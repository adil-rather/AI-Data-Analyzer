export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function errorMessage(body, fallback) {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail))
    return body.detail
      .map(
        (e) =>
          `${(e.loc || []).filter((x) => x !== "body").join(".")}: ${e.msg}`,
      )
      .join(" · ");
  return fallback;
}

async function request(path, { signal, ...options } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 120000);
  try {
    const response = await fetch("/api" + path, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "AI-Data-Analyzer",
        ...options.headers,
      },
      signal: controller.signal,
    });
    if (response.status === 204) return null;
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        errorMessage(
          body,
          `Request failed (${response.status}). Please try again.`,
        ),
        response.status,
      );
    if (body === null)
      throw new ApiError(
        "The server returned an unreadable response. Try again after it finishes starting.",
        502,
      );
    return body;
  } catch (error) {
    if (timedOut)
      throw new ApiError(
        "The server is taking too long. Check the connection or retry when it is less busy.",
        408,
      );
    if (error.name === "AbortError" || error instanceof ApiError) throw error;
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function post(path, body, options) {
  return request(path, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });
}

function uploadFile(file, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = () => signal?.removeEventListener("abort", abort);
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("X-Requested-With", "AI-Data-Analyzer");
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      finish();
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body);
      else
        reject(
          new ApiError(
            errorMessage(
              body,
              `Upload failed (${xhr.status}). The hosting service may have a request or storage limit.`,
            ),
            xhr.status,
          ),
        );
    };
    xhr.onerror = () => {
      finish();
      reject(
        new ApiError(
          "Upload interrupted. Check your connection and try again.",
          0,
        ),
      );
    };
    xhr.ontimeout = () => {
      finish();
      reject(
        new ApiError(
          "Upload timed out. Large datasets may need a stronger server or a local run.",
          408,
        ),
      );
    };
    xhr.onabort = () => {
      finish();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const form = new FormData();
    form.append("file", file);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      finish();
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    xhr.send(form);
  });
}

export const api = {
  session: (options) => request("/session", options),
  samples: (options) => request("/samples", options),
  clear: (options) => request("/dataset", { ...options, method: "DELETE" }),
  loadSample: (name, options) => post("/sample", { name }, options),
  uploadFile,
  forecast: (body, options) => post("/forecast", body, options),
  cluster: (body, options) => post("/cluster", body, options),
  classify: (body, options) => post("/classify", body, options),
  insights: (body, options) => post("/insights", body, options),
};
