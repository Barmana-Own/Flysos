# Deployment — Passenger Rights Document Delivery Fix

**STAGE_11_STATUS: PASS**

## Build and install

From `backend/`:

```text
npm ci --omit=dev
npm run db:legal
npm start
```

The frontend remains the committed root/static asset set and must be deployed with the existing `index.html`, `admin/v2/login/index.html`, and `assets/` files.

## Configuration

Copy `backend/.env.example` to the environment-managed backend configuration and provide real values outside source control. `DB_NAME`, `DB_USER`, and a strong `JWT_SECRET` are required for normal operation. Keep `UPLOAD_DIR` persistent across application restarts and outside any unintended public document root.

## Migration rollout

1. Back up the database according to the existing operations policy.
2. Run `npm run db:legal` once against the target database.
3. Confirm `AppSetting.powerOfAttorneyUrl` and `AppSetting.rightsDocumentUrl` exist and legacy values were preserved.
4. Restart the backend and perform an authenticated settings upload test.
5. Verify `GET /api/legal-documents` and the public passenger-rights download.

The migration is idempotent. The runtime settings path also performs compatibility checks for installations that have not yet run the focused migration.

## Runtime and health

Use the existing `GET /api/health` endpoint and application logs for readiness checks. The API must run with production `NODE_ENV`, a strong JWT secret, and no development credentials. The existing rate limiter covers the API and scoped public file paths.

## Flight feed refresh

For the cPanel deployment where the backend cannot reach the provider's port 3000, configure the backend with a strong `FLIGHT_IMPORT_SECRET` (at least 32 characters; 48 random characters are recommended) and set `FLIGHT_CACHE_ENABLED=false`. Run `backend/scripts/pushFlightsToFlySOS.mjs` on the flight-data server with the same secret and provider credentials, then schedule it every five minutes. The script posts to `/api/flights/import`; the endpoint acknowledges valid pushes with HTTP `202` and persists them asynchronously.

If the provider is made reachable through an HTTPS reverse proxy, configure the canonical `EXTERNAL_FLIGHTS_BASE_URL` and keep the scheduler enabled instead. The older `EXTERNAL_FLIGHTS_RELAY_URL` name remains accepted as a backward-compatible alias, but new deployments should use the canonical name.

The admin diagnostic endpoint is `GET /api/admin/flight-cache/push-status`. It requires admin authentication and reports configuration/cache metadata without exposing secrets or provider payloads.

## Deployment status

Production-like startup was smoke-tested with the database unavailable and the scheduler disabled; the process started and shut down cleanly. Flight import route/auth/size behavior was tested locally without a database. A real target deployment, database migration, flight push persistence, and public download smoke test are **NOT_PERFORMED** in this workspace.
