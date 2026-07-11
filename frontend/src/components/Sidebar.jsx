import React from "react";

const NAV = [
  { id: "upload", icon: "📥", label: "Data Source" },
  { id: "dashboard", icon: "📊", label: "Overview" },
  { id: "forecast", icon: "📈", label: "Trend Forecast" },
  { id: "cluster", icon: "🧩", label: "Clustering" },
  { id: "classify", icon: "🎯", label: "Classification" },
  { id: "insights", icon: "💡", label: "Insights" },
];

export default function Sidebar({ active, onNavigate, hasData }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">◈</div>
        <div>
          <h1>AI Data Analyzer</h1>
          <span>Predictive ML Studio</span>
        </div>
      </div>

      <div className="nav-label">Workspace</div>
      {NAV.map((n) => {
        const disabled = !hasData && n.id !== "upload";
        return (
          <div
            key={n.id}
            className={`nav-item ${active === n.id ? "active" : ""}`}
            style={disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}
            onClick={() => onNavigate(n.id)}
          >
            <span className="ico">{n.icon}</span>
            {n.label}
          </div>
        );
      })}

      <div style={{ marginTop: "auto", padding: "14px 10px 0" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            lineHeight: 1.5,
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
          }}
        >
          <span className="live-dot" style={{ display: "inline-block", marginRight: 6 }} />
          Models run locally on your machine. No data leaves this device.
          <div style={{ marginTop: 8 }}>
            Created by <b style={{ color: "var(--text-dim)" }}>RATHER_ADIL</b>
            {" · "}
            &copy; 2026 RATHER_ADIL
            {" · "}10/07/2026
          </div>
        </div>
      </div>
    </aside>
  );
}
