# Deployment, maintenance and troubleshooting

## Existing Render service

Pushes update the source repository. Render changes only after it builds and deploys that commit. If auto-deploy is disabled, use the Render dashboard's manual deploy action. A GitHub push by itself is not evidence that the live app has updated.

Recommended service settings:

| Setting             | Value                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Repository / branch | `adil-rather/AI-Data-Analyzer`, `main`                                                                     |
| Runtime             | Python                                                                                                     |
| Python              | 3.11.15                                                                                                    |
| Node                | 24.17.0                                                                                                    |
| Build command       | `python -m pip install -r requirements.txt && npm ci --prefix frontend && npm run build --prefix frontend` |
| Start command       | `python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT --workers 1`                     |
| Health check        | `/api/health`                                                                                              |
| Instances / workers | One / one                                                                                                  |

`render.yaml` records the blueprint. Existing services with manually configured settings may need their dashboard settings updated; changing a YAML file is not always enough to change an independently configured service.

No external database credentials or AI API keys are needed. The embedded DuckDB tables are temporary. Do not put secret values into the frontend or commit environment files.

## Verify a deploy

1. In Render, confirm the deployed commit matches the new GitHub commit and the build/start commands succeeded.
2. Open `/api/health`: version should be `2.0.0`, status `ok`.
3. Open the website in a fresh browser context. It should show the forest-and-stone Data Source screen.
4. Load a sample, open Overview and run an analysis. Check the browser Network tab for successful `/api` calls.
5. Verify the session cookie is HTTP-only, SameSite=Lax and Secure on the HTTPS site. Check that a second incognito context cannot access the first dataset.
6. Test phone navigation, a small CSV upload and Clear data. Then try a representative large CSV appropriate for your hosting resources.

Free or small hosting can have cold starts, slow builds, short request lifetimes or limited disk/RAM. The app supports large CSV ingestion by design, but it cannot override a provider's limits. A million-row local regression does not prove that every million-row file fits every hosting plan; width, text size and data types matter.

## Why one worker matters

The session registry lives in one Python process. Multiple workers/instances would have different ownership maps and would produce intermittent “dataset unavailable” errors. Keep one worker. To scale horizontally, use shared object storage, a durable ownership registry and a background-job queue first.

## Dependency maintenance

Frontend exact versions are in `frontend/package.json`; the npm lockfile records the resolved graph. Use `npm ci`, not an unreviewed install/update during deployment.

Backend direct inputs live in `backend/requirements.in` and `requirements-dev.in`. Their `.txt` files pin the resolved graphs for Python3.11. To intentionally update them with uv:

```bash
uv pip compile backend/requirements.in --python-version 3.11 -o backend/requirements.txt
uv pip compile backend/requirements-dev.in --python-version 3.11 -o backend/requirements-dev.txt
```

Use an isolated environment. Run the full Python suite, frontend tests/build and browser suite after updates, then check known advisories. A passing package audit is not a security guarantee.

## Troubleshooting

| Symptom                       | Check / action                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Old colors after a push       | Confirm Render deployed the right commit; refresh after deployment completes                                             |
| Blank page or missing JS      | Build `frontend/dist`; verify the service starts from repository root with `--app-dir backend`                           |
| API403 on upload              | Use the app from one origin; custom clients need the request header and cookie; check proxy Host/Origin forwarding       |
| Dataset unavailable /404      | Session expired, server restarted, another tab cleared/replaced it, or multiple workers are running; reload/upload again |
| Two jobs running /429         | Wait for a slot; duplicate clicks should not start more work                                                             |
| File rejected /400            | Read the exact message; check UTF-8, headers, row structure, formulas, active content and numeric suitability            |
| Workbook too large /413       | Export a values-only CSV instead of a complex Excel workbook                                                             |
| Storage unavailable /503      | Free space/capacity is low; wait for cleanup, reduce file footprint or use stronger/local hosting                        |
| Numeric column shown as text  | Check mixed values and formatting in the CSV; clean the source rather than silently coercing it                          |
| Classifier rejects rare class | Each modeled class needs at least two complete rows and room in both splits; a large-source sample can miss rare labels  |
| Date forecast rejects cadence | Remove duplicates, repair date gaps or explicitly use equally spaced row order                                           |
| Large request times out       | Host/network request duration may be lower than app needs; use CSV, stronger hosting or a local run                      |

## Safe issue reports

Include the app version/commit, failing workflow, parameter names, HTTP status and a small synthetic reproduction. Exclude real uploaded records, passwords, API keys and session cookies. Never paste a whole private data file into a public issue.
