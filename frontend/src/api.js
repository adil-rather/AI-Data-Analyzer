const BASE = "/api";

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) msg = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  samples: () => req("/samples"),
  loadSample: (name, rows) =>
    req("/sample", {
      method: "POST",
      body: JSON.stringify({ name, rows }),
    }),
  uploadFile: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(BASE + "/upload", { method: "POST", body: form });
    if (!res.ok) {
      let msg = "Upload failed";
      try {
        const b = await res.json();
        if (b.detail) msg = b.detail;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  },
  forecast: (body) => req("/forecast", { method: "POST", body: JSON.stringify(body) }),
  cluster: (body) => req("/cluster", { method: "POST", body: JSON.stringify(body) }),
  classify: (body) => req("/classify", { method: "POST", body: JSON.stringify(body) }),
  insights: (body) => req("/insights", { method: "POST", body: JSON.stringify(body) }),
};
