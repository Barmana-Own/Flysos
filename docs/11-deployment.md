# Deployment — Passenger Rights, Goftino, Claim Workflow, and Legal-Document Replacement Fixes

**STAGE_11_STATUS: REPAIR_REQUIRED — provider reachability**

## Build and install

From `backend/`:

```text
npm ci --omit=dev
npm run db:legal
npm start
```

The frontend remains the committed root/static asset set and must be deployed with the existing `index.html`, `admin/v2/login/index.html`, and `assets/` files.

## Configuration

Copy `backend/.env.example` to the environment-managed backend configuration and provide real values outside source control. `DB_NAME`, `DB_USER`, and a strong `JWT_SECRET` are required for normal operation. Keep `UPLOAD_DIR` persistent across application restarts and outside any unintended public document root.

## Migration rollout

1. Back up the database according to the existing operations policy.
2. Run `npm run db:legal` once against the target database.
3. Confirm `AppSetting.powerOfAttorneyUrl` and `AppSetting.rightsDocumentUrl` exist and legacy values were preserved.
4. Restart the backend and perform an authenticated settings upload test.
5. Verify `GET /api/legal-documents` and the public passenger-rights download.

The migration is idempotent. The runtime settings path also performs compatibility checks for installations that have not yet run the focused migration. Legal-document replacement itself does not run a migration and reuses the existing `AppSetting` and `CmsMedia` structures.

## Downloadable-document replacement rollout

The protected CMS upload endpoint recognizes the existing titles for `نمونه وکالت‌نامه رسمی` and `آیین‌نامه حقوق مسافر` (or an explicit supported `documentKey`). It inserts the new media row and updates the matching setting in one transaction, then removes the previous managed physical file after commit when it is not referenced by the other legal-document slot. The previous `CmsMedia` metadata row and unrelated database data are preserved.

Deploy `backend/services/legalDocumentReplacementService.js` and `backend/controllers/cmsController.js`, restart the application, and verify `/api/health`. Then, using a supervisor/CMS-editor account and an approved non-sensitive PDF, replace each document one at a time. Verify the returned URL, `GET /api/legal-documents`, the public download, and the absence of the previous physical file under the managed CMS directory. Do not run a database migration or manually delete rows/files as part of this check.

## Runtime and health

Use the existing `GET /api/health` endpoint and application logs for readiness checks. The API must run with production `NODE_ENV`, a strong JWT secret, and no development credentials. The existing rate limiter covers the API and scoped public file paths.

## Flight feed refresh

The registered cPanel Node.js application is configured with `FLIGHT_CACHE_ENABLED=true` and `FLIGHT_CACHE_INTERVAL_MS=600000`, so the backend attempts a provider refresh every ten minutes when the provider endpoint is reachable. For a cPanel deployment where the backend cannot reach the provider's port 3000, configure a strong `FLIGHT_IMPORT_SECRET` (at least 32 characters; 48 random characters are recommended), set `FLIGHT_CACHE_ENABLED=false`, and run `backend/scripts/pushFlightsToFlySOS.mjs` on the flight-data server with the same secret and provider credentials. Schedule that fallback push every ten minutes. The script posts to `/api/flights/import`; the endpoint acknowledges valid pushes with HTTP `202` and persists them asynchronously.

If the provider is made reachable through an HTTPS reverse proxy, configure the canonical `EXTERNAL_FLIGHTS_BASE_URL`, keep the scheduler enabled, and retain the ten-minute interval. The older `EXTERNAL_FLIGHTS_RELAY_URL` name remains accepted as a backward-compatible alias, but new deployments should use the canonical name.

The admin diagnostic endpoint is `GET /api/admin/flight-cache/push-status`. It requires admin authentication and reports configuration/cache metadata without exposing secrets or provider payloads.

## Deployment status

Production-like startup was smoke-tested with the database unavailable and the scheduler disabled; the process started and shut down cleanly. The SMS service, SMS error mapping, root `.htaccess` protection, questionnaire backend, active cache-busted public/admin bundles, and legal-document replacement backend were deployed to the authorized cPanel target without running a database command. No migration, database deletion, or data update was performed. A real recipient SMS or authenticated production document replacement was intentionally not sent during deployment validation.

## SMS provider prerequisites

The application loads the environment-managed `backend/.env.sms` after the general environment file. The provider must approve the configured numeric sender/agent, permit the account to send during the requested hours, and allow the production server's outbound IP when IP restrictions are enabled. The live provider responses previously observed were status `17` for sender/agent validity and status `12` for the organization send window; these are account/provider controls, not database failures. After the provider corrects them, use the admin SMS test with a controlled recipient and verify the resulting `MessageLog` entry.

## Goftino widget configuration

The browser reads `goftinoWidgetId` from `GET /api/legal-documents`. The admin settings endpoint accepts and returns the value, while the server checks for the existing `AppSetting.goftinoWidgetId` column without altering the database. The supplied identifier is configured through the server-managed environment file, so the live response now contains the identifier without requiring a database write. If the database column exists, a later administrator save can persist a changed value; if it does not exist, a requested widget update fails explicitly rather than being silently discarded.

## Validation checkpoint — 2026-09-01

- The checked-out revision is `4a0bdec`, equal to `origin/main`.
- `npm ci --omit=dev`, the 32-test regression suite, backend syntax checks for 54 files, and `npm audit --omit=dev` passed.
- A deterministic provider contract smoke verified `/api/flights`, `/api/flights/cancelled-last-24h`, `/api/flights/delayed-last-24h`, and `/api/flights/count`, including separate credential query parameters and response normalization.
- The supplied provider host timed out from this workspace on all four bounded requests. This is a reachability limitation, not evidence of fresh provider data.
- `https://flysos.ir/api/health` and the public frontend are reachable. `GET /api/flights/status?limit=500` returns 500 cached rows, but the latest cached snapshot observed was `2026-08-18T05:44:30.618Z`; freshness is therefore not verified.
- The SMS backend fix and root `.htaccess` protection were uploaded through cPanel and verified from the public site: `/api/health` returned HTTP 200 while `/backend/services/smsService.js` and `/backend/stderr.log` returned HTTP 403.
- The 32-test suite, 54-file backend syntax check, `npm audit --omit=dev`, and `git diff --check` passed. The live provider/account correction and real SMS delivery check remain **NOT_RUN/BLOCKED_EXTERNALLY**.
- The questionnaire backend and active public/admin frontend bundles were uploaded through cPanel with cache-busting updates. Live checks confirmed the required-answer guard, claim-type propagation, admin section label, and HTTP 200 delivery; no database migration or data modification was performed.

## Validation checkpoint — 2026-09-02

- The Goftino settings plumbing was uploaded through cPanel without changing the database. The live `GET /api/legal-documents` response returned HTTP 200 and included the configured `goftinoWidgetId` value.
- The full local regression suite passed 39/39 tests; 54 backend files passed syntax checks; `npm audit --omit=dev` reported 0 vulnerabilities; `git diff --check` passed.
- The live health endpoint returned HTTP 200 after the backend restart marker was uploaded. No migration, settings update, deletion, or data operation was performed.
- The SMS token was updated in the server-managed environment file and the provider endpoint remains reachable, but delivery remains blocked by provider-side sender/agent, send-window, and IP policy (observed status 17/12 and the read-only IP-list check returned status 35). The application reports the actionable failure but cannot override provider account controls.

## Claim deletion deployment

The admin frontend already called `DELETE /api/admin/claims/:id`; the deployed backend now mounts that route behind `requireSupervisor` and repeats the role check in the controller. Claim-owned rows are deleted transactionally, nullable notification/SMS/support links are detached, the shared customer row is preserved, and uploaded files are cleaned only after commit and only inside `UPLOAD_DIR`. `adminController.js`, `adminRoutes.js`, and the Passenger restart marker were uploaded through cPanel. The live unauthenticated boundary returned HTTP `401`, `/api/health` returned HTTP `200`, and no authenticated delete, database query, migration, or existing-record mutation was performed.

## Validation checkpoint — 2026-09-02 legal-document replacement

- `backend/services/legalDocumentReplacementService.js` and the updated CMS controller were uploaded through cPanel; no database command or production file replacement was performed.
- The server restart marker was uploaded and `/api/health` remained HTTP 200.
- The local replacement regression suite passed 3/3; the full suite at that checkpoint passed 43/43; all 55 backend JavaScript/MJS files passed syntax checks; dependency audit and `git diff --check` passed. The subsequent claim-priority repair raised the current full suite to 46/46.
- The deployed public legal-document contract now returns `/api/uploads/...` delivery paths for stored legacy `/uploads/...` values, and both live document endpoints returned HTTP 200 PDF responses with the `%PDF-` signature; stored database values were not changed.
- A real authenticated replacement was marked NOT_RUN because it would mutate production settings/media. The code path is covered locally and is ready for a controlled supervisor test with an approved PDF.

## Claim priority deployment — 2026-09-02

The admin claim summary already sent `priority`, but the backend schema removed the field before the controller built its SQL update list. `backend/validation/adminSchemas.js` now accepts only `low`, `medium`, `high`, and `urgent`, and `backend/controllers/adminController.js` persists a supplied value through the existing parameterized claim-edit transaction. The existing `Claim.priority` column is reused; no migration, database command, row deletion, or data update was performed.

Both backend files were uploaded with overwrite enabled to the exact server import paths (`backend/validation/adminSchemas.js` and `backend/controllers/adminController.js`) through the authenticated cPanel file endpoint. The registered CloudLinux Node.js application was restarted; remote priority markers matched, `/api/health` returned HTTP 200, and an unauthenticated priority PATCH probe returned HTTP 401. An authenticated live claim update was intentionally NOT_RUN to protect existing production data.

## Questionnaire inline validation deployment — 2026-09-02

The active public bundle was updated so the incomplete-question guard renders an inline red validation message above the questionnaire instead of opening a browser alert. The message uses an accessible `role="alert"` and clears after a response or problem-type change. The local public/admin HTML references were cache-busted, and the live v2 bundle plus public/admin HTML were updated through cPanel. Live checks confirmed HTTP `200`, the inline-error marker, and the absence of the exact questionnaire browser alert. No backend, database, migration, or stored-data operation was performed for this UI change.

## Claim registration connection deployment — 2026-09-02

The registered CloudLinux Node.js application was updated through cPanel with `backend/config/db.js`, `backend/config/env.js`, `backend/controllers/claimController.js`, `backend/services/ticketExtractionJobService.js`, and `backend/services/claimNotificationJobService.js`. The pool now bounds idle/connect behavior and safely disposes of known-broken connections; ticket OCR and registration notification work are queued after their core database operations, while the submit response is built from the committed claim state. The application was restarted and the remote source files matched the locally validated bytes. `/api/health` returned HTTP 200 with `database: connected` in 12/12 bounded read-only checks. No migration, database query intended to mutate data, claim submission, deletion, or stored-data change was performed.

## Admin white-screen deployment — 2026-09-02

The public entry HTML, admin entry HTML, shared main bundle, and canonical admin bundle were uploaded with overwrite enabled through the authenticated cPanel Fileman endpoint. No old asset or database data was deleted. Remote UTF-8 hashes matched the local files. Both HTML routes now reference the same cache-busted shared entry, and the reciprocal bundle imports use the same module URLs. A fresh live unauthenticated admin route rendered the login form without React `#321` or `removeChild` errors.

## Questionnaire submission cache correction — 2026-09-02

The live CDN was serving an older cached copy of the shared browser bundle under the previous immutable query string. That copy posted questionnaire answers without `claimType`, while the deployed API correctly validates the claim type before persistence and therefore returned HTTP `400`. The public and admin HTML entries plus both reciprocal bundle imports now use the new `20260902-questionnaire-submit-v2` cache key. The four static files were overwritten through authenticated cPanel Fileman; no backend restart, database command, migration, row update, or stored-file deletion was performed. Live checks confirmed the new bundle contains `claimType` propagation and the inline questionnaire guard, and the new public/admin HTML serves the new cache key.

## Registration SMS template deployment — 2026-09-02

The active admin bundle was updated so General Settings → SMS templates includes an editable `پیام ثبت پرونده` field initialized with the existing registration message. The existing settings save handler already sends `smsTemplates.registration`, while the backend already validates, stores, and renders this key for the post-commit registration notification. The canonical `index.html`, admin entry HTML, shared main bundle, and admin bundle were overwritten through authenticated cPanel Fileman with the new cache key `20260902-registration-sms-template-v1`. Live HTTPS responses for all four files returned HTTP 200, matched the local SHA-256 hashes, and contained the new field/module references. No backend restart, migration, SQL command, database row update, deletion, or stored-data mutation was performed.

## Flight scheduler deployment and provider reachability — 2026-09-02

The backend flight scheduler was deployed to the registered CloudLinux Node.js application and restarted through cPanel. The server-managed environment now enables the scheduler and sets `FLIGHT_CACHE_INTERVAL_MS=600000` (ten minutes). The deployed `flightCacheService.js` matched the locally validated source. No migration, SQL command, claim operation, database deletion, or customer-data update was performed.

Read-only live checks confirmed `/api/health` returns HTTP `200` with `database: connected`, and `/api/flights/status` remains reachable with `X-Data-Source: flight-cache`. The response still contains the last valid snapshot from `2026-08-18T05:44:30.618Z`; this is intentional preservation behavior while provider refreshes fail, not deletion of the stored rows.

The provider API returns HTTP `200` with current data from the laptop, but the deployed server log records repeated `fetch failed (UND_ERR_CONNECT_TIMEOUT)` errors for the provider connection on port `3000`. The remaining root cause is therefore external network reachability: the API owner must allow the actual FlySOS server egress IP to TCP/3000, expose the provider through HTTPS/443, or run the existing `pushFlightsToFlySOS.mjs` on the provider-accessible server every ten minutes. The current DNS address `185.239.1.100` is only a candidate for allow-listing and must be confirmed as the server's actual egress IP by the hosting provider.

## Host-side repair recheck — 2026-09-03

The backend runtime and SMS environment files were restricted through cPanel File Manager to owner-only permissions (`0600`), and the registered CloudLinux Node.js application was restarted and remained `started` on Node `22.23.2`. This changed permissions only; no file contents, database rows, migration, claim, deletion, or stored customer data were touched.

Read-only live checks after the restart returned HTTP `200` from `/api/health` with `database: connected` and HTTP `200` from `/api/flights/status` with `X-Data-Source: flight-cache`. The last valid snapshot is still preserved at `2026-08-18T05:44:30.618Z`. The scheduler is ready to refresh automatically once the API owner or network policy makes the provider endpoint reachable; the remaining timeout is outside this host.

## Admin flight-monitor ordering follow-up — 2026-09-15

The local backend correction changes only the read ordering used by the protected admin dashboard summary: the newest valid snapshot is retained and its latest scheduled flight is returned first. The ten-minute provider `GET` scheduler, authenticated dashboard read path, public flight API, and database schema remain unchanged. A live upload/restart was NOT_PERFORMED for this follow-up because no current authenticated cPanel/deployment target was available in the session. The previously deployed scheduler and its provider port-3000 reachability dependency remain as documented above.

During local release validation, the direct `multer` dependency was raised from `2.2.0` to `2.4.0` and the lockfile was regenerated. This security hardening is validated locally but is also NOT_PERFORMED on the live host because the current authenticated deployment target was unavailable; the server must receive the updated package manifest/lockfile and restart through the normal deployment process before the dependency change is active in production.

## Stage-four final receipt CMS follow-up — 2026-09-15

## Admin stale-bundle cache repair — 2026-09-15

The deployed admin white screen was caused by an immutable CDN copy of the AdminPanel bundle retaining the old reciprocal main-bundle query key. The public entry HTML, admin entry HTML, shared main bundle, and canonical AdminPanel bundle were overwritten through authenticated cPanel Fileman using the new cache key 20260915-admin-react-singleton-v1. Live checks returned HTTP 200, the three-way module graph was consistent, the live main/AdminPanel content matched local SHA-256 hashes, and no database or Node.js restart operation was required.

The local release includes `backend/services/claimReceiptContentService.js`, the CMS controller/seed integration, `assets/claim-receipt-cms-content-20260915.js`, `index.html`, and `tests/claim-receipt-cms-regression.test.cjs`. No cPanel upload, Node.js restart, CMS publish action, database migration, or production receipt download was performed in this session. Deployment requires uploading the exact changed files, restarting the registered Node.js app if backend code is cached by the host, publishing the `track-success` CMS draft, then performing one controlled stage-four receipt download check.

## Team-performance staff coverage deployment — 2026-09-16

The report previously filtered `AdminUser` to only the four legal-expert role values, while the three staff accounts currently shown in Expert Management use the `supervisor` and `passenger_admin` roles. That filter produced a valid empty array, so the admin table rendered only its headers. The allowed claim-team role set now includes `supervisor` and `passenger_admin`; the existing aggregation and active admin bundle already render names, role labels, assigned/closed counts, review time, and the explicit unregistered satisfaction state.

`backend/services/teamPerformanceService.js` and `backend/controllers/platformController.js` were uploaded to their exact server paths through authenticated cPanel Fileman, and the registered Node.js application was restarted using `backend/tmp/restart.txt`. Read-only live checks returned HTTP `200` from `/api/health` with `database: connected`, HTTP `401` from the protected report without a token, and HTTP `200` for the active admin HTML/bundle. No claim, staff, database, or satisfaction data was changed. An authenticated browser retrieval of the production rows remains `NOT_RUN` because no admin session was used for the deployment check.
