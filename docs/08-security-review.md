# Application Security Review — Passenger Rights Document Delivery Fix

**STAGE_08_STATUS: PASS**

## Scope and authorization

The review covers the changed settings, CMS upload, file-serving, migration, flight import, configuration, and dependency boundaries inside this repository. No external or production system was modified or subjected to write/destructive testing; previously collected read-only availability evidence is not treated as deployment validation.

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
| SEC-006 | High | The intended HTTPS flight push controller was not mounted and imported service exports that did not exist, leaving the deployed import path at HTTP 404 and the cache stale. | Wired the route, restored service exports/persistence, and added isolated route/module-link regression coverage. | FIXED LOCALLY; DEPLOYMENT PENDING |
| SEC-007 | Medium | The global 1 MB JSON parser could reject a legitimate three-feed push before authentication. | Added a bounded 5 MB parser only for `/api/flights/import`; unrelated JSON APIs remain capped at 1 MB and oversized bodies return a safe 413 envelope. | FIXED |

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
- No real secret was added to source, examples, or release artifacts.

## Validation

- `npm audit --omit=dev`: PASS, zero vulnerabilities after the lockfile update.
- Backend JavaScript syntax check: PASS.
- Focused flight security/contract tests: PASS (`node --test tests/flight-api-regression.test.cjs`, 8 tests).
- Live database migration and external deployment: NOT_RUN / NOT_PERFORMED because no database server, credentials, or authorized deployment target is available.

No open Critical or High finding introduced by the local implementation remains. The production deployment dependency is operational rather than an unresolved code finding.

## Residual risk

The existing provider API contract sends provider credentials as query parameters from the direct-pull path and the provider-side push script. This was not changed because it is part of the external provider contract; production proxy/access logs must be protected and must not be exposed to untrusted operators.
