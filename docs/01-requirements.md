# Requirements — Passenger Rights Document Delivery Fix

**STAGE_01_STATUS: PASS**

## Functional requirements

- **FR-001:** A supervisor can upload a valid PDF from the passenger-rights setting even when the browser reports a generic PDF MIME type.
- **FR-002:** Invalid or non-PDF content is rejected and is not left as an orphaned file.
- **FR-003:** The uploaded CMS media record is stored and its URL is persisted in the application settings without losing unrelated settings.
- **FR-004:** Reopening General Settings returns the persisted passenger-rights document reference, including compatibility with existing legacy column names.
- **FR-005:** `GET /api/legal-documents` returns the passenger-rights URL and the public page uses it for its download action.
- **FR-006:** New CMS documents are publicly reachable through the URL emitted by the API; existing CMS media URLs remain compatible.
- **FR-007:** Private claim files are not exposed by the public CMS media serving path.

## Non-functional requirements

- **NFR-001:** Server-side validation remains authoritative and uses file content verification for fallback MIME values.
- **NFR-002:** SQL remains parameterized; schema changes are idempotent and preserve existing document references.
- **NFR-003:** The API contract remains backward compatible with the existing `rightsDocumentUrl`/`powerOfAttorneyDocumentUrl` naming where needed.
- **NFR-004:** Upload size and file-count limits remain bounded; failures return safe errors without secrets or internal paths.
- **NFR-005:** Regression tests cover the field contract, MIME/signature behavior, URL normalization, and public-serving boundary.
- **NFR-006:** Build/type/lint/database checks are reported with actual PASS or NOT_RUN evidence.
