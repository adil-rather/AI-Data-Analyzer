import { useMemo, useState } from "react";
import { Download, Play } from "lucide-react";
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
import {
  AnalysisFeedback,
  EmptyAnalysis,
  Facts,
  Field,
  Notice,
  ScopeNote,
  Section,
} from "../components/ui";
import DataTable from "../components/DataTable";
import {
  axisStyle,
  ChartTooltip,
  Legend,
  useChartAnimation,
} from "../components/charts";
import { useAnalysis } from "../hooks/useAnalysis";
import { COLORS, downloadCsv, fmt } from "../lib";
export default function Forecast({ profile, datasetId }) {
  const numeric = profile.stats
      .filter((s) => s.type === "numeric")
      .map((s) => s.name),
    dates = profile.stats
      .filter((s) => s.type === "datetime")
      .map((s) => s.name);
  const state = useAnalysis(
    "forecast",
    {
      target: numeric[0] || "",
      dateColumn: dates[0] || null,
      periods: 30,
      period: null,
    },
    "forecast",
    datasetId,
  );
  const { params, setParams, result } = state;
  const [allHistory, setAllHistory] = useState(false),
    animate = useChartAnimation(result);
  const chart = useMemo(() => {
    if (!result) return [];
    const history = allHistory
      ? result.history
      : result.history.filter((h) => h.index >= result.historyRows - 120);
    const bridge = result.history.at(-1);
    return [
      ...history.map((h) => ({ ...h })),
      {
        index: bridge.index,
        date: bridge.date,
        forecast: bridge.actual,
        band: [bridge.actual, bridge.actual],
      },
      ...result.future.map((f) => ({ ...f, band: [f.lower, f.upper] })),
    ];
  }, [result, allHistory]);
  const exportColumns = [
    { key: "index", label: "Observation index" },
    { key: "date", label: "Date" },
    { key: "forecast", label: "Forecast" },
    { key: "lower", label: "Residual range lower" },
    { key: "upper", label: "Residual range upper" },
  ];
  if (!numeric.length)
    return (
      <EmptyAnalysis title="A numeric series is needed.">
        Upload a table with at least one numeric field and 12 complete
        observations, or try the retail sales sample.
      </EmptyAnalysis>
    );
  return (
    <>
      <form className="model-controls" onSubmit={state.run}>
        <Field label="Target column">
          {(id) => (
            <select
              id={id}
              value={params.target}
              onChange={(e) => setParams({ target: e.target.value })}
            >
              {numeric.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Order by">
          {(id) => (
            <select
              id={id}
              value={params.dateColumn || ""}
              onChange={(e) =>
                setParams({ dateColumn: e.target.value || null })
              }
            >
              <option value="">Row order</option>
              {dates
                .filter((c) => c !== params.target)
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Horizon (steps)">
          {(id) => (
            <input
              id={id}
              type="number"
              required
              min={1}
              max={365}
              step={1}
              value={params.periods}
              onChange={(e) => setParams({ periods: e.target.value })}
            />
          )}
        </Field>
        <Field label="Seasonality">
          {(id) => (
            <select
              id={id}
              value={
                params.period === null
                  ? "auto"
                  : params.period === 0
                    ? "none"
                    : "custom"
              }
              onChange={(e) =>
                setParams({
                  period:
                    e.target.value === "auto"
                      ? null
                      : e.target.value === "none"
                        ? 0
                        : 7,
                })
              }
            >
              <option value="auto">Auto detect</option>
              <option value="none">None</option>
              <option value="custom">Custom period</option>
            </select>
          )}
        </Field>
        {params.period !== null && params.period !== 0 && (
          <Field label="Period (steps)">
            {(id) => (
              <input
                id={id}
                type="number"
                required
                min={2}
                max={365}
                value={params.period}
                onChange={(e) =>
                  setParams({
                    period: e.target.value,
                  })
                }
              />
            )}
          </Field>
        )}
        <button className="button" disabled={state.busy}>
          <Play size={15} />
          {state.busy ? "Calculating…" : "Run forecast"}
        </button>
      </form>
      <p className="quiet-note">
        Linear trend + repeating seasonal pattern.{" "}
        {params.dateColumn
          ? "Rows are sorted by the selected date column; regular spacing is required."
          : "Row order is used. Each row represents one equally spaced step."}
      </p>
      <AnalysisFeedback state={state} />
      {result ? (
        <div className="model-results">
          <ScopeNote result={result} />
          <Facts
            items={[
              ["Holdout MAE", fmt(result.evaluation.mae)],
              ["Holdout RMSE", fmt(result.evaluation.rmse)],
              ["In-sample R²", fmt(result.r2, 3)],
              [
                "Detected period",
                result.period ? `${result.period} steps` : "None",
              ],
            ]}
          />
          <Section
            title={`${result.target} · observed and projected`}
            description={`${result.future.length} future steps · ${result.historyRows.toLocaleString()} modeled observations`}
            className="chart-surface"
            action={
              result.historyRows > 120 ? (
                <button
                  className="text-button"
                  onClick={() => setAllHistory((v) => !v)}
                >
                  {allHistory ? "Recent history" : "All history"}
                </button>
              ) : null
            }
          >
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chart}
                  margin={{ top: 10, right: 12, bottom: 10, left: -14 }}
                >
                  <CartesianGrid vertical={false} stroke="#e1e6dc" />
                  <XAxis
                    dataKey="index"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tick={axisStyle}
                    axisLine={{ stroke: "#b8c5b4" }}
                    tickLine={false}
                    minTickGap={35}
                    tickFormatter={(v) => fmt(v + 1, 0)}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(v) => fmt(v, 0)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    dataKey="band"
                    name="Residual range"
                    stroke="none"
                    fill="#dce3cf"
                    isAnimationActive={animate}
                    animationDuration={450}
                  />
                  <Line
                    dataKey="actual"
                    name="Actual"
                    type="linear"
                    stroke={COLORS[0]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={animate}
                    animationDuration={450}
                  />
                  <Line
                    dataKey="fitted"
                    name="Fitted"
                    stroke="#9aab90"
                    strokeWidth={1.4}
                    dot={false}
                    isAnimationActive={animate}
                    animationDuration={450}
                  />
                  <Line
                    dataKey="forecast"
                    name="Forecast"
                    stroke={COLORS[1]}
                    strokeWidth={2.2}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={animate}
                    animationDuration={450}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <Legend
              items={[
                { label: "Actual", color: COLORS[0] },
                { label: "Fitted", color: "#9aab90" },
                { label: "Forecast", color: COLORS[1], dashed: true },
                { label: "Residual range", color: "#dce3cf" },
              ]}
            />
            <p className="quiet-note">
              The horizontal axis is observation order.{" "}
              {result.dateColumn
                ? "Dates appear in the tooltip and exported values. "
                : ""}
              {!allHistory && result.historyRows > 120
                ? "Recent history is shown; use All history to see the complete fitted window. "
                : ""}
              Residual range is descriptive, not a calibrated prediction
              interval.
            </p>
          </Section>
          <div className="model-notes-grid">
            <section>
              <h2>Model notes</h2>
              <p>
                The overall trend is {result.summary.direction}, changing by
                about {fmt(result.summary.avgChangePerStep)} per step.{" "}
                {result.period
                  ? `A ${result.period}-step repeating pattern is included.`
                  : "No seasonal pattern is included."}
              </p>
              <p>
                {result.evaluation.note}{" "}
                {result.evaluation.holdoutRows > 0 &&
                  `${result.evaluation.holdoutRows} observations were evaluated.`}
              </p>
              <p>
                This is an exploratory baseline. It extends past patterns; it
                does not model external events or guarantee future values.
                In-sample R² describes historical fit, not future accuracy.
              </p>
            </section>
            <Section
              title="Forecast values"
              action={
                <button
                  className="button small secondary"
                  onClick={() =>
                    downloadCsv("forecast.csv", exportColumns, result.future)
                  }
                >
                  <Download size={15} />
                  Export CSV
                </button>
              }
            >
              <DataTable
                label="Forecast values"
                columns={[
                  {
                    key: "date",
                    label: result.dateColumn ? "Date" : "Step",
                    render: (val, row) =>
                      val
                        ? String(val).slice(0, 10)
                        : row.index - result.historyRows + 1,
                  },
                  { key: "forecast", label: "Forecast", type: "numeric" },
                  { key: "lower", label: "Lower", type: "numeric" },
                  { key: "upper", label: "Upper", type: "numeric" },
                ]}
                rows={result.future}
              />
            </Section>
          </div>
        </div>
      ) : (
        <EmptyAnalysis>
          Choose a numeric field, check its ordering and run the forecast.
          Results include a chronological holdout when enough data is available.
        </EmptyAnalysis>
      )}
    </>
  );
}
