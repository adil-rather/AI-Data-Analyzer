# API reference

The production frontend and API share an origin. Browser mutations require `X-Requested-With: AI-Data-Analyzer`. A cookie-aware client must preserve the session cookie; a dataset ID alone does not authorize access.

## Dataset lifecycle

| Method / path         | Request                                                       | Response                                               |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| `GET /api/health`     | None                                                          | Service, status, version                               |
| `GET /api/session`    | Cookie if available                                           | `{profile: object or null, expiresInSeconds: 3600}`    |
| `GET /api/samples`    | None                                                          | Available synthetic sample IDs, names and descriptions |
| `POST /api/sample`    | `{name: "retail_sales"}`; optional generated `rows` 30–25,000 | Registered dataset profile                             |
| `POST /api/upload`    | Multipart form field `file`, UTF-8 CSV or `.xlsx`             | Registered dataset profile                             |
| `DELETE /api/dataset` | Session cookie                                                | 204; removes current dataset                           |

The optional `rows` field controls **sample generation**, not the row count allowed in an uploaded CSV.

Profiles include `datasetId`, `name`, `source`, `rows`, `columns`, `types`, `stats`, `preview`, `missingCells`, `modelSampleLimit`, `previewTextLimit` and `expiresInSeconds`. Numeric stats expose actual or labeled approximate summaries. The preview is limited; the stored dataset is not replaced by it.

## Models

All model requests are JSON. Unknown fields are rejected. Each requires the current owned `datasetId`.

```json
{
  "datasetId": "returned-id",
  "target": "sales",
  "dateColumn": "date",
  "periods": 30,
  "period": null
}
```

`POST /api/forecast`: target numeric; dateColumn optional; periods 1–365. `period=null` means auto, `0` disables seasonality, 2–365 requests a custom period. Returns `history`, `future`, `evaluation`, `r2`, `period`, `summary`, source/drop counts and scope. Future values include date where applicable and descriptive lower/upper residual bounds.

```json
{
  "datasetId": "returned-id",
  "features": ["income", "spending_score"],
  "clusters": 3
}
```

`POST /api/cluster`: 2–20 distinct numeric features; clusters 2–10. Returns bounded plotted `points` with nested original `values`, original-unit `centroids`, `sizes`, `silhouette`, projection metadata and scope.

```json
{
  "datasetId": "returned-id",
  "features": ["income", "spending_score"],
  "target": "segment",
  "testSize": 0.25
}
```

`POST /api/classify`: 1–20 numeric predictors, separate discrete target, testSize 0.1–0.4. Returns held-out scores, class labels, train/test counts, confusion matrix, feature importance, drop count and scope.

```json
{ "datasetId": "returned-id", "threshold": 3 }
```

`POST /api/insights`: threshold 2–6. Returns numeric columns, correlations (undefined cells are null), top pairs, flagged-row count, bounded anomaly details and scope.

Every successful model response includes:

```json
{
  "analysisScope": {
    "sourceRows": 1000001,
    "analyzedRows": 25000,
    "method": "Deterministic reservoir sample"
  }
}
```

Other methods are `All rows`, `Most recent 25,000 observations` and `Last 25,000 rows in file order`. This field describes materialized rows before model-specific missing-value exclusion.

## Errors

| Status | Meaning                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| 400    | Invalid/malformed data or mathematically unsuitable settings                                                   |
| 403    | Mutation missing the same-origin header or rejected origin                                                     |
| 404    | Unknown route or missing/expired/unowned dataset                                                               |
| 409    | A pending upload was superseded or the workspace was cleared before it could commit                            |
| 413    | Unsafe structural/parser budget or oversized settings JSON; large CSV ingestion itself has no fixed MB/row cap |
| 415    | Unsupported file extension                                                                                     |
| 422    | Typed request validation failed                                                                                |
| 429    | Both processing slots are occupied; retry later                                                                |
| 503    | Temporary storage or session capacity unavailable                                                              |
| 500    | Unexpected failure, with generic client text                                                                   |

Expected errors use `{ "detail": "actionable text" }`. FastAPI validation can return a detail array; the frontend converts it into readable field messages. Application logs do not intentionally print uploaded rows, raw cookies or file contents.

## Simple checks

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/samples
```

For analysis calls, use the frontend or a cookie-preserving client and send the custom mutation header. Do not copy session cookies into issues or commit them to the repository.
