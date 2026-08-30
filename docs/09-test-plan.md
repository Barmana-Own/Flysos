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

## Test levels

- Unit-style: URL mapping and file metadata/signature helpers.
- Boundary: real Express/Multer multipart upload into a disposable temporary directory.
- Structural contract: settings SQL/API, route wiring, active HTML/bundle references, and migration assertions.
- Flight API boundary: public import route, secret/configuration errors, payload validation, async acknowledgement, body size, and admin status authorization.
- Existing regression: claim final-step structure.
- Database/API end-to-end: required for deployment, but unavailable in this workspace.
