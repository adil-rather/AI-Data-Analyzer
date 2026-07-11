# AI Data Analyzer

> Made by **ADIL_RATHER** · Date: 10/07/2026 · © Copyright 2026 ADIL_RATHER. All rights reserved.

A machine-learning studio that predicts trends from large datasets, with a
custom dark glassmorphism UI. Built with **React + Vite** (frontend) and
**FastAPI** (Python ML backend).

## Features

- **Data Source** — upload CSV/Excel or use a built-in synthetic dataset.
- **Overview** — automatic column profiling, type detection, stats & preview.
- **Trend Forecast** — linear trend + FFT-detected seasonality, with a 95%
  confidence band.
- **Clustering** — K-Means segmentation with PCA projection and silhouette score.
- **Classification** — RandomForest with accuracy / precision / recall / F1,
  confusion matrix and feature importances.
- **Insights** — correlation heatmap, strongest pairs, key drivers and
  z-score anomaly detection.

All processing happens locally — no data leaves your machine.

## Run it

**Backend** (terminal 1):
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend** (terminal 2):
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Project layout

```
ai-data-analyzer/
├── backend/
│   ├── main.py          # FastAPI app + ML endpoints
│   ├── sample_data.py   # synthetic datasets (retail, customers, sensors, stocks)
│   └── requirements.txt
└── frontend/
    ├── src/App.jsx
    ├── src/components/  # UI primitives + sidebar
    ├── src/views/       # Upload, Dashboard, Forecast, Clustering, Classification, Insights
    └── src/api.js

---

# How It Works (Inside the Project)

This section explains what the code actually does and *why* each piece exists,
written as if you were explaining how you built it from scratch.

## 1. Big picture: two services, one job

The app is split into two independent programs that talk over the network:

```
 Browser (React UI)  ──HTTP /api/*──▶  FastAPI backend (Python ML)
 http://localhost:5173              http://localhost:8000
```

- **Frontend (React + Vite)** — draws the buttons, tables, and charts. It knows
  nothing about math; it only sends JSON requests and renders JSON responses.
- **Backend (FastAPI + Python)** — receives those requests, runs the actual
  machine-learning, and returns plain JSON.

**Why split it?** The heavy lifting (pandas, scikit-learn, numpy) is Python
territory, while the interface (reactive UI, charts) is JavaScript territory.
Keeping them separate means each side uses the best tool for its job and can be
developed/run independently.

**How do they connect without errors?** In development, Vite is configured
(`vite.config.js`) to *proxy* every `/api` request to `http://localhost:8000`.
So the browser only ever talks to `localhost:5173`, and Vite silently forwards
the `/api/*` calls to the backend. This avoids CORS (cross-origin) headaches
entirely. The backend also sets a permissive `CORSMiddleware` as a safety net.

## 2. What happens when you use it (request flow)

1. You click something in the UI (e.g. "Load sample dataset").
2. The React view calls a function from `src/api.js`, e.g. `api.loadSample(...)`.
3. `api.js` does `fetch("/api/sample", ...)`. Vite rewrites that to
   `http://localhost:8000/api/sample`.
4. FastAPI matches the URL to a function decorated with `@app.post("/api/sample")`
   in `backend/main.py`, runs the Python, and returns JSON.
5. React receives the JSON and re-renders the page (table, chart, stats).

No page reloads — it's a single-page app; only the data moves back and forth.

## 3. The backend — how it was built (`backend/main.py`)

**Framework: FastAPI.** Chosen because it gives automatic interactive API docs
at `/docs`, validates request bodies with type hints (Pydantic), and is
asynchronous-friendly. Each ML capability is just a function with an
`@app.post(...)` decorator.

**Datasets live in memory, not a database.** When you upload a file or load a
sample, the DataFrame is stored in a Python dictionary `_STORE` keyed by an ID
like `ds_1`:

```python
_STORE: dict[str, pd.DataFrame] = {}
# upload → _register(df) stores it and returns {"datasetId": "ds_1", ...}
```

**Why in-memory?** This is a local, single-user analysis tool. A database would
add setup, files, and complexity for zero benefit. The trade-off: if you restart
the backend, the loaded datasets are gone (you just re-upload). Every later
request (`/api/forecast`, `/api/cluster`, …) references that `datasetId` to
fetch the same DataFrame back via `_get(datasetId)`.

**Column-type detection (`_column_type`).** Before any analysis, the backend
inspects each column and labels it `numeric`, `datetime`, `categorical`, or
`text` using simple heuristics (is it numbers? does it parse as dates? how many
unique values?). This drives the UI: numeric columns become chartable axes,
categorical columns become dropdown options, etc.

**Profiling (`_profile`).** Computes per-column statistics (mean/std/min/max for
numbers; value counts for categories) plus a 50-row preview, and returns it as
the "Overview" page.

### The five ML endpoints

**Forecast (`/api/forecast`)** — predicts future values of one numeric column.
- Fits a **linear trend** with `np.polyfit` (least-squares line through the data).
- Subtracts the trend to get *residuals*, then runs an **FFT**
  (`np.fft.rfft`) on those residuals to find the dominant repeating period
  (seasonality, e.g. weekly/monthly). Why FFT? It's the fastest way to detect a
  repeating cycle hidden in noisy data.
- Reconstructs `trend + seasonal` and projects it forward `periods` steps.
- Draws a **95% confidence band** as `±1.96 × residual_std` (the statistical
  rule for "about 95% of normal variation").
- Returns `r2` (how well the line fits) and a plain-language `summary`
  (direction, next value, total change).

**Cluster (`/api/cluster`)** — K-Means segmentation.
- Scales features with `StandardScaler` (why: K-Means uses distance, so
  features on wildly different scales would dominate).
- Runs `KMeans(n_clusters=...)`.
- If there are more than 2 features, it reduces them to 2 dimensions with
  **PCA** so the result can be drawn on an X/Y scatter plot.
- Reports a **silhouette score** — a 0–1 quality metric telling you how
  well-separated the clusters are.

**Classify (`/api/classify`)** — trains a **RandomForest** to predict a
categorical column from numeric features.
- Splits data into train/test (`train_test_split`, 75/25 by default).
- Encodes the target labels with `LabelEncoder`.
- Trains `RandomForestClassifier(n_estimators=120)`. Why RandomForest? It handles
  non-linear patterns, rarely overfits, and naturally reports **feature
  importances** — which inputs actually drive the prediction.
- Returns accuracy / precision / recall / F1, a **confusion matrix**, and the
  ranked feature importances.

**Insights (`/api/insights`)** — the "so what?" page.
- Builds a **correlation matrix** (`df.corr()`) and ranks the strongest pairs.
- Flags **anomalies** using a **z-score**: for each numeric row,
  `z = (value − mean) / std`; any row whose z-score exceeds the threshold
  (default 3.0, i.e. >3 standard deviations) is flagged as an outlier.

### Synthetic data (`backend/sample_data.py`)

Instead of forcing you to find a dataset, the app ships four generated ones:
`retail_sales`, `customer_segments`, `sensor_telemetry`, `stock_prices`. Each is
built with numpy/pandas and deliberately contains **trends + seasonality + noise**
(and, for sensors, **injected anomalies**) so every feature has something
interesting to show. A fixed random seed (`default_rng(42)`) makes them
reproducible — the same data every time. **Why synthetic?** The demos work
offline, instantly, with no upload step, and they reliably exercise each
algorithm.

## 4. The frontend — how it was built (`frontend/src/`)

**Stack: React 18 + Vite 5 + Recharts.**
- **Vite** was chosen as the dev server/bundler because it starts instantly and
  hot-reloads on save. The `npm run dev` script is literally just `vite`.
- **React** gives a component model: small reusable pieces composed into pages.
- **Recharts** is the charting library (the line/bar/scatter/heatmap visuals).

**State: plain React, no extra library.** `App.jsx` holds two pieces of state:
`view` (which page is showing) and `profile` (the loaded dataset's schema +
`datasetId`). When data loads, `handleLoaded()` stores the profile and switches
to the Dashboard. There's no Redux/Vite-router — navigation is just
`setView("forecast")` toggling which view component renders. (A router library
would be overkill for six static pages.)

**The views** (`src/views/`) each own one feature:
`Upload` → `Dashboard` → `Forecast` → `Clustering` → `Classification` →
`Insights`. Each calls the matching `api.*` function and renders the JSON.
The `Sidebar` (`components/Sidebar.jsx`) lists these and greys out the analysis
pages until a dataset is loaded (`hasData`).

**API layer (`src/api.js`).** One small module wraps `fetch` so the rest of the
app never touches URLs or error parsing directly. It centralizes the `/api`
prefix and extracts FastAPI's `detail` error messages. Upload is handled
slightly differently (it sends `FormData` for the file instead of JSON).

**Styling (`src/index.css`).** A single hand-written stylesheet, no UI framework.
It implements the **dark glassmorphism** look via CSS custom properties
(`--panel`, `--grad`, etc.), translucent panels with `backdrop-filter: blur()`,
and a blue→purple→teal gradient accent. Fonts are *Inter* (body) and *Space
Grotesk* (headings). Everything is responsive — below 1024px the sidebar hides
and grids stack.

## 5. Why "everything runs locally"

Every computation happens in the backend's RAM on *your* machine. Files are
parsed in memory and never uploaded to any server. That's why the sidebar footer
says *"Models run locally on your machine. No data leaves this device."* — it's
a real property of the architecture, not a slogan.

## 6. Tech-stack summary (what & why)

| Piece | Library / Tool | Why it's here |
|---|---|---|
| Backend web framework | **FastAPI** | Auto docs, typed validation, async, minimal boilerplate |
| Backend ML | **scikit-learn** | Battle-tested KMeans, RandomForest, PCA, metrics |
| Backend data | **pandas** + **numpy** | Table handling, statistics, FFT, vector math |
| Excel support | **openpyxl** | Reads `.xlsx`/`.xls` uploads |
| File uploads | **python-multipart** | Lets FastAPI accept `multipart/form-data` files |
| Dev server / bundler | **Vite** | Instant dev server, hot reload, simple build |
| UI | **React 18** | Component model, reactive state |
| Charts | **Recharts** | Declarative React charts |
| Styling | Hand-written **CSS** | Full control of the glassmorphism design, zero dependency |

---

## 7. Behind the Build — Q&A (the questions you'd get)

**Q: What does this app actually do?**
A: It's a local ML studio. You give it tabular data (CSV/Excel or a built-in
sample), and it profiles it, forecasts trends, clusters rows into segments,
trains a classifier, and surfaces correlations + anomalies — all in a visual UI.

**Q: How does data get into the app?**
A: Two ways — (1) upload a `.csv`/`.xlsx` via the Data Source page (parsed by
pandas in the backend), or (2) click one of four synthetic sample datasets
generated on the fly by `sample_data.py`. Either way it's stored in the
backend's in-memory `_STORE` and handed a `datasetId`.

**Q: How does the frontend talk to the backend?**
A: Through HTTP `POST`/`GET` calls to `/api/*` URLs, defined once in
`src/api.js`. Vite proxies those to `localhost:8000` in dev, so there are no
CORS issues.

**Q: Where does the actual math happen?**
A: 100% in `backend/main.py` using numpy/pandas/scikit-learn. The frontend only
sends parameters (e.g. which column to forecast) and draws the returned numbers.

**Q: Why KMeans for clustering and RandomForest for classification?**
A: KMeans is the simplest, fastest way to find natural groupings and gives a
clean silhouette score. RandomForest is robust, handles messy real-world data,
and importantly reports which features matter most — exactly what users want to
see.

**Q: How does forecasting find seasonality?**
A: It fits a straight trend line, looks at what's *left over* (the residuals),
and runs an FFT to find the strongest repeating cycle in that leftover signal.

**Q: Is my data sent anywhere?**
A: No. All parsing and modeling happen in the backend process on your machine.
Nothing is transmitted to an external server.

**Q: What's the catch of the in-memory design?**
A: If you restart the backend, loaded datasets are cleared and you re-upload.
For a local single-user tool that's an acceptable trade-off versus running a
database.

**Q: How would I add a new analysis feature?**
A: (1) Add an endpoint function in `backend/main.py` returning JSON; (2) add a
matching call in `src/api.js`; (3) create a view in `src/views/` and register it
in `App.jsx` + `Sidebar.jsx`. That three-step pattern covers every existing
feature.
```
