# Test Plan — Passenger Rights Document Delivery Fix

**STAGE_09_STATUS: PASS**

## Risk-based coverage

| Requirement/risk | Test coverage |
| --- | --- |
| FR-001 / generic browser PDF MIME | Runtime settings schema test and real Multer middleware multipart test. |
| FR-002 / invalid file boundary | Pure metadata/signature tests; CMS controller signature guard reviewed. Live database-backed controller test is NOT_RUN. |
| FR-003 / persistence without collateral updates | Controller SQL contract assertions and legal URL mapping tests. MySQL integration is NOT_RUN. |
| FR-004 / reload and legacy names | Canonical/legacy normalization and migration contract tests. |
| FR-005 / public response and page consumer | Public controller contract assertion and active bundle contract test. |
| FR-006 / new and legacy file paths | Scoped static/legacy route contract assertions and isolated CMS storage test. |
| FR-007 / claim-file privacy | No broad public static mount assertion and legacy allow-list review. |
| NFR-002 / migration safety | Idempotent migration source assertions and syntax check. |
| NFR-004 / bounded uploads | Middleware configuration review; existing shared limits retained. |
| NFR-005 / regression | `tests/legal-documents-regression.test.cjs` plus existing claim-flow test. |
| Flight API route/module link | Isolated child-process route probe imports `publicRoutes`, exercises `POST /flights/import`, and proves the previous 404/import-time failure is covered. |
| Flight import authentication and payload bounds | Missing/weak secret, invalid key, malformed feed, valid `202` acknowledgement, and route-scoped body-limit tests in `tests/flight-api-regression.test.cjs`. |
| Admin push diagnostics authorization | Isolated admin router probe verifies `/flight-cache/push-status` returns `AUTH_REQUIRED` without an administrator token. |
| Questionnaire completeness | `tests/questionnaire-required-answers.test.cjs` verifies visible-question completeness, conditional-question activation, null rejection, duplicate/unknown ID rejection, admin section mapping, and active bundle safeguards. |
| SMS delivery boundary | `tests/sms-service-regression.test.cjs` verifies Persian/Arabic-Indic phone normalization, invalid-sender rejection before network access, provider status-12 mapping, and the documented provider payload. |
| Goftino widget settings contract | `tests/widget-settings-regression.test.cjs` verifies public response mapping and acceptance of a widget-id settings update; persistence uses a read-only column-presence check and has no migration path in the deployment. |
| FR-008 / destructive claim deletion | `tests/delete-claim-regression.test.cjs` verifies route wiring behind admin authentication, supervisor-only denial for `passenger_admin`, transactional child cleanup, preservation of shared/history rows, parameterized claim deletion, and upload-root path containment. An authenticated database-backed deletion is intentionally NOT_RUN to protect production data. |
| FR-009 / legal-document replacement transaction | `tests/legal-document-replacement-regression.test.cjs` verifies the two supported slots, controller transaction/update wiring, and the response contract. MySQL-backed upload execution is NOT_RUN to avoid mutating production data. |
| FR-010 / old physical file cleanup | The same suite verifies post-commit cleanup wiring, upload-root containment, traversal/external URL rejection, non-symlink file handling, and preservation of the old metadata row. |
| FR-011 / claim priority update | `tests/claim-priority-regression.test.cjs` verifies supported-value preservation, unsupported-value rejection, controller SQL wiring, and compatibility with the existing mapper fallback. |
| FR-013 / upload request availability | `tests/claim-upload-lifecycle-regression.test.cjs` verifies that ticket OCR is scheduled after the upload response and that stale replacement jobs cannot overwrite a newer file. |
| FR-014 / submit response availability | `tests/claim-registration-connection-regression.test.cjs` verifies that the submit controller returns committed state without a second post-commit read or synchronous notification dependency. |
| NFR-011 / transaction connection lifecycle | `tests/db-connection-regression.test.cjs` verifies cleanup for failed begin/rollback paths, broken-connection disposal, original-error preservation, and successful release. |
| NFR-012 / notification isolation | `tests/claim-registration-connection-regression.test.cjs` verifies post-commit notification scheduling and swallowed provider failures without an HTTP-path rejection. |
| NFR-014 / admin runtime module identity | `tests/admin-react-singleton-regression.test.cjs` verifies that public/admin HTML and reciprocal bundle imports use one exact cache-key-stable React module graph; live unauthenticated admin rendering is smoke-tested without database mutation. |
| FR-015 / registration SMS template editing | `tests/registration-sms-template-regression.test.cjs` verifies the registration default, server-side tracking-code rendering, settings schema contract, notification-template key, and the active admin textarea/field. |
| NFR-013 / registration template preservation | The same suite verifies that the existing protected settings contract is reused and that all active entrypoints share the new cache key; no migration or production data mutation is used. |
| FR-016 / scheduled flight refresh and last-valid-data display | `tests/flight-cache-scheduler-regression.test.cjs` verifies the ten-minute default, enabled/disabled behavior, and minimum interval bound; live read-only checks verify the deployed scheduler configuration, cache response, provider reachability split, and preservation of the last valid snapshot. |
| FR-017 / team-performance report visibility and accuracy | `tests/team-performance-report-regression.test.cjs` verifies claim-team role filtering, inclusion of the three staff roles shown by Expert Management, zero-count rows, assigned/closed counts, status-history timing, legacy timestamp fallback, supervisor route wiring, and active-bundle loading/rendering. |
| FR-018 / admin latest-flight ordering and refresh contract | `tests/admin-flight-monitor-regression.test.cjs` verifies latest-scheduled-first SQL ordering, the authenticated dashboard `GET` refresh path, and preservation of the ten-minute provider `GET` scheduler. |

## Test levels

- Team performance: pure aggregation tests plus static controller/route/active-bundle contract checks; live authenticated report retrieval is NOT_RUN without a production admin session and database mutation is not required.

- Unit-style: URL mapping and file metadata/signature helpers.
- Boundary: real Express/Multer multipart upload into a disposable temporary directory.
- Structural contract: settings SQL/API, route wiring, active HTML/bundle references, and migration assertions.
- Flight API boundary: public import route, secret/configuration errors, payload validation, async acknowledgement, body size, and admin status authorization.
- Existing regression: claim final-step structure.
- Questionnaire policy and admin mapping: pure service tests plus active public/admin bundle contract checks.
- Legal-document replacement: allow-listed slot resolution plus safe post-commit physical-file cleanup checks.
- Claim priority: schema boundary and controller transaction wiring; live authenticated mutation is intentionally not used as a test fixture.
- Claim registration availability: database transaction lifecycle, post-response OCR, committed-state submit response, and post-commit notification scheduling; live mutation is intentionally not used as a test fixture.
- Database/API end-to-end: required for deployment, but unavailable in this workspace.
- Admin runtime smoke: fresh unauthenticated route render plus console filtering for the reported React hook-context and DOM reconciliation failures.
- Flight scheduler/availability: pure configuration regression plus live health/cache/log checks; provider-side TCP reachability remains an external dependency and no database mutation is used as a fixture.
- Admin flight monitor: static query/order and refresh-contract regression; live deployment of the ordering follow-up is NOT_PERFORMED without a current authenticated deployment target.
| FR-019 / stage-two mandatory ticket-upload feedback | `tests/ticket-upload-required-error.test.cjs` verifies the active public entrypoint loads the scoped stage-two helper, the mandatory-file guard still blocks advancement, the error is exposed as a top accessible alert, and the alert scrolls to the viewport start. |

## Additional test level

- Stage-two ticket upload: active HTML/bundle/script structural regression; live browser/device validation is NOT_RUN because no authenticated deployment target or browser automation session is available.

## Stage-four final receipt CMS coverage

- `tests/claim-receipt-cms-regression.test.cjs` verifies default receipt content, preservation of editor changes, page-scope isolation, controller/seed wiring, public helper loading, and the 750×980 canvas boundary.
- The generic nested CMS editor is treated as the existing UI boundary; no production admin bundle change is required because it already renders editable nested string objects.
- Live authenticated CMS publication and browser receipt download are NOT_RUN until a current deployment session is available.
