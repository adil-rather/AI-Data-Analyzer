import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Card, Spinner } from "../components/ui";

export default function Upload({ onLoaded }) {
  const [samples, setSamples] = useState([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef();

  useEffect(() => {
    api.samples().then(setSamples).catch(() => {});
  }, []);

  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.uploadFile(file);
      onLoaded(data, file.name);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadSample(name) {
    setBusy(true);
    setError("");
    try {
      const data = await api.loadSample(name);
      onLoaded(data, name.replace(/_/g, " "));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (busy) return <Spinner label="Analyzing dataset…" />;

  return (
    <div className="fade-in">
      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="big">☁️</div>
        <h3>Drop a CSV or Excel file here</h3>
        <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
          or click to browse — your data is processed locally
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          hidden
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(248,114,114,0.12)",
            border: "1px solid rgba(248,114,114,0.3)",
            color: "#ffb0b0",
            fontSize: 13,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div style={{ marginTop: 34, marginBottom: 4 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18 }}>
          Or start with a sample dataset
        </h3>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>
          Realistic synthetic data so you can explore every feature instantly.
        </p>
      </div>

      <div className="sample-grid">
        {samples.map((s) => (
          <div key={s.id} className="sample slide-in" onClick={() => loadSample(s.id)}>
            <h4>
              {s.id === "retail_sales" && "🛍️ "}
              {s.id === "customer_segments" && "👥 "}
              {s.id === "sensor_telemetry" && "📡 "}
              {s.id === "stock_prices" && "💹 "}
              {s.name}
            </h4>
            <p>{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
