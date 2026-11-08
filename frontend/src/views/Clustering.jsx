import { useMemo } from "react";
import { Play } from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
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
import DataTable from "../components/DataTable";
import {
  axisStyle,
  Legend,
  PointTooltip,
  useChartAnimation,
} from "../components/charts";
import { useAnalysis } from "../hooks/useAnalysis";
import { COLORS, fmt, uniqueFieldKey } from "../lib";
export default function Clustering({ profile, datasetId }) {
  const numeric = profile.stats
    .filter((s) => s.type === "numeric")
    .map((s) => s.name);
  const state = useAnalysis(
      "clustering",
      { features: numeric.slice(0, 4), clusters: 3 },
      "cluster",
      datasetId,
    ),
    { params, setParams, result } = state;
  const animate = useChartAnimation(result);
  const clusterKey = uniqueFieldKey(result?.features || [], "__cluster_label");
  const groups = useMemo(
    () =>
      result
        ? Array.from({ length: result.clusters }, (_, i) =>
            result.points.filter((p) => p.cluster === i),
          )
        : [],
    [result],
  );
  if (numeric.length < 2)
    return (
      <EmptyAnalysis title="Two numeric fields are needed.">
        Clustering compares distances between observations. Try a table with at
        least two numeric fields or load the customer segments sample.
      </EmptyAnalysis>
    );
  return (
    <>
      <FeaturePicker
        columns={numeric}
        selected={params.features}
        onChange={(features) => setParams({ features })}
      />
      <form className="model-controls" onSubmit={state.run}>
        <Field
          label="Number of clusters (K)"
          hint="2–10 groups; fewer than complete rows"
        >
          {(id) => (
            <input
              id={id}
              type="number"
              required
              min={2}
              max={10}
              value={params.clusters}
              onChange={(e) => setParams({ clusters: e.target.value })}
            />
          )}
        </Field>
        <button
          className="button"
          disabled={
            state.busy ||
            params.features.length < 2 ||
            params.features.length > 20
          }
        >
          <Play size={15} />
          {state.busy ? "Finding groups…" : "Find clusters"}
        </button>
      </form>
      <p className="quiet-note">
        Select 2–20 numeric features. Features are standardized before K-Means;
        a fixed random seed makes runs repeatable.
      </p>
      <AnalysisFeedback state={state} />
      {result ? (
        <div className="model-results">
          <ScopeNote result={result} />
          <Facts
            items={[
              ["Clusters", result.clusters],
              ["Complete rows", fmt(result.rowsUsed, 0)],
              ["Silhouette", fmt(result.silhouette, 3)],
              ["Points plotted", fmt(result.points.length, 0)],
            ]}
          />
          <Section
            title="The shape of your segments"
            description={
              result.projection === "PCA components"
                ? "PCA components 1 and 2 · reduced from the selected features"
                : `Standardized ${result.features[0]} and ${result.features[1]}`
            }
            className="chart-surface"
          >
            <div className="chart-box tall">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 15, right: 12, bottom: 18, left: -12 }}
                >
                  <CartesianGrid stroke="#e1e6dc" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    name={
                      result.projection === "PCA components"
                        ? "PC1"
                        : result.features[0]
                    }
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={{ stroke: "#c3cdbb" }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    name={
                      result.projection === "PCA components"
                        ? "PC2"
                        : result.features[1]
                    }
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={<PointTooltip />}
                  />
                  {groups.map((points, i) => (
                    <Scatter
                      key={i}
                      name={`Cluster ${i + 1}`}
                      data={points}
                      fill={COLORS[i]}
                      fillOpacity={0.7}
                      isAnimationActive={animate}
                      animationDuration={400}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <Legend
              items={groups.map((_, i) => ({
                label: `Cluster ${i + 1} · ${fmt(result.sizes[String(i)], 0)} rows`,
                color: COLORS[i],
              }))}
            />
            <p className="quiet-note">
              Plot axes are transformed units, not the original measurements. Up
              to 2,000 points are displayed; all complete analysis rows
              contribute to the model.
            </p>
          </Section>
          <div className="model-notes-grid">
            <section>
              <h2>Read the result</h2>
              <p>
                Silhouette ranges from −1 to 1. Higher values suggest better
                separation under this choice of features and K; the score alone
                does not prove that groups are meaningful.
              </p>
              <p>
                The score uses up to {fmt(result.silhouetteSample, 0)} sampled
                points. Cluster numbers are labels, not a ranking. Test several
                values of K and check whether the groups make sense for your
                question.
              </p>
            </section>
            <Section
              title="Centroids in original units"
              description="Average feature position of each cluster."
            >
              <DataTable
                label="Cluster centroids"
                columns={[
                  {
                    key: clusterKey,
                    label: "Cluster",
                    render: (v) => (
                      <span className="cluster-key">
                        <i style={{ background: COLORS[v] }} />
                        Cluster {v + 1}
                      </span>
                    ),
                  },
                  ...result.features.map((key) => ({ key, type: "numeric" })),
                ]}
                rows={result.centroids.map((c, i) => ({
                  ...c,
                  [clusterKey]: i,
                }))}
              />
            </Section>
          </div>
        </div>
      ) : (
        <EmptyAnalysis>
          Choose meaningful features and a starting number of groups. The result
          shows a colored projection, group sizes and centroids in the original
          units.
        </EmptyAnalysis>
      )}
    </>
  );
}
