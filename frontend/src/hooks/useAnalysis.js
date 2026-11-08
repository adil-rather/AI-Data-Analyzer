import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api";
export const WorkspaceContext = createContext(null);
export function useAnalysis(key, initial, endpoint, datasetId) {
  const { cache, setCache } = useContext(WorkspaceContext);
  const state = cache[key] || {
    params: initial,
    result: null,
    lastParams: null,
  };
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const setParams = (patch) =>
    setCache((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || state),
        params: { ...(prev[key]?.params || state.params), ...patch },
      },
    }));
  async function run(event) {
    event?.preventDefault();
    if (busy) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const params = { ...state.params };
    setBusy(true);
    setError("");
    try {
      const result = await api[endpoint](
        { datasetId, ...params },
        { signal: current.signal },
      );
      if (alive.current && !current.signal.aborted)
        setCache((prev) => ({
          ...prev,
          [key]: { ...(prev[key] || state), result, lastParams: params },
        }));
    } catch (e) {
      if (alive.current && e.name !== "AbortError") setError(e.message);
    } finally {
      if (alive.current && !current.signal.aborted) setBusy(false);
    }
  }
  function cancel() {
    controller.current?.abort();
    setBusy(false);
    setError(
      "Request cancelled. A calculation already started on the server may finish in the background.",
    );
  }
  return {
    ...state,
    setParams,
    run,
    cancel,
    busy,
    error,
    stale:
      state.result &&
      JSON.stringify(state.params) !== JSON.stringify(state.lastParams),
  };
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}
