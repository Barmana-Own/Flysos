# Flysos Technical Deployment Report

| Item | Value |
|---|---|
| Project | Flysos |
| Report type | Technical deployment report |
| Language | English |
| Jalali date | 1405/06/24 |
| Gregorian date | 2026-09-15 |
| Status | NOT_PERFORMED; blocked by browser-session tooling |

## Scope and File Selection

After reviewing `git status`, `project-state.json`, and `release-manifest.json`, the runtime files related to the five fixes were identified as `index.html`, `admin/v2/login/index.html`, the active public/admin bundles, the three questionnaire helpers, the receipt helper, `backend/controllers/cmsController.js`, `backend/services/claimReceiptContentService.js`, `backend/services/flightCacheService.js`, `backend/services/teamPerformanceService.js`, `backend/controllers/platformController.js`, `backend/routes/adminRoutes.js`, and the flight-edit contract files (`adminController.js`, `adminSchemas.js`, and `claimMapper.js`).

`backend/services/cmsSeedService.js` was excluded from this deployment because startup invokes its database seed/repair paths, which conflicts with the requirement to perform no migration or real-data mutation. No `.env`, `node_modules`, `uploads`, or database data was targeted.

## Local Validation

| Check | Status |
|---|---|
| Focused tests for the five fixes | PASS; 25 tests |
| Complete local suite | PASS; 100 tests, zero failures |
| `node --check` for selected files | PASS |
| Frontend build | NOT_RUN; the repository contains committed browser assets without a frontend build project |
| Typecheck/lint | NOT_RUN; no corresponding build scripts/project were available in the workspace |
| Migration/database | NOT_PERFORMED; required by the user |
| Security mutation/exploitation | NOT_PERFORMED |

## Pre-Deployment Live Checks

- `https://flysos.ir/`: HTTP 200.
- `https://flysos.ir/api/health`: HTTP 200.
- `index.html`: HTTP 200, but the current version lacks the ticket and receipt markers.
- New helpers: the requests returned an apparent HTTP 200, but the ticket and receipt asset responses were the site's HTML fallback rather than the local helper contents.
- `GET /api/pages/track`: HTTP 200 without the `رسید نهایی` section.
- Remote file hashes/content did not match the local release files.

## Deployment Status

Both available browser-control paths—the session-control runtime and the browser helper—failed to initialize with `helper_unknown_error: apply deny-read ACLs`. The cPanel session was not accessed, and no password or cookie was requested or extracted. Consequently, destination backup, upload, overwrite, Passenger restart, and post-deployment live verification were not performed; no deployment success is claimed.

## Risk and Required Follow-up

The live version remains the previous release until control of the existing cPanel session is available. After the tooling issue is resolved, back up each destination file, upload only the selected files, restart only the registered app through Setup Node.js App, and repeat the HTML/helper hash, CMS track, and health checks.
