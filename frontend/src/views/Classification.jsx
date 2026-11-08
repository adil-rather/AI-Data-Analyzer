import { useMemo } from "react";
import { Play } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnalysisFeedback,
  EmptyAnalysis,
  Facts,
  FeaturePicker,
  Field,
  ScopeNote,
  Section,
} from "../components/ui";
import { axisStyle, useChartAnimation } from "../components/charts";
import DataTable from "../components/DataTable";
import { useAnalysis } from "../hooks/useAnalysis";
import { COLORS, fmt, percentage } from "../lib";
export default function Classification({ profile, datasetId }) {
  const numeric = profile.stats
      .filter((s) => s.type === "numeric")
      .map((s) => s.name),
    targets = profile.stats
      .filter((s) => s.unique >= 2 && s.unique <= 20)
      .map((s) => s.name);
  const first = targets.find((c) => !numeric.includes(c)) || targets[0] || "";
  const state = useAnalysis(
      "classification",
      {
        target: first,
        features: numeric.filter((c) => c !== first).slice(0, 8),
        testSize: 0.25,
      },
      "classify",
      datasetId,
    ),
    { params, setParams, result } = state;
  const animate = useChartAnimation(result);
  const matrix = useMemo(
    () =>
      result
        ? result.confusionMatrix.map((row, i) =>
            Object.fromEntries([
              ["actual", result.classes[i]],
              ...row.map((n, j) => [`prediction_${j}`, n]),
            ]),
          )
        : [],
    [result],
  );
  if (!targets.length || !numeric.length)
    return (
      <EmptyAnalysis title="A category and numeric predictors are needed.">
        Use a target with 2–20 classes and at least one separate numeric input.
        The customer segments sample is a useful starting point.
      </EmptyAnalysis>
    );
  return (
    <>
      <form className="model-controls" onSubmit={state.run}>
        <Field label="Target category">
          {(id) => (
            <select
              id={id}
              value={params.target}
              onChange={(e) =>
                setParams({
                  target: e.target.value,
                  features: params.features.filter((c) => c !== e.target.value),
                })
              }
            >
              {targets.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Holdout size">
          {(id) => (
            <select
              id={id}
              value={params.testSize}
              onChange={(e) => setParams({ testSize: Number(e.target.value) })}
            >
              {[0.1, 0.2, 0.25, 0.3, 0.4].map((v) => (
                <option key={v} value={v}>
                  {v * 100}% test / {100 - v * 100}% train
                </option>
              ))}
            </select>
          )}
        </Field>
        <button
          className="button"
          disabled={
            state.busy || !params.features.length || params.features.length > 20
          }
        >
          <Play size={15} />
          {state.busy ? "Training model…" : "Train classifier"}
        </button>
      </form>
      <FeaturePicker
        columns={numeric}
        exclude={params.target}
        selected={params.features}
        onChange={(features) => setParams({ features })}
      />
      <p className="quiet-note">
        Random Forest · 100 trees · stratified holdout · seed 42. The target is
        excluded from predictor choices to prevent direct answer leakage.
      </p>
      <AnalysisFeedback state={state} />
      {result ? (
        <div className="model-results">
          <ScopeNote result={result} />
          <Facts
            items={[
              ["Holdout accuracy", percentage(result.accuracy)],
              ["Weighted precision", percentage(result.precision)],
              ["Weighted recall", percentage(result.recall)],
              ["Weighted F1", percentage(result.f1)],
            ]}
          />
          <Section
            title="What the model used"
            description={`Predictors ranked by impurity-based importance · ${fmt(result.trainSize, 0)} training rows · ${fmt(result.testSize, 0)} test rows`}
            className="chart-surface"
          >
            <div
              className="chart-box"
              style={{
                height: Math.max(
                  240,
                  Math.min(620, result.featureImportances.length * 34 + 55),
                ),
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={result.featureImportances}
                  layout="vertical"
                  margin={{ top: 8, right: 25, bottom: 15, left: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="#e1e6dc" />
                  <XAxis
                    type="number"
                    domain={[0, "dataMax"]}
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                    tickFormatter={(v) =>
                      v.length > 17 ? v.slice(0, 16) + "…" : v
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "#e7eddf" }}
                    formatter={(v) => percentage(v)}
                    contentStyle={{
                      background: "#fcfcf9",
                      border: "1px solid #bdc8b9",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="importance"
                    name="Importance"
                    barSize={17}
                    radius={[0, 3, 3, 0]}
                    isAnimationActive={animate}
                    animationDuration={450}
                  >
                    {result.featureImportances.map((p) => (
                      <Cell
                        key={p.feature}
                        fill={
                          COLORS[
                            result.features.indexOf(p.feature) % COLORS.length
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="quiet-note">
              Importance shows how this fitted model used the chosen predictors.
              It is not causal evidence and can favor high-cardinality
              variables.
            </p>
          </Section>
          <div className="model-notes-grid">
            <section>
              <h2>Evaluate with context</h2>
              <p>
                The model predicts <strong>{result.target}</strong> across{" "}
                {result.classes.length} classes. Scores above describe one
                reproducible held-out split of the analysis data, not a
                guarantee on new populations.
              </p>
              <p>
                For an imbalanced target, look beyond accuracy: compare
                precision, recall and the confusion matrix. Rows are actual
                labels; columns are predicted labels. Diagonal cells are correct
                predictions.
              </p>
              <p>
                Feature selection still needs domain judgment. Remove fields
                that would be unavailable at prediction time, identifiers and
                indirect copies of the target. This baseline is not
                cross-validation.
              </p>
            </section>
            <Section
              title="Confusion matrix"
              description="Actual class by predicted class."
            >
              <DataTable
                label="Confusion matrix"
                columns={[
                  { key: "actual", label: "Actual ↓ / Predicted →" },
                  ...result.classes.map((c, i) => ({
                    key: `prediction_${i}`,
                    label: c,
                    type: "numeric",
                  })),
                ]}
                rows={matrix}
              />
            </Section>
          </div>
        </div>
      ) : (
        <EmptyAnalysis>
          Choose a target, select the predictors available at prediction time,
          then train a baseline. The app will validate class sizes before
          splitting the data.
        </EmptyAnalysis>
      )}
    </>
  );
}
