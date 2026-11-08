# AI Data Analyzer rebuild

## Intent and accepted direction

Rebuild the existing public project as a useful, credible analysis workbench. Keep its six workflows, replace its dark glass/gradient interface, fix reproducible defects, and publish to `adil-rather/AI-Data-Analyzer` without replacing Git history. The user approved the forest/stone color direction and requested distinct chart colors, animation, effects and transitions. They delegated implementation choices and asked to update the existing repository.

The approved visual direction uses a deep forest navigation rail, warm stone workspace, sage selection states and restrained copper accents. Chart data uses a coordinated multicolor palette rather than making every series green. No italic text, glowing gradients, emoji navigation, fake AI chat or invented business claims.

## Approaches

1. **Rebuild within React/Vite + FastAPI (chosen technical recommendation).** Retains the real analysis functions and current single-service Render deployment, while replacing the UI and separating unsafe backend responsibilities. Lowest migration risk; Python still needs a running server.
2. Replace with a new framework/full account platform. Adds migration, authentication and database work without improving the requested analysis. Rejected as unnecessary scope.
3. Cosmetic restyle only. Leaves verified forecast crashes, target leakage, global dataset access and misleading privacy claims. Does not satisfy the request.

## Goals, limits and constraints

- CSV and `.xlsx` upload; four reproducible synthetic samples; profiling, forecasting, clustering, classification and insights all remain usable.
- First-time use starts on Data Source; sample loading or upload opens Overview. No fake sample output is substituted for calculations.
- Clear explanation that hosted uploads are processed on the server. No external AI provider or third-party data transfer is added.
- Temporary, isolated anonymous browser sessions; one active dataset per session. Embedded DuckDB table storage, without an external database service, login, collaboration or durable projects.
- One Uvicorn worker, one instance: process-memory sessions are unsuitable for horizontal scaling. Restart/expiry clears data. State this in the UI and README.
- User revision: remove the low total-file MB and source-row caps. Store complete CSVs in temporary disk-backed DuckDB tables; profile the full table, use clearly labeled bounded model subsets (25,000 rows), and select only required fields into pandas. Check available disk with a128MiB reserve, 96MiB DuckDB query memory, at most64 active dataset sessions and two parsing/model jobs. Keep100 columns,200-character headers,8,192-character text-cell and1MiB CSV record guards. Preview text to256 characters. High-cardinality distinct counts and large-table medians may be approximate, labeled explicitly.
- Excel means `.xlsx` only. Inspect ZIP metadata before parsing (256MiB expanded content maximum,2,048 members), reject formulas, macros, embedded objects, external relationships and encrypted/unsupported files; stream values to CSV. Recommend CSV for very large tables. These are parsing safeguards, not a malware-scanning guarantee.
- Keep Render's single-service architecture and health route; pin resolved dependencies and commit npm lockfile. Test on Python 3.11 in CI and the available local Python version if compatible.
- No promise of perfect security or predictive reliability. This is an exploratory analysis tool for non-sensitive data, not a production prediction service.

## Visual system

Concepts generated in this session: mineral Overview (`exec-34856d6f-d392-45ac-b88d-2bb612570d10.png`), mobile Overview (`exec-359e9c8d-7f72-462e-9547-0da3ccfcd848.png`), Forecast (`exec-38b3cbf2-9671-495e-b07a-ffc6882c1774.png`), Data Source (`exec-aec14a65-c84b-4455-a950-161e2de63e9d.png`). They live in the Codex generated-images session folder and are design references, never rasterized UI in the product.

- Canvas `#F2F1EC`, surface `#FCFCF9`, rail `#192C28`, primary `#2E594C`, active sage `#CBD9BF`, text `#17241F`, muted `#63716A`, border `#D5D8CF`, copper `#B65C3D`.
- Data palette: forest `#2E6758`, copper `#B65C3D`, slate blue `#526E96`, ochre `#AA7B28`, muted plum `#86647C`, cyan teal `#357F89`, olive `#75834C`, neutral charcoal `#555B62`. Reuse stable category-to-color mapping; don't use color alone.
- Upright locally hosted sans font (Manrope if licensed font available; system fallback), 14–15px control/body text, 28–32px page titles, 18–21px section headings; tabular numerals.
- 224px desktop rail, 32px main gutters, fine dividers, open sections. Controls 6px corners, 40–44px tall. No nested panel/card grid. Focus treatment visible and restrained.
- Below 900px use a compact header and modal navigation drawer. Escape/backdrop close it; focus stays inside and returns to trigger. At narrow widths forms and inspector stack, metrics use two columns, tables scroll within their own region. Never squeeze all table columns into unreadable text.
- Generated mockups have minor illustrative errors: preview shows eight rows while pagination says ten; some source descriptions overstate fields; one forecast note is italic. Implementation uses true pagination, accurate sample descriptions and upright notes. These correctness fixes are intentional.

## Motion and feedback

- Navigation active indicator and drawer: 180–240ms ease-out; view reveal 180ms opacity + at most 6px translation. No full-screen exit delay.
- Charts: one 350–500ms reveal when a new result appears, no replay on every pointer movement or tab return. Distinguish forecast with a dashed line and labeled legend. Cluster colors also have text labels and counts.
- Buttons: subtle background/border change, at most 1px lift on pointer devices. Sample rows expose their action without hover.
- Busy calculation keeps controls and prior results visible with a truthful progress label; duplicate Run disabled. User can navigate, cancel the browser request, or clear data; cancellation does not claim a running server calculation was forcibly stopped.
- Respect `prefers-reduced-motion` for CSS and charts. Avoid perpetual shimmer, count-up metrics, autoplay ornament or animation that delays use.

## Screens and real behavior

### Shared shell

Navigation labels: Data Source, Overview, Trend Forecast, Clustering, Classification, Insights. Dataset metadata and Change dataset/Clear data in toolbar only when loaded. Active location reflected in hash for reload/back navigation. Session startup restores the current server dataset, without storing file contents in localStorage. Clear confirms, deletes dataset server-side, resets results and returns to Data Source. An expired-session error explains how to upload/load again. Cache per-view configuration/results in React while the dataset is unchanged; changing dataset invalidates everything.

### Data Source

Upload area with native Choose file button, keyboard access, drag/drop, supported format/limits and explicit server-processing/expiry note. Four sample rows with actual descriptions/counts and Load sample action. Loading and failure messages remain visible; failed replacement keeps the previous dataset usable. No startup demo upload without user action.

### Overview

Compact facts strip (rows, columns, missing cells, numeric fields), Data preview/Column profiles tabs, paginated first-50-row table (10 rows per page), column selection, adjacent inspector with count/missing/type, real histogram for numeric columns or top categories otherwise. Minimum/median/maximum calculated, not illustrative dashes. Full cell text available by title/accessibility and wrapping where appropriate. Numeric tables right aligned. Three next-step links lead to real analysis views.

### Trend Forecast

Target, ordering column or row order, horizon 1–365 and seasonality auto/none/custom (period 2–365). Parse/sort dates when selected; require unique valid dates and regular spacing for date-based extrapolation; otherwise explain using row order. Drop invalid numeric observations with a visible count, fail if insufficient complete data. Linear trend + seasonal residual baseline remains deliberately simple. At least 12 observations; chronological last-20% holdout when at least 20 observations (minimum four holdout points). Holdout MAE/RMSE are produced from a model fit only to the earlier rows; full-data fit R² explicitly labeled in-sample. For smaller inputs holdout is unavailable, with reason. Forecast dates only when cadence is regular, otherwise steps. Full-data residual range is descriptive, not advertised as a calibrated 95% interval. Actual, fitted and projected series, concise limitations, result table and forecast CSV export (formula-safe).

### Clustering

At least two distinct numeric features, K 2–10; complete finite rows must exceed K and contain at least K distinct feature vectors. StandardScaler + KMeans (seed42); PCA projection for >2 features, otherwise standardized axes. Explain that plot positions are transformed units. Plot at most 2,000 deterministically sampled points with total/displayed counts. Silhouette sampled to at most 1,000 points and unavailable when not mathematically defined. Centroids returned/displayed in original feature units. Per-cluster count/color labels and centroid table. Nested point `values` payload avoids feature names overwriting x/y/cluster.

### Classification

RandomForest on numeric predictors. Target cannot also be a predictor. Target may be categorical/text/discrete numeric with 2–20 classes; drop missing target before converting labels, reject class counts below two. At least 20 complete finite rows; test fraction 0.1–0.4 and enough train/test rows for every class. Fixed seed42, 100 trees, bounded depth, single model thread. Stratified holdout only, metrics accuracy/weighted precision/recall/F1, train/test sizes, labeled confusion matrix, real importance chart/table. Explicitly explain that importance is not causation and one split is not cross-validation.

### Insights

Numeric correlation matrix with undefined relationships shown as unavailable (not zero), strongest valid pairs with signed coefficient, configurable z threshold 2–6, observed-value-only anomalies, total flagged count and first25 flagged rows. Constant/missing columns handled without spurious outliers. Dates/nulls/NumPy types JSON-safe. No causal 'key driver' claims.

## Backend boundaries and security

- Separate dataset registry, upload parsing/profiling, request DTOs and analysis functions from FastAPI route composition.
- Cryptographic random session cookie (HTTPOnly, SameSite Lax, Secure on HTTPS) and random dataset IDs bound to that session. Unknown/mismatched ID returns404. Server-side idle expiry and periodic/lazy cleanup. No global sequential IDs. Raw session token not logged or returned in JSON.
- Same-origin frontend, no wildcard credentialed CORS. Mutating browser requests require custom `X-Requested-With` header and reject cross-site origins; no cross-origin CORS permission. No secrets/API keys in frontend.
- Parse one uploaded file without accepting form fields; bound multipart headers and the in-memory spool before streaming to temporary disk. CSV ingestion has no low total-file or row cap. Bound record width, cells, Excel archive metadata/expansion, model subsets and concurrent jobs. Data/model validation errors produce actionable4xx, saturation429/503, not unhandled tracebacks. Generic unexpected500; log no uploaded values.
- Resolve static paths under build directory; unknown `/api/*` returns JSON404, never index.html. Safe immutable asset caching only for hashed assets; HTML/API no-store. Set nosniff, frame restrictions, referrer policy and practical same-origin CSP.
- Treat infinities as invalid, normalize column names and reject duplicates/empty names before analysis. Never silently accept unknown/duplicate features.
- Frontend API wrapper handles validation arrays, offline/timeout, abort and stale responses. A late result from an old dataset must not replace current data. CSV downloads escape formulas.

## Assets, documentation and delivery

Create a distinct transparent PNG mark for this project (sage/forest/copper data-to-insight motif, no generic brain or sparkles), practical 512px and small favicon derivatives, use in app and README. Preserve the generated high-resolution PNG. Record prompt and generation method in asset notes. Do not add screenshots or decorative marketing images to the analysis interface.

README covers what is real, model limitations, hosted vs local processing, upload/session bounds, commands, tests and single-worker Render deployment. Include CI for backend regression suite and frontend build/tests. Do not alter another repository or the portfolio unless separately requested.

Acceptance: all six workflows tested on synthetic samples and uploaded fixtures; malformed/oversized/empty/nonfinite/rare-class/date/gap inputs handled; browser-session isolation and clear/expiry verified; keyboard navigation, phone drawer, pagination, downloads, browser Back and reduced motion checked; rendered screenshots visually compared to concepts at desktop/tablet/phone, no relevant console errors or horizontal page overflow. Push only after verification. Report hosted redeployment status honestly; existing Render auto-deploy may require user dashboard action if not connected.

## Builder discretion

Choose exact module names, dependency versions supported by Python3.11+, small icon library, testing utilities and implementation details within these interfaces and limits. No new paid provider, account system or external database. Correctness, accessibility and real-data legibility outweigh literal copying of illustrative mockup errors. The later user-approved large-data revision supersedes the original in-memory-registry implementation proposal in the backend-boundary notes.
