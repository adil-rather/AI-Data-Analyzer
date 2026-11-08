import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronsLeftRight } from "lucide-react";
import { fmt } from "../lib";
export default function DataTable({
  columns,
  rows,
  label = "Data table",
  pageSize: providedPageSize,
  onSelect,
  selected,
}) {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 620px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 620px)");
    const change = () => setCompact(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const pageSize = providedPageSize || (compact ? 5 : 10);
  const [requested, setPage] = useState(0),
    page = Math.min(
      requested,
      Math.max(0, Math.ceil(rows.length / pageSize) - 1),
    );
  const shown = rows.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <div className="data-table">
      <div
        className="table-scroll"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`${c.type === "numeric" ? "numeric" : ""} ${selected === c.key ? "selected" : ""}`}
                >
                  {onSelect && c.selectable !== false ? (
                    <button
                      onClick={() => onSelect(c.key)}
                      aria-pressed={selected === c.key}
                    >
                      {c.label || c.key}
                    </button>
                  ) : (
                    c.label || c.key
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              <tr key={page * pageSize + index}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={c.type === "numeric" ? "numeric" : ""}
                    title={
                      row[c.key] == null ? "Missing value" : String(row[c.key])
                    }
                  >
                    {c.render ? (
                      c.render(row[c.key], row)
                    ) : row[c.key] == null ? (
                      <span className="missing">—</span>
                    ) : typeof row[c.key] === "number" ? (
                      fmt(row[c.key])
                    ) : c.type === "datetime" ? (
                      String(row[c.key]).replace(
                        /T00:00:00(?:\.000)?(?:\+00:00|Z)?$/,
                        "",
                      )
                    ) : (
                      String(row[c.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="table-empty">No rows to display.</p>}
      </div>
      <p className="table-scroll-hint">
        <ChevronsLeftRight size={15} />
        Scroll the table to see more columns
      </p>
      {rows.length > pageSize && (
        <div className="pagination">
          <button
            className="button small secondary"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ArrowLeft size={15} />
            <span>Previous</span>
          </button>
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)}{" "}
            of {fmt(rows.length, 0)}{" "}
            {label === "Dataset preview" ? "preview " : ""}rows
          </span>
          <button
            className="button small secondary"
            disabled={(page + 1) * pageSize >= rows.length}
            onClick={() => setPage(page + 1)}
          >
            <span>Next</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
