import { useState } from "react";
import { ArrowLink, Facts, Section } from "../components/ui";
import DataTable from "../components/DataTable";
import { COLORS, fmt, uniqueFieldKey } from "../lib";
export default function Dashboard({ profile, onNavigate }) {
  const [tab, setTab] = useState("preview"),
    [selected, setSelected] = useState(
      profile.stats.find((s) => s.type === "numeric")?.name ||
        profile.columns[0],
    );
  const stat = profile.stats.find((s) => s.name === selected);
  const rowKey = uniqueFieldKey(profile.columns, "__displayRow");
  const preview = profile.preview.map((row, i) => ({
    ...row,
    [rowKey]: i + 1,
  }));
  return (
    <>
      <Facts
        items={[
          ["Rows", fmt(profile.rows, 0)],
          ["Columns", profile.columns.length],
          [
            "Missing cells",
            fmt(
              profile.missingCells ??
                profile.stats.reduce((n, s) => n + s.missing, 0),
              0,
            ),
          ],
          [
            "Numeric fields",
            profile.stats.filter((s) => s.type === "numeric").length,
          ],
        ]}
      />
      <div className="overview-grid">
        <Section title="Dataset preview">
          <div
            className="tabs"
            role="tablist"
            aria-label="Dataset view"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "preview"
                  : event.key === "End"
                    ? "profiles"
                    : tab === "preview"
                      ? "profiles"
                      : "preview";
              setTab(next);
              event.currentTarget
                .querySelector(`[data-tab="${next}"]`)
                ?.focus();
            }}
          >
            <button
              role="tab"
              data-tab="preview"
              tabIndex={tab === "preview" ? 0 : -1}
              aria-selected={tab === "preview"}
              onClick={() => setTab("preview")}
            >
              Data preview
            </button>
            <button
              role="tab"
              data-tab="profiles"
              tabIndex={tab === "profiles" ? 0 : -1}
              aria-selected={tab === "profiles"}
              onClick={() => setTab("profiles")}
            >
              Column profiles
            </button>
          </div>
          {tab === "preview" ? (
            <>
              <p className="table-description">
                First {profile.preview.length} rows · select a column to inspect
                {profile.previewTextLimit &&
                  ` · long text previewed to ${profile.previewTextLimit} characters`}
              </p>
              <DataTable
                label="Dataset preview"
                columns={[
                  {
                    key: rowKey,
                    label: "#",
                    type: "numeric",
                    selectable: false,
                  },
                  ...profile.columns.map((key) => ({
                    key,
                    type: profile.types[key],
                  })),
                ]}
                rows={preview}
                selected={selected}
                onSelect={(key) => {
                  if (key !== rowKey) setSelected(key);
                }}
              />
            </>
          ) : (
            <>
              <p className="table-description">
                Descriptive statistics cover the full stored dataset.
              </p>
              <DataTable
                label="Column profiles"
                columns={[
                  {
                    key: "name",
                    label: "Column",
                    render: (v) => (
                      <button
                        className="text-button"
                        onClick={() => setSelected(v)}
                      >
                        {v}
                      </button>
                    ),
                  },
                  { key: "type", label: "Type" },
                  { key: "count", label: "Complete", type: "numeric" },
                  { key: "missing", label: "Missing", type: "numeric" },
                  { key: "unique", label: "Distinct", type: "numeric" },
                  { key: "mean", label: "Mean", type: "numeric" },
                  { key: "median", label: "Median", type: "numeric" },
                ]}
                rows={profile.stats}
              />
              {profile.rows > 25000 && (
                <p className="quiet-note">
                  Distinct counts and medians are approximate on large tables.
                  Counts, missing values, ranges, means and histogram bins use
                  the full dataset.
                </p>
              )}
            </>
          )}
        </Section>
        <aside className="column-inspector">
          <h2>Column details</h2>
          <label className="inspector-select">
            Field
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {profile.columns.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <dl className="detail-list">
            <div>
              <dt>Type</dt>
              <dd>{stat.type}</dd>
            </div>
            <div>
              <dt>Complete rows</dt>
              <dd>{fmt(stat.count, 0)}</dd>
            </div>
            <div>
              <dt>Missing</dt>
              <dd>{fmt(stat.missing, 0)}</dd>
            </div>
          </dl>
          <div className="distribution">
            <h3>
              {stat.type === "numeric"
                ? "Distribution"
                : "Most frequent values"}
            </h3>
            {stat.type === "numeric" ? (
              <>
                <div
                  className="histogram"
                  role="img"
                  aria-label={`Histogram of ${selected}; ${stat.count} complete values`}
                >
                  {(stat.histogram || []).map((bin, i) => (
                    <div
                      key={i}
                      title={`${fmt(bin.start)}–${fmt(bin.end)}: ${fmt(bin.count, 0)} values`}
                      style={{
                        height: `${Math.max(2, (bin.count / Math.max(1, ...stat.histogram.map((b) => b.count))) * 100)}%`,
                        background: COLORS[i % 3 === 0 ? 2 : 0],
                      }}
                    />
                  ))}
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Minimum</dt>
                    <dd>{fmt(stat.min)}</dd>
                  </div>
                  <div>
                    <dt>
                      {stat.medianApproximate ? "Approx. median" : "Median"}
                    </dt>
                    <dd>{fmt(stat.median)}</dd>
                  </div>
                  <div>
                    <dt>Maximum</dt>
                    <dd>{fmt(stat.max)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <ul className="category-list">
                {stat.top?.map((v, i) => (
                  <li key={v.value}>
                    <span
                      className="category-key"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span title={v.value}>{v.value}</span>
                    <strong>{fmt(v.count, 0)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
      <Section title="Next steps" className="next-steps">
        <div>
          <article>
            <ArrowLink onClick={() => onNavigate("forecast")}>
              Forecast a trend
            </ArrowLink>
            <p>Explore a time-based pattern in your data.</p>
          </article>
          <article>
            <ArrowLink onClick={() => onNavigate("clustering")}>
              Find segments
            </ArrowLink>
            <p>Group records by their numeric characteristics.</p>
          </article>
          <article>
            <ArrowLink onClick={() => onNavigate("insights")}>
              Explore relationships
            </ArrowLink>
            <p>Compare variables and inspect unusual values.</p>
          </article>
        </div>
      </Section>
    </>
  );
}
