import { useRef } from "react";
import { useReducedMotion } from "../hooks/useAnalysis";
import { fmt } from "../lib";
export const axisStyle = { fontSize: 11, fontFamily: "Manrope, sans-serif" };
export function useChartAnimation(result) {
  const initial = useRef(result);
  return !useReducedMotion() && result !== initial.current;
}
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-box">
      <strong>
        {payload[0]?.payload?.date
          ? String(payload[0].payload.date).slice(0, 10)
          : label != null
            ? `Observation ${Number(label) + 1}`
            : "Data point"}
      </strong>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <p key={p.dataKey}>
            <span style={{ color: p.color }}>{p.name}</span>
            <span>
              {Array.isArray(p.value)
                ? p.value.map((v) => fmt(v)).join("–")
                : fmt(p.value)}
            </span>
          </p>
        ))}
    </div>
  );
}
export function PointTooltip({ active, payload }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="tooltip-box">
      <strong>
        Cluster {point.cluster + 1} · row {fmt(point.row, 0)}
      </strong>
      {Object.entries(point.values || {}).map(([key, val]) => (
        <p key={key}>
          <span>{key}</span>
          <span>{fmt(val)}</span>
        </p>
      ))}
    </div>
  );
}
export function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map(({ label, color, dashed }) => (
        <span key={label}>
          <i
            className={dashed ? "dashed" : ""}
            style={dashed ? { borderColor: color } : { background: color }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
