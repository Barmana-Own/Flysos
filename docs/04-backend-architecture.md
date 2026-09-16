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
| `services/legalDocumentReplacementService.js` | Resolve the supported legal-document slots and safely remove only managed replacement files. |
| `controllers/cmsController.js` | Persist CMS media, transactionally activate legal-document replacements, clean failed uploads, delete safely, and serve legacy CMS files. |
| `validation/adminSchemas.js` and `controllers/adminController.js` | Validate and transactionally persist the authorized admin claim-edit fields, including the closed-set handling priority. |
| `routes/adminRoutes.js` and `app.js` | Enforce CMS upload middleware and scoped public file paths. |

## Error and configuration model

Existing `AppError`/`asyncHandler` handling is preserved. Upload failures return safe typed errors; internal paths and database details are not sent in production. Upload directories remain configuration-driven through `UPLOAD_DIR`.

## Team performance report boundary

The `GET /api/admin/reports/team-performance` endpoint is protected by `requireSupervisor` and reads every claim-handling staff role shown in Expert Management (`supervisor`, `passenger_admin`, `senior_expert`, `expert`, `expert_domestic`, and `expert_intl`). The aggregation returns a row for each matching staff member, including zero-count rows, so the report cannot disappear when no claims are currently assigned. Assigned and currently closed counts are derived from `Claim`; average review time uses the first `closed` entry in `ClaimStatusHistory` and falls back to `Claim.updatedAt` for legacy closed records without a history timestamp. No satisfaction table or persisted rating field exists in the current schema, so the response returns an explicit null satisfaction score rather than a fabricated value. No migration or write operation is part of this report.

## Claim priority update boundary

`PATCH /api/admin/claims/:id` validates `priority` as one of `low`, `medium`, `high`, or `urgent`, then adds the field to the existing parameterized transaction only when supplied. No schema, migration, or unrelated claim update behavior is changed.

## Legal-document replacement boundary

The protected CMS multipart endpoint recognizes the two existing downloadable-document slots from the explicit `documentKey` or the admin control title. For a recognized slot it locks the default `AppSetting` row, inserts the new `CmsMedia` record, and updates the available canonical/legacy setting column in one transaction. The previous physical file is considered only after commit and only when the old URL matches a stored `CmsMedia` record, is inside `UPLOAD_DIR`, is a regular non-symlink file, and is not shared by the other legal-document setting. The old metadata row is intentionally retained to honor data-preservation requirements. Unknown explicit legal-document keys fail validation; generic CMS uploads retain their existing behavior.

## Handoff to Stage 05

Persistence requires `AppSetting.powerOfAttorneyUrl` and `AppSetting.rightsDocumentUrl`, with compatibility reads/backfills for `powerOfAttorneyDocumentUrl` and `passengerRightsUrl`. CMS media remains the existing database-backed record with files in the configured upload root. No schema or migration change is required for replacement uploads.

## Claim registration connection repair — 2026-09-02

`backend/config/db.js` now uses bounded, environment-configurable pool settings with TCP keep-alive, connect timeout, idle cleanup, and the existing default pool size/queue behavior. `runTransaction` covers connection acquisition through commit, releases a connection when `beginTransaction` fails, preserves the original application error when rollback fails, and destroys known-fatal connections instead of returning them to the pool. It deliberately does not add a blanket retry around writes.

The expensive ticket extraction path is owned by `services/ticketExtractionJobService.js`. The upload controller persists the uploaded file, schedules extraction, and returns the HTTP response before OCR starts. The job performs only short database transactions after extraction, rejects stale replacement jobs by checking the active file id/path, and records extraction/persistence failures without converting a completed upload into a second HTTP failure.

Registration completion now returns from the committed claim state without issuing a second post-commit claim read. Registration SMS/template work is queued after the response, so a slow provider or unavailable message-history write cannot make an already committed claim appear to have failed in the browser.

## Registration SMS template contract — 2026-09-02

The existing `smsTemplateService.js` already defines the registration default, normalizes stored templates, replaces `{trackingCode}`, and is used by `claimNotificationJobService.js` after a successful claim commit. `platformSchemas.js` already accepts `smsTemplates.registration`, and the settings controller already reads and persists the normalized `smsTemplates` JSON with the other existing settings. This UI delivery reuses that contract; no backend code, schema, migration, or stored value was changed.

## Flight scheduler and cache-preservation repair — 2026-09-02

`flightCacheService.js` now exposes the effective scheduler configuration for diagnostics and applies a bounded ten-minute default (`600000` ms). `FLIGHT_CACHE_ENABLED` remains environment-controlled, and the existing in-process guard prevents duplicate intervals. Each scheduled run attempts the configured provider feeds and writes a new snapshot only after a successful feed response; failed provider requests are logged with a safe error code while the last valid stored snapshot remains available to `GET /api/flights/status`. No database schema or customer-data path was changed.

## Admin flight-monitor latest-row ordering — 2026-09-15

The root cause of the dashboard showing the first flight of the day was the `ASC` ordering in `getFlightCacheSummary()`. The admin summary queries now use `fetchedAt DESC, scheduledTime DESC, flightNumber DESC` for the global recent rows and `scheduledTime DESC, flightNumber DESC` within the newest source snapshot. This changes read ordering only; it does not rewrite cached rows, alter the public flight contract, or change the ten-minute provider `GET` scheduler. Provider failures continue to preserve the last valid snapshot.

## Stage-four final receipt content boundary — 2026-09-15

`backend/services/claimReceiptContentService.js` defines the editable receipt text defaults and normalizes the nested `رسید نهایی` content in the `track-success` CMS block. `cmsController.js` applies that normalizer to admin reads, draft updates, publishing, and the public `track` page response, preserving existing editor values and filling only missing receipt fields. `cmsSeedService.js` includes the defaults for new installations and runs the idempotent `editable-track-receipt-content-v1` repair for existing track records. No claim data, receipt dynamic values, database schema, or unrelated CMS page is modified by this boundary.
