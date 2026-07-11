import React, { useMemo, useState } from "react";
import { api } from "../api";
import { Card, Field, Metric, Spinner } from "../components/ui";

export default function Classification({ profile, datasetId }) {
  const numericCols = useMemo(
    () => profile.stats.filter((s) => s.type === "numeric").map((s) => s.name),
    [profile]
  );
  const catCols = useMemo(
    () => profile.stats.filter((s) => s.type !== "numeric").map((s) => s.name),
    [profile]
  );
  const [features, setFeatures] = useState(numericCols);
  const [target, setTarget] = useState(catCols[catCols.length - 1] || "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!target) {
      setError("Pick a categorical target");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api.classify({ datasetId, features, target });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleFeature(f) {
    setFeatures((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }

  return (
    <div className="fade-in">
      <div className="controls">
        <Field label="Target (what to predict)">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— select —</option>
            {catCols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {numericCols.map((c) => (
              <option key={c} value={c} style={{ color: "#5e688a" }}>
                {c} (numeric)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Features">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 620 }}>
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
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? "Training…" : "🎯 Train Model"}
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
      {busy && <Spinner label="Training RandomForest classifier…" />}

      {result && !busy && (
        <>
          <div className="metric-row">
            <Metric k="Accuracy" v={(result.accuracy * 100).toFixed(1) + "%"} />
            <Metric k="Precision" v={(result.precision * 100).toFixed(1) + "%"} />
            <Metric k="Recall" v={(result.recall * 100).toFixed(1) + "%"} />
            <Metric k="F1 Score" v={(result.f1 * 100).toFixed(1) + "%"} />
            <Metric k="Test Set" v={result.testSize} />
          </div>

          <div className="grid grid-2">
            <Card title="Confusion Matrix" sub={`Predicted vs actual · classes = ${result.classes.length}`}>
              <ConfusionMatrix
                matrix={result.confusionMatrix}
                classes={result.classes}
              />
            </Card>

            <Card title="Feature Importance" sub="What drove the predictions">
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
                {result.featureImportances.map((fi) => (
                  <div key={fi.feature}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12.5,
                        marginBottom: 4,
                        color: "var(--text-dim)",
                      }}
                    >
                      <span>{fi.feature}</span>
                      <span style={{ color: "var(--text)" }}>{(fi.importance * 100).toFixed(1)}%</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${Math.max(2, fi.importance * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {!result && !busy && (
        <Card>
          <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: 30 }}>
            Select a categorical target and train a RandomForest to predict labels.
          </div>
        </Card>
      )}
    </div>
  );
}

function ConfusionMatrix({ matrix, classes }) {
  const max = Math.max(...matrix.flat(), 1);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ minWidth: 260 }}>
        <thead>
          <tr>
            <th></th>
            {classes.map((c, i) => (
              <th key={i} style={{ textAlign: "center" }}>
                P{c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th style={{ color: "var(--text-dim)" }}>A{classes[i]}</th>
              {row.map((v, j) => {
                const isDiag = i === j;
                const op = 0.15 + (v / max) * 0.7;
                return (
                  <td key={j} style={{ textAlign: "center", padding: 6 }}>
                    <div
                      style={{
                        background: isDiag
                          ? `rgba(54,211,153,${op})`
                          : `rgba(248,114,114,${op})`,
                        borderRadius: 8,
                        padding: "10px 0",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#fff",
                      }}
                    >
                      {v}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="legend" style={{ marginTop: 14 }}>
        <span>
          <span className="swatch" style={{ background: "rgba(54,211,153,0.6)" }} />
          Correct (diagonal)
        </span>
        <span>
          <span className="swatch" style={{ background: "rgba(248,114,114,0.6)" }} />
          Misclassified
        </span>
      </div>
    </div>
  );
}
