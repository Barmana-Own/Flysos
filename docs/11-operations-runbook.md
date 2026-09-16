# Operations Runbook — Passenger Rights Document Delivery Fix

**STAGE_11_STATUS: PASS**

## Verification after release

- Check `GET /api/health`.
- Log in as a supervisor and upload a known-good PDF in General Settings.
- Confirm the settings response contains `passengerRightsUrl`.
- Confirm `GET /api/legal-documents` returns the same URL.
- Open the public passenger-rights page and download the PDF.
- Confirm claim-file URLs are not served by the public CMS path.
- For each downloadable document, upload an approved PDF through its existing General Settings control. Confirm the response URL, the matching `GET /api/legal-documents` field, and the public PDF download. After confirming the replacement is active, verify only the previous managed physical file is gone; do not delete database rows or unrelated files.
- As a supervisor, use the admin claim list delete action only after confirming the claim code. Verify the success toast and refreshed list; do not use an existing production claim for testing. Non-supervisor accounts must receive a forbidden response.
- After a controlled claim-registration smoke test, verify `GET /api/health` remains HTTP 200 and inspect only redacted application error codes. Ticket OCR and registration SMS are post-response jobs; a provider or OCR failure must not turn an already committed claim into a duplicate submission.

## Failure handling

- `UNSUPPORTED_FILE_TYPE`: verify the file extension is `.pdf` and the upload is sent as a PDF; do not weaken server validation.
- `INVALID_FILE_CONTENT`: replace the file with a valid PDF beginning with `%PDF-`.
- Missing column errors: run `npm run db:legal` with a verified database backup.
- Missing public file: inspect the `CmsMedia` row, the `UPLOAD_DIR/cms` file, and the returned URL; do not expose the full upload root.
- `INVALID_LEGAL_DOCUMENT`: use the existing supported document control/title or a supported `documentKey`; do not send arbitrary setting-column names.
- Replacement committed but old file remains: inspect the safe server cleanup log by media id and verify the old URL is not referenced by the other legal-document setting. Do not manually delete a file until its path and cross-reference are confirmed.
- Claim registration returns a generic request failure: first check the HTTP status/content type and recent redacted API/OCR/SMS error codes, then verify `/api/health`. Do not resubmit repeatedly until the claim status and tracking code are checked, because the status transaction may already have committed. Do not add a blanket database retry around claim writes.

## Rollback/roll-forward

Roll back the application code only after preserving the new migration columns and checking compatibility with the deployed bundle. Prefer roll-forward to the repaired code; do not delete document columns or files as a rollback shortcut. Restore database data only through the approved backup/recovery procedure.

For a failed claim deletion, inspect the safe API error code and transaction logs. The transaction rolls back on a database error; post-commit file cleanup failures are logged by file id and do not expose stored paths. Do not manually delete database rows or upload files as a workaround.

For a failed legal-document replacement, the new file is removed when the transaction does not commit; the previous setting and metadata remain unchanged. If the database commit succeeds but physical cleanup fails, the new document remains active and the failure is logged for safe operational cleanup. No database row deletion is part of this flow.

For a claim-registration connection failure, prefer roll-forward after confirming the application restart and pool configuration. The upload file record is committed before OCR; extracted-field persistence is isolated in its own short transaction, and registration notification is post-commit. Do not run migrations, delete rows, or use a real production claim as a retry fixture.

## Flight monitoring and refresh

- Check `GET https://flysos.ir/api/health` and confirm `database: connected`.
- In the authenticated admin diagnostic, confirm the scheduler is enabled and `schedulerIntervalMs` is `600000` for the ten-minute policy.
- `GET /api/flights/status?limit=1&fresh=<unique-value>` should return the latest valid cache row with `X-Data-Source: flight-cache`. During a provider outage, an older `fetchedAt` is expected and existing rows must remain available.
- If the server log contains `UND_ERR_CONNECT_TIMEOUT` for `109.122.250.170:3000`, do not change or delete database rows. Ask the API owner to allow the actual FlySOS egress IP, publish an HTTPS/443 endpoint, or configure `scripts/pushFlightsToFlySOS.mjs` on the provider-accessible server with a ten-minute cron schedule.
- After connectivity is corrected, confirm a new `fetchedAt` and a successful feed-run record through the admin monitor. Keep provider credentials and the import secret in server-managed environment variables only.
