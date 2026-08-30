# Authentication and Authorization — Passenger Rights Document Delivery Fix

## Status

**STAGE_07_STATUS: PASS**

No authentication mechanism or role model was changed. The existing admin router applies `requireAdminAuth`, the settings route remains supervisor-only, and CMS media upload/update/delete remains behind `requireCmsEditor`.

## Authorization matrix

| Operation | Required boundary |
| --- | --- |
| Read public legal-document metadata | Anonymous public route; only document URLs are returned. |
| Download public CMS passenger-rights document | Anonymous public CMS path; only CMS storage is exposed. |
| Upload CMS media | Authenticated CMS editor. |
| Change general settings | Authenticated supervisor. |
| Download claim files | Existing authenticated admin path with claim access checks; not routed through public static serving. |

## Security verification

The public upload path no longer exposes the shared claim upload directory. Existing claim-file download authorization remains in `adminController.js` and was not replaced by a public route.

## Handoff to Stage 08

Review public file delivery, metadata/content validation, path traversal, legacy compatibility, and dependency state without weakening the existing admin boundaries.
