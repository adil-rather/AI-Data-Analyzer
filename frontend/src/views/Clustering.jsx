import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { api } from "../api";
import { Card, Field, Metric, Spinner } from "../components/ui";

const PALETTE = ["#6c8bff", "#2ee6c5", "#b06cff", "#ff7eb6", "#fbbd23", "#36d399", "#ff9f43"];

export default function Clustering({ profile, datasetId }) {
  const numericCols = useMemo(
    () => profile.stats.filter((s) => s.type === "numeric").map((s) => s.name),
    [profile]
  );
  const [features, setFeatures] = useState(numericCols.slice(0, 2));
  const [clusters, setClusters] = useState(3);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (features.length < 2) {
      setError("Select at least two features");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api.cluster({ datasetId, features, clusters: Number(clusters) });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleFeature(f) {
    setFeatures((cur) =>
      cur.includes(f) ? cur.filter((x) => x !== f) : cur.length < 4 ? [...cur, f] : cur
    );
  }

  return (
    <div className="fade-in">
      <div className="controls">
        <Field label="Features (max 4)">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {numericCols.map((c) => (
              <button
                key={c}
                onClick={() => toggleFeature(c)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  cursor: "pointer",
                  border: "1px solid var(--border-strong)",
                  background: features.includes(c) ? "var(--grad-soft)" : "transparent",
                  color: features.includes(c) ? "var(--text)" : "var(--text-dim)",
                  fontFamily: "inherit",
                }}
              >
                {features.includes(c) ? "✓ " : ""}
                {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Clusters (k)">
          <input
            type="number"
            min="2"
            max="8"
            value={clusters}
            onChange={(e) => setClusters(e.target.value)}
            style={{ width: 90 }}
          />
        </Field>
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? "Clustering…" : "🧩 Run K-Means"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(248,114,114,0.12)",
            border: "1px solid rgba(248,114,114,0.3)",
            color: "#ffb0b0",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ⚠️ {error}
        </div>
      )}
      {busy && <Spinner label="Segmenting data with K-Means…" />}

      {result && !busy && (
        <>
          <div className="metric-row">
            <Metric k="Clusters" v={result.clusters} />
            <Metric k="Silhouette" v={result.silhouette.toFixed(3)} />
            <Metric k="Points" v={result.points.length.toLocaleString()} />
            <Metric
              k="Largest Segment"
              v={`${Math.max(...Object.values(result.sizes))} pts`}
            />
          </div>

          <div className="grid grid-3">
            <Card
              title="Cluster Map"
              sub="PCA projection of your selected features"
              className="slide-in"
              style={{ gridColumn: "span 2" }}
            >
              <ResponsiveContainer width="100%" height={380}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="rgba(120,140,200,0.1)" />
                  <XAxis type="number" stroke="#5e688a" fontSize={11} name="PC1" />
                  <YAxis type="number" stroke="#5e688a" fontSize={11} name="PC2" />
                  <ZAxis range={[40, 40]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    wrapperClassName="chart-tooltip"
                    content={<ClusterTip features={result.features} />}
                  />
                  {Object.keys(result.sizes).map((c) => (
                    <Scatter
                      key={c}
                      name={`Cluster ${c}`}
                      data={result.points.filter((p) => String(p.cluster) === c)}
                      fill={PALETTE[c % PALETTE.length]}
                      fillOpacity={0.75}
                      className="cluster-dot"
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="legend">
                {Object.keys(result.sizes).map((c) => (
                  <span key={c}>
                    <span
                      className="swatch"
                      style={{ background: PALETTE[c % PALETTE.length] }}
                    />
                    Cluster {c} · {result.sizes[c]} pts
                  </span>
                ))}
              </div>
            </Card>

            <Card title="Segment Centroids" sub="Mean feature values per cluster">
              <div className="table-wrap" style={{ maxHeight: 320 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Cluster</th>
                      {result.features.map((f) => (
                        <th key={f}>{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.centroids.map((cen, i) => (
                      <tr key={i}>
                        <td>
                          <span
                            className="swatch"
                            style={{
                              background: PALETTE[i % PALETTE.length],
                              display: "inline-block",
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              marginRight: 6,
                            }}
                          />
                          {i}
                        </td>
                        {result.features.map((f) => (
                          <td key={f}>{cen[f]?.toFixed ? cen[f].toFixed(1) : cen[f]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      {!result && !busy && (
        <Card>
          <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: 30 }}>
            Choose numeric features and run K-Means to discover natural groupings.
          </div>
        </Card>
      )}
    </div>
  );
}

function ClusterTip({ active, payload, features }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Cluster {p.cluster}</div>
      {features.map((f) => (
        <div key={f}>
          {f}: <b>{p[f]?.toFixed ? p[f].toFixed(2) : p[f]}</b>
        </div>
      ))}
    </div>
  );
}
