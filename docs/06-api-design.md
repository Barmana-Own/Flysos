# API Design — Passenger Rights Document Delivery Fix

## Status

**STAGE_06_STATUS: PASS**

## Contract map

| Method | Endpoint | Contract |
| --- | --- | --- |
| `POST` | `/api/admin/cms/media` | Protected multipart upload; accepts PDF/image metadata within bounded limits and returns a CMS media record with a `/uploads/cms/...` URL for new media. |
| `PATCH` | `/api/admin/settings` | Protected settings update; accepts `passengerRightsUrl` and compatible aliases, preserving unrelated settings. |
| `GET` | `/api/admin/settings` | Protected settings read; returns normalized legal-document fields and compatibility aliases. |
| `GET` | `/api/legal-documents` | Public read; returns `passengerRightsUrl`, `powerOfAttorneyUrl`, and compatibility aliases. |
| `GET` | `/api/uploads/cms/:path` | Public static delivery for new CMS files. |
| `GET` | `/api/uploads/:filename` | Database-allow-listed legacy root-level CMS delivery only. |

## Error and bounds

The existing JSON error envelope and HTTP status conventions are retained. Uploads remain limited to 4 files/15 MB by the shared middleware; the CMS endpoint uses one file. File names are normalized and generated server-side.

## Integration evidence

The active admin bundle calls the CMS upload endpoint and sends `passengerRightsUrl`. The active public bundle reads the public endpoint and maps returned upload URLs through `/api`. The focused regression suite verifies the contract and active bundle pairing.

## Flight feed API contract

The existing flight-data push architecture is wired through the backend:

| Method | Endpoint | Contract |
| --- | --- | --- |
| `POST` | `/api/flights/import` | Secret-protected JSON push from the flight-data server. Requires `X-FlySOS-Import-Key` and a `feeds` object containing `all_recent` plus optional `cancelled_last_24h` and `delayed_last_24h` provider payloads. `providerCount` is an optional non-negative integer. |
| `GET` | `/api/flights/status` | Public cached flight-status read used by the browser application. |
| `GET` | `/api/admin/flight-cache/push-status` | Authenticated admin diagnostic for import configuration, scheduler state, cache row counts, and last attempts. It does not expose credentials or pushed payloads. |

The import endpoint returns HTTP `202` after authentication and payload validation, then persists the feed in the background through the existing `ExternalFlightSnapshot`, `FlightFeedRun`, and `ExternalFlightCountSnapshot` tables. Invalid credentials return `401`, missing/weak server configuration returns `503`, malformed payloads return `400`, and bodies above the route-scoped `5 MB` limit return `413`. Other JSON APIs retain the existing `1 MB` limit.

## Handoff to Stage 07

Existing supervisor/CMS-editor authorization remains in place. The upload and settings endpoints must not be treated as public merely because the legal-document read/file path is public.

The flight import endpoint is public in routing location only; its dedicated shared secret is mandatory. Production refresh also requires deploying this backend and scheduling `scripts/pushFlightsToFlySOS.mjs` on the provider-accessible server as described in `backend/PUSH-FLIGHTS-SETUP.txt`.
