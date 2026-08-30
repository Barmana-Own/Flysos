# Operations Runbook — Passenger Rights Document Delivery Fix

**STAGE_11_STATUS: PASS**

## Verification after release

- Check `GET /api/health`.
- Log in as a supervisor and upload a known-good PDF in General Settings.
- Confirm the settings response contains `passengerRightsUrl`.
- Confirm `GET /api/legal-documents` returns the same URL.
- Open the public passenger-rights page and download the PDF.
- Confirm claim-file URLs are not served by the public CMS path.

## Failure handling

- `UNSUPPORTED_FILE_TYPE`: verify the file extension is `.pdf` and the upload is sent as a PDF; do not weaken server validation.
- `INVALID_FILE_CONTENT`: replace the file with a valid PDF beginning with `%PDF-`.
- Missing column errors: run `npm run db:legal` with a verified database backup.
- Missing public file: inspect the `CmsMedia` row, the `UPLOAD_DIR/cms` file, and the returned URL; do not expose the full upload root.

## Rollback/roll-forward

Roll back the application code only after preserving the new migration columns and checking compatibility with the deployed bundle. Prefer roll-forward to the repaired code; do not delete document columns or files as a rollback shortcut. Restore database data only through the approved backup/recovery procedure.
