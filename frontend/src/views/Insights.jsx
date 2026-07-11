import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Metric, Spinner } from "../components/ui";

export default function Insights({ profile, datasetId }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!datasetId) return;
    let alive = true;
    setBusy(true);
    api
      .insights({ datasetId, threshold: 3.0 })
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [datasetId]);

  if (busy) return <Spinner label="Scanning for patterns & anomalies…" />;
  if (error)
    return (
      <Card>
        <div style={{ color: "#ffb0b0", fontSize: 13 }}>⚠️ {error}</div>
      </Card>
    );
  if (!result) return null;

  const cols = result.numericColumns;
  const matrix = result.correlationMatrix;

  return (
    <div className="fade-in">
      <div className="metric-row">
        <Metric k="Numeric Columns" v={cols.length} />
        <Metric k="Strong Correlations" v={result.topPairs.filter((p) => Math.abs(p.correlation) > 0.5).length} />
        <Metric k="Anomalies Detected" v={result.anomalies.count} />
        <Metric k="Total Cells Analyzed" v={cols.length * profile.rows} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <Card title="Correlation Heatmap" sub="Pearson correlation across numeric features">
          {cols.length >= 2 ? (
            <Heatmap cols={cols} matrix={matrix} />
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Need at least two numeric columns for correlations.
            </div>
          )}
        </Card>

        <Card title="Top Correlated Pairs" sub="Strongest relationships in your data">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.topPairs.slice(0, 8).map((p, i) => {
              const strong = Math.abs(p.correlation) > 0.5;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "var(--panel-solid)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {p.a} ↔ {p.b}
                    </div>
                    <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
                      {[0.2, 0.4, 0.6, 0.8, 1].map((step) => (
                        <div
                          key={step}
                          style={{
                            flex: 1,
                            height: 5,
                            borderRadius: 3,
                            background:
                              Math.abs(p.correlation) >= step
                                ? p.correlation > 0
                                  ? "var(--accent-3)"
                                  : "var(--accent-4)"
                                : "rgba(120,140,200,0.15)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontWeight: 700,
                      fontSize: 16,
                      color: strong ? "var(--accent-3)" : "var(--text-dim)",
                      minWidth: 52,
                      textAlign: "right",
                    }}
                  >
                    {p.correlation > 0 ? "+" : ""}
                    {p.correlation?.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Anomaly Detection" sub={`Rows flagged by |z-score| > 3.0 (threshold)`}>
          {result.anomalies.count === 0 ? (
            <div style={{ color: "var(--good)", fontSize: 13 }}>
              ✓ No significant anomalies detected in numeric columns.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-dim)" }}>
                Found <b style={{ color: "var(--bad)" }}>{result.anomalies.count}</b> anomalous
                rows. Showing first {result.anomalies.rows.length}:
              </div>
              <div className="table-wrap" style={{ maxHeight: 300 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Score</th>
                      <th>Sample values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.anomalies.rows.map((r, i) => {
                      const vals = Object.entries(r)
                        .filter(([k]) => !k.startsWith("_"))
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ");
                      return (
                        <tr key={i}>
                          <td style={{ color: "var(--accent-4)", fontWeight: 600 }}>
                            {r._anomalyColumn}
                          </td>
                          <td style={{ color: "var(--bad)", fontWeight: 700 }}>
                            {r._anomalyScore?.toFixed(2)}
                          </td>
                          <td style={{ color: "var(--text-dim)", fontSize: 11.5 }}>{vals}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <Card title="Key Drivers" sub="Per-column spread & skew">
          <div className="table-wrap" style={{ maxHeight: 300 }}>
            <table>
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Mean</th>
                  <th>Std</th>
                  <th>Range</th>
                  <th>Skew</th>
                </tr>
              </thead>
              <tbody>
                {result.columnStats.map((c) => (
                  <tr key={c.name}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.mean?.toFixed(1)}</td>
                    <td>{c.std?.toFixed(1)}</td>
                    <td>
                      {c.min?.toFixed(1)} – {c.max?.toFixed(1)}
                    </td>
                    <td style={{ color: Math.abs(c.skew) > 1 ? "var(--warn)" : "var(--text-dim)" }}>
                      {c.skew?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function corrColor(v) {
  // diverging blue(-) -> neutral -> teal(+)
  if (v > 0) {
    const a = 0.12 + v * 0.78;
    return `rgba(46,230,197,${a})`;
  }
  const a = 0.12 + Math.abs(v) * 0.78;
  return `rgba(108,139,255,${a})`;
}

function Heatmap({ cols, matrix }) {
  const n = cols.length;
  return (
    <div style={{ overflowX: "auto" }}>
      <div
        className="heatmap"
        style={{
          gridTemplateColumns: `minmax(70px,auto) repeat(${n}, 1fr)`,
          minWidth: 70 + n * 46,
        }}
      >
        <div className="heat-corner" />
        {cols.map((c) => (
          <div key={"h" + c} className="heat-label" style={{ justifyContent: "center" }}>
            {c}
          </div>
        ))}
        {cols.map((rowC, i) => (
          <React.Fragment key={"r" + rowC}>
            <div className="heat-label">{rowC}</div>
            {cols.map((colC, j) => {
              const v = matrix[i]?.[j] ?? 0;
              return (
                <div
                  key={j}
                  className="heat-cell"
                  title={`${rowC} × ${colC}: ${v.toFixed(2)}`}
                  style={{
                    background: corrColor(v),
                    color: Math.abs(v) > 0.55 ? "#06121f" : "#dfe6ff",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {v.toFixed(1)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
