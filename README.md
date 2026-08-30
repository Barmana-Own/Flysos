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

The supervisor uploads through the protected CMS media endpoint. New CMS files are stored under `UPLOAD_DIR/cms`; the settings API stores the URL in `AppSetting.rightsDocumentUrl` and exposes it as `passengerRightsUrl`. The public endpoint is `GET /api/legal-documents`, and public files are served only from the CMS path or through an allow-listed legacy CMS record.

Do not put real credentials in source control, `.env.example`, documentation, or browser assets. Use the migration and operations instructions in `docs/11-deployment.md` and `docs/11-operations-runbook.md` for release verification.

## Flight feed refresh

When the backend host cannot make outbound requests to the provider, run `backend/scripts/pushFlightsToFlySOS.mjs` on the provider-accessible server. Configure the same strong `FLIGHT_IMPORT_SECRET` in both environments, set `FLIGHT_CACHE_ENABLED=false` on FlySOS, and schedule the push script every five minutes. It sends the three flight feeds and provider count to `POST /api/flights/import` over HTTPS. The endpoint validates the secret and payload, returns `202`, and persists the data asynchronously. See `backend/PUSH-FLIGHTS-SETUP.txt` for the complete environment and cron configuration.
