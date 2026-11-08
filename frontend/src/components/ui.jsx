import { useEffect, useId, useRef } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  LoaderCircle,
  X,
} from "lucide-react";
import { fmt } from "../lib";

export function Field({ label, hint, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {typeof children === "function" ? children(id) : children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
export function Notice({ children, kind = "info", onRetry }) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === "error" ? "alert" : undefined}
    >
      <AlertCircle size={17} aria-hidden="true" />
      <div>
        {children}
        {onRetry && (
          <button className="text-button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading({ label = "Loading workspace…" }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} />
      <span>{label}</span>
    </div>
  );
}
export function PageHeading({ title, description, profile }) {
  return (
    <>
      <div className="page-heading">
        <h1 tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      {profile && (
        <p className="source-line">
          <strong>{profile.name}</strong>
          <span>·</span>
          {profile.source === "sample" ? "Synthetic sample" : "Uploaded table"}
        </p>
      )}
    </>
  );
}
export function Facts({ items }) {
  return (
    <dl className="facts">
      {items.map(([label, val]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Section({
  title,
  description,
  action,
  children,
  className = "",
}) {
  return (
    <section className={`section ${className}`}>
      <header className="section-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function AnalysisFeedback({ state }) {
  return (
    <>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.busy && (
        <div className="analysis-progress" role="status">
          <LoaderCircle className="spin" size={17} />
          Calculating with your selected settings…
          <button className="text-button" onClick={state.cancel}>
            Cancel request
          </button>
        </div>
      )}
      {state.stale && !state.busy && (
        <Notice>
          Settings changed. Run the analysis to update the results shown below.
        </Notice>
      )}
    </>
  );
}
export function ScopeNote({ result }) {
  const scope = result?.analysisScope;
  if (!scope) return null;
  return (
    <p className="scope-note">
      <Check size={15} aria-hidden="true" />
      {scope.method === "All rows"
        ? `Analysis uses all ${fmt(scope.sourceRows, 0)} rows.`
        : `${scope.method}: ${fmt(scope.analyzedRows, 0)} of ${fmt(scope.sourceRows, 0)} stored rows. The complete dataset is retained; these results describe the analysis subset.`}
      {result.droppedRows > 0 &&
        ` ${fmt(result.droppedRows, 0)} incomplete rows excluded.`}
    </p>
  );
}
export function EmptyAnalysis({ title = "Ready when you are.", children }) {
  return (
    <div className="empty-analysis">
      <div className="empty-plot" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function FeaturePicker({
  columns,
  selected,
  onChange,
  exclude,
  disabled,
}) {
  return (
    <fieldset className="feature-picker" disabled={disabled}>
      <legend>
        Numeric predictors <span>{selected.length} selected</span>
      </legend>
      <div>
        {columns
          .filter((c) => c !== exclude)
          .map((column, i) => (
            <label
              key={column}
              style={{ "--series": `var(--series-${i % 6})` }}
            >
              <input
                type="checkbox"
                checked={selected.includes(column)}
                onChange={() =>
                  onChange(
                    selected.includes(column)
                      ? selected.filter((c) => c !== column)
                      : [...selected, column],
                  )
                }
              />
              <span>{column}</span>
            </label>
          ))}
      </div>
    </fieldset>
  );
}
export function Dialog({ open, onClose, title, children, className = "" }) {
  const ref = useRef(null);
  const label = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    } else dialog.close?.();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={label}
      className={`dialog ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2 id={label}>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function ArrowLink({ children, onClick }) {
  return (
    <button className="arrow-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={18} />
    </button>
  );
}
