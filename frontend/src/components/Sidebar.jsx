import {
  Activity,
  ChartNoAxesCombined,
  Database,
  Grid2X2,
  Layers,
  Network,
  ScanLine,
} from "lucide-react";
export const NAV = [
  { id: "source", label: "Data Source", Icon: Database },
  { id: "overview", label: "Overview", Icon: Grid2X2 },
  { id: "forecast", label: "Trend Forecast", Icon: ChartNoAxesCombined },
  { id: "clustering", label: "Clustering", Icon: Network },
  { id: "classification", label: "Classification", Icon: Layers },
  { id: "insights", label: "Insights", Icon: ScanLine },
];
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <img src="/project-icon-128.png" width="44" height="44" alt="" />
      </span>
      <span>AI Data Analyzer</span>
    </div>
  );
}
export default function Sidebar({
  active,
  onNavigate,
  hasData,
  mobile = false,
}) {
  return (
    <aside
      className={`sidebar ${mobile ? "mobile-sidebar" : "desktop-sidebar"}`}
    >
      <Brand />
      <p className="nav-label">Workspace</p>
      <nav aria-label={mobile ? "Mobile workspace" : "Workspace"}>
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? "active" : ""}`}
            aria-current={active === id ? "page" : undefined}
            disabled={!hasData && id !== "source"}
            onClick={() => onNavigate(id)}
          >
            <Icon size={19} strokeWidth={1.6} />
            <span>{label}</span>
            <span className="nav-active-dot" />
          </button>
        ))}
      </nav>
      <div className="sidebar-note">
        <a
          href="https://rather-builds.vercel.app/"
          target="_blank"
          rel="noreferrer"
        >
          By Rather Builds <Activity size={14} />
        </a>
        <p>Temporary server session</p>
        <small>Your dataset expires after 60 minutes of inactivity.</small>
      </div>
    </aside>
  );
}
