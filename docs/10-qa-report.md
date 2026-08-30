# QA Report — Passenger Rights Document Delivery Fix

## Status

**STAGE_10_STATUS: PASS**

## Tested journeys

- Supervisor upload contract: verified through the active bundle, settings schema, CMS route, and real Multer multipart boundary.
- Persisted setting contract: verified through canonical/legacy mapping and all SQL update/insert branches.
- Public delivery contract: verified through public response mapping, API upload-path normalization, and scoped serving configuration.
- Existing claim workflow: existing claim-final-step structural regression passes and no claim route was removed.
- Flight feed refresh: the public import endpoint is mounted, rejects unauthorized/malformed requests safely, acknowledges valid pushes asynchronously, and keeps the admin diagnostic endpoint protected. Database-backed persistence remains an environment-owned check.

## Defect log

| ID | Severity | Root cause | Fix | Regression |
| --- | --- | --- | --- | --- |
| QA-001 | P1 | `passengerRightsUrl` was stripped by the settings schema and absent from persistence/public response. | Added schema, normalized mapping, SQL write branches, migration/backfill, and public response. | Legal-document regression suite. |
| QA-002 | P1 | Valid PDFs with fallback MIME values were rejected by shared Multer filtering. | Added extension-aware fallback handling and server-side PDF signature verification. | Middleware and signature tests. |
| QA-003 | P1 | Browser-resolved `/api/uploads/...` had no matching server path, while broad historical serving exposed private uploads. | Added CMS-scoped static paths and allow-listed legacy CMS delivery. | Serving isolation and route contract tests. |
| QA-004 | P1 | The flight HTTPS push path was partially committed: the public route was absent and the controller referenced missing service exports, so the cache could not be refreshed through the documented path. | Mounted the route, wired the import secret, implemented push feed/count persistence and status reporting, and reused the existing cache/advisory-lock path. | `tests/flight-api-regression.test.cjs`; MySQL persistence NOT_RUN. |
| QA-005 | P2 | The global 1 MB JSON parser could reject a legitimate three-feed push before authentication. | Added a bounded 5 MB parser only for the flight import path and a safe 413 error envelope. | Route-scoped body-size regression. |

All identified P0/P1 defects in the local repository scope are fixed. The live flight cache will not refresh until deployment and provider-side scheduling are completed. No browser/device exploratory run or database-backed push persistence run was performed because a configured environment is unavailable; those limitations are recorded rather than treated as a pass.

## Accessibility/responsive review

The active bundle retains the existing Persian RTL settings and public page UI, including loading/empty/download states. No frontend source or visual asset was rewritten. Full browser viewport and assistive-technology validation remains an environment-level NOT_RUN check.

## Release blockers

None identified in the local repository. Live migration, backend deployment, shared-secret provisioning, and provider-side cron activation remain operational prerequisites for production flight freshness.
