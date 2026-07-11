import React from "react";
import { Card, Pill, StatTile } from "../components/ui";

export default function Dashboard({ profile }) {
  if (!profile) return null;
  const numericCols = profile.stats.filter((s) => s.type === "numeric");
  const catCols = profile.stats.filter((s) => s.type === "categorical");
  const totalMissing = profile.stats.reduce((a, s) => a + (s.missing || 0), 0);
  const completeness =
    profile.rows * profile.columns.length > 0
      ? (
          100 -
          (totalMissing / (profile.rows * profile.columns.length)) * 100
        ).toFixed(1)
      : "100";

  return (
    <div className="fade-in">
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatTile icon="📦" label="Total Rows" value={profile.rows.toLocaleString()} />
        <StatTile icon="🧱" label="Columns" value={profile.columns.length} />
        <StatTile
          icon="🔢"
          label="Numeric Features"
          value={numericCols.length}
          delta={`${catCols.length} categorical`}
        />
        <StatTile
          icon="✨"
          label="Data Completeness"
          value={`${completeness}%`}
          delta={totalMissing > 0 ? `${totalMissing} missing` : "no gaps"}
          deltaDir={totalMissing > 0 ? "down" : "up"}
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <Card title="Column Profile" sub="Detected types & key statistics">
          <div className="table-wrap" style={{ maxHeight: 340 }}>
            <table>
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Mean / Top</th>
                  <th>Range / Unique</th>
                  <th>Missing</th>
                </tr>
              </thead>
              <tbody>
                {profile.stats.map((s) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>
                      <Pill type={s.type}>{s.type}</Pill>
                    </td>
                    <td>
                      {s.type === "numeric"
                        ? s.mean?.toLocaleString()
                        : s.top?.[0]
                        ? `${s.top[0].value} (${s.top[0].count})`
                        : "—"}
                    </td>
                    <td>
                      {s.type === "numeric"
                        ? `${s.min?.toLocaleString()} – ${s.max?.toLocaleString()}`
                        : `${s.unique ?? "—"} unique`}
                    </td>
                    <td style={{ color: s.missing ? "var(--warn)" : "var(--text-faint)" }}>
                      {s.missing || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Distribution Snapshot" sub="Top categories across categorical fields">
          {catCols.length === 0 && (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
              No categorical columns detected in this dataset.
            </div>
          )}
          {catCols.slice(0, 4).map((c) => {
            const max = Math.max(...(c.top || []).map((t) => t.count), 1);
            return (
              <div key={c.name} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{c.name}</div>
                {(c.top || []).map((t) => (
                  <div key={t.value} style={{ marginBottom: 7 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 3,
                        color: "var(--text-dim)",
                      }}
                    >
                      <span>{t.value}</span>
                      <span>{t.count}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(t.count / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
      </div>

      <Card title="Data Preview" sub={`First ${Math.min(50, profile.rows)} rows`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {profile.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profile.preview.map((row, i) => (
                <tr key={i}>
                  {profile.columns.map((c) => (
                    <td key={c}>{formatCell(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function formatCell(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v : v.toFixed(2);
  if (typeof v === "string" && v.length > 24) return v.slice(0, 24) + "…";
  return String(v);
}
