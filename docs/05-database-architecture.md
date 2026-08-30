# Database Architecture — Passenger Rights Document Delivery Fix

## Status

**STAGE_05_STATUS: PASS**

## Data model impact

- `AppSetting.powerOfAttorneyUrl` is the canonical power-of-attorney URL used by the current API.
- `AppSetting.rightsDocumentUrl` is the canonical stored passenger-rights URL.
- Existing `powerOfAttorneyDocumentUrl` and `passengerRightsUrl` columns, when present, are treated as legacy sources and backfilled only when the canonical value is `NULL`.
- `CmsMedia` stores the generated filename, normalized MIME type, size, URL, category, title, and uploader identity.

## Integrity and migration

- `backend/scripts/runLegalDocumentsMigration.js` is idempotent and adds the two canonical settings columns when absent.
- `backend/scripts/runEmployerRevisionMigration.js` now includes the missing canonical power-of-attorney column and legacy backfill.
- Backfill uses `COALESCE` so a deliberate empty value remains a deliberate clear on subsequent requests.
- Settings updates write both legal-document columns in both existing-row and first-row branches without overwriting unrelated settings.

## File lifecycle

- New CMS media is stored under `<UPLOAD_DIR>/cms`.
- Failed validation or database insertion removes the newly written file.
- CMS deletion resolves paths relative to the configured upload root and rejects traversal.
- Legacy root-level CMS media remains resolvable through a database allow-list.

## Validation

The migration was syntax-checked but not run against MySQL because no database server/credentials are available in this workspace. The exact migration command is documented for deployment.

## Handoff to Stage 06

API integration must use the canonical `passengerRightsUrl` response while keeping legacy response aliases for older browser bundles.
