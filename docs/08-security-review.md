# Application Security Review — Passenger Rights Document Delivery Fix

**STAGE_08_STATUS: PASS**

## Scope and authorization

The review covers the changed settings, CMS upload, file-serving, migration, flight import, SMS integration, configuration, and dependency boundaries inside this repository. The authorized cPanel update changed only backend/static files; no database command or destructive operation was executed. Previously collected read-only availability evidence is not treated as database or SMS delivery validation.

## Threat model summary

Protected assets are claim files, administrator credentials, settings, and CMS media. The relevant trust boundaries are multipart upload input, administrator API requests, database-stored filenames/URLs, and anonymous public file requests.

## Findings and remediation

| ID | Severity | Finding | Remediation | Status |
| --- | --- | --- | --- | --- |
| SEC-001 | High | The historical broad `/uploads` static mount made shared claim files reachable anonymously. | Removed the broad mount; new CMS files use `/uploads/cms`, while legacy root media requires a matching `CmsMedia` record and safe filename. | FIXED |
| SEC-002 | High | The public settings response omitted the passenger-rights URL, creating a broken/misconfigured public document path. | Added canonical/compatibility mapping and public response coverage. | FIXED |
| SEC-003 | Medium | Valid browser PDF uploads with generic/empty MIME values were rejected before the controller. | Allow fallback MIME values only for `.pdf`, then require the `%PDF-` signature before CMS persistence. | FIXED |
| SEC-004 | Low | The lockfile contained an advisory for an outdated transitive `body-parser`. | Updated the lockfile to the patched version and verified the production audit. | FIXED |
| SEC-005 | Medium | Existing local configuration documentation contained credential-like example values. | Replaced them with explicit placeholders and added a safe `backend/.env.example`. | FIXED |
| SEC-006 | High | The intended HTTPS flight push controller was not mounted and imported service exports that did not exist, leaving the deployed import path at HTTP 404 and the cache stale. | Wired the route, restored service exports/persistence, added isolated route/module-link regression coverage, and deployed the scheduler/import service. | CODE AND DEPLOYMENT FIXED; PROVIDER REACHABILITY BLOCKED |
| SEC-007 | Medium | The global 1 MB JSON parser could reject a legitimate three-feed push before authentication. | Added a bounded 5 MB parser only for `/api/flights/import`; unrelated JSON APIs remain capped at 1 MB and oversized bodies return a safe 413 envelope. | FIXED |
| SEC-008 | High | The live document root exposed backend source files and runtime logs under `/backend/`, increasing source and operational-data disclosure risk. | Deployed a root rewrite deny rule for `/backend/` while preserving `/api` availability; verified public source and log requests return HTTP 403. | FIXED ON SERVER |
| SEC-009 | High | SMS provider responses recorded status `17` (sender/agent invalid or inactive) and status `12` (organization send window not allowed). The server had an SMS configuration file, but provider-side sender and schedule/permission state were not valid for sending. | Added sender normalization/validation, Persian and Arabic-Indic phone normalization, actionable provider-code mapping, SMS history preservation, and a safe regression suite. Provider account/sender/schedule correction remains required. | CODE FIXED; PROVIDER ACTION REQUIRED |
| SEC-010 | Low | The Goftino widget identifier was absent from the settings response, and a client-provided value could otherwise be silently discarded by schema/storage mismatches. | Added bounded schema validation, server-managed environment fallback, an explicit read-only existing-column check, and public-contract coverage. The identifier is intentionally public widget configuration, not a secret; the SMS token remains server-only. | FIXED |
| SEC-011 | High | The admin UI called `DELETE /api/admin/claims/:id`, but the backend had no matching route, so deletion failed with `404`; adding the endpoint also required protection against unauthorized destructive access and collateral data/file deletion. | Added a supervisor-only route and controller guard, identifier validation, row locking, transactional child cleanup, preservation of shared customer and cross-feature history rows, and upload-root path containment for post-commit file cleanup. | FIXED |
| SEC-012 | Medium | Replacing a downloadable legal document uploaded a new CMS file but had no server-side transaction tying the selected slot to the new media and no safe cleanup of the previous physical file. | Added an allow-listed two-slot replacement path, row-locked media/settings transaction, explicit invalid-slot rejection, post-commit cleanup, raw traversal checks, external-URL rejection, upload-root containment, regular-file verification, symlink refusal, and cross-slot reference protection. Previous database metadata is retained. | FIXED |
| SEC-013 | Medium | The admin claim summary submitted `priority`, but the update schema stripped the field and the controller never added it to the SQL update list, so the UI showed a success path without changing `Claim.priority`. | Added closed-set server validation and a parameterized update branch inside the existing transaction; no schema or data migration was introduced. | FIXED |
| SEC-014 | High | Ticket OCR ran synchronously inside the multipart request, allowing a slow image/PDF or OCR worker failure to exceed the reverse-proxy timeout and surface as a generic request failure. The transaction helper also leaked a pool connection when `beginTransaction` failed and could mask the original error when rollback failed. | Queued OCR after the upload response, kept extracted-data persistence in a short guarded transaction, added stale-job protection, bounded pool/keep-alive settings, and made transaction cleanup preserve original errors while destroying known-broken connections. No blanket write retry was added. | FIXED |

## Defensive controls verified

- Generated server-side filenames and normalized original names.
- Bounded upload size/count retained at 15 MB/4 files.
- CMS upload storage is separate from private claim-file storage.
- Stored-file resolution rejects paths outside `UPLOAD_DIR`.
- Legacy public serving is database allow-listed and restricted to generated-style single-segment names.
- SQL values remain parameterized; dynamic migration identifiers are fixed code values.
- Admin upload/settings boundaries retain existing authentication and role checks.
- The flight import secret is read only from environment configuration, compared with a length-safe constant-time check, and never returned or logged.
- Flight import feed names are allow-listed, provider counts are bounded non-negative integers, and normalized feed records are capped before persistence.
- The Goftino identifier is exposed only as intentional public widget configuration; the SMS token is stored in the server-managed environment file and is not present in source, examples, logs, or release artifacts.
- The Goftino persistence compatibility path performs only a read-only metadata check and does not create, alter, or remove database structures.
- Claim deletion is restricted to supervisors, uses parameterized SQL in a transaction, detaches nullable historical links instead of deleting shared history, and never removes the shared customer record.
- Claim-file cleanup resolves and verifies paths relative to `UPLOAD_DIR`, skips unsafe paths, and runs only after a successful database commit.
- Legal-document replacement uses fixed setting-column allow-lists, locks the settings row, cleans only after commit, rejects traversal/external URLs, refuses symlinks, and never deletes the previous database metadata row.
- Claim priority uses a closed enum, existing claim-editor authorization, parameterized SQL, and the existing transaction; unsupported values are rejected before persistence.
- Database repair configuration is bounded and secret-free; error logs emit only safe connection/error codes and no SQL, parameters, credentials, or file contents.
- No real secret was added to source, examples, or release artifacts.

## Validation

- `npm audit --omit=dev --audit-level=high`: PASS at the high-severity release threshold; 0 high, 0 critical, and 5 moderate advisories were reported.
- Backend JavaScript syntax check: PASS.
- Focused flight security/contract tests: PASS (`node --test tests/flight-api-regression.test.cjs`, 8 tests).
- SMS regression tests: PASS (`node --test tests/sms-service-regression.test.cjs`, 4 tests).
- Goftino settings regression tests: PASS (`node --test tests/widget-settings-regression.test.cjs`, 4 tests).
- Claim deletion regression tests: PASS (`node --test tests/delete-claim-regression.test.cjs`, 3 tests), including authentication, non-supervisor denial, route wiring, transactional cleanup, history preservation, and file-path containment assertions.
- Legal-document replacement regression tests: PASS (`node --test tests/legal-document-replacement-regression.test.cjs`, 3 tests), including supported-slot resolution, traversal/external-path rejection, post-commit cleanup wiring, and invalid-slot rejection.
- Claim-priority regression tests: PASS (`node --test tests/claim-priority-regression.test.cjs`, 3 tests), including closed-set validation, unsupported-value rejection, and parameterized controller/mapper wiring.
- Claim registration connection/OCR/notification regression tests: PASS (`node --test --test-concurrency=1 tests/db-connection-regression.test.cjs tests/claim-upload-lifecycle-regression.test.cjs tests/claim-registration-connection-regression.test.cjs`, 6 tests), including connection release/destroy behavior, original-error preservation, post-response OCR/notification scheduling, short transactional persistence, stale-job safety, and isolated persistence failures.
- Full regression suite after the repair: PASS (`node --test --test-concurrency=1 tests/*.test.cjs`, 52 tests).
- Live post-restart health: PASS; 12 bounded `GET /api/health` checks returned HTTP 200 with `database: connected`.
- Live database migration: NOT_RUN because no database command was authorized or required for this repair.
- Safe cPanel deployment: PASS for the claim deletion backend route/controller and restart marker; live unauthenticated delete probe returned `401`, `/api/health` returned `200`, and no claim deletion or database command was executed. SMS delivery remains blocked by provider status 17/12/35.

The safe SMS backend and public `/backend/` deny rule were deployed through cPanel without running any database command or changing database contents. A real recipient SMS was not sent during validation.

No open Critical or High finding introduced by the local implementation remains. The production deployment dependency is operational rather than an unresolved code finding.

The admin white-screen fix did not broaden any trust boundary or expose a new endpoint. It only aligned cache-busted module URLs so the public and admin bundles resolve one React runtime; remote file hashes matched the validated local assets and no database command was executed.

## Residual risk

The existing provider API contract sends provider credentials as query parameters from the direct-pull path and the provider-side push script. This was not changed because it is part of the external provider contract; production proxy/access logs must be protected and must not be exposed to untrusted operators. SMS delivery remains dependent on the provider approving the configured sender/agent, send window, and server IP policy.

## Flight scheduler availability review — 2026-09-02

The scheduler configuration is environment-only, bounded to one minute through 24 hours, and the effective ten-minute interval is exposed only as non-sensitive diagnostic metadata. Provider credentials remain backend-only; the cache route and import route do not return them. Read-only production evidence shows the provider works from the laptop but the server's outbound request fails with `UND_ERR_CONNECT_TIMEOUT` on port `3000`. This is an availability/reachability blocker, not an authorization or data-exposure finding. No TLS verification was disabled, no permissive proxy was introduced, and no database data was removed. The provider owner must fix the allow-list/HTTPS exposure or use the authenticated HTTPS push fallback.

## Multipart dependency hardening checkpoint — 2026-09-15

The production dependency audit identified a high-severity advisory affecting the locked `multer@2.2.0` release. The direct dependency and lockfile were updated to `multer@2.4.0`, the production dependency tree was reinstalled with `npm ci --omit=dev --ignore-scripts`, and the high-threshold audit now reports zero high and zero critical findings. Four moderate advisories remain in transitive/other direct dependencies and are not part of this dashboard correction; no new Critical or High finding remains in the validated dependency set.
