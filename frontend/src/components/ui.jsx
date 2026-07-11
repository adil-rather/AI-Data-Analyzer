import React from "react";

export function Card({ title, sub, children, style, className = "" }) {
  return (
    <div className={`card ${className}`} style={style}>
      {title && <h3>{title}</h3>}
      {sub && <div className="sub">{sub}</div>}
      {children}
    </div>
  );
}

export function StatTile({ icon, label, value, delta, deltaDir }) {
  return (
    <div className="card stat fade-in">
      {icon && <div className="ico">{icon}</div>}
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && (
        <div className={`delta ${deltaDir || ""}`}>
          {deltaDir === "up" ? "▲ " : deltaDir === "down" ? "▼ " : ""}
          {delta}
        </div>
      )}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="loading-box">
      <div className="spinner" />
      {label && <div>{label}</div>}
    </div>
  );
}

export function Empty({ icon = "📊", title, children }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, marginBottom: 6 }}>
        {title}
      </h3>
      <div style={{ maxWidth: 420, margin: "0 auto", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function Pill({ type, children }) {
  return <span className={`pill ${type}`}>{children}</span>;
}

export function Metric({ k, v }) {
  return (
    <div className="metric">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
