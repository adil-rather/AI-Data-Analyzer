<img src="frontend/public/project-icon.png" width="96" height="96" alt="AI Data Analyzer project mark">

# AI Data Analyzer

[![View Live Project](https://img.shields.io/badge/🌐_View_Project_Online-00E5FF?style=for-the-badge&logoColor=black)](https://ai-data-analyzer-xa0c.onrender.com/)

A practical workbench for understanding tabular data, exploring patterns and evaluating machine-learning baselines. Built by **Adil Hassan Rather / Rather Builds** with React, FastAPI, DuckDB and scikit-learn.

Version 2 rebuilds the original interface and data lifecycle. It uses a forest-and-stone workspace, distinct chart colors, responsive tables, accessible navigation and subtle motion. More importantly, uploaded datasets are isolated by browser session, large CSVs are stored on disk, and model outputs explain what was actually analyzed.

**The name refers to machine-learning analysis. This app does not call an LLM, generate explanations with an external AI service, or require an API key.**

## Read the project in this order

1. This README: setup, workflow and major decisions.
2. [Architecture and request lifecycle](docs/architecture.md): how the code fits together, from file upload to rendered result.
3. [Analysis methods](docs/analysis-methods.md): calculations, validation, metrics and limitations of every model.
4. [API reference](docs/api.md): routes, request fields and error handling.
5. [Upload safety and privacy](docs/security.md): actual protections, resource boundaries and remaining risks.
6. [Deployment and maintenance](docs/deployment.md): Render, testing, updates and troubleshooting.
7. [Project PNG and asset notes](assets/README.md): files, colors and how the icon was made.

These documents describe the implementation, including its limits. They are also intended as an explanation you can use when presenting the project.

## What you can do

| Workspace      | Purpose                                                                          | Main output                                                                     |
| -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Data Source    | Upload UTF-8 CSV or a values-only `.xlsx` workbook; try four synthetic samples   | An isolated, temporary dataset                                                  |
| Overview       | Inspect the entire table's shape, column types, missing values and distributions | Full-dataset statistics, first-50-row preview, column inspector                 |
| Trend Forecast | Extend an ordered numeric series with a simple trend/seasonal baseline           | Actual/fitted/projected chart, chronological holdout errors, forecast CSV       |
| Clustering     | Group complete numeric observations with standardized K-Means                    | Colored projection, silhouette score, cluster sizes and original-unit centroids |
| Classification | Predict a category from separate numeric predictors                              | Stratified holdout scores, feature importance and confusion matrix              |
| Insights       | Compare numeric variables and flag unusual observed values                       | Correlations, strongest pairs and z-score flags                                 |

The four built-in datasets are **synthetic**, deterministic and generated with seed 42: retail sales, customer segments, sensor telemetry and stock prices. They are examples, not evidence about actual customers, markets or business performance.

## Large CSVs: storage is different from model size

The app has no fixed 10 MB upload limit or 25,000-row ingestion limit. CSVs with millions of rows can be ingested into a temporary DuckDB table without first loading the complete file into pandas. A regression test uploads **1,000,001 rows** and checks that all rows remain stored and counted.

This does not mean unlimited hosting capacity. Available disk space, request timeouts, the host's upload limits and computational resources still apply. CSV is recommended for large datasets; expanded Excel content is deliberately bounded to protect its XML parser.

- **Overview:** counts, missing values, ranges, means, standard deviations and histogram bins use the stored table. Large-table medians and high-cardinality distinct counts are approximate and labeled accordingly.
- **Clustering, classification, insights:** all rows when there are at most 25,000; otherwise a reproducible reservoir sample of 25,000 rows.
- **Forecast:** all rows up to 25,000; otherwise the most recent 25,000 observations by selected date, or the last 25,000 in file order.
- **Plots:** bounded separately to keep the browser responsive. Clustering displays at most 2,000 points; the model may use more observations.
- **Text preview:** long text is previewed to 256 characters; the stored source values are retained.

Every model result includes an `analysisScope` showing `sourceRows`, `analyzedRows` and `method`. Sampling is never presented as a full-dataset model. A sample can miss rare groups or unusual events; use a representative dataset and interpret results accordingly.

## Requirements

- Python **3.11** (development tested with 3.11.15).
- Node.js **24** (development tested with 24.17.0; package engine requires >=22.22.2).
- A modern browser and enough temporary disk space for the input, database and intermediate files.
- Chrome for the Windows browser-test commands below, or Playwright Chromium on Linux/macOS.

No database server, Supabase project, AI subscription or environment secrets are required. DuckDB is an embedded local database library. Production still needs a running Python service; static hosting alone cannot run the API.

## Run the complete app on Windows

From the repository root in PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
npm ci --prefix frontend
npm run build --prefix frontend
.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). One Python service serves both the API and the built frontend. Activation is optional because the commands explicitly use the virtual environment.

For a production-only install, use `requirements.txt` at the repository root instead of the development requirements. It includes the pinned backend runtime dependencies.

### macOS / Linux equivalent

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
npm ci --prefix frontend
npm run build --prefix frontend
.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1
```

### Develop with hot reload

Keep the API running on port 8000. In a second terminal:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to port 8000; keep the browser on one origin so its session cookie stays consistent. React builds the interface; Vite is the development server and build tool, not an alternative to React.

## First useful workflow

1. Choose **Retail Sales → Load sample**. Overview opens with the dataset's actual statistics.
2. Select a table column or the inspector dropdown. Check its missing count and distribution.
3. Use **Trend Forecast**, select `sales`, order by `date`, leave a 30-step horizon and run.
4. Inspect the holdout MAE/RMSE, historical fit and assumptions. Export the forecast values if useful.
5. Return to Data Source and load **Customer Segments**. Try clustering `income`, `spending_score` and `age` with K=3.
6. In Classification, predict `segment` from separate numeric predictors. Inspect the confusion matrix, not just accuracy.
7. Load **Sensor Telemetry** for Insights. Review flagged rows as candidates for investigation, not automatically bad data.
8. **Clear data** removes the temporary table and analysis state. A failed replacement upload preserves the previous dataset.

Navigation preserves completed analysis while the same dataset is loaded. Changing a parameter marks existing results as outdated until you run again. Reload restores the server dataset if its session is still alive; completed model results are browser-memory state and are not restored after a reload.

## Data privacy and upload safety

**On the hosted app, the file leaves your device and is processed on the server.** When you run the complete app locally, processing stays on that local server. No uploaded values are sent to an external AI provider.

Datasets are kept in temporary disk-backed tables owned by an opaque HTTP-only browser-session cookie. They expire after 60 minutes without an API access, are removed by Clear data, and are discarded on normal server shutdown. Expiry/cleanup is not a promise of forensic erasure from the host's storage. A server restart also invalidates the process-local session registry.

The upload path accepts only CSV and `.xlsx`, validates structure and text, inspects Excel archives, rejects formulas/macros/embedded objects/external workbook relationships, and never executes uploaded cells or scripts. Parsers and models have resource controls, and CSV export neutralizes spreadsheet formulas. These protections are **not an antivirus service or a guarantee against every malicious file**. Use non-sensitive data. See [the complete threat model](docs/security.md).

## Tests and checks

Backend, from the repository root:

```powershell
.venv\Scripts\python.exe -m pytest backend/tests -q
.venv\Scripts\ruff.exe check backend --select F
.venv\Scripts\ruff.exe format --check backend
```

Frontend:

```bash
npm test --prefix frontend
npm run build --prefix frontend
npm audit --prefix frontend --omit=dev
```

Browser tests, with the built frontend:

```powershell
cd frontend
$env:ANALYZER_PYTHON='../.venv/Scripts/python.exe'
$env:PLAYWRIGHT_CHROME_EXECUTABLE='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run test:e2e
```

On Linux CI, the workflow installs Playwright Chromium. Browser tests cover real sample/upload/model flows, navigation, phone controls and session cleanup. The backend suite covers isolation, malformed uploads, workbook active content, model edge cases, metadata collisions and large-file ingestion. No finite test suite proves an application bug-free.

## Source map

```text
backend/
  main.py             API composition, session/security middleware, job slots, SPA host
  upload_parser.py    one-file multipart parsing, bounded headers and memory spool
  dataset_engine.py   streamed uploads, workbook inspection, DuckDB profiles and model subsets
  store.py            session ownership, expiry, atomic replacement and cleanup
  analysis.py         forecasting, clustering, classification and insights
  schemas.py          typed request bounds
  tabular.py          finite JSON-safe scalar conversion
  sample_data.py      four reproducible synthetic data generators
  tests/              API, model, file-safety and large-data regressions
frontend/
  src/App.jsx         shell, hash navigation, dataset lifecycle and result cache
  src/api.js          same-origin API, readable errors, cancellation, upload progress
  src/hooks/          cached analysis state and motion preference
  src/components/     navigation, dialogs, tables, fields and chart primitives
  src/views/          the six real workflows
  src/lib.js          shared colors, number formatting and formula-safe CSV export
  src/index.css       responsive design tokens, layouts and motion
  src/tests/          component and API-client regressions
  e2e/                browser workflow tests
  public/             PNG mark and favicon
docs/                 architecture, methods, API, security and deployment guides
assets/               original generated PNG and provenance
```

## Deployment

The existing Render service can deploy this repository's `main` branch. See [deployment instructions](docs/deployment.md) before changing build/runtime settings. Keep **one worker and one instance**: browser-session ownership currently lives in process memory, even though table contents are on disk.

For durable workspaces, multiple instances, stronger public abuse resistance or full-data model jobs at much larger scale, the next step is shared object storage, a durable registry, authenticated access and a bounded background-job queue. They are separate architectural work, not features silently claimed by this version.

## Project identity and ownership

The [512px transparent project PNG](frontend/public/project-icon.png) is suitable for a portfolio cover or project listing. The [high-resolution original](assets/project-icon-original.png) is preserved. The icon uses forest, sage and copper; [asset notes](assets/README.md) record its AI-assisted generation and optimization.

© 2026 Adil Hassan Rather / Rather Builds. The repository has no separate open-source license grant; dependency and font licenses remain their respective owners'.
