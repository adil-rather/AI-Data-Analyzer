import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Upload from "./views/Upload";
import Dashboard from "./views/Dashboard";
import Forecast from "./views/Forecast";
import Clustering from "./views/Clustering";
import Classification from "./views/Classification";
import Insights from "./views/Insights";

const TITLES = {
  upload: { h: "Data Source", p: "Connect a dataset to begin the analysis" },
  dashboard: { h: "Overview", p: "Profile, statistics & a preview of your data" },
  forecast: { h: "Trend Forecast", p: "Project future values with seasonal modeling" },
  cluster: { h: "Clustering", p: "Discover natural segments with K-Means" },
  classify: { h: "Classification", p: "Train a model to predict categories" },
  insights: { h: "Insights", p: "Correlations, key drivers & anomalies" },
};

export default function App() {
  const [view, setView] = useState("upload");
  const [profile, setProfile] = useState(null);

  function handleLoaded(data, name) {
    setProfile({ ...data, displayName: name });
    setView("dashboard");
  }

  const hasData = !!profile;
  const t = TITLES[view];

  return (
    <div className="app">
      <Sidebar active={view} onNavigate={setView} hasData={hasData} />

      <main className="main">
        <div className="topbar">
          <div className="title">
            <h2>{t.h}</h2>
            <p>{t.p}</p>
          </div>
          {hasData && (
            <div className="dataset-chip">
              <span className="live-dot" />
              <span>
                <b>{profile.displayName}</b>
                <span className="muted">
                  {" "}
                  · {profile.rows.toLocaleString()} rows · {profile.columns.length} cols
                </span>
              </span>
            </div>
          )}
        </div>

        {view === "upload" && <Upload onLoaded={handleLoaded} />}
        {view === "dashboard" && hasData && <Dashboard profile={profile} />}
        {view === "forecast" && hasData && (
          <Forecast profile={profile} datasetId={profile.datasetId} />
        )}
        {view === "cluster" && hasData && (
          <Clustering profile={profile} datasetId={profile.datasetId} />
        )}
        {view === "classify" && hasData && (
          <Classification profile={profile} datasetId={profile.datasetId} />
        )}
        {view === "insights" && hasData && (
          <Insights profile={profile} datasetId={profile.datasetId} />
        )}
      </main>
    </div>
  );
}
