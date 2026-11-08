import { Play } from "lucide-react";
import {
  AnalysisFeedback,
  EmptyAnalysis,
  Facts,
  Field,
  ScopeNote,
  Section,
} from "../components/ui";
import DataTable from "../components/DataTable";
import { useAnalysis } from "../hooks/useAnalysis";
import { fmt } from "../lib";
function heatColor(value) {
  if (value == null) return "#e4e6df";
  const amount = Math.min(1, Math.abs(value));
  const target = value >= 0 ? [46, 103, 88] : [182, 92, 61];
  return `rgb(${target.map((v) => Math.round(247 + (v - 247) * amount)).join(",")})`;
}
export default function Insights({ profile, datasetId }) {
  const state = useAnalysis(
      "insights",
      { threshold: 3 },
      "insights",
      datasetId,
    ),
    { params, setParams, result } = state;
  if (!profile.stats.some((s) => s.type === "numeric"))
    return (
      <EmptyAnalysis title="A numeric field is needed.">
        Insights explores numeric relationships and unusual observations. Try
        the sensor telemetry sample for a ready-to-use example.
      </EmptyAnalysis>
    );
  const anomalyRows =
    result?.anomalies.rows.map((row) => ({
      row: row.row,
      column: row.column,
      score: row.score,
      value: row.value,
    })) || [];
  return (
    <>
      <form className="model-controls" onSubmit={state.run}>
        <Field
          label="Anomaly threshold (z-score)"
          hint="2–6 standard deviations from the mean"
        >
          {(id) => (
            <input
              id={id}
              type="number"
              required
              min={2}
              max={6}
              step={0.1}
              value={params.threshold}
              onChange={(e) => setParams({ threshold: e.target.value })}
            />
          )}
        </Field>
        <button className="button" disabled={state.busy}>
          <Play size={15} />
          {state.busy ? "Exploring data…" : "Generate insights"}
        </button>
      </form>
      <p className="quiet-note">
        Pearson correlations and z-score flags describe patterns. They do not
        establish causes or automatically identify errors.
      </p>
      <AnalysisFeedback state={state} />
      {result ? (
        <div className="model-results">
          <ScopeNote result={result} />
          <Facts
            items={[
              ["Numeric fields", result.numericColumns.length],
              ["Pairs displayed", result.topPairs.length],
              ["Flagged rows", fmt(result.anomalies.count, 0)],
              ["Threshold", `|z| > ${fmt(state.lastParams?.threshold, 1)}`],
            ]}
          />
          <Section
            title="How your variables relate"
            description="Pearson correlation · −1 to +1 · undefined relationships are shown as —"
            className="chart-surface"
          >
            <div
              className="heatmap-scroll"
              role="region"
              aria-label="Correlation matrix"
              tabIndex={0}
            >
              <table
                className="heatmap"
                style={{
                  minWidth: Math.max(
                    360,
                    result.numericColumns.length * 76 + 120,
                  ),
                }}
              >
                <caption className="sr-only">
                  Pearson correlation matrix
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Variable</th>
                    {result.numericColumns.map((c) => (
                      <th key={c} scope="col" title={c}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.numericColumns.map((c, i) => (
                    <tr key={c}>
                      <th scope="row" title={c}>
                        {c}
                      </th>
                      {result.correlationMatrix[i].map((val, j) => (
                        <td
                          key={j}
                          title={`${c} / ${result.numericColumns[j]}: ${val == null ? "undefined" : fmt(val, 3)}`}
                          style={{
                            background: heatColor(val),
                            color:
                              val != null && Math.abs(val) > 0.65
                                ? "#fff"
                                : "#223e31",
                          }}
                        >
                          {fmt(val, 2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="chart-legend">
              <span>
                <i style={{ background: "#b65c3d" }} />
                Negative
              </span>
              <span>
                <i style={{ background: "#dce4d3" }} />
                Near zero
              </span>
              <span>
                <i style={{ background: "#2e6758" }} />
                Positive
              </span>
            </div>
            <p className="quiet-note">
              Missing observations are excluded pairwise. Constant fields have
              undefined correlations. Pearson correlation captures linear
              relationships only.
            </p>
          </Section>
          <div className="model-notes-grid">
            <Section
              title="Strongest relationships"
              description="Top 10 valid pairs, ranked by absolute correlation."
            >
              {result.topPairs.length ? (
                <ul className="correlation-list">
                  {result.topPairs.map((pair) => (
                    <li key={`${pair.a}:${pair.b}`}>
                      <span>
                        {pair.a}
                        <span className="muted"> ↔ </span>
                        {pair.b}
                      </span>
                      <strong
                        style={{
                          color: pair.correlation < 0 ? "#9d4b32" : "#2e6758",
                        }}
                      >
                        {pair.correlation > 0 ? "+" : ""}
                        {fmt(pair.correlation, 3)}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No valid variable pairs. Add a second non-constant numeric
                  field to explore correlations.
                </p>
              )}
            </Section>
            <section>
              <h2>What deserves a closer look?</h2>
              <p>
                A row is flagged if at least one observed numeric value exceeds
                the selected z-score threshold. Missing values are not replaced
                with zero, and constant columns do not create artificial
                outliers.
              </p>
              <p>
                Z-scores are sensitive to skewed distributions and extreme
                values. A flagged observation may be valid. Investigate it in
                context before removing it.
              </p>
              <p>
                {fmt(result.anomalies.count, 0)} rows were flagged in the
                analysis subset. The table below shows at most the first 25,
                with the strongest deviation per row.
              </p>
            </section>
          </div>
          <Section
            title="Flagged observations"
            description="Source-file row number, excluding the header; strongest numeric deviation."
            className="anomaly-section"
          >
            <DataTable
              label="Flagged observations"
              columns={[
                { key: "row", label: "Row", type: "numeric" },
                { key: "column", label: "Field" },
                { key: "value", label: "Value" },
                { key: "score", label: "Absolute z-score", type: "numeric" },
              ]}
              rows={anomalyRows}
            />
          </Section>
        </div>
      ) : (
        <EmptyAnalysis>
          Run an initial exploration to compare numeric variables and identify
          observations that may need investigation.
        </EmptyAnalysis>
      )}
    </>
  );
}
