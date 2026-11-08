# AI Data Analyzer Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement in this checkout. Track progress below. The user authorized the existing repository update and approved the visual direction; implement without repeated permission requests.

**Goal:** Replace the analyzer's interface with the accepted mineral workbench and ship tested, isolated, bounded analysis workflows.

**Architecture:** React/Vite frontend, FastAPI single-worker backend. Separate session storage, tabular profiling and ML services; native accessible controls with coordinated charts.

**Tech Stack:** Python3.11+, pandas/NumPy/scikit-learn, FastAPI, React, Vite, Recharts, pytest, Vitest, Playwright.

**Spec:** ../specs/2026-11-08-analyzer-rebuild-design.md

## Global constraints

- Six workflows and four synthetic samples; no external AI API, login or database.
- Existing repository and history retained; deploy remains one Render service/worker.
- User revision: complete CSV ingestion to disk-backed DuckDB without low total-file/row caps. Full-table profiles; model subsets up to25,000 rows, clearly labeled.96MiB query memory,128MiB disk reserve,64 temporary sessions,60-minute idle TTL,two jobs; structural CSV/Excel safeguards remain.
- Forest/stone/sage/copper interface; multicolor data marks, upright type, reduced-motion support.
- Real validation, finite JSON, bounded calculations, no fabricated metrics or privacy claims.

## Review focus

1. A second browser must never access another visitor's dataset, including after ID guessing.
2. Nonfinite values, constant columns and missing labels must never create500s or invented observations.
3. Old responses after dataset replacement/clear must never overwrite the current workspace.
4. Date selection must change actual forecast ordering and reject duplicate/irregular cadence.
5. Phone controls/tables/drawer must remain usable with keyboard, touch and reduced motion.

## Task1: Regression coverage and safe dataset lifecycle

Files: backend/tests/test_api.py, backend/tests/test_store.py, backend/main.py, backend/store.py, backend/tabular.py, backend/schemas.py, backend/requirements*.txt, frontend/package*.json, .gitignore.

Interfaces: `create_app(store=None,dist=None)` produces FastAPI app. Session cookie scoped to/api; `GET /api/session` returns profile or null. Existing sample/upload endpoint shapes extended with name/source/expires. `DELETE /api/dataset` clears session. `DatasetStore.put/get/clear` enforce owner and TTL atomically.

- [x] Write failing HTTP/lifecycle tests: two-cookie isolation,clear/restore/expiry,oversizebody,malformedfile,CSV/XLSX,unsupportedextension,duplicatecolumns,nonfiniteprofile,unknownAPI,staticcontainment.
- [x] Run tests against baseline with compatible isolated dependencies; confirm relevant failures.
- [x] Implement bounded parsing/profiling/session storage and safe static routing. Keep failed replacement atomic.
- [x] Run full pytest; include the lifecycle in the final reviewed rebuild commit.

## Task2: Credible model results

Files: backend/analysis.py, backend/schemas.py, backend/tests/test_analysis.py, route composition.

Interfaces: forecast/cluster/classify/insights accept typed requests and dataframe; return JSON-safe dictionaries. Errors use actionable4xx. Profiles include real histogram/median, all numeric inputs finite-mask filtered.

- [x] Write failing regressions for horizon0,invalidK,onecluster/distinctrowlimits,targetleakage,missingtargets,rarelables,invalidsplits,dateordering,regularcadence,constantcorrelation,missinganomalyvalues,centroidunits,featurex/ynamecollision.
- [x] Confirm baseline failures, then implement each analysis boundary and service.
- [x] Test all four generated samples and successful uploaded fixtures, plus holdout calculations and saturation behavior. Run full pytest; include changes in the final reviewed rebuild commit.

## Task3: Workbench shell and dataset exploration

Files: frontend/src/App.jsx, api.js, components/{Sidebar,ui,Icon,DataTable}.jsx, views/{Upload,Dashboard}.jsx,index.css, hooks/, tests/.

Interfaces: central workspace profile/state; six hash routes; per-dataset view cache; cancellable API calls and structured errors. DataTable consumes columns/rows, native horizontal scroll and10-row pagination. Sidebar is accessible desktop navigation/mobile dialog.

- [x] Write tests for structured validation errors,formula-safeCSV,late-responseprotection,targetfeatureexclusion and key userflows before implementation.
- [x] Implement exact palette/type/layout from accepted concepts, real upload/sample/restore/clear, paginatedpreview/inspector/profiles and next-step links.
- [x] Verify source→sample→overview→column→previewpagination; keyboard drawer and browserBack; datasetclear and failure states. Run frontendtests/build; include changes in the final reviewed rebuild commit.

## Task4: Analysis views and coordinated motion

Files: frontend/src/views/{Forecast,Clustering,Classification,Insights}.jsx, shared analysis hook and chart utilities.

- [x] Add UI behavior tests for no data/no suitablecolumns,modelsubmit,readablefailure,repeatednavigationretainsresults and parameterchanges requiringrerun.
- [x] Implement forms,truthfulmetrics,charts/tables,legends,export and limitations; preserve controls during work.
- [x] Apply 180–240ms UI motion,350–500ms newchartreveal,stablemulticolorpalette and reduced-motion control. No fake progress.
- [x] Exercise each model end-to-end at desktop/phone; frontendtests/build+pytest; include changes in the final reviewed rebuild commit.

## Task5: Project asset, docs, deployment and final review

Files: frontend/public/project-icon*.png, favicon.png, frontend/index.html, assetnotes,README.md,render.yaml,.github/workflows/ci.yml.

- [x] Generate transparent data-to-insight PNG with ImageGen, inspect it, save final asset and small derivatives; use mark in shell and README. Record prompt.
- [x] Document real processing/session/model/deployment behavior and reproducible commands; CI tests/build and Render npmci+singleworker.
- [x] Chrome visualQA source+sixviews at1440×1000,768×1024,390×844,320×640and844×390landscape; keyboard/touch/Back/loading/error/clear/export/reducedmotion. Browser plugin absent, use PlaywrightCLI; capture outside repository and compare using view_image.
- [x] Fresh whole-branch review, fix important findings, full verification and secret/artifact diff check.
- [ ] Commit and push to existing main without force. Verify hosted redeployment if reachable; report limitations accurately.

## Progress

- Design reviewer: nothing important left. User approved mineral colors and requested multicolor chart data and motion.
- Baseline audit: forecast0 crashes; classifier accepts targetasfeature; silhouetteK==N crashes; unbounded/globaldatasets; unsafe staticpathjoin; misleading all-local claim. LiveRender read-only inspection timedout90s, no assertion of currentvisualstate.
- Ruling: execute directly in isolated freshclone on featurebranch; no repeatapproval for reversible authorized changes or requested GitHub update. This follows user's instruction to rebuild and update existingrepository.
- Ruling: Python systemsite is incompatible/slow; use isolated uv-managedPython3.11 rather than changing globalpackages.
- Ruling: user's later instruction rejects low upload/row caps and delegates the professional large-data choice. DuckDB full storage plus explicit sampled/windowed models replaces all-frame RAM storage. One-million-row regression proves retention; docs disclose hosting and sampling limits.
- Tasks1–5 implemented and reviewed. Final verification: 53 backend tests, 8 frontend tests, production build and Ruff checks passed. Playwright completed all 10 tests across five desktop/tablet/phone/landscape sizes; 30 rendered views were captured and visually inspected. Production npm audit reported no known advisories.
- Review fixes include upload/clear write leases, bounded one-file multipart parsing, workbook central-directory preflight, precise tiny values, actual holdout class coverage, float32 rescaling validation, editable custom seasonality and structured low-disk failures. Each regression was exercised before and after its fix.
- PNG, README and five detailed guides are complete; internal documentation links were checked. Source publication is the remaining delivery step. Render was confirmed to be serving version 1.0.0 before the push.
