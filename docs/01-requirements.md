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
- **FR-008:** A supervisor can delete a claim from the admin panel; the server removes claim-owned records in one transaction, preserves shared customer/history records, and cleans claim files only within the configured upload directory.
- **FR-009:** A supervisor can replace either downloadable legal document from General Settings; the upload creates the new CMS media record and activates its URL in the matching application setting as one transaction without changing unrelated settings.
- **FR-010:** After a successful legal-document replacement commit, the previous managed physical file is removed from the configured upload directory only when it is not referenced by the other legal-document setting; the previous database metadata row and all unrelated data remain preserved.
- **FR-011:** An authorized admin can change a claim's handling priority from the claim summary, and the selected value is validated and persisted without changing unrelated claim fields.
- **FR-012:** When a user tries to continue with an incomplete visible questionnaire, the public flow displays an inline red validation message above the active question list instead of a native browser alert.
- **FR-013:** Claim file uploads return after the file record is persisted; expensive ticket extraction runs in a guarded background task and does not keep the registration request open.
- **FR-014:** After the claim status transaction commits, claim submission returns the committed identifier/tracking code/status without waiting for OCR, SMS provider delivery, or SMS-history logging.
- **FR-015:** A supervisor can view and edit the registration SMS template in General Settings; the saved template is used for the post-commit claim-registration notification and supports `{trackingCode}` replacement.
- **FR-016:** The admin flight monitor displays the most recent valid stored snapshot and reports the scheduler's last attempt/success state; when enabled, the provider check runs every ten minutes and a failed provider request does not discard the last valid snapshot.
- **FR-017:** A supervisor can view a team-performance report that lists every claim-handling staff member shown in Expert Management (`supervisor`, `passenger_admin`, `senior_expert`, `expert`, `expert_domestic`, or `expert_intl`) and shows each member's name, organizational role, assigned claims, currently closed claims, and average time from claim creation to the first recorded closed transition.
- **FR-018:** The admin flight monitor displays rows from the newest valid cache snapshot with the latest scheduled flight first; the existing provider `GET` refresh continues on the ten-minute server schedule and the dashboard refresh path displays the resulting snapshot.

## Non-functional requirements

- **NFR-015:** Team-performance metrics use parameterized, supervisor-protected reads; every claim-handling staff row is returned even when its counts are zero; missing historical timestamps are handled with a documented legacy fallback, and passenger-satisfaction remains explicitly unregistered until a persisted survey source exists.

- **NFR-001:** Server-side validation remains authoritative and uses file content verification for fallback MIME values.
- **NFR-002:** SQL remains parameterized; schema changes are idempotent and preserve existing document references.
- **NFR-003:** The API contract remains backward compatible with the existing `rightsDocumentUrl`/`powerOfAttorneyDocumentUrl` naming where needed.
- **NFR-004:** Upload size and file-count limits remain bounded; failures return safe errors without secrets or internal paths.
- **NFR-005:** Regression tests cover the field contract, MIME/signature behavior, URL normalization, and public-serving boundary.
- **NFR-006:** Build/type/lint/database checks are reported with actual PASS or NOT_RUN evidence.
- **NFR-007:** Claim deletion is protected by server-side supervisor authorization, parameterized SQL, transaction rollback, bounded identifier validation, and safe post-commit file cleanup.
- **NFR-008:** Legal-document cleanup runs only after the settings/media transaction commits, rejects traversal/external paths, skips symlinks, and records cleanup failures without converting a committed replacement into a false client failure.
- **NFR-009:** Claim-priority updates use a closed set of supported values, parameterized SQL, the existing claim-edit authorization boundary, and the existing transaction without requiring a schema or data migration.
- **NFR-010:** Inline questionnaire validation uses an accessible alert role, clears after a valid answer or problem-type change, and does not alter backend validation or stored data.
- **NFR-011:** MySQL pool transactions release connections on begin/commit/rollback failures, discard known-broken connections, preserve the original failure, and do not retry non-idempotent writes.
- **NFR-012:** Post-commit registration notification failures are isolated, logged with safe error codes, and cannot convert a committed claim into a failed HTTP response.
- **NFR-013:** Registration-template editing reuses the existing settings/API contract, preserves unrelated SMS templates and settings, and does not require a schema or data migration.
- **NFR-014:** Flight refresh scheduling uses a bounded interval with a ten-minute default (`600000` ms), prevents duplicate in-process schedulers, preserves cached data across provider failures, and exposes only non-sensitive monitoring metadata to administrators.
- **NFR-016:** Latest-flight ordering is deterministic and scoped to the admin cache summary; provider failures preserve the last valid snapshot, and public flight-response ordering is not changed by this admin-only correction.

- **FR-020:** The static wording of the final stage-four claim receipt must be editable from the existing `track-success` CMS content, published through the normal CMS workflow, and applied to the generated receipt without replacing dynamic claim values.
- **NFR-017:** Receipt-content normalization must preserve administrator edits, supply missing safe defaults, remain scoped to the `track` page, and avoid exposing or changing claim data.
