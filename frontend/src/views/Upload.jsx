import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ChartNoAxesColumn,
  FileSpreadsheet,
  Info,
  ShoppingCart,
  Users,
} from "lucide-react";
import { api } from "../api";
import { Loading, Notice, Section } from "../components/ui";
import { fmt } from "../lib";
const icons = {
  retail_sales: ShoppingCart,
  customer_segments: Users,
  sensor_telemetry: Activity,
  stock_prices: ChartNoAxesColumn,
};
export default function Upload({ onLoaded, hasData, onReturn }) {
  const [samples, setSamples] = useState([]),
    [sampleError, setSampleError] = useState(""),
    [retry, setRetry] = useState(0),
    [loadingSamples, setLoadingSamples] = useState(true),
    [busy, setBusy] = useState(""),
    [progress, setProgress] = useState(null),
    [drag, setDrag] = useState(false),
    [error, setError] = useState("");
  const input = useRef(null),
    controller = useRef(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setLoadingSamples(true);
    setSampleError("");
    api
      .samples({ signal: abort.signal })
      .then(setSamples)
      .catch((e) => {
        if (e.name !== "AbortError") setSampleError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoadingSamples(false);
      });
    return () => abort.abort();
  }, [retry]);
  async function run(task, label) {
    if (busy) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(label);
    setError("");
    try {
      const data = await task(current.signal);
      if (alive.current && !current.signal.aborted) onLoaded(data);
    } catch (e) {
      if (alive.current && e.name !== "AbortError") setError(e.message);
    } finally {
      if (alive.current) {
        setBusy("");
        setProgress(null);
      }
    }
  }
  function upload(file) {
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError(
        "Choose a UTF-8 CSV or .xlsx file. Other file types are not accepted.",
      );
      return;
    }
    setProgress(0);
    run(
      (signal) => api.uploadFile(file, { signal, onProgress: setProgress }),
      `Uploading ${file.name}`,
    );
  }
  return (
    <>
      <div
        className={`dropzone ${drag ? "dragging" : ""} ${busy ? "is-busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy) upload(e.dataTransfer.files[0]);
        }}
      >
        <FileSpreadsheet size={48} strokeWidth={1.2} aria-hidden="true" />
        <h2>
          {busy
            ? progress === 100
              ? "Profiling your complete dataset…"
              : busy
            : "Drop a CSV or Excel file here"}
        </h2>
        {busy ? (
          <>
            <Loading
              label={
                progress === null
                  ? "Preparing your sample…"
                  : progress < 100
                    ? `Uploading · ${progress}%`
                    : "Upload complete. Reading and profiling every row…"
              }
            />
            {progress !== null && (
              <progress
                value={progress}
                max={100}
                aria-label="Upload progress"
              />
            )}
            <button
              className="button secondary"
              onClick={() => {
                controller.current?.abort();
                setBusy("");
                setProgress(null);
              }}
            >
              Cancel request
            </button>
          </>
        ) : (
          <button className="button" onClick={() => input.current?.click()}>
            Choose file
          </button>
        )}
        <p>UTF-8 CSV or .xlsx · large CSVs supported · values-only tables</p>
        <input
          ref={input}
          type="file"
          accept=".csv,.xlsx"
          aria-label="Upload a dataset"
          className="sr-only"
          onChange={(e) => {
            upload(e.target.files[0]);
            e.target.value = "";
          }}
          disabled={!!busy}
        />
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="upload-guidance">
        <Info size={19} />
        <p>
          Files are processed on this server, not only in your browser. The full
          dataset stays in temporary storage and expires after 60 minutes of
          inactivity. Large-file models use labeled samples. Avoid personal or
          sensitive data.
        </p>
      </div>
      <details className="upload-safety">
        <summary>Supported data & safe uploads</summary>
        <p>
          CSV is recommended for million-row tables. No low file-size or row cap
          is imposed by this app; available server storage and hosting request
          limits still apply. Use up to 100 uniquely named columns and text
          cells up to 8,192 characters. Macros, formulas, embedded objects and
          external workbook connections are rejected. Files are never executed.
          Large Excel workbooks may need conversion to CSV.
        </p>
      </details>
      {hasData && (
        <p className="return-link">
          <button className="text-button" onClick={onReturn}>
            Return to current dataset ↗
          </button>{" "}
          A failed upload keeps the current table.
        </p>
      )}
      <Section
        title="Explore without an upload"
        description="Four reproducible synthetic datasets, ready to analyze."
        className="sample-section"
      >
        {loadingSamples ? (
          <Loading label="Loading sample datasets…" />
        ) : sampleError ? (
          <Notice kind="error" onRetry={() => setRetry((x) => x + 1)}>
            {sampleError}
          </Notice>
        ) : (
          <div className="sample-list">
            {samples.map((sample) => {
              const Icon = icons[sample.id] || FileSpreadsheet;
              return (
                <div className="sample-row" key={sample.id}>
                  <Icon className="sample-icon" size={31} strokeWidth={1.4} />
                  <div className="sample-copy">
                    <h3>{sample.name}</h3>
                    <p>{sample.description}</p>
                  </div>
                  <div className="sample-size">
                    <span>
                      {fmt(
                        sample.rows ||
                          {
                            retail_sales: 730,
                            customer_segments: 600,
                            sensor_telemetry: 1000,
                            stock_prices: 500,
                          }[sample.id],
                        0,
                      )}{" "}
                      rows
                    </span>
                    <span>
                      {sample.columns ||
                        { sensor_telemetry: 4 }[sample.id] ||
                        6}{" "}
                      columns
                    </span>
                  </div>
                  <button
                    className="button secondary"
                    aria-label={`Load ${sample.name} sample`}
                    disabled={!!busy}
                    onClick={() => {
                      setProgress(null);
                      run(
                        (signal) => api.loadSample(sample.id, { signal }),
                        `Loading ${sample.name}…`,
                      );
                    }}
                  >
                    Load sample <ArrowRight size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="quiet-note">
          The stock dataset is simulated. These sample results do not describe
          real people or businesses.
        </p>
      </Section>
    </>
  );
}
