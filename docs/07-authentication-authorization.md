# Authentication and Authorization — Passenger Rights Document Delivery Fix

## Status

**STAGE_07_STATUS: PASS**

No authentication mechanism or role model was changed. The existing admin router applies `requireAdminAuth`, the settings route remains supervisor-only, and CMS media upload/update/delete remains behind `requireCmsEditor`.

## Authorization matrix

| Operation | Required boundary |
| --- | --- |
| Read public legal-document metadata | Anonymous public route; only document URLs are returned. |
| Download public CMS passenger-rights document | Anonymous public CMS path; only CMS storage is exposed. |
| Upload or replace downloadable legal documents | Authenticated CMS editor; the existing supervisor/settings authorization boundary remains required. |
| Change general settings | Authenticated supervisor. |
| Download claim files | Existing authenticated admin path with claim access checks; not routed through public static serving. |
| Edit claim priority | Existing authenticated claim-editor boundary with claim access checks; the server validates and persists the value, and the browser's select visibility is not treated as authorization. |
| Delete a claim | Authenticated supervisor only; server-side route and controller checks are both enforced. |

## Security verification

The public upload path no longer exposes the shared claim upload directory. Existing claim-file download authorization remains in `adminController.js` and was not replaced by a public route.

Claim deletion is intentionally stricter than ordinary claim editing. `passenger_admin` and expert roles cannot invoke it; the route requires `supervisor`, and the controller repeats the exact role check before opening a database transaction. The operation does not delete the shared customer row or cross-feature notification, SMS, and support history.

## Handoff to Stage 08

Review public file delivery, metadata/content validation, path traversal, legacy compatibility, and dependency state without weakening the existing admin boundaries.
Legal-document replacement does not create a public upload path. The public contract exposes only the configured document URLs; the multipart endpoint remains behind administrator authentication and CMS-editor authorization, and server-side slot allow-listing prevents a caller from selecting an arbitrary settings column.
