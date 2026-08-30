# Backend Architecture — Passenger Rights Document Delivery Fix

## Status

**STAGE_04_STATUS: PASS**

The existing modular Express backend remains the source of truth. Transport routes call controllers, controllers use validation/application helpers, and persistence continues through the parameterized MySQL query layer.

## Affected modules

| Module | Responsibility |
| --- | --- |
| `validation/platformSchemas.js` | Validate settings payloads, including canonical and legacy legal-document fields. |
| `controllers/platformController.js` | Read, normalize, backfill, and persist settings; expose public legal documents. |
| `utils/legalDocument.js` | Keep database/API field naming compatible and deterministic. |
| `middleware/upload.js` | Bound upload size/count, normalize file names, and select safe upload destinations. |
| `utils/fileValidation.js` | Validate extension/MIME combinations and PDF signatures. |
| `controllers/cmsController.js` | Persist CMS media, clean failed uploads, delete safely, and serve legacy CMS files. |
| `routes/adminRoutes.js` and `app.js` | Enforce CMS upload middleware and scoped public file paths. |

## Error and configuration model

Existing `AppError`/`asyncHandler` handling is preserved. Upload failures return safe typed errors; internal paths and database details are not sent in production. Upload directories remain configuration-driven through `UPLOAD_DIR`.

## Handoff to Stage 05

Persistence requires `AppSetting.powerOfAttorneyUrl` and `AppSetting.rightsDocumentUrl`, with compatibility reads/backfills for `powerOfAttorneyDocumentUrl` and `passengerRightsUrl`. CMS media remains the existing database-backed record with files in the configured upload root.
