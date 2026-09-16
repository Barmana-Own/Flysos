# Flysos

Flysos is a Persian RTL passenger-rights and flight-claim web application. The backend includes passenger-rights document delivery and a cached flight-status pipeline with a secure HTTPS push path for environments that cannot reach the provider directly.

## Repository layout

- `index.html`, `admin/`, and `assets/`: committed public/admin browser application.
- `backend/`: Express/Node API, MySQL access, authentication, claim workflows, CMS, and migrations.
- `tests/`: Node test-runner regression checks.
- `docs/`: project, architecture, security, test, QA, deployment, and final-review artifacts.

## Local setup

1. Copy `backend/.env.example` to an environment-managed `backend/.env` and fill in local values.
2. Install backend dependencies:

   ```text
   cd backend
   npm ci
   ```

3. Run the database migration against the configured MySQL database:

   ```text
   npm run db:legal
   ```

4. Start the API:

   ```text
   npm start
   ```

5. Serve the repository root with the existing web-server configuration and open the public or admin entry point.

## Validation

From the repository root:

```text
node --test tests/*.test.cjs
```

The backend JavaScript syntax check can be run with `node --check` for each file under `backend/`. Database-backed and deployment checks require the environment-specific MySQL service and deployment target.

## Passenger-rights document flow

The supervisor uploads either downloadable legal document through the protected CMS media endpoint. New CMS files are stored under `UPLOAD_DIR/cms`; a recognized replacement updates the matching application setting in the same transaction and, after commit, removes the previous managed physical file when it is not shared by the other legal document. The previous `CmsMedia` metadata row and unrelated database data are preserved. The public endpoint is `GET /api/legal-documents`, and public files are served only from the CMS path or through an allow-listed legacy CMS record.

## Claim questionnaire

The stage-three claim questionnaire requires a boolean answer for every visible question in the selected cancellation or delay section. Conditional questions are required when their parent answer makes them visible. The server enforces the rule on both questionnaire save and final submission. Admin claim responses include the saved answers and their questionnaire section metadata. This behavior does not require a database migration.

## Claim registration availability

Ticket OCR runs after the upload response and extracted-field persistence uses a short guarded transaction. Claim submission returns the committed tracking state without waiting for OCR or registration SMS delivery; notification failures are isolated from the claim response. The MySQL pool uses bounded connection/idle settings and disposes of known-broken connections without retrying non-idempotent writes.

Do not put real credentials in source control, `.env.example`, documentation, or browser assets. Use the migration and operations instructions in `docs/11-deployment.md` and `docs/11-operations-runbook.md` for release verification.

## Admin claim deletion

The existing admin delete action uses `DELETE /api/admin/claims/:id`. The endpoint is restricted to supervisor accounts, validates the identifier, removes claim-owned records transactionally, preserves the shared customer and cross-feature history links, and cleans claim files only within `UPLOAD_DIR` after a successful commit. No database migration is required.

## Flight feed refresh

The backend scheduler checks the configured flight provider every ten minutes (`FLIGHT_CACHE_INTERVAL_MS=600000`) when direct provider connectivity is available. If the backend host cannot reach the provider, run `backend/scripts/pushFlightsToFlySOS.mjs` on the provider-accessible server, set `FLIGHT_CACHE_ENABLED=false` on FlySOS, and schedule the push script every ten minutes. It sends the three flight feeds and provider count to `POST /api/flights/import` over HTTPS. The endpoint validates the secret and payload, returns `202`, and persists the data asynchronously. See `backend/PUSH-FLIGHTS-SETUP.txt` for the complete environment and cron configuration.
