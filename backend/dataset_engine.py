"""Disk-backed tables; full-dataset profiles, bounded model materialization."""

import codecs
import csv
from pathlib import Path
import re
import shutil
import struct
import tempfile
import zipfile
from threading import RLock

from defusedxml.ElementTree import iterparse
import duckdb
from fastapi import HTTPException
from openpyxl import load_workbook

from tabular import value

MODEL_ROWS = 25000
MAX_COLUMNS = 100
DISK_RESERVE = 128 * 1024 * 1024


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def validate_headers(headers):
    clean = [str(c).strip() if c is not None else "" for c in headers]
    if (
        not clean
        or any(not c or len(c) > 200 for c in clean)
        or len({c.casefold() for c in clean}) != len(clean)
    ):
        raise HTTPException(
            400,
            "Column names must be non-empty, unique and no longer than 200 characters.",
        )
    if len(clean) > MAX_COLUMNS:
        raise HTTPException(
            413,
            "Use at most 100 columns per table. Export the fields needed for analysis.",
        )
    return clean


def capacity_check(folder, upcoming=0):
    if shutil.disk_usage(folder).free < DISK_RESERVE + upcoming:
        raise HTTPException(
            503,
            "Temporary server storage is nearly full. Try later or run the project locally with more disk space.",
        )


def inspect_zip_directory(path):
    # ZipFile materializes its central directory during construction. Check the
    # bounded end record first so an entry-count guard is not applied too late.
    with path.open("rb") as file:
        if file.read(4) != b"PK\x03\x04":
            raise HTTPException(400, "Choose an ordinary, unencrypted .xlsx workbook.")
        file.seek(0, 2)
        size = file.tell()
        file.seek(max(0, size - 65557))
        tail = file.read(65557)
    offset = tail.rfind(b"PK\x05\x06")
    if offset < 0 or offset + 22 > len(tail):
        raise HTTPException(400, "The Excel archive directory is incomplete.")
    _, disk, start_disk, on_disk, total, directory_bytes, _, comment = (
        struct.unpack_from("<4s4H2IH", tail, offset)
    )
    if offset + 22 + comment != len(tail) or disk or start_disk:
        raise HTTPException(
            400,
            "Unsupported Excel archive structure. Export a values-only table as CSV.",
        )
    if max(on_disk, total) > 2048 or directory_bytes > 1024 * 1024:
        raise HTTPException(
            413,
            "Excel archive metadata exceeds the safe parsing budget. Export a values-only CSV instead.",
        )


def inspect_excel(path):
    inspect_zip_directory(path)
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        # Expanded workbook size guards XML/ZIP bombs; use CSV for very large tables.
        if len(members) > 2048 or sum(m.file_size for m in members) > 256 * 1024 * 1024:
            raise HTTPException(
                413,
                "Expanded Excel content exceeds the safe workbook parsing budget. Export the table as CSV for large-data support.",
            )
        names = [m.filename for m in members]
        if len(set(names)) != len(names) or any(
            ".." in n.split("/") or "\\" in n for n in names
        ):
            raise HTTPException(400, "This Excel archive has an invalid structure.")
        active = (
            "vbaproject",
            "activex",
            "embeddings/",
            "externallinks/",
            "connections.xml",
            "customui/",
            "querytables/",
        )
        if any(any(p in n.lower() for p in active) for n in names):
            raise HTTPException(
                400,
                "Active workbook content is not supported. Export a plain values-only table.",
            )
        for member in members:
            if member.flag_bits & 1:
                raise HTTPException(400, "Encrypted Excel files are not supported.")
            if member.filename.lower().endswith((".xml", ".rels")):
                with archive.open(member) as stream:
                    for _, node in iterparse(stream, events=("end",)):
                        if node.tag.rsplit("}", 1)[-1] == "f":
                            raise HTTPException(
                                400,
                                "Formula workbooks are not supported. Paste values into a clean sheet or export CSV.",
                            )
                        if node.attrib.get(
                            "TargetMode", ""
                        ).lower() == "external" or any(
                            "macroenabled" in str(v).lower()
                            for v in node.attrib.values()
                        ):
                            raise HTTPException(
                                400,
                                "Active or externally linked workbook content is not supported.",
                            )
                        node.clear()


class TableData:
    def __init__(self):
        self._temp = tempfile.TemporaryDirectory(prefix="rather-analyzer-")
        self.folder = Path(self._temp.name)
        self.path = self.folder / "dataset.duckdb"
        self.profile = None
        self._lock = RLock()
        self._closed = False
        self.order_column = "__rb_position"

    def connect(self, read_only=False):
        if self._closed:
            raise HTTPException(404, "Dataset expired. Upload or load a sample again.")
        con = duckdb.connect(str(self.path), read_only=read_only)
        con.execute("SET threads=1")
        con.execute("SET memory_limit='96MB'")
        con.execute("SET preserve_insertion_order=true")
        con.execute(
            "SET enable_external_access=false"
            if read_only
            else "SET autoinstall_known_extensions=false"
        )
        return con

    def close(self):
        with self._lock:
            if not self._closed:
                self._temp.cleanup()
                self._closed = True

    @classmethod
    def from_upload(cls, stream, name):
        table = cls()
        suffix = Path(name).suffix.lower()
        try:
            if suffix not in {".csv", ".xlsx"}:
                raise HTTPException(
                    415, "Choose UTF-8 CSV or .xlsx. Save legacy .xls as .xlsx first."
                )
            original = table.folder / ("upload" + suffix)
            decoder = (
                codecs.getincrementaldecoder("utf-8-sig")()
                if suffix == ".csv"
                else None
            )
            with original.open("wb") as output:
                while chunk := stream.read(1024 * 1024):
                    capacity_check(table.folder, len(chunk) * 3)
                    if decoder:
                        text = decoder.decode(chunk)
                        if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", text):
                            raise HTTPException(
                                400,
                                "CSV must contain ordinary UTF-8 text, not binary or control characters.",
                            )
                    output.write(chunk)
                if decoder:
                    decoder.decode(b"", final=True)
            if original.stat().st_size == 0:
                raise HTTPException(400, "This file is empty.")
            csv_path = original
            if suffix == ".xlsx":
                inspect_excel(original)
                csv_path = table.folder / "values.csv"
                book = load_workbook(
                    original, read_only=True, data_only=True, keep_links=False
                )
                try:
                    sheet = book.worksheets[0]
                    if sheet.max_column and sheet.max_column > MAX_COLUMNS:
                        raise HTTPException(
                            413,
                            "This worksheet is too wide. Export at most 100 columns.",
                        )
                    with csv_path.open("w", newline="", encoding="utf-8") as output:
                        writer = csv.writer(output)
                        for index, row in enumerate(sheet.iter_rows(values_only=True)):
                            if index % 10000 == 0:
                                capacity_check(table.folder, 16 * 1024 * 1024)
                            writer.writerow(row)
                finally:
                    book.close()
            with csv_path.open(encoding="utf-8-sig", newline="") as text:
                headers = validate_headers(next(csv.reader(text), []))
            while table.order_column.casefold() in {c.casefold() for c in headers}:
                table.order_column += "_"
            with table.connect() as con:
                con.read_csv(
                    str(csv_path),
                    header=True,
                    sample_size=-1,
                    max_line_size=1024 * 1024,
                    na_values=["", "NA", "NaN", "nan", "NULL"],
                    parallel=False,
                ).create_view("incoming")
                schema = con.execute("DESCRIBE incoming").fetchall()
                if len(schema) != len(headers):
                    raise HTTPException(
                        400, "The table header does not match its rows."
                    )
                parts = []
                for (column, kind, *_), clean in zip(schema, headers):
                    expr = (
                        f"CASE WHEN isfinite({quote(column)}) THEN {quote(column)} ELSE NULL END"
                        if is_numeric(kind)
                        else quote(column)
                    )
                    parts.append(f"{expr} AS {quote(clean)}")
                con.execute(
                    f"CREATE TABLE data AS SELECT row_number() OVER () - 1 AS {quote(table.order_column)}, "
                    + ",".join(parts)
                    + " FROM incoming"
                )
                table.profile = build_profile(con, name, "upload", table.order_column)
            original.unlink(missing_ok=True)
            if csv_path != original:
                csv_path.unlink(missing_ok=True)
            return table
        except HTTPException:
            table.close()
            raise
        except UnicodeError:
            table.close()
            raise HTTPException(
                400, "CSV must use UTF-8 encoding. Save as UTF-8 CSV and try again."
            ) from None
        except Exception:
            table.close()
            raise HTTPException(
                400,
                "Could not safely read this table. Check its header, row structure and format; for large Excel files use CSV.",
            ) from None

    @classmethod
    def from_frame(cls, frame, name, source="sample"):
        table = cls()
        try:
            while table.order_column.casefold() in {
                str(c).casefold() for c in frame.columns
            }:
                table.order_column += "_"
            with table.connect() as con:
                con.register("incoming", frame)
                con.execute(
                    f"CREATE TABLE data AS SELECT row_number() OVER () - 1 AS {quote(table.order_column)}, * FROM incoming"
                )
                table.profile = build_profile(con, name, source, table.order_column)
            return table
        except Exception:
            table.close()
            raise

    def model_frame(self, kind, req):
        total = self.profile["rows"]
        stats = {s["name"]: s for s in self.profile["stats"]}
        if kind == "forecast":
            columns = list(
                dict.fromkeys(
                    [req.target] + ([req.dateColumn] if req.dateColumn else [])
                )
            )
            numeric = [req.target]
        elif kind in {"cluster", "classify"}:
            numeric = req.features
            columns = list(
                dict.fromkeys(
                    req.features + ([req.target] if kind == "classify" else [])
                )
            )
            if len(set(req.features)) != len(req.features):
                raise HTTPException(400, "Choose distinct numeric features.")
            if kind == "classify" and req.target in req.features:
                raise HTTPException(400, "The target cannot also be a predictor.")
        else:
            columns = numeric = [c for c in stats if stats[c]["type"] == "numeric"]
        if not columns or any(c not in stats for c in columns):
            raise HTTPException(
                400,
                "Choose existing columns; numeric fields are required for analysis.",
            )
        if any(stats[c]["type"] != "numeric" for c in numeric):
            raise HTTPException(
                400, "Every predictor and forecast target must be numeric."
            )
        if kind == "classify":
            target = stats[req.target]
            if not 2 <= target["unique"] <= 20:
                raise HTTPException(400, "Choose a target with 2–20 distinct classes.")
            if target.get("maxLength", 0) > 200:
                raise HTTPException(
                    400,
                    "Category labels must be at most 200 characters. Shorten the target labels before classification.",
                )
        selected = (
            quote(self.order_column)
            + " AS __rb_index, "
            + ",".join(quote(c) for c in columns)
        )
        with self._lock, self.connect(read_only=True) as con:
            if self._closed:
                raise HTTPException(
                    404, "Dataset expired. Upload or load a sample again."
                )
            if total <= MODEL_ROWS:
                frame = con.execute(
                    f"SELECT {selected} FROM data ORDER BY {quote(self.order_column)}"
                ).df()
                method = "All rows"
            elif kind == "forecast":
                column = req.dateColumn
                if column and column not in self.profile["columns"]:
                    raise HTTPException(400, "Choose an existing date column.")
                order = (
                    f"TRY_CAST({quote(column)} AS TIMESTAMP)"
                    if column
                    else quote(self.order_column)
                )
                frame = (
                    con.execute(
                        f"SELECT {selected} FROM data ORDER BY {order} DESC LIMIT {MODEL_ROWS}"
                    )
                    .df()
                    .iloc[::-1]
                )
                method = (
                    "Most recent 25,000 observations"
                    if column
                    else "Last 25,000 rows in file order"
                )
            else:
                frame = con.execute(
                    f"SELECT {selected} FROM data USING SAMPLE reservoir({MODEL_ROWS} ROWS) REPEATABLE(42)"
                ).df()
                method = "Deterministic reservoir sample"
        # Avoid collision with uploaded '__row' by renaming metadata immediately.
        frame.index = frame.iloc[:, 0].to_numpy()
        frame = frame.iloc[:, 1:]
        frame.columns = columns
        return frame, {
            "sourceRows": total,
            "analyzedRows": len(frame),
            "method": method,
        }


def is_numeric(kind):
    return any(
        kind.startswith(t)
        for t in (
            "TINYINT",
            "SMALLINT",
            "INTEGER",
            "BIGINT",
            "HUGEINT",
            "UTINYINT",
            "USMALLINT",
            "UINTEGER",
            "UBIGINT",
            "UHUGEINT",
            "FLOAT",
            "DOUBLE",
            "DECIMAL",
        )
    )


def build_profile(con, name, source, order_column):
    rows = con.execute("SELECT count(*) FROM data").fetchone()[0]
    if not rows:
        raise HTTPException(400, "This file contains no data rows.")
    schema = [
        item
        for item in con.execute("DESCRIBE data").fetchall()
        if item[0] != order_column
    ]
    stats, types = [], {}
    for column, kind, *_ in schema:
        q = quote(column)
        numeric = is_numeric(kind)
        date_kind = kind.startswith(("DATE", "TIME"))
        # Approximate distinct counts avoid unbounded hash sets on high-cardinality fields.
        distinct = (
            f"approx_count_distinct({q})"
            if rows > MODEL_ROWS
            else f"count(DISTINCT {q})"
        )
        count, unique = con.execute(
            f"SELECT count({q}), {distinct} FROM data"
        ).fetchone()
        unique_approximate = rows > MODEL_ROWS
        if unique_approximate and unique <= 100:
            unique = con.execute(f"SELECT count(DISTINCT {q}) FROM data").fetchone()[0]
            unique_approximate = False
        field_type = (
            "numeric"
            if numeric
            else "datetime"
            if date_kind
            else "categorical"
            if unique <= max(20, 0.2 * count)
            else "text"
        )
        types[column] = field_type
        stat = {
            "name": column,
            "type": field_type,
            "count": count,
            "missing": rows - count,
            "unique": unique,
            "uniqueApproximate": unique_approximate,
        }
        if numeric:
            expressions = [
                f"avg({q})",
                f"stddev_samp({q})",
                f"min({q})",
                f"max({q})",
                f"{'approx_quantile' if rows > MODEL_ROWS else 'quantile_cont'}({q},0.5)",
            ]
            mean, std, low, high, median = con.execute(
                "SELECT " + ",".join(expressions) + " FROM data"
            ).fetchone()
            stat.update(
                {
                    k: value(v)
                    for k, v in zip(
                        ["mean", "std", "min", "max", "median"],
                        [mean, std, low, high, median],
                    )
                }
            )
            stat["medianApproximate"] = rows > MODEL_ROWS
            if low is not None and high is not None:
                if abs(float(low)) > 1e100 or abs(float(high)) > 1e100:
                    raise HTTPException(
                        400,
                        "Numeric magnitudes exceed the stable analysis range. Rescale values below 1e100.",
                    )
                bins = 1 if low == high else 12
                expression = (
                    "0"
                    if bins == 1
                    else f"least(11, greatest(0, floor(({q} - ?) / ? * 12)))::INTEGER"
                )
                args = [] if bins == 1 else [float(low), float(high) - float(low)]
                counts = dict(
                    con.execute(
                        f"SELECT {expression} AS bucket, count(*) FROM data WHERE {q} IS NOT NULL GROUP BY bucket",
                        args,
                    ).fetchall()
                )
                width = (float(high) - float(low)) / bins
                stat["histogram"] = [
                    {
                        "start": value(float(low) + i * width),
                        "end": value(float(low) + (i + 1) * width),
                        "count": counts.get(i, 0),
                    }
                    for i in range(bins)
                ]
            else:
                stat["histogram"] = []
        else:
            stat["maxLength"] = (
                con.execute(
                    f"SELECT max(length(CAST({q} AS VARCHAR))) FROM data"
                ).fetchone()[0]
                or 0
            )
            if (
                not date_kind
                and con.execute(
                    f"SELECT 1 FROM data WHERE length(CAST({q} AS VARCHAR)) > 8192 LIMIT 1"
                ).fetchone()
            ):
                raise HTTPException(
                    413, "Text cells must be no longer than 8,192 characters."
                )
            top = con.execute(
                f"SELECT {q},count(*) AS n FROM data WHERE {q} IS NOT NULL GROUP BY {q} ORDER BY n DESC LIMIT 8"
            ).fetchall()
            stat["top"] = [{"value": preview_value(v), "count": n} for v, n in top]
        stats.append(stat)
    columns = [s[0] for s in schema]
    preview = [
        dict(zip(columns, map(preview_value, row)))
        for row in con.execute(
            "SELECT "
            + ",".join(quote(c) for c in columns)
            + f" FROM data ORDER BY {quote(order_column)} LIMIT 50"
        ).fetchall()
    ]
    return {
        "name": name,
        "source": source,
        "rows": rows,
        "columns": columns,
        "types": types,
        "stats": stats,
        "preview": preview,
        "missingCells": sum(s["missing"] for s in stats),
        "modelSampleLimit": MODEL_ROWS,
        "previewTextLimit": 256,
    }


def preview_value(item):
    converted = value(item)
    return (
        converted[:256] + "…"
        if isinstance(converted, str) and len(converted) > 256
        else converted
    )
