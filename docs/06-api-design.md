# API Design — Passenger Rights, Goftino, and Claim Workflow Fixes

## Status

**STAGE_06_STATUS: PASS**

## Contract map

| Method | Endpoint | Contract |
| --- | --- | --- |
| `POST` | `/api/admin/cms/media` | Protected multipart upload; accepts PDF/image metadata within bounded limits. For `category=legal-document` and a recognized title or `documentKey`, it inserts the new CMS media and activates the matching downloadable-document setting transactionally, returning an `/api/uploads/cms/...` URL plus `legalDocumentKey` and `settingsUpdated`. |
| `PATCH` | `/api/admin/settings` | Protected settings update; accepts `passengerRightsUrl`, compatible aliases, and the normalized `goftinoWidgetId`, preserving unrelated settings. |
| `GET` | `/api/admin/settings` | Protected settings read; returns normalized legal-document fields, `goftinoWidgetId`, and compatibility aliases. |
| `GET` | `/api/legal-documents` | Public read; returns `passengerRightsUrl`, `powerOfAttorneyUrl`, `goftinoWidgetId`, and compatibility aliases. |
| `GET` | `/api/uploads/cms/:path` | Public static delivery for new CMS files. |
| `GET` | `/api/uploads/:filename` | Database-allow-listed legacy root-level CMS delivery only. |
| `PATCH` | `/api/admin/claims/:id` | Existing authenticated claim-edit operation; accepts optional `priority` with values `low`, `medium`, `high`, or `urgent` and persists it transactionally without changing unrelated fields. |
| `DELETE` | `/api/admin/claims/:id` | Supervisor-only claim deletion; removes claim-owned records transactionally, detaches nullable cross-feature history links, and cleans files under `UPLOAD_DIR` after commit. |

## Error and bounds

## Team performance report contract

The protected `GET /api/admin/reports/team-performance` response is an array containing every claim-handling staff row from Expert Management (`supervisor`, `passenger_admin`, `senior_expert`, `expert`, `expert_domestic`, and `expert_intl`), including rows whose counts are zero. Each row contains `id`, `name`, `username`, `role`, `roleLabel`, `assignedClaimsCount`, `closedClaimsCount`, `averageReviewHours`, `satisfactionScore`, and `satisfactionResponseCount`. Counts use the current assignment and status in `Claim`; the average uses the first `ClaimStatusHistory.toStatus = "closed"` timestamp and falls back to `updatedAt` for legacy closed claims. `satisfactionScore` is `null` and `satisfactionResponseCount` is `0` until the application has a persisted passenger-survey source. The active admin bundle requests this endpoint whenever the Reports screen is opened and renders an explicit unregistered value instead of a hardcoded score.

The existing JSON error envelope and HTTP status conventions are retained. Uploads remain limited to 4 files/15 MB by the shared middleware; the CMS endpoint uses one file. File names are normalized and generated server-side.

For a legal-document replacement, the old managed physical file is cleaned after the transaction commits, only when it is not referenced by the other legal-document setting. The old database metadata row is retained. An unknown explicit `documentKey` or unsupported legal-document title returns `400 INVALID_LEGAL_DOCUMENT`; an invalid PDF returns the existing safe upload error and the new file is removed. Generic CMS media uploads are unchanged.

## Integration evidence

The active admin bundle calls the CMS upload endpoint and sends `passengerRightsUrl`. The active public bundle reads the public endpoint and remains compatible with legacy `/uploads/...` values by mapping them through `/api`. The backend now exposes stored legacy values and new CMS upload results through `/api/uploads/...`, so cPanel's SPA fallback cannot replace a document response with `index.html`; stored database values are not rewritten by this compatibility mapping. The focused regression suite verifies the contract and active bundle pairing.

The active admin bundle sends the legal-document category and the existing Persian control title for both downloadable-document controls. The backend now performs the setting update itself, so the browser's follow-up settings PATCH remains backward compatible but is no longer the only persistence step.

## Goftino widget contract

The public legal-settings response now always includes `goftinoWidgetId`; an unset value is returned as an empty string so older clients remain safe. The protected settings update accepts a trimmed value up to 191 characters and persists it only when the existing `AppSetting.goftinoWidgetId` column is present. The runtime performs a read-only column check and never creates, alters, or removes database structures as part of this fix. If the column is unavailable, a widget update fails explicitly instead of being silently discarded. The widget identifier is intentionally public because the browser uses it to load the Goftino widget; it is not an API secret.

## Flight feed API contract

The existing flight-data push architecture is wired through the backend:

| Method | Endpoint | Contract |
| --- | --- | --- |
| `POST` | `/api/flights/import` | Secret-protected JSON push from the flight-data server. Requires `X-FlySOS-Import-Key` and a `feeds` object containing `all_recent` plus optional `cancelled_last_24h` and `delayed_last_24h` provider payloads. `providerCount` is an optional non-negative integer. |
| `GET` | `/api/flights/status` | Public cached flight-status read used by the browser application. |
| `GET` | `/api/admin/flight-cache/push-status` | Authenticated admin diagnostic for import configuration, scheduler state, cache row counts, and last attempts. It does not expose credentials or pushed payloads. |

The import endpoint returns HTTP `202` after authentication and payload validation, then persists the feed in the background through the existing `ExternalFlightSnapshot`, `FlightFeedRun`, and `ExternalFlightCountSnapshot` tables. Invalid credentials return `401`, missing/weak server configuration returns `503`, malformed payloads return `400`, and bodies above the route-scoped `5 MB` limit return `413`. Other JSON APIs retain the existing `1 MB` limit.

## Claim questionnaire contract

`POST /api/claims/:id/questionnaire` accepts the optional `claimType` (`cancellation` or `delay`) and an `answers` array. The backend validates the selected section independently of the browser: every currently visible question must have a boolean answer, duplicate or unknown question identifiers are rejected, and conditional questions become required when their parent answer is `true`. Hidden conditional questions are not persisted. Referral options retain the existing rule that at least one valid option must be selected before final submission.

`POST /api/claims/:id/submit` repeats the questionnaire validation against persisted answers before changing the claim status, so a client cannot bypass the required-answer rule by calling the submit endpoint directly. Missing answers return `400` with code `QUESTIONNAIRE_ANSWERS_REQUIRED`. This change does not add or alter database tables, columns, migrations, or existing stored records.

Authenticated admin claim responses now include `questionnaireAnswers` and add `section` and `sectionLabel` to mapped questionnaire records. The existing `delayAnswers` and `cancellationAnswers` fields remain available for compatibility, and the admin detail/print views show the selected questionnaire section label.

## Claim priority contract

`PATCH /api/admin/claims/:id` retains the existing authentication and claim-editor authorization boundary. When `priority` is present, the backend accepts only `low`, `medium`, `high`, or `urgent`, updates the existing `Claim.priority` column through the current parameterized transaction, and returns the refreshed mapped claim. Missing `priority` leaves it unchanged; unsupported values return the normal validation error. No database migration or data cleanup is required.

## Claim deletion contract

`DELETE /api/admin/claims/:id` is mounted behind the existing administrator authentication and `requireSupervisor` middleware. The controller repeats the supervisor check at the application boundary, validates the claim identifier, locks the claim row, deletes claim-owned questionnaire, status-history, note, bank-detail, flight, passenger, and uploaded-file records inside a transaction, and then deletes the claim row. Notifications, SMS logs, and support tickets are retained with their nullable `claimId` detached. Uploaded files are removed only after a successful commit and only when their resolved paths are inside `UPLOAD_DIR`; missing files are treated as already-cleaned and other cleanup failures are logged without exposing paths. The shared `Customer` record is never deleted.

## Registration SMS template contract — 2026-09-02

`GET /api/admin/settings` returns the normalized `smsTemplates.registration` value, and `PATCH /api/admin/settings` accepts a trimmed registration template up to 3000 characters together with the existing settings fields. `{trackingCode}` is rendered only on the server when the post-commit registration notification is prepared. The active admin bundle now exposes this field in General Settings; the existing protected route, storage column, and other template values are reused without a migration or database-data change.

## Handoff to Stage 07

Existing supervisor/CMS-editor authorization remains in place. The upload and settings endpoints must not be treated as public merely because the legal-document read/file path is public.

The flight import endpoint is public in routing location only; its dedicated shared secret is mandatory. Production refresh also requires deploying this backend and scheduling `scripts/pushFlightsToFlySOS.mjs` on the provider-accessible server as described in `backend/PUSH-FLIGHTS-SETUP.txt`.

## Claim file upload and registration availability

`POST /api/claims/:id/files` keeps the existing multipart input and `201` response contract. For ticket uploads, the response now includes `ocr.pending: true`, `extractedTicketData: null`, and no warning before extraction; the file record is already committed when the response is sent. Ticket OCR and extracted-field persistence run in a guarded background job. This prevents a slow PDF/image OCR operation from exceeding the cPanel request timeout and avoids holding a database connection during OCR. The existing public bundle safely treats the extracted text as optional and continues to the questionnaire/submit calls.

`POST /api/claims/:id/submit` returns the committed claim identifier, tracking code, and `under_review` status immediately after the status transaction succeeds. The registration SMS/template side effect is queued after commit and is isolated from the HTTP response; provider or SMS-history failures are logged with a safe error code and do not convert a successful claim submission into a generic browser request failure.

## Flight monitoring and scheduler contract — 2026-09-02

`GET /api/flights/status` continues to return the latest valid cached flight rows and exposes `X-Data-Source: flight-cache`; a failed provider pull does not replace those rows with an empty response. `GET /api/admin/flight-cache/push-status` now also reports the effective scheduler interval in milliseconds without exposing provider credentials. The deployed scheduler is configured for ten-minute checks (`600000` ms), while the existing authenticated HTTPS import endpoint remains the supported fallback for a provider-accessible push job.

## Admin flight-monitor ordering checkpoint — 2026-09-15

The `GET /api/admin/dashboard` response contract is unchanged. Its `flightCache.recentFlights` array is now deterministic: rows from the newest fetch are considered first, and the latest scheduled time within that snapshot is first, with the flight number as a stable tie-breaker. The provider pull remains a server-side `GET` on the configured ten-minute interval; the admin UI continues to refresh its dashboard read path independently. No database migration or write is required for the ordering correction.

## Stage-four final receipt CMS contract — 2026-09-15

`GET /api/pages/track` now returns the published `track-success` block with a normalized nested `رسید نهایی` object. The existing authenticated CMS page read/update/publish endpoints expose and persist the same fields through the generic block editor. The public helper consumes only these static text fields for the generated receipt canvas; claim identifiers, passenger values, uploaded-file names, status, and registration time continue to come from the claim workflow. The response is marked non-cacheable for the track page so a published text edit can be reflected on the next receipt download.

## Inline responsible-expert assignment contract — 2026-09-16

The claims table reuses the existing protected endpoints; no API or database migration is added. Supervisor accounts load assignable account records through `GET /api/admin/experts` and update one claim through `PATCH /api/admin/claims/:id` with `{ "assignedAdminId": "<admin-id>" }`. The existing `updateClaimSchema` accepts a non-empty admin identifier, an empty string, or `null`; the controller validates the target record, enforces the existing supervisor/passenger-admin assignment boundary, updates `Claim.assignedAdminId` transactionally, and returns the refreshed `mapClaimForAdmin` response including `expert` and `assignedAdminId`. The table stops click propagation from the selector so changing an assignment does not open the claim detail. Authentication and authorization remain server-side and unchanged.
