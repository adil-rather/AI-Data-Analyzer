# Upload safety, privacy and operational boundaries

## Trust model

This is an anonymous, temporary analysis workbench for non-sensitive data. Visitors can upload files. A browser session owns one dataset; unrelated visitors must not read or model it. Uploaded values are untrusted input. The application does not execute them as code or fetch URLs contained in cells.

It is not an antivirus product, a confidential-data platform or a claim of zero vulnerabilities. Parser dependencies, the operating system, the hosting account and deployment configuration remain part of the security boundary.

## File protections

- Only UTF-8 CSV and `.xlsx` are accepted. Renamed binary/control-character CSV content is rejected. Legacy `.xls`, `.xlsm`, archives, executables and arbitrary extensions are rejected.
- Multipart parsing permits exactly one file and zero additional text fields. Per-part headers have a 4 KiB budget, content-type metadata is bounded, and the file spool rolls to disk after 128 KiB. These metadata/memory guards do not cap the total CSV file size.
- CSV is copied in chunks and parsed into a temporary DuckDB table, not loaded as one giant pandas frame. Its header must have unique, non-empty names; at most 100 columns and 200 characters per name.
- CSV records have a 1 MiB encoded-line parsing budget. Text cells must be at most 8,192 characters. These structural guards are distinct from a total-file MB or row limit.
- A bounded end-of-ZIP-directory preflight runs before ZIP directory objects are allocated: at most 2,048 declared entries and a 1 MiB central directory. Excel content is then limited to 256 MiB expanded size. Duplicate/unsafe paths, encryption and unsupported multi-disk/ZIP64 metadata are rejected. The archive is never extracted to user-supplied paths.
- Macros, active objects, embedded OLE content, external workbook links/connections and formulas are rejected. XML inspection uses `defusedxml`; workbook reading uses read-only/data-only mode with external links disabled.
- Only the first worksheet is imported. A values-only CSV export is recommended for large or complex workbooks.
- Raw upload filenames are labels only. Storage paths are application-generated temporary paths. No subprocess is started from uploaded content, and there is no Python `eval`, JavaScript evaluation or spreadsheet calculation step.
- UI values are ordinary React text, not injected HTML. Exported CSV cells that could be interpreted as spreadsheet formulas are prefixed safely; quotes/delimiters are escaped.

These checks reject known risky structures; they do not identify every malicious binary signature or future parser exploit. Keep dependencies patched. A public service needing malware scanning should add a maintained scanning/quarantine service and fail closed on scan failures before parsing.

## Resource protections

There is no low fixed total-file MB or source-row cap for CSV ingestion. Instead the app uses disk-backed data, checks free temporary storage with a 128 MiB reserve, limits DuckDB connections to 96 MiB of query memory and one thread, and allows two expensive jobs at a time. At most 64 dataset-owning sessions are retained by one process.

Only required model columns are materialized. Models use at most 25,000 source observations; chart payloads and silhouette calculations have smaller display/evaluation bounds. Category labels used for classification are limited to 200 characters. Preview responses truncate long text to 256 characters without changing the stored source.

The DuckDB setting is not a hard limit on the whole Python process's RSS. Framework buffers, pandas, scikit-learn, Python and concurrent requests consume additional memory. Available disk checks are not a complete distributed quota system. Two long-running anonymous requests can still occupy both slots. The hosting platform can impose earlier upload/time/storage limits.

For a larger public service, add edge rate limiting, authenticated quotas, a worker queue, process-level CPU/memory limits, cancellation/time limits, monitoring and shared storage. Full-data training on millions of rows needs a separate job architecture and suitable hosting. Do not present this interactive sample-based design as that service.

## Session and browser protections

- Random 256-bit session token in an HTTP-only, SameSite=Lax cookie; Secure on HTTPS.
- Hash of the token used as an in-process owner key; random dataset ID checked against the owner on every analysis.
- No wildcard credentialed CORS. Browser mutations require a custom header and reject cross-site origins/fetch metadata.
- Column identifiers are quoted before SQL construction; user paths and arbitrary SQL are not accepted.
- Static paths are resolved under the frontend build root. Unknown API paths return JSON404 rather than the application HTML.
- Responses set `nosniff`, frame restrictions, same-origin referrer policy and a practical CSP. The UI needs inline styles for chart geometry; scripts remain same-origin.
- API/HTML responses are not cached as public user data. Only hashed build assets receive long immutable caching.

The cookie is anonymous ownership, not a login account. Browser tabs share it. Anyone controlling the same browser profile or server account is outside that isolation boundary. Use HTTPS on a hosted deployment and verify its cookie flags.

## Lifetime and deletion

An API access renews the 60-minute idle timestamp. Idle tables are removed by lazy/periodic cleanup. Clear data removes the current table and resets the browser's analysis cache. Normal shutdown closes temporary tables. A restart invalidates the in-memory registry.

Clear also invalidates pending upload/sample write leases. An older request that finishes afterward is rejected instead of restoring deleted data. A newer upload supersedes an older pending write; unsuccessful replacements preserve the existing stored table.

An interrupted request is not guaranteed to stop already-running parsing/model work. A crash can bypass normal cleanup; the host's temporary storage policy then matters. Deletion is logical application cleanup, not certified secure erasure or a backup-retention guarantee.

No external AI provider receives uploaded values. The app does not intentionally log file contents, cookies or uploaded rows. Hosting access logs can still record network metadata. Avoid uploading personal data, secrets or proprietary datasets to the public demo.

## Regression coverage

Tests include cross-browser dataset isolation, session clear/restore, unsupported/malformed input, duplicate headers, binary CSV, oversized text cells, workbook formulas/macros/external links/objects, expanded ZIP content, metadata-name collisions, finite JSON, missing values and million-row ingestion. These tests are useful evidence, not proof that all possible attacks are covered.
