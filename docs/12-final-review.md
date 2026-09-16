# Full-Stack Final Review — Passenger Rights, Goftino, Claim Workflow, and Legal-Document Replacement Fixes

## Executive verdict

**STAGE_12_STATUS: FAIL — REPAIR_REQUIRED**

The repository contains the passenger-rights PDF repair, the two-slot downloadable legal-document replacement flow, the flight-feed integration, the required questionnaire/admin update, and the admin claim-priority persistence repair. The backend accepts valid browser-reported PDF MIME variants, verifies PDF content, persists replacements transactionally using compatible setting names, removes only the previous unshared managed physical file after commit, serves CMS media safely, persists validated claim priority through the existing transaction, and exposes the authenticated HTTPS flight import path needed to refresh the cache. The live site is reachable, its cached flight snapshot is stale, and the safe SMS, questionnaire, claim-priority, and scheduler updates have been deployed; provider-side SMS configuration and flight endpoint reachability remain environment-owned.

The 2026-09-01 SMS follow-up and 2026-09-02 Goftino settings repair were deployed safely through cPanel without database access. The widget API contract is present on the live site and returns the supplied identifier from server-managed configuration. The SMS code path reaches the provider and reports the actionable failure, but live delivery cannot be marked complete until the provider resolves sender status 17, send-window status 12, and the applicable production-IP approval status.

The 2026-09-02 live document-delivery check found that legacy `/uploads/...` response values were intercepted by the cPanel SPA fallback and returned HTML. Public legal-document responses and new legal-document upload results now use `/api/uploads/...`; the stored database values remain unchanged, and both live document endpoints returned PDF responses after restart.

The 2026-09-02 claim-registration checkpoint addressed the generic `Request failed.` path: OCR and registration notification work no longer extend the core HTTP request, the submit response uses the committed claim state, and MySQL transaction cleanup now handles dropped connections without leaking or masking the original error. The backend repair was deployed and health stability was verified without a production claim mutation.

The current 2026-09-02 flight-monitoring recheck supersedes the earlier flight freshness pass: the ten-minute scheduler is deployed and running, but the provider connection from the production server fails with `UND_ERR_CONNECT_TIMEOUT` on port 3000. The provider returns current data from the laptop, so the remaining release blocker is provider-side network reachability or the documented HTTPS push fallback. The last valid cached snapshot is intentionally retained; no database or customer data was deleted.

The 2026-09-03 host-side recheck restricted the backend runtime and SMS environment files to owner-only `0600` permissions, restarted the registered CloudLinux Node.js application successfully, and revalidated `/api/health` (`200`, database connected) and `/api/flights/status` (`200`, preserved flight-cache). No file contents or database/customer data were changed. The provider port-3000 timeout remains an external dependency blocker.

## Requirement traceability

| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-001 | `fileValidation.js`, `upload.js`, runtime multipart test | PASS |
| FR-002 | PDF signature guard and cleanup path; live DB controller execution unavailable | PASS / environment follow-up |
| FR-003 | `updateSettings` update/insert branches and URL mapping tests | PASS |
| FR-004 | Canonical/legacy normalization and migration | PASS |
| FR-005 | Public controller mapping and active public bundle | PASS |
| FR-006 | CMS-specific static path plus legacy database allow-list | PASS |
| FR-007 | Broad `/uploads` static mount removed; claim download remains protected | PASS |
| FR-008 | Supervisor-only `DELETE /api/admin/claims/:id`, transactional claim-owned cleanup, preserved shared/history records, and safe upload-root cleanup | PASS locally / authenticated database execution intentionally NOT_RUN |
| FR-009 | Allow-listed replacement of either downloadable legal document with transactionally activated CMS media and setting URL | PASS locally / authenticated production upload intentionally NOT_RUN |
| FR-010 | Post-commit cleanup of previous unshared managed physical file while preserving old database metadata and unrelated data | PASS locally / live mutation intentionally NOT_RUN |
| FR-011 | Public legal-document URLs use the API delivery namespace while preserving stored legacy values | PASS; live contract and PDF delivery verified |
| FR-011 | Authorized admin claim priority is validated and persisted through the existing claim-update transaction | PASS locally and deployed; authenticated production mutation intentionally NOT_RUN |
| FR-012 | Incomplete-question feedback is rendered inline above the active questionnaire with the existing red validation treatment | PASS locally and deployed; exact native questionnaire alert removed |
| FR-013 | Upload persistence returns before expensive ticket extraction | PASS locally and deployed; OCR is queued after the upload response |
| FR-014 | Claim submit returns committed state without waiting for OCR/SMS side effects | PASS locally and deployed; notification is queued after commit |
| FR-015 | Admin General Settings exposes the registration SMS template, and the existing post-commit notification renders `{trackingCode}` | PASS locally and deployed; no database/schema/data operation was performed |
| FR-016 | Admin flight monitor retains the latest valid stored snapshot and the backend checks the provider every ten minutes when enabled | Scheduler implementation/deployment PASS; fresh server-side provider pull BLOCKED_EXTERNALLY by `UND_ERR_CONNECT_TIMEOUT` on port 3000 |
| Goftino-001 | Public/admin settings mapping, schema acceptance, conditional persistence, and live response field | PASS; identifier configuration remains environment-owned |
| Flight API-001 | `/api/flights/import` route, controller/service exports, secret configuration, async acknowledgement, and admin push status | PASS locally / live invalid-key boundary reaches `401` |
| Flight API-002 | Push payload allow-list, provider-count bounds, shared sync lock, and route-scoped request size | PASS locally / MySQL persistence NOT_RUN |

## Validation matrix

| Check | Result | Notes |
| --- | --- | --- |
| Focused and existing Node tests | PASS | 60 passed, 0 failed. |
| Goftino widget regression | PASS | 4 focused tests passed; live public settings response includes the configured field. |
| Backend syntax | PASS | 57 backend JavaScript/MJS files parsed. |
| Dependency audit | PASS at high threshold | `npm audit --omit=dev --audit-level=high` returned exit code 0 with 0 high, 0 critical, and 5 moderate advisories. |
| Production dependency installation | PASS | `npm ci --omit=dev --ignore-scripts` completed. |
| Provider contract smoke | PASS | All four supplied path patterns, separated credentials, limits, response normalization, and count extraction passed against a deterministic local contract. |
| Application startup smoke | PASS | Started and shut down cleanly with DB unavailable and scheduler disabled; flight route boundary probes also passed. |
| Frontend static smoke | PASS | `index.html` and the active public bundle were served with HTTP 200. The static-only server intentionally has no `/api` proxy. |
| Live site health/frontend | PASS | `https://flysos.ir/api/health` and the public site returned HTTP 200. |
| Live flight status | PASS_WITH_STALE_CACHE | `GET /api/flights/status` returned HTTP 200 with `X-Data-Source: flight-cache`; latest valid snapshot remains `2026-08-18T05:44:30.618Z` because deployed-server refresh attempts time out. |
| Provider pull from laptop | PASS | The supplied provider endpoint returned HTTP 200 with current data. |
| Provider pull from deployed server | BLOCKED_EXTERNALLY | Deployed-server logs contain repeated `UND_ERR_CONNECT_TIMEOUT` errors for provider port 3000. |
| Host-side runtime recheck | PASS_WITH_EXTERNAL_BLOCKER | Environment-file permissions are `0600`, the registered Node.js app remained started after restart, and live health/status checks returned `200`; fresh provider data remains blocked by the external timeout. |
| MySQL migration | NOT_RUN | No local MySQL server or credentials. |
| Database-backed API E2E | NOT_RUN | Requires configured database and admin account. |
| Frontend production build | NOT_RUN | No frontend source/package build is present; committed active assets were contract-checked. |
| Safe SMS backend deployment | PASS | Backend SMS service, platform error mapping, restart marker, and root backend deny rule were uploaded through cPanel; `/api/health` remained HTTP 200 and protected backend paths returned HTTP 403. |
| Questionnaire backend/frontend deployment | PASS | Questionnaire backend files, active public/admin bundles, cache-busting references, and restart marker were uploaded through cPanel; required-answer, claim-type, and admin section-label markers were verified over HTTPS. No database command was executed. |
| Goftino settings deployment | PASS | Backend schema, response mapping, conditional persistence, environment fallback, and restart marker were uploaded through cPanel; live `GET /api/legal-documents` returned the configured `goftinoWidgetId` field. No database command was executed. |
| Claim deletion backend deployment | PASS | The missing `DELETE /api/admin/claims/:id` route and controller were uploaded with a restart marker; the live unauthenticated boundary returned HTTP `401`, remote code markers matched, and no authenticated delete or database operation was performed. |
| Legal-document replacement backend deployment | PASS | The allow-listed replacement service, CMS controller, and public legal-document mapping were uploaded with a restart marker; `/api/health` returned HTTP `200`, remote code markers matched, and no authenticated production upload or database operation was performed. |
| Legal-document replacement regression | PASS | 3 focused tests passed; old-file cleanup is path-contained, post-commit, cross-reference-aware, and database-preserving. |
| Live legal-document delivery | PASS | Public settings returned `/api/uploads/...` paths and both configured documents returned HTTP `200` PDF responses with `%PDF-`; no database operation was executed. |
| Claim-priority backend deployment | PASS | `adminSchemas.js` and `adminController.js` were uploaded to the exact `backend/validation` and `backend/controllers` import paths through cPanel; the registered CloudLinux Node.js application was restarted, remote priority markers matched, `/api/health` returned HTTP 200, and the unauthenticated priority PATCH boundary returned HTTP 401. No authenticated mutation was issued. |
| Admin white-screen/module-graph repair | PASS | The four canonical static files were uploaded through cPanel; remote hashes matched local files, the focused React singleton regression passed, and a fresh live unauthenticated admin route rendered without React `#321` or DOM `removeChild` errors. |
| Questionnaire inline validation deployment | PASS | The active public v2 bundle and public/admin cache-busted HTML references were updated through cPanel; the live bundle returned HTTP 200 with the inline red `role="alert"` marker and without the native incomplete-question alert. |
| Claim registration connection/timeout repair | PASS | Transaction cleanup, post-response OCR/notification scheduling, and committed-state response regressions passed; the exact backend files were deployed, the registered Node.js app restarted, and 12/12 read-only health checks returned HTTP 200 with `database: connected`. |
| Registration SMS template deployment | PASS | Four focused tests and the full 57-test suite passed; the active bundles passed syntax checks; the four canonical static files returned HTTP 200 over HTTPS with hashes matching local files and the live admin bundle contains the editable registration field/default. |
| Live SMS delivery | BLOCKED_EXTERNALLY | Provider/account responses show sender status 17, send-window status 12, and the read-only IP-list check returned status 35; no real SMS was sent during validation. |

## Flight API follow-up

The current live invalid-key probe reaches `POST /api/flights/import` and returns `401`, so the previously observed missing-route condition is no longer present on the deployed site. The public cache remains reachable but stale. A real provider pull, cache write, and freshness check cannot be claimed until the provider-accessible refresh job and the FlySOS deployment are authorized, configured with the same strong `FLIGHT_IMPORT_SECRET`, and executed.

## Questionnaire follow-up

The claim registration flow now rejects incomplete visible questionnaire answers in both the browser and the API. The API recomputes conditional question visibility, validates persisted answers again before final submission, and returns the admin claim response with `questionnaireAnswers`, `section`, and `sectionLabel` metadata. The existing admin detail and print views display the selected section label. No database schema, migration, or stored record was changed for this update.

The 2026-09-02 live `400`/`Failed to fetch` report was isolated to CDN cache state: the older immutable shared bundle omitted `claimType` from the questionnaire POST, so the deployed API rejected the request before persistence. The public/admin HTML entries and reciprocal imports now use `20260902-questionnaire-submit-v2`, and the live bundle serves the claim-type payload plus inline validation guard. A random-claim live contract probe returned the expected `404 CLAIM_NOT_FOUND` after payload validation; no production claim or database data was changed.

## Goftino follow-up

The missing `goftinoWidgetId` field was a backend contract gap: the browser settings UI already carried the field, but the settings schema and legal-document response did not. The backend now accepts, maps, and conditionally persists the value when the existing column is available, with an explicit failure rather than silent loss when it is not. The supplied identifier is now available through server-managed configuration and the live public contract returns it without a database mutation.

## Downloadable legal-document replacement follow-up

The previous upload path relied on a separate settings PATCH after creating a CMS media row, so a replacement did not have a single server-side commit boundary and the obsolete physical file remained on the server. The updated CMS upload path resolves only the two supported document slots, locks the existing settings row, inserts the new media row and updates the matching setting in one transaction, then performs safe post-commit cleanup. The cleanup regression includes the legacy root-level CMS file shape used by the live power-of-attorney setting. The old `CmsMedia` metadata row and unrelated database data are retained. A real authenticated replacement was not executed because it would mutate production data.

The public URL compatibility layer translates stored `/uploads/...` values to `/api/uploads/...` only at response time, and the upload controller returns the API delivery path for new CMS files. This prevents the document-root SPA fallback from returning HTML for a valid document link without changing database contents.

## Claim priority follow-up

The claim summary select was already wired to send `PATCH /api/admin/claims/:id` with `priority`, but the backend validation schema stripped the field and the controller omitted it from the update list. The repair adds the closed set `low`, `medium`, `high`, and `urgent` to server validation and persists the supplied value with the existing parameterized transaction. The deployment reused the existing `Claim.priority` column and did not modify database contents. Three focused regression tests and the 52-test suite pass; authenticated live mutation was intentionally not run.

## Claim registration connection follow-up

The upload controller now stores the uploaded file before scheduling OCR, and the extraction job performs its existing extracted-field writes in a short transaction with stale-file protection. The database helper includes bounded pool settings, keep-alive, release-on-failure behavior, rollback-error isolation, and destruction of known-fatal connections. Claim submission returns the committed status without a second post-commit read and queues the registration SMS/template side effect, so provider or log failures cannot turn a completed claim into a generic browser failure.

Validation: the focused connection/upload/notification regression set passed 6/6; the serialized full regression suite passed 52/52; all 57 backend JavaScript/MJS files passed syntax checks; the remote deployed bytes matched local files; and 12/12 read-only live health checks returned HTTP 200 with `database: connected`. No migration, claim submission, database write, deletion, or production-data mutation was used for validation.

## Registration SMS template follow-up — 2026-09-02

The active admin bundle now exposes the supplied registration SMS text under General Settings → SMS templates as an editable `پیام ثبت پرونده` field. The existing backend already validates and persists `smsTemplates.registration`, renders `{trackingCode}`, and queues the notification after claim commit. The cache-busted HTML and reciprocal bundle imports were deployed through cPanel, live HTTP 200 responses matched local SHA-256 hashes, the focused four-test suite and full 57-test suite passed, and no database/schema/data operation was performed.

## Security and integrity

- CMS public media is isolated under `UPLOAD_DIR/cms`.
- Legacy root-level CMS files require a matching `CmsMedia` row and safe generated-style filename.
- Claim files remain outside public static serving.
- Upload size/count limits, generated filenames, PDF signatures, path containment, and role boundaries are retained or strengthened.
- The lockfile uses the patched `body-parser` release with no audit findings.
- Existing credential-like example values were replaced with placeholders.
- The deployed `.htaccess` denies direct public access to backend source and runtime logs while preserving `/api` health access.
- The deployed claim-delete endpoint is supervisor-only, transactionally removes claim-owned records, detaches nullable cross-feature history, preserves shared customers, and performs constrained post-commit file cleanup. No existing claim was deleted during validation.
- The deployed legal-document replacement endpoint is CMS-editor protected, allow-lists the two document slots, transactionally activates the new file, and performs constrained post-commit cleanup without deleting database metadata. No production document was replaced during validation.
- Public legal-document delivery is routed through `/api/uploads/...`; both configured live PDFs passed the HTTP/content-signature check, and legacy stored URL values were preserved.
- SMS sender/recipient normalization, provider error mapping, and history logging were preserved/strengthened; no database data or schema was changed.
- Flight import uses environment-only secret configuration, constant-time comparison, feed-name allow-listing, bounded provider counts/normalized records, a shared advisory lock, and a protected admin status endpoint.
- Claim priority uses server-side closed-set validation, the existing claim-editor authorization boundary, parameterized SQL, and the existing transaction; unsupported values are rejected without touching the database.
- Questionnaire incomplete-answer feedback is rendered inline with an accessible alert role above the active question list; the UI-only asset update did not change backend validation, database schema, or stored data.
- The integrity baseline still contains the public/admin routes, claim workflow, CMS records, settings controls, and active bundle pair; no protected element was removed.

## Release instructions

Set `EXTERNAL_FLIGHTS_BASE_URL` to the supplied provider base path, keep its username/password in backend-only environment variables, run the idempotent `backend` migration, deploy the existing browser assets and backend, then perform the supervisor upload/public download checks and the flight refresh checks in `docs/11-operations-runbook.md`. If the FlySOS host cannot reach port 3000, use the documented HTTPS push job with a shared strong `FLIGHT_IMPORT_SECRET`. Database execution remains an environment-owned step. SMS sender approval, provider send-window permissions, and any provider IP allowlist correction remain environment-owned steps.

## Final artifact inventory

- Backend settings, migration, upload middleware, CMS controller, routes, validation utilities, and flight-cache push integration.
- Legal-document replacement service, CMS controller transaction path, cleanup regression tests, and aligned deployment/runbook documentation.
- Active frontend assets preserved and verified.
- `backend/.env.example` and sanitized local configuration example.
- Regression tests and stage documentation.
- Claim-priority regression test and deployed backend validation/controller repair.
- Questionnaire inline-error regression assertions and cache-busted active public/admin bundle references.
- Admin React module-graph regression assertions, aligned public/admin entry references, and live unauthenticated white-screen smoke verification.
- Flight API regression tests and aligned push/deployment documentation.
- `project-state.json`, `project-integrity-manifest.md`, and this final review.

## Current flight release-gate recheck — 2026-09-02

| Check | Result |
| --- | --- |
| Ten-minute scheduler implementation and regression | PASS — 3 focused tests; bounded configuration and duplicate-scheduler guard verified. |
| Production deployment and restart | PASS — service uploaded to the registered Node.js app; health returned HTTP 200 with a connected database. |
| Latest valid stored snapshot preservation | PASS — the cached response remains available while provider pulls fail. |
| Fresh provider pull from the laptop | PASS — provider returned HTTP 200 with current data. |
| Fresh provider pull from the deployed server | BLOCKED_EXTERNALLY — repeated `UND_ERR_CONNECT_TIMEOUT` to port 3000. |
| Final release verdict for fresh flight data | REPAIR_REQUIRED — provider allow-list/HTTPS exposure or the ten-minute provider-side push job is still required. |

The release gate cannot claim fresh production flight data until the API owner permits the actual FlySOS egress IP, exposes the provider on HTTPS/443, or schedules `pushFlightsToFlySOS.mjs` on the provider-accessible server. No database migration, manual SQL, deletion, or customer-data mutation was performed.

## Admin flight-monitor ordering repair review — 2026-09-15

The dashboard defect was caused by ascending scheduled-time ordering in the admin cache-summary query. The implementation now returns the latest scheduled row first, retains the newest-fetch precedence, and uses the flight number as a deterministic tie-breaker. The focused 3-test regression, serialized 96-test suite, syntax checks, and diff check passed. The correction is not yet live: no current authenticated deployment target was available, so deployment and live dashboard verification are `NOT_PERFORMED`. No public route, database schema/data, scheduler interval, or unrelated feature was changed.

The dependency security review also upgraded the locked Multer release to `2.4.0`. After a clean production-only install, the high-threshold audit passed with zero high and zero critical advisories; four moderate advisories remain. The dependency update is local and requires the same pending live deployment target before it is active on the host.

## Stage-four final receipt CMS follow-up — 2026-09-15

The final receipt's static wording is now represented by the editable `رسید نهایی` group in the `track-success` CMS block. Admin/public controller paths normalize the group, the seed migration backfills missing fields without replacing editor values, and the public helper maps published values only inside the existing 750×980 receipt canvas. The 2-test focused suite, serialized 100-test suite, syntax checks, and diff checks are local validation evidence. Live publication, authenticated CMS read/write, browser visual verification, and production receipt download remain `NOT_PERFORMED`.

`STAGE_11_STATUS: REPAIR_REQUIRED`
`STAGE_12_STATUS: REPAIR_REQUIRED`
`WORKFLOW_STATUS: REPAIR_REQUIRED`
`PROJECT_STATUS: PRODUCTION_DEPENDENCIES_PENDING`
`NEXT_STAGE: 11-deployment-production`
