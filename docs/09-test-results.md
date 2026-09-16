# Test Results — Passenger Rights, Goftino, and Claim Workflow Fixes

**STAGE_09_STATUS: PASS**

## Executed checks

| Command/check | Result | Evidence |
| --- | --- | --- |
| `node --test --test-concurrency=1 --test-timeout=120000 tests/*.test.cjs` | PASS | 60 tests passed, 0 failed, 0 skipped. |
| `node --check` on all 57 backend JavaScript/MJS files | PASS | All files parsed successfully, including the transaction, extraction-job, and notification-job services. |
| `npm ci --omit=dev --ignore-scripts` in `backend/` | PASS | Lockfile installation completed with production dependencies only. |
| `npm audit --omit=dev --audit-level=high` in `backend/` | PASS | Exit code 0; 0 high, 0 critical, and 5 moderate advisories. |
| `npm run db:legal` against MySQL | NOT_RUN | No local MySQL server or application credentials are available. |
| Frontend production build | NOT_RUN | The repository contains committed browser assets but no frontend source/package build project. |
| Live API/database end-to-end flow | NOT_RUN | Requires a configured database and administrator account. |

## Questionnaire change evidence

| Command/check | Result | Evidence |
| --- | --- | --- |
| `node --test tests/questionnaire-required-answers.test.cjs` | PASS | 8 tests passed, covering cancellation and delay completeness, conditional questions, invalid identifiers, controller ordering, admin section mapping, and active bundle safeguards. |
| `node --check` on changed backend and browser bundles | PASS | `claimController.js`, `questionnaireService.js`, `claimMapper.js`, the public bundle, and both committed admin bundles parsed successfully. |
| Database schema/migration change | NOT_PERFORMED | The questionnaire requirement is enforced at the API boundary and no database structure or stored data was changed. |

## Flight API regression evidence

| Check | Result | Evidence |
| --- | --- | --- |
| `node --test tests/flight-api-regression.test.cjs` | PASS | 8 tests passed, including the previous route 404/module-link failure, `401`/`503`/`400` rejection paths, authenticated `202` acknowledgement, route-scoped size handling, admin status authentication, and legacy provider URL compatibility. |
| Flight-cache persistence against MySQL | NOT_RUN | No local MySQL service or deployment credentials are available; the valid request test intentionally verifies the asynchronous acknowledgement without claiming database persistence. |
| Production push job and live cache freshness | NOT_PERFORMED | Requires deployment of the updated backend, shared secret provisioning, and the provider-side cron job. |

## SMS integration evidence

| Check | Result | Evidence |
| --- | --- | --- |
| SMS service regression suite | PASS | `node --test tests/sms-service-regression.test.cjs`: 4 tests passed, 0 failed. |
| Full regression suite | PASS | `node --test --test-concurrency=1 tests/*.test.cjs`: 52 tests passed, 0 failed. |
| Provider contract | VERIFIED | The implementation uses the documented `POST /Messages/Send` JSON contract and raw `Authorization` token header. |
| Live provider result | BLOCKED_EXTERNALLY | Existing server logs contained provider status 17 and 12; the read-only provider IP-list check returned status 35; no real recipient message was sent by this validation. |
| Database impact | NOT_PERFORMED | No database query, migration, update, or deletion was executed during the SMS repair/deployment. |

## Goftino widget integration evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Widget mapping/schema regression | PASS | `node --test tests/widget-settings-regression.test.cjs`: 4 tests passed, covering stored mapping, environment fallback, settings-schema acceptance, and non-migrating persistence wiring. |
| Live public settings contract | PASS | `GET /api/legal-documents` returned HTTP 200, includes `goftinoWidgetId`, and returned the configured server-side identifier without exposing it in the validation log. |
| Live backend deployment | PASS | `platformSchemas.js`, `legalDocument.js`, and `platformController.js` were uploaded through cPanel and verified by their deployed code markers. |
| Live environment configuration | PASS | The user-supplied Goftino identifier and SMS token were stored in the server-managed environment file; values were verified by length/match checks only and were not written to source control. |
| Database impact | NOT_PERFORMED | No migration, schema alteration, settings update, or data deletion was executed. |

## Claim deletion integration evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Claim deletion regression suite | PASS | `node --test tests/delete-claim-regression.test.cjs`: 3 tests passed, covering unauthenticated protection, non-supervisor denial, route/controller wiring, transactional child cleanup, history detachment, and upload-root path containment. |
| Live route boundary | PASS | The deployed unauthenticated `DELETE /api/admin/claims/claim-delete-probe` request returned HTTP `401`; no authenticated deletion request was issued. |
| Live backend deployment | PASS | `adminController.js`, `adminRoutes.js`, and the Passenger restart marker were uploaded through cPanel; remote code markers were verified and `/api/health` returned HTTP `200`. |
| Database/data impact | NOT_PERFORMED | No migration, database query, authenticated delete, or claim/data mutation was executed during implementation or deployment validation. |

## Downloadable legal-document replacement evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Replacement regression suite | PASS | `node --test tests/legal-document-replacement-regression.test.cjs`: 3 tests passed, covering both supported document slots, invalid-slot rejection, path containment, traversal/external URL rejection, symlink refusal, and cleanup of both nested and legacy root-level CMS files. |
| Full regression suite after replacement change | PASS | `node --test --test-concurrency=1 tests/*.test.cjs`: 52 tests passed, 0 failed, including the claim-registration connection/OCR/notification regressions. |
| Backend syntax after replacement change | PASS | `node --check` over 57 backend JavaScript/MJS files completed successfully. |
| Public URL delivery mapping | PASS | Stored legacy `/uploads/...` values remain unchanged internally while public responses and new CMS upload results use `/api/uploads/...`; both live document endpoints returned PDF responses and no database write was performed. |
| Authenticated upload against MySQL | NOT_RUN | No database-backed authenticated upload was issued because it would mutate production settings/media and the user required database preservation. |
| Database/schema impact | NOT_PERFORMED | No migration, schema alteration, row deletion, or database update was executed. The existing `AppSetting` and `CmsMedia` structures are reused. |
| Physical-file cleanup behavior | PASS LOCALLY / LIVE MUTATION NOT_RUN | The cleanup helper is confined to `UPLOAD_DIR`, runs after commit, refuses unsafe paths/symlinks, and retains old metadata. A real replacement file was not uploaded during validation. |

## Claim priority integration evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Claim-priority regression suite | PASS | `node --test --test-concurrency=1 --test-timeout=120000 --test-reporter=dot tests/claim-priority-regression.test.cjs`: 3 tests passed, covering supported-value preservation, unsupported-value rejection, and controller/mapper wiring. |
| Changed-file syntax | PASS | `node --check backend/validation/adminSchemas.js`, `node --check backend/controllers/adminController.js`, and `node --check tests/claim-priority-regression.test.cjs` completed successfully. |
| Server deployment | PASS | `backend/validation/adminSchemas.js` and `backend/controllers/adminController.js` were uploaded to their exact server import paths through the authenticated cPanel file endpoint; the registered CloudLinux Node.js application was restarted, remote priority markers matched, and live `/api/health` returned HTTP 200. |
| Live mutation | NOT_RUN | An authenticated claim update was not issued so no existing claim or database value was changed during validation. The unauthenticated `PATCH /api/admin/claims/priority-deploy-probe` boundary returned HTTP 401. |

## Questionnaire inline validation evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Inline missing-answer regression | PASS | The focused questionnaire suite passed 8/8 tests; the active public bundle contains the `questionnaireError` state, accessible `role="alert"` rendering, and the red validation style. |
| Native alert removal | PASS | The exact incomplete-question browser alert is absent from the active local and live bundles; the message is rendered above the active question list instead. |
| Live cache-busted asset | PASS | Public and admin HTML now reference the `20260902-questionnaire-inline-error-v2` bundle URL; the live bundle returned HTTP `200` and the expected inline-error marker. |
| Database/data impact | NOT_PERFORMED | This UI-only change did not execute a migration, database query, stored-data update, deletion, or database command. |

## Claim registration connection/OCR repair evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Transaction lifecycle regression | PASS | `node --test tests/db-connection-regression.test.cjs`: failed begin/rollback paths destroy broken connections, always clean up, and preserve the original error. |
| Upload/OCR lifecycle regression | PASS | `node --test tests/claim-upload-lifecycle-regression.test.cjs`: ticket OCR is scheduled after the response path, persistence is transactional, stale replacements are ignored, and persistence failures do not become upload HTTP failures. |
| Submit/notification lifecycle regression | PASS | `node --test tests/claim-registration-connection-regression.test.cjs`: the submit response uses committed state, notification work is post-commit, and provider failures cannot reject the completed registration response. |
| Full regression suite | PASS | `node --test --test-concurrency=1 tests/*.test.cjs`: 52 tests passed, 0 failed, 0 skipped. |
| Backend syntax | PASS | `node --check` over all 57 backend JavaScript/MJS files completed successfully. |
| Live deployment | PASS | `db.js`, `env.js`, `claimController.js`, the extraction-job service, and the registration-notification service were uploaded to the exact server paths, the registered Node.js application was restarted, remote SHA-256/byte checks matched local files, and live health returned HTTP 200 with `database: connected`. |
| Live connection stability smoke | PASS | 12 bounded read-only `GET /api/health` checks returned HTTP 200 after restart. |
| Database/schema impact | NOT_PERFORMED | No migration, query intended to mutate data, claim submission, deletion, or stored database value was issued during deployment validation. |

## Admin white-screen regression evidence — 2026-09-02

| Check | Result | Evidence |
| --- | --- | --- |
| React module-graph regression | PASS | `node --test --test-concurrency=1 tests/admin-react-singleton-regression.test.cjs`: 1 test passed, 0 failed; public/admin HTML and reciprocal bundle imports use the same exact cache-busted module URLs. |
| Full regression suite after admin repair | PASS | `node --test --test-concurrency=1 tests/*.test.cjs`: 53 tests passed, 0 failed, 0 skipped. |
| Static deployment integrity | PASS | Canonical `index.html`, admin HTML, main bundle, and admin bundle were uploaded through authenticated cPanel Fileman; remote UTF-8 hashes matched local files. No database command or data mutation was issued. |
| Live admin runtime smoke | PASS | A fresh unauthenticated `https://flysos.ir/admin/v2/login/` route rendered the admin login form. No React error `#321` or `removeChild` reconciliation error was observed; anonymous session-fetch failures were expected without an admin session. |

## Regression suite contents

The suites cover both legal-document settings slots, canonical/legacy URL normalization, transactional replacement/cleanup wiring, Goftino widget response/schema/fallback handling, generic-MIME PDF acceptance, actual CMS Multer destination behavior, public-serving isolation, migration fields/backfill, active asset pairing, the flight import API contract, SMS request/error handling, supervisor-only claim deletion, claim-priority validation/persistence wiring, claim registration transaction/async OCR/notification handling, and the existing claim-flow structural test.

## Team performance report regression — 2026-09-16

| Check | Result | Evidence |
| --- | --- | --- |
| Team-performance aggregation and contract suite | PASS | `node --test --test-concurrency=1 tests/team-performance-report-regression.test.cjs`: 4 tests passed, 0 failed; includes the three staff roles currently shown by Expert Management and zero-count rows. |
| Full serialized regression suite | PASS | `node --test --test-concurrency=1 tests/*.test.cjs`: 101 tests passed, 0 failed, 0 skipped. |
| Changed-file syntax | PASS | `node --check` passed for the new service, modified controllers/routes, and active browser bundles. |
| Database-backed authenticated report retrieval | NOT_RUN | No production admin session/database mutation was used in local validation; the endpoint uses read-only queries and is deployed only when an authenticated deployment target is available. |
| Passenger satisfaction metric | NOT_APPLICABLE | The current schema has no persisted passenger-survey source; the API returns an explicit null/unregistered value rather than a fabricated score. |

## Unresolved test limitations

The database migration, settings/replacement controller against MySQL, authenticated browser upload/download against the deployed API, and successful live SMS delivery require environment-specific verification. The replacement code is deployed and health-checked, but no production file or database record was mutated as a test fixture. SMS provider sender/account permissions, send-time policy, and production-IP approval must be corrected before a real delivery can pass.

## Registration SMS template deployment — 2026-09-02

| Check | Result | Evidence |
| --- | --- | --- |
| Registration template regression | PASS | `node --test --test-concurrency=1 tests/registration-sms-template-regression.test.cjs`: 4 tests passed, 0 failed. |
| Full regression suite | PASS | `node --test --test-concurrency=1 tests/*.test.cjs`: 57 tests passed, 0 failed, 0 skipped. |
| Active bundle syntax | PASS | `node --check assets/AdminPanel-CmsReadyAdminFix20260820.js` and `node --check assets/index-CmsReadyAdminFix20260820.js` completed successfully. |
| Static deployment integrity | PASS | The four canonical HTML/bundle files were uploaded through authenticated cPanel Fileman; live HTTPS responses returned HTTP 200, matched local SHA-256 hashes, and the admin bundle contains the registration field/default. |
| Database/schema impact | NOT_PERFORMED | No migration, `ALTER TABLE`, settings update, row deletion, or stored-data mutation was executed for this delivery. |

The existing backend already owns the registration template default, server-side `{trackingCode}` rendering, settings validation/persistence, and post-commit notification call. This change adds the missing admin control and rotates the static cache key to `20260902-registration-sms-template-v1` so the field is available from the live bundle.

## Flight scheduler and live reachability checkpoint — 2026-09-02

| Check | Result | Evidence |
| --- | --- | --- |
| Scheduler configuration regression | PASS | `node --test --test-concurrency=1 tests/flight-cache-scheduler-regression.test.cjs`: 3 tests passed, including enabled/disabled behavior, the `600000` ms interval, and the minimum-bound fallback. |
| Full regression suite | PASS | `node --test --test-concurrency=1 --test-timeout=120000 tests/*.test.cjs`: 60 tests passed, 0 failed, 0 skipped. |
| Backend/test syntax | PASS | 57 backend JavaScript/MJS files and 15 test CJS files passed `node --check`. |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high --json` returned exit code 0 with 0 high, 0 critical, and 5 moderate advisories. |
| Live backend deployment | PASS | `flightCacheService.js` was uploaded to the registered Node.js app through cPanel and the app was restarted; `/api/health` returned HTTP 200 with `database: connected`. |
| Live cached flight status | PASS_WITH_STALE_CACHE | `/api/flights/status` returned HTTP 200 and `X-Data-Source: flight-cache`; the latest valid row remains `2026-08-18T05:44:30.618Z` because refresh attempts fail. |
| Provider contract from laptop | PASS | The supplied provider endpoint returned HTTP 200 with current flight data. |
| Provider pull from deployed server | BLOCKED_EXTERNALLY | Server logs contain repeated `fetch failed (UND_ERR_CONNECT_TIMEOUT)` for the provider's port 3000. |
| Database mutation/migration | NOT_PERFORMED | No migration, manual SQL, claim operation, deletion, or stored-data update was used for this repair. |

The cached-row preservation behavior is intentional: a failed provider request does not erase the last valid snapshot. Fresh production data requires provider-side network correction or the existing HTTPS push job on the provider-accessible server.

## Admin flight-monitor ordering follow-up — 2026-09-15

| Check | Result | Evidence |
| --- | --- | --- |
| Latest-flight ordering regression | PASS | `node --test tests/admin-flight-monitor-regression.test.cjs`: 3 tests passed, 0 failed. The admin summary queries use newest-fetch/latest-scheduled ordering with a deterministic flight-number tie-breaker. |
| Complete regression suite | PASS | `node --test --test-concurrency=1 --test-timeout=120000 tests/*.test.cjs`: 96 tests passed, 0 failed, 0 skipped. |
| Syntax validation | PASS | `node --check` passed for 61 backend JavaScript/MJS files, 28 test CJS files, and the active admin/public bundles. |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high --package-lock-only --json`: 0 high, 0 critical, and 4 moderate advisories; Multer is locked to `2.4.0`. |
| Diff validation | PASS | `git diff --check` completed successfully; only existing LF/CRLF normalization warnings were reported. |
| Live deployment of ordering follow-up | NOT_PERFORMED | No current authenticated cPanel/deployment target was available in this session; no production file, restart, database, or cache mutation was issued. |

The correction is limited to the admin cache-summary read ordering. The ten-minute server-side provider `GET` scheduler and one-minute authenticated dashboard refresh remain in place. Fresh live data still depends on the previously documented provider reachability blocker.
## Stage-two ticket-upload feedback evidence — 2026-09-15

| Command/check | Result | Evidence |
| --- | --- | --- |
| `node --test tests/ticket-upload-required-error.test.cjs` | PASS | 2 tests passed; the public entrypoint loads the scoped helper, the mandatory-file guard remains in the active bundle, and the top alert/scroll contract is present. |
| `node --check assets/ticket-upload-error-position-20260915.js` | PASS | The new public helper parsed successfully. |
| `node --test --test-concurrency=1 --test-timeout=120000 tests/*.test.cjs` | PASS | 98 tests passed, 0 failed, 0 skipped after the change. |
| Live mobile browser validation | NOT_RUN | No current authenticated deployment target or working browser automation session was available; live publication was not performed. |

## Stage-four final receipt CMS evidence — 2026-09-15

| Command/check | Result | Evidence |
| --- | --- | --- |
| `node --test tests/claim-receipt-cms-regression.test.cjs` | PASS | 2 tests passed; custom CMS receipt values survive normalization, missing defaults are supplied, non-track pages remain untouched, and the public canvas bridge is wired. |
| `node --test --test-concurrency=1 --test-timeout=120000 tests/*.test.cjs` | PASS | 100 tests passed, 0 failed, 0 skipped after adding the receipt regression. |
| Syntax validation | PASS | 62 backend JavaScript/MJS files, 30 test CJS files, the active public/admin bundles, and the receipt helper passed `node --check`. |
| Live CMS publication and browser download | NOT_RUN | No current authenticated cPanel/deployment target or working browser automation session was available; no production file or database mutation was issued. |

## Admin stale-bundle cache repair evidence — 2026-09-15

| Command/check | Result | Evidence |
| --- | --- | --- |
| node --test --test-concurrency=1 tests/admin-react-singleton-regression.test.cjs | PASS | The focused regression requires one new cache key across public/admin HTML and reciprocal imports and rejects the stale 20260906-rights-cta-v1 import. |
| node --check for active public/admin bundles | PASS | Both JavaScript bundles parsed successfully after the cache-key update. |
| Full regression suite | PASS | node --test --test-concurrency=1 --test-timeout=120000 tests/*.test.cjs: 100 tests passed, 0 failed, 0 skipped. |
| Live module graph | PASS | Admin HTML, lazy AdminPanel bundle, and shared main bundle all served HTTP 200 with 20260915-admin-react-singleton-v1; live content matched local files by SHA-256. |
| Database impact | NOT_PERFORMED | This static cache repair issued no migration, SQL command, claim operation, or stored-data mutation. |
