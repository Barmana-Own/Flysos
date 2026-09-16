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

## Replacement transaction

- A recognized legal-document upload locks the existing default `AppSetting` row with `FOR UPDATE`.
- The new `CmsMedia` row and the matching canonical/legacy setting URL are committed together; a database failure rolls both back.
- Physical cleanup of the previous file runs only after commit, and only after managed-path, regular-file, and cross-reference checks.
- The previous `CmsMedia` metadata row is not deleted. This preserves database history and complies with the no-database-deletion constraint while the obsolete physical file is removed.

## Claim priority persistence

The `Claim.priority` column already exists and is returned by the admin claim mapper. The repair reuses that column through the existing claim-update transaction and does not add a migration, alter a constraint, delete rows, or modify unrelated claim data. The application validates the four supported priority values before the parameterized update.

## File lifecycle

- New CMS media is stored under `<UPLOAD_DIR>/cms`.
- Failed validation or database insertion removes the newly written file.
- CMS deletion resolves paths relative to the configured upload root and rejects traversal.
- Legacy root-level CMS media remains resolvable through a database allow-list.
- Replacing either downloadable legal document does not run a migration, delete database rows, or alter unrelated settings.

## Validation

The migration was syntax-checked but not run against MySQL because no database server/credentials are available in this workspace. The exact migration command is documented for deployment.

## Handoff to Stage 06

API integration must use the canonical `passengerRightsUrl` response while keeping legacy response aliases for older browser bundles.

## Claim registration connection repair — 2026-09-02

No table, column, index, migration, stored record, or database value was changed. Ticket extraction persistence now uses the existing claim/file/flight/passenger/customer tables through one short transaction after OCR, preserving atomicity for the extracted-data update. The upload request no longer holds an application request open while OCR workers read the file. The connection pool's failure lifecycle was hardened without changing schema or data.

The final claim-submit response is built from the claim row already read before the existing status transaction. Registration SMS rendering/sending is a post-commit background side effect; it does not add a database transaction, migration, retry, or data mutation to the claim-submit path.

## Registration SMS template persistence — 2026-09-02

The registration template uses the existing `AppSetting.smsTemplates` storage contract already used by the other SMS templates. No migration, `ALTER TABLE`, row update, deletion, or production database command was executed for this UI delivery. Unrelated settings and previously stored SMS templates remain outside the new field's update scope.

## Flight cache refresh behavior — 2026-09-02

The ten-minute scheduler reuses the existing `ExternalFlightSnapshot`, `ExternalFlightCountSnapshot`, and `FlightFeedRun` tables. A provider timeout records the failed run state without replacing the latest successful snapshot, so the admin monitor and public status route continue to show the last valid stored data. No migration, schema alteration, manual SQL, row deletion, or customer-data update was executed for this repair.
