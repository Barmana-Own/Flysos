# Frontend Architecture — Passenger Rights Document Delivery Fix

## Status

**STAGE_03_STATUS: PASS**

The repository ships the frontend as committed browser assets rather than source/build tooling. The existing active bundle pair was retained and verified; the repair is implemented at the backend contract and storage boundary.

## Runtime and route map

- Public entry: `index.html` → `assets/index-CmsReadyAdminFix20260820.js`.
- Admin entry: `admin/v2/login/index.html` → the same shared entry, which lazy-loads `assets/AdminPanel-CmsReadyAdminFix20260820.js`.
- Public passenger-rights route: existing rights page in the shared bundle.
- Admin settings route: existing General Settings downloadable-documents section in the lazy admin bundle.

## Data boundary

- Shared browser API base is `/api`.
- The admin bundle uploads CMS media and then patches settings with `passengerRightsUrl`.
- The public bundle reads `/legal-documents` and consumes `passengerRightsUrl`.
- Relative `/uploads/...` values are normalized by the existing browser helper to `/api/uploads/...`.
- No production path was changed to use fixtures or hard-coded document data.

## States and accessibility

The existing UI includes upload validation, loading feedback, persisted-link display, and the public empty/download states. The claim-registration questionnaire now renders incomplete-answer feedback inline above the active question list with an accessible alert role; the native browser alert is reserved for unrelated failure paths. The browser remains a convenience layer; the backend validates, authorizes, and persists independently.

## Verification

- Both HTML entry points reference the existing shared bundle.
- The shared bundle references the existing lazy admin bundle.
- The active bundles contain the passenger-rights upload title, settings field, public read, and `/api/uploads` normalization.
- The focused questionnaire regression suite and existing claim-flow structural test pass; the shared bundle passes `node --check`.

## Handoff to Stage 04

The backend must accept `passengerRightsUrl`, return it from admin/public settings, preserve legacy names, and serve the returned URL. The existing frontend contract does not require a generated asset change.

## Admin runtime module-graph checkpoint — 2026-09-02

The admin white screen was traced to two cache keys for the same physical main bundle. The public/admin HTML entries and the reciprocal lazy/static imports now use one exact cache-busted URL for the shared React entry and one exact URL for the canonical admin bundle. This prevents a second React runtime from being instantiated and removes the React hook-context failure that preceded the DOM reconciliation error. The focused static regression is `tests/admin-react-singleton-regression.test.cjs`; the live unauthenticated admin route rendered the login form after deployment.

## Registration SMS template checkpoint — 2026-09-02

The active admin settings bundle now includes an editable `پیام ثبت پرونده` textarea with the existing default registration message and `{trackingCode}` placeholder. The settings save path already sends the complete `smsTemplates` object through the existing protected settings API, so the new field is preserved alongside the existing status, replacement-ticket, and bank-detail templates. The public/admin entrypoints and reciprocal imports use the cache key `20260902-registration-sms-template-v1`; no frontend source/build project exists in the repository, so the committed browser assets were updated directly and syntax-checked.

## Flight monitoring checkpoint — 2026-09-02

The existing admin dashboard monitoring surface remains the consumer of the backend flight-cache summary. Its “latest valid stored data” state is preserved when the provider is unavailable; the server-side scheduler now reports the effective ten-minute interval through the protected diagnostic contract. No frontend bundle change was required for this repair. Once provider reachability is corrected, the existing monitor can show a newer stored `fetchedAt` without a UI or database migration.

## Admin flight-monitor ordering checkpoint — 2026-09-15

The dashboard continues to load its monitoring data through authenticated `GET /api/admin/dashboard` on initial dashboard entry and the existing one-minute UI refresh. The server-side provider pull remains a `GET` scheduled every ten minutes. The follow-up correction is intentionally backend-only: the summary response now orders rows from the newest valid snapshot by `scheduledTime DESC` and `flightNumber DESC`, so the latest scheduled flight is shown first. No public route, unrelated dashboard card, or browser bundle was changed.
## Stage-two ticket-upload validation checkpoint — 2026-09-15

The stage-two continue action already blocks navigation when the mandatory ticket file is missing, but its existing error paragraph was rendered below the upload controls. The scoped public script `assets/ticket-upload-error-position-20260915.js` now keeps that original React node hidden, exposes one accessible alert immediately below the stage heading, and scrolls it into view after the continue click. The script is loaded only by `index.html`, is limited to the stage-two heading/error text, and removes the temporary top alert after the error clears. The boarding-pass upload remains optional and stage-three validation is unchanged.

## Stage-four final receipt CMS checkpoint — 2026-09-15

The generated 750×980 final receipt image remains produced by the existing claim-flow canvas. The scoped `assets/claim-receipt-cms-content-20260915.js` helper loads the published `track-success` CMS block from `GET /api/pages/track` and replaces only the receipt canvas's static labels/text; tracking code, passenger data, filenames, and timestamps remain dynamic claim values. The helper is loaded before the existing public bundle, keeps hardcoded defaults when CMS is unavailable, and does not change the success-page layout or unrelated canvases. The generic admin CMS editor already supports nested object fields, so the new `رسید نهایی` group is editable in the existing track page without an admin bundle rewrite.

## Admin stale-bundle cache repair — 2026-09-15

The live white-screen report was traced to the CDN serving the old immutable AdminPanel asset under the 20260914 query key. That stale file imported the shared main bundle with `20260906-rights-cta-v1`, while the current HTML loaded `20260914-team-performance-v1`; React therefore instantiated two runtimes and raised error #321 before the secondary `removeChild` reconciliation error. The public/admin entry HTML and both reciprocal bundle imports now use `20260915-admin-react-singleton-v1`. The four static files were re-uploaded, live bundle contents match the local files, and the focused regression rejects the stale import.

## Inline responsible-expert assignment — 2026-09-16

The claims table keeps its existing row navigation and now renders a compact, accessible `select` in the `کارشناس مسئول` cell for supervisor accounts. The list is loaded through the existing authenticated `GET /api/admin/experts` path when the claims screen opens; active experts are offered, and an already assigned inactive account remains visible so the current value is not lost. Selecting an option stops row navigation and calls the existing authenticated `PATCH /api/admin/claims/:id` mutation with `assignedAdminId`; the empty option sends `null` to clear the assignment. Non-supervisor viewers retain the read-only expert label. The new cache key is `20260916-claim-assignment-selector-v1` so the immutable browser asset cannot mask the update.
