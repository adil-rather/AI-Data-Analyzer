import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar, { Brand, NAV } from "./components/Sidebar";
import { Dialog, Loading, Notice, PageHeading } from "./components/ui";
import Upload from "./views/Upload";
import Dashboard from "./views/Dashboard";
import { api } from "./api";
import { WorkspaceContext } from "./hooks/useAnalysis";
const Forecast = lazy(() => import("./views/Forecast"));
const Clustering = lazy(() => import("./views/Clustering"));
const Classification = lazy(() => import("./views/Classification"));
const Insights = lazy(() => import("./views/Insights"));
const descriptions = {
  overview: "Understand the shape of your data before you model it.",
  forecast: "Project a numeric series and understand the model behind it.",
  clustering:
    "Find groups in your data, then understand what makes them different.",
  classification: "Predict a category and evaluate it on held-out data.",
  insights:
    "Explore relationships and observations that deserve a closer look.",
};
const validRoute = () =>
  NAV.some((n) => n.id === location.hash.slice(1))
    ? location.hash.slice(1)
    : "source";

export default function App() {
  const [route, setRoute] = useState(validRoute),
    [profile, setProfile] = useState(null),
    [starting, setStarting] = useState(true),
    [error, setError] = useState(""),
    [navOpen, setNavOpen] = useState(false),
    [confirmClear, setConfirmClear] = useState(false),
    [clearing, setClearing] = useState(false),
    [cache, setCache] = useState({}),
    [retry, setRetry] = useState(0);
  const [uploadEpoch, setUploadEpoch] = useState(0);
  const content = useRef(null),
    generation = useRef(0);
  function navigate(next, replace = false) {
    const target = !profile && next !== "source" ? "source" : next;
    setRoute(target);
    setNavOpen(false);
    if (location.hash !== `#${target}`)
      history[replace ? "replaceState" : "pushState"](null, "", `#${target}`);
  }
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStarting(true);
    setError("");
    api
      .session({ signal: controller.signal })
      .then(({ profile: data }) => {
        if (!active) return;
        setProfile(data);
        if (data && !location.hash) setRoute("overview");
        else if (!data && validRoute() !== "source") {
          setRoute("source");
          history.replaceState(null, "", "#source");
        }
      })
      .catch((e) => {
        if (active && e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (active) setStarting(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [retry]);
  useEffect(() => {
    const change = () => {
      const next = validRoute();
      setRoute(!profile && next !== "source" ? "source" : next);
      setNavOpen(false);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [profile]);
  useEffect(() => {
    document.title = `${NAV.find((n) => n.id === route)?.label || "Workspace"} · AI Data Analyzer`;
  }, [route]);
  useEffect(() => {
    if (starting) return;
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      content.current?.querySelector("h1")?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [route, starting]);
  function loaded(data) {
    generation.current++;
    setProfile(data);
    setCache({});
    setError("");
    setRoute("overview");
    history.pushState(null, "", "#overview");
  }
  async function clear() {
    const current = ++generation.current;
    setClearing(true);
    setUploadEpoch((value) => value + 1);
    try {
      await api.clear();
      if (current !== generation.current) return;
      setProfile(null);
      setCache({});
      setRoute("source");
      history.replaceState(null, "", "#source");
      setConfirmClear(false);
      setError("");
    } catch (e) {
      setError(e.message);
      setConfirmClear(false);
    } finally {
      setClearing(false);
    }
  }
  const title =
    route === "source"
      ? "Bring your data into focus."
      : NAV.find((n) => n.id === route)?.label;
  return (
    <WorkspaceContext.Provider value={{ cache, setCache }}>
      <a
        className="skip-link"
        href="#workspace-content"
        onClick={(e) => {
          e.preventDefault();
          content.current?.focus();
        }}
      >
        Skip to workspace
      </a>
      <div className="app-shell">
        <Sidebar active={route} onNavigate={navigate} hasData={!!profile} />
        <div className="workspace">
          <header className="mobile-header">
            <Brand />
            <button
              className="icon-button menu-toggle"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={24} strokeWidth={1.5} />
            </button>
          </header>
          <header className="workspace-toolbar">
            <div className="breadcrumb">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <strong title={profile?.name}>
                {profile?.name || "Data Source"}
              </strong>
            </div>
            {profile && (
              <div className="toolbar-actions">
                <button
                  className="button small"
                  onClick={() => navigate("source")}
                >
                  Change dataset
                </button>
                <button
                  className="button small secondary"
                  onClick={() => setConfirmClear(true)}
                >
                  Clear data
                </button>
              </div>
            )}
          </header>
          <main
            id="workspace-content"
            ref={content}
            tabIndex={-1}
            className="workspace-content"
          >
            {starting ? (
              <Loading label="Connecting to your workspace…" />
            ) : error && !profile ? (
              <Notice kind="error" onRetry={() => setRetry((x) => x + 1)}>
                {error}
              </Notice>
            ) : (
              <>
                <div key={route} className="view-enter">
                  <PageHeading
                    title={title}
                    description={
                      route === "source"
                        ? "Upload a table or explore a synthetic sample. Start with a question, then let the data guide you."
                        : descriptions[route]
                    }
                    profile={route === "source" ? null : profile}
                  />
                  {error && <Notice kind="error">{error}</Notice>}
                  {route === "source" ? (
                    <Upload
                      key={uploadEpoch}
                      onLoaded={loaded}
                      hasData={!!profile}
                      onReturn={() => navigate("overview")}
                    />
                  ) : (
                    profile && (
                      <Suspense
                        fallback={<Loading label="Opening analysis tools…" />}
                      >
                        <div key={profile.datasetId}>
                          {route === "overview" && (
                            <Dashboard
                              profile={profile}
                              onNavigate={navigate}
                            />
                          )}
                          {route === "forecast" && (
                            <Forecast
                              profile={profile}
                              datasetId={profile.datasetId}
                            />
                          )}
                          {route === "clustering" && (
                            <Clustering
                              profile={profile}
                              datasetId={profile.datasetId}
                            />
                          )}
                          {route === "classification" && (
                            <Classification
                              profile={profile}
                              datasetId={profile.datasetId}
                            />
                          )}
                          {route === "insights" && (
                            <Insights
                              profile={profile}
                              datasetId={profile.datasetId}
                            />
                          )}
                        </div>
                      </Suspense>
                    )
                  )}
                </div>
                <footer className="workspace-footnote">
                  Uploaded data is processed on this server and stored
                  temporarily. Avoid sensitive data.{" "}
                  <a
                    href="https://github.com/adil-rather/AI-Data-Analyzer#data-privacy-and-upload-safety"
                    target="_blank"
                    rel="noreferrer"
                  >
                    How your data is handled ↗
                  </a>
                </footer>
              </>
            )}
          </main>
        </div>
      </div>
      <Dialog
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title="Workspace navigation"
        className="navigation-dialog"
      >
        <Sidebar
          active={route}
          onNavigate={navigate}
          hasData={!!profile}
          mobile
        />
      </Dialog>
      <Dialog
        open={confirmClear}
        onClose={() => {
          if (!clearing) setConfirmClear(false);
        }}
        title="Clear this workspace?"
      >
        <p>
          The uploaded table and its analysis results will be removed from this
          session. Your original file stays on your device.
        </p>
        <div className="dialog-actions">
          <button
            className="button secondary"
            autoFocus
            onClick={() => setConfirmClear(false)}
            disabled={clearing}
          >
            Keep data
          </button>
          <button className="button danger" onClick={clear} disabled={clearing}>
            {clearing ? "Deleting…" : "Delete dataset"}
          </button>
        </div>
      </Dialog>
    </WorkspaceContext.Provider>
  );
}
