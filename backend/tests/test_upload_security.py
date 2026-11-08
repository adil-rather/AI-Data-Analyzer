import io
import zipfile
import struct

import pandas as pd
import pytest

from conftest import upload_csv


def workbook():
    buffer = io.BytesIO()
    pd.DataFrame({"value": [1, 2]}).to_excel(buffer, index=False)
    return buffer.getvalue()


@pytest.mark.parametrize(
    "entry",
    [
        "xl/vbaProject.bin",
        "xl/externalLinks/externalLink1.xml",
        "xl/embeddings/oleObject1.bin",
        "xl/activeX/activeX1.xml",
    ],
)
def test_rejects_active_content_even_when_renamed_xlsx(client, entry):
    buffer = io.BytesIO(workbook())
    with zipfile.ZipFile(buffer, "a") as archive:
        archive.writestr(entry, b"synthetic test marker")
    response = client.post(
        "/api/upload", files={"file": ("unsafe.xlsx", buffer.getvalue())}
    )
    assert response.status_code == 400
    assert "active" in response.json()["detail"].lower()


def test_rejects_formula_workbook(client):
    buffer = io.BytesIO()
    pd.DataFrame({"value": ["=1+1", 3]}).to_excel(buffer, index=False)
    response = client.post(
        "/api/upload", files={"file": ("formula.xlsx", buffer.getvalue())}
    )
    assert response.status_code == 400
    assert "formula" in response.json()["detail"].lower()


def test_binary_disguised_as_csv_rejected(client):
    response = upload_csv(client, "value\nMZ\x00\x01binary")
    assert response.status_code == 400
    assert "text" in response.json()["detail"].lower()


def test_oversized_cell_rejected(client):
    response = upload_csv(client, "value\n" + "x" * 10001)
    assert response.status_code == 413


def test_excel_expansion_limit(client):
    buffer = io.BytesIO(workbook())
    with zipfile.ZipFile(buffer, "a", compression=zipfile.ZIP_DEFLATED) as archive:
        with archive.open("xl/oversized.xml", "w") as member:
            for _ in range(257):
                member.write(b"x" * (1024 * 1024))
    response = client.post(
        "/api/upload", files={"file": ("expanded.xlsx", buffer.getvalue())}
    )
    assert response.status_code == 413


@pytest.mark.parametrize("field,value", [(10, 3000), (12, 2 * 1024 * 1024)])
def test_excel_directory_is_checked_before_zip_metadata_allocation(
    client, monkeypatch, field, value
):
    import dataset_engine

    raw = bytearray(workbook())
    offset = raw.rfind(b"PK\x05\x06")
    struct.pack_into("<H" if field == 10 else "<I", raw, offset + field, value)
    original = dataset_engine.zipfile.ZipFile
    opened = []

    def recorded(*args, **kwargs):
        opened.append(True)
        return original(*args, **kwargs)

    monkeypatch.setattr(dataset_engine.zipfile, "ZipFile", recorded)
    response = client.post("/api/upload", files={"file": ("metadata.xlsx", bytes(raw))})
    assert response.status_code == 413
    assert opened == []


def test_only_one_multipart_file_is_accepted(client):
    response = client.post(
        "/api/upload",
        files=[("file", ("one.csv", b"a\n1")), ("file", ("two.csv", b"a\n2"))],
    )
    assert response.status_code == 400


def test_extra_multipart_fields_are_rejected(client):
    response = client.post(
        "/api/upload",
        data={"extra": "not accepted"},
        files={"file": ("one.csv", b"a\n1")},
    )
    assert response.status_code == 400


def test_multipart_header_size_is_bounded(client):
    body = (
        b'--fixture\r\nContent-Disposition: form-data; name="file"; filename="one.csv"\r\nX-Extra: '
        + b"x" * 6000
        + b"\r\nContent-Type: text/csv\r\n\r\na\n1\r\n--fixture--\r\n"
    )
    response = client.post(
        "/api/upload",
        content=body,
        headers={"Content-Type": "multipart/form-data; boundary=fixture"},
    )
    # Either our header budget or the upstream parser's stricter malformed-
    # metadata guard can reject first; neither may reach table ingestion.
    assert response.status_code in {400, 413}


def test_low_disk_remains_an_actionable_503(client, monkeypatch):
    import main
    from fastapi import HTTPException

    def full(*args):
        raise HTTPException(503, "Temporary server storage is nearly full.")

    monkeypatch.setattr(main, "capacity_check", full)
    response = client.post("/api/upload", files={"file": ("one.csv", b"a\n1")})
    assert response.status_code == 503
    assert "storage" in response.json()["detail"].lower()
