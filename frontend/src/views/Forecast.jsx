import React, { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { Card, Field, Metric, Spinner } from "../components/ui";

export default function Forecast({ profile, datasetId }) {
  const numericCols = useMemo(
    () => profile.stats.filter((s) => s.type === "numeric").map((s) => s.name),
    [profile]
  );
  const [target, setTarget] = useState(numericCols[0] || "");
  const [periods, setPeriods] = useState(30);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const r = await api.forecast({ datasetId, target, periods: Number(periods) });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const chartData = useMemo(() => {
    if (!result) return [];
    const hist = result.history.map((h) => ({
      index: h.index,
      actual: h.actual,
      fitted: h.fitted,
    }));
    const fut = result.future.map((f) => ({
      index: f.index,
      forecast: f.forecast,
      band: [f.lower, f.upper],
    }));
    // bridge the gap so lines connect
    if (hist.length && fut.length) {
      fut.unshift({
        index: hist[hist.length - 1].index,
        forecast: hist[hist.length - 1].actual,
        band: [hist[hist.length - 1].actual, hist[hist.length - 1].actual],
      });
    }
    return [...hist, ...fut];
  }, [result]);

  return (
    <div className="fade-in">
      <div className="controls">
        <Field label="Target variable">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {numericCols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Forecast horizon (steps)">
          <input
            type="number"
            min="1"
            max="365"
            value={periods}
            onChange={(e) => setPeriods(e.target.value)}
            style={{ width: 120 }}
          />
        </Field>
        <button className="btn primary" onClick={run} disabled={busy || !target}>
          {busy ? "Forecasting…" : "⚡ Run Forecast"}
        </button>
      </div>

      {error && <ErrorBox msg={error} />}
      {busy && <Spinner label="Fitting trend + seasonality model…" />}

      {result && !busy && (
        <>
          <div className="metric-row">
            <Metric k="Trend" v={result.summary.direction === "upward" ? "▲ Upward" : "▼ Downward"} />
            <Metric k="Fit Quality (R²)" v={(result.r2 * 100).toFixed(1) + "%"} />
            <Metric k="Seasonality" v={result.period ? `${result.period} steps` : "none"} />
            <Metric k="Next Value" v={fmt(result.summary.nextValue)} />
            <Metric k="Projected End" v={fmt(result.summary.endValue)} />
          </div>

          <Card
            title={`Forecast · ${result.target}`}
            sub={`Historical fit and ${result.future.length}-step projection with 95% confidence band`}
          >
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6c8bff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6c8bff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2ee6c5" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2ee6c5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(120,140,200,0.1)" vertical={false} />
                <XAxis dataKey="index" stroke="#5e688a" fontSize={11} />
                <YAxis stroke="#5e688a" fontSize={11} />
                <Tooltip
                  wrapperClassName="chart-tooltip"
                  contentStyle={{ background: "transparent", border: "none" }}
                  labelStyle={{ color: "#9aa6c8" }}
                />
                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill="url(#gBand)"
                  name="Confidence"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#6c8bff"
                  strokeWidth={2}
                  fill="url(#gActual)"
                  name="Actual"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#2ee6c5"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  name="Forecast"
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="legend">
              <span>
                <span className="swatch" style={{ background: "#6c8bff" }} />
                Actual
              </span>
              <span>
                <span className="swatch" style={{ background: "#2ee6c5" }} />
                Forecast
              </span>
              <span>
                <span className="swatch" style={{ background: "rgba(46,230,197,0.4)" }} />
                95% confidence
              </span>
            </div>
          </Card>
        </>
      )}

      {!result && !busy && (
        <Card>
          <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: 30 }}>
            Pick a numeric target and run the forecast to project future trends.
          </div>
        </Card>
      )}
    </div>
  );
}

function fmt(v) {
  if (v == null) return "—";
  return Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(2);
}

function ErrorBox({ msg }) {
  return (
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
      ⚠️ {msg}
    </div>
  );
}
