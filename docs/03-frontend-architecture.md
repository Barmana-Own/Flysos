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

The existing UI includes upload validation, loading feedback, persisted-link display, and the public empty/download states. The browser remains a convenience layer; the backend validates, authorizes, and persists independently.

## Verification

- Both HTML entry points reference the existing shared bundle.
- The shared bundle references the existing lazy admin bundle.
- The active bundles contain the passenger-rights upload title, settings field, public read, and `/api/uploads` normalization.
- The focused regression suite and existing claim-flow structural test pass.

## Handoff to Stage 04

The backend must accept `passengerRightsUrl`, return it from admin/public settings, preserve legacy names, and serve the returned URL. The existing frontend contract does not require a generated asset change.
