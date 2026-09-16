# QA Report — Passenger Rights and Legal-Document Replacement Fix

## Status

**STAGE_10_STATUS: PASS**

## Tested journeys

- Supervisor upload contract: verified through the active bundle, settings schema, CMS route, and real Multer multipart boundary.
- Persisted setting contract: verified through canonical/legacy mapping and all SQL update/insert branches.
- Public delivery contract: verified through public response mapping, API upload-path normalization, and scoped serving configuration.
- Existing claim workflow: existing claim-final-step structural regression passes and no claim route was removed.
- Flight feed refresh: the public import endpoint is mounted, rejects unauthorized/malformed requests safely, acknowledges valid pushes asynchronously, and keeps the admin diagnostic endpoint protected. Database-backed persistence remains an environment-owned check.
- Downloadable legal documents: both General Settings replacement controls are covered by an allow-listed backend slot resolver; the new CMS record and matching setting are committed together, and the previous unshared managed physical file is cleaned after commit without deleting its database metadata row.
- Admin claim priority: the claim summary's existing select values are validated server-side and persisted through the existing claim-edit transaction; no database schema or data migration is required.
- Claim registration: the upload response no longer waits for OCR, the submit response no longer waits for SMS/provider work, and transaction cleanup handles dropped connections without masking the original failure.

## Defect log

| ID | Severity | Root cause | Fix | Regression |
| --- | --- | --- | --- | --- |
| QA-001 | P1 | `passengerRightsUrl` was stripped by the settings schema and absent from persistence/public response. | Added schema, normalized mapping, SQL write branches, migration/backfill, and public response. | Legal-document regression suite. |
| QA-002 | P1 | Valid PDFs with fallback MIME values were rejected by shared Multer filtering. | Added extension-aware fallback handling and server-side PDF signature verification. | Middleware and signature tests. |
| QA-003 | P1 | Browser-resolved `/api/uploads/...` had no matching server path, while broad historical serving exposed private uploads. | Added CMS-scoped static paths and allow-listed legacy CMS delivery. | Serving isolation and route contract tests. |
| QA-004 | P1 | The flight HTTPS push path was partially committed: the public route was absent and the controller referenced missing service exports, so the cache could not be refreshed through the documented path. | Mounted the route, wired the import secret, implemented push feed/count persistence and status reporting, and reused the existing cache/advisory-lock path. | `tests/flight-api-regression.test.cjs`; MySQL persistence NOT_RUN. |
| QA-005 | P2 | The global 1 MB JSON parser could reject a legitimate three-feed push before authentication. | Added a bounded 5 MB parser only for the flight import path and a safe 413 error envelope. | Route-scoped body-size regression. |
| QA-006 | P1 | Questionnaire submission accepted `null` or missing visible answers, and admin records did not expose a questionnaire section label. | Added server-side completeness validation for both save and submit, retained the existing conditional-question behavior, added section metadata to admin mappings, and updated the active public/admin bundles. | `tests/questionnaire-required-answers.test.cjs`; bundle syntax checks. |
| QA-007 | P1 | SMS delivery reached the provider with weak local input validation and provider failures were surfaced only as opaque numeric reasons; live logs showed sender status 17 and send-window status 12, and the read-only IP-list check returned status 35. | Added numeric sender validation, Persian/Arabic-Indic phone normalization, actionable provider reason mapping, preserved remote SMS logging, deployed the backend fix, and blocked public backend source/log paths. | `tests/sms-service-regression.test.cjs`; live HTTP 403/health checks; provider-side sender, schedule, and IP approval correction still required. |
| QA-008 | P1 | The admin claim list sent `DELETE /api/admin/claims/:id`, but the backend route/controller was missing, producing a route failure and leaving no server-side delete implementation. | Added a supervisor-only route and controller with identifier validation, transactional claim-owned cleanup, shared-history detachment, and safe post-commit upload-file cleanup; deployed the two backend files and restart marker without deleting a real claim. | `tests/delete-claim-regression.test.cjs`; live unauthenticated boundary returned HTTP 401; authenticated database-backed deletion NOT_RUN by design. |
| QA-009 | P1 | The downloadable-document controls uploaded a new CMS file but did not guarantee that the selected setting and media row were activated together, and the previous physical file was not cleaned. | Added fixed two-slot resolution, row-locked media/settings transaction, explicit invalid-slot rejection, post-commit managed-file cleanup, and preservation of prior metadata/unrelated data. The regression also covers the live legacy root-level CMS file shape. | `tests/legal-document-replacement-regression.test.cjs`; 43-test suite and 55-file syntax check pass; authenticated production mutation NOT_RUN. |
| QA-010 | P1 | Legacy `/uploads/...` document values were returned directly on cPanel, where the document-root SPA fallback rewrote them to HTML instead of serving a PDF. | Kept stored values unchanged but mapped public legal-document responses and new legal-document upload results to `/api/uploads/...`, which is handled by the static delivery routes. | Public URL mapping regression; live `/api/legal-documents` and both PDF delivery boundaries. |
| QA-011 | P1 | The admin claim summary sent `priority`, but `updateClaimSchema` stripped it and `updateClaim` did not add it to the SQL update list, so changing the select could not affect `Claim.priority`. | Added a closed priority enum to the schema and a parameterized `priority = ?` branch inside the existing transaction; deployed both backend files and a Passenger restart marker without changing database contents. | `tests/claim-priority-regression.test.cjs`; current 52-test suite; changed-file syntax; live health and unauthenticated PATCH boundary. |
| QA-012 | P2 | The incomplete-question guard used a native browser alert, which obscured the questionnaire and did not identify the location of the missing response. | Replaced only that alert with an inline red accessible validation message positioned above the active question list; the message clears when an answer is selected or the problem type changes. | `tests/questionnaire-required-answers.test.cjs`; local bundle syntax; live HTML/bundle HTTP 200 and marker checks. |
| QA-013 | P1 | Claim registration kept OCR and post-commit notification work on the request path; stale/fatal MySQL connections could also leak on transaction start or mask the original failure during rollback, producing a generic proxy `Request failed.` response. | Queued OCR and registration notification work after the relevant commit, returned the committed claim state without a second post-commit read, bounded pool idle/connect behavior, and safely destroyed known-broken connections while preserving the original error. | `tests/db-connection-regression.test.cjs`, `tests/claim-upload-lifecycle-regression.test.cjs`, `tests/claim-registration-connection-regression.test.cjs`; 52-test suite; 57-file syntax check; live health 12/12. |
| QA-014 | P1 | The admin HTML and lazy admin bundle imported the same physical main bundle with different query strings, causing separate React module instances and React error `#321`; the subsequent `removeChild` error was a reconciliation symptom. | Aligned the public/admin HTML and both reciprocal bundle imports to one exact cache-busted module graph, then deployed the four static files through cPanel. | `tests/admin-react-singleton-regression.test.cjs`; remote hash comparison; fresh live unauthenticated admin route rendered the login form without the reported errors. |
| QA-015 | P1 | The CDN served an older immutable copy of the shared browser bundle under the previous cache key. That copy omitted `claimType` from the questionnaire request, so the strict API rejected an otherwise completed questionnaire with HTTP `400`, surfaced by the proxy as a generic fetch failure. | Rotated the cache key in both HTML entries and both reciprocal bundle imports, overwrote the four static files through cPanel, and verified the new live bundle includes claim-type propagation and the existing inline completeness guard. | `tests/admin-react-singleton-regression.test.cjs`, `tests/questionnaire-required-answers.test.cjs`; live HTML/assets served the new key and live random-claim contract probes returned the expected `404 CLAIM_NOT_FOUND` after request validation; no production claim or database row was changed. |

All identified P0/P1 defects in the local repository scope are fixed. The flight scheduler deployment is complete, but the live cache will not refresh until the provider permits the deployed server's outbound path or the provider-side ten-minute push job is configured. No browser/device exploratory run, authenticated claim-priority mutation, or database-backed push persistence run was performed because a configured environment is unavailable; those limitations are recorded rather than treated as a pass.

## Accessibility/responsive review

The active bundle retains the existing Persian RTL settings and public page UI, including loading/empty/download states. The missing-question feedback now uses an inline red `role="alert"` message above the active question list and remains aligned with the existing validation styling. Full browser viewport and assistive-technology validation remains an environment-level NOT_RUN check.

## Release blockers

No open code-level P0/P1 defect remains in the claim-registration connection, SMS isolation, claim-delete, legal-document replacement, or claim-priority paths. Live SMS delivery remains blocked by provider-side sender/agent, send-window, and IP approval configuration (status 17/12/35), and must be re-tested after the provider account is corrected. Authenticated database-backed replacement, claim-priority, and real claim-registration mutation tests were intentionally not run; no database data was changed.

## Claim registration connection checkpoint — 2026-09-02

The screenshot's generic `Request failed.` is consistent with the registration request exceeding the reverse-proxy window while OCR or notification work was still running, and the previous transaction helper could leak or mask a dropped connection. The upload path now persists the file and returns before OCR; the submit path returns after its status transaction and queues registration SMS work. Known-fatal connections are destroyed, rollback errors cannot replace the original failure, and no blanket retry was added for non-idempotent writes. Local regression coverage passed 52/52 and the deployed application returned HTTP 200 from 12/12 read-only health checks after restart.

## Admin white-screen checkpoint — 2026-09-02

The reported React hook-context error was reproduced from the deployed asset pairing: the admin bundle referenced a second query-string URL for the shared main bundle. The static module graph was corrected and deployed without touching the database. A fresh live admin route rendered the login form; console inspection found no React `#321` or DOM `removeChild` error. The only remaining console entries were anonymous session-fetch failures expected before authentication.

## Questionnaire submission checkpoint — 2026-09-02

The live questionnaire failure was traced to CDN cache state, not a database disconnect: the previously cached public bundle still posted `{ answers }` while the API requires the selected claim type for validation. The cache key was rotated to `20260902-questionnaire-submit-v2` across the public/admin entries and reciprocal imports. The new live bundle was served successfully and the request contract was checked against the live API with a nonexistent claim, which validated the payload and returned the expected not-found response without changing production data.

## Registration SMS template QA checkpoint — 2026-09-02

The missing registration-template control was confirmed in the active admin bundle while the backend contract already supported the `registration` key. The admin settings state now includes the supplied default message, the template list renders an editable `پیام ثبت پرونده` textarea, and the existing save handler sends the complete `smsTemplates` object. Four focused tests and the serialized 57-test suite passed; both active bundles passed syntax checks; all four static files were deployed and their live SHA-256 hashes matched local files. No database command or data mutation was executed.

## Flight monitoring checkpoint — 2026-09-02

The admin flight monitor now has a deployed ten-minute scheduler configuration and continues to display the latest valid stored snapshot when a provider refresh fails. The local scheduler regression and full 60-test suite pass, the live application health check reports a connected database, and the provider endpoint returns current data from the laptop. The remaining P1 release dependency is external: the deployed server cannot establish TCP connectivity to the provider on port 3000 and logs `UND_ERR_CONNECT_TIMEOUT`. The API owner must allow the actual FlySOS egress IP, expose an HTTPS endpoint, or schedule the existing authenticated push script every ten minutes. No P0/P1 code defect was introduced by this configuration repair, but fresh production flight data remains blocked until that dependency is corrected.

## Admin flight-monitor ordering follow-up — 2026-09-15

The dashboard ordering defect was isolated to the admin summary query using ascending scheduled times. The query now places the latest scheduled flight first while preserving the newest-fetch precedence and a deterministic tie-breaker. The focused regression passed 3/3 and the complete serialized suite passed 96/96. No live deployment was performed in this follow-up because an authenticated deployment target was not available; the existing external provider reachability blocker remains unchanged.
## Stage-two ticket-upload feedback follow-up — 2026-09-15

| ID | Severity | Root cause | Fix | Regression |
| --- | --- | --- | --- | --- |
| QA-016 | P2 | The mandatory ticket-file guard stopped the stage transition, but its error was rendered below the upload controls, so a mobile user could miss it after pressing «ادامه و تکمیل پرسشنامه». | Added a public-entrypoint helper scoped to stage two that hides the lower duplicate, renders one `role="alert"` immediately under the stage heading, and scrolls that alert to the viewport start after the continue click. | `tests/ticket-upload-required-error.test.cjs`; active asset syntax and full serialized regression suite. |

The mandatory ticket guard, optional boarding-pass behavior, and stage-three questionnaire validation remain unchanged. Live mobile interaction and live publication are NOT_RUN because no current authenticated deployment target or working browser automation session was available.

## Stage-four final receipt CMS follow-up — 2026-09-15

## Admin stale-bundle cache repair follow-up — 2026-09-15

| ID | Severity | Root cause | Fix | Regression |
| --- | --- | --- | --- | --- |
| QA-018 | P1 | The CDN copy of AdminPanel-CmsReadyAdminFix20260820.js under the previous immutable query key still imported index-CmsReadyAdminFix20260820.js?v=20260906-rights-cta-v1, while the entry HTML loaded the newer shared bundle. The duplicate React runtime caused error #321; removeChild was a secondary reconciliation failure. | Rotated the public/admin entry and both reciprocal imports to 20260915-admin-react-singleton-v1, uploaded the canonical four static files, and verified live content hashes and HTTP 200 delivery. | tests/admin-react-singleton-regression.test.cjs; both active bundles passed node --check; full 100-test suite passed; live stale-import scan returned false. |

No database, claim, authentication, or API data path was changed by this repair. The Chrome-extension CSP message remains outside the application bundle and is not the cause of the white screen.

| ID | Severity | Root cause | Fix | Regression |
| --- | --- | --- | --- | --- |
| QA-017 | P2 | Static text in the generated final receipt canvas was hardcoded inside the public bundle, so CMS administrators could not update the receipt wording. | Added a normalized editable `رسید نهایی` group to the `track-success` CMS block, applied it to admin/public CMS paths, and added a canvas-scoped bridge that leaves dynamic claim data unchanged. | `tests/claim-receipt-cms-regression.test.cjs`; 100-test serialized suite; 96-file syntax validation. |

The receipt change is scoped to the final 750×980 receipt canvas and does not alter the stage-four success screen, claim submission, stored claim values, or other canvases. Live CMS publication, visual browser verification, and production deployment remain NOT_RUN without a current authenticated deployment session.
