const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(repoRoot, 'backend');
const controllerPath = path.join(backendRoot, 'controllers', 'adminController.js');
const routesPath = path.join(backendRoot, 'routes', 'adminRoutes.js');
const publicBundlePath = path.join(repoRoot, 'assets', 'index-CmsReadyAdminFix20260820.js');
const adminBundlePath = path.join(repoRoot, 'assets', 'AdminPanel-CmsReadyAdminFix20260820.js');
const PROBE_TIMEOUT_MS = 60_000;

function runDeleteRouteProbe() {
  const script = `
    import express from 'express';
    import { adminRoutes } from './routes/adminRoutes.js';
    import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

    const app = express();
    app.use('/api/admin', adminRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    const server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
      const response = await fetch(
        \`http://127.0.0.1:\${server.address().port}/api/admin/claims/claim-delete-probe\`,
        { method: 'DELETE' },
      );
      const body = await response.json();
      console.log(JSON.stringify({ status: response.status, body }));
    } finally {
      server.close();
    }
  `;

  return spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        DB_NAME: 'delete_claim_regression',
        DB_USER: 'delete_claim_regression',
        DB_PASSWORD: '',
        JWT_SECRET: 'test-jwt-secret-delete-claim',
        FLIGHT_CACHE_ENABLED: 'false',
      },
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
    },
  );
}

function readProbeResult(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const line = result.stdout
    .trim()
    .split(/\r?\n/)
    .find((value) => value.startsWith('{'));
  assert.ok(line, result.stderr || result.stdout);
  return JSON.parse(line);
}

function runRoleRouteProbe() {
  const script = `
    import express from 'express';
    import jwt from 'jsonwebtoken';
    import { adminRoutes } from './routes/adminRoutes.js';
    import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

    const secret = 'test-jwt-secret-delete-claim';
    const app = express();
    app.use('/api/admin', adminRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    const server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
      const token = jwt.sign(
        { id: 'admin-delete-probe', role: 'passenger_admin' },
        secret,
      );
      const response = await fetch(
        \`http://127.0.0.1:\${server.address().port}/api/admin/claims/claim-delete-probe\`,
        { headers: { authorization: \`Bearer \${token}\` }, method: 'DELETE' },
      );
      const body = await response.json();
      console.log(JSON.stringify({ status: response.status, body }));
    } finally {
      server.close();
    }
  `;

  return spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        DB_NAME: 'delete_claim_regression',
        DB_USER: 'delete_claim_regression',
        DB_PASSWORD: '',
        JWT_SECRET: 'test-jwt-secret-delete-claim',
        FLIGHT_CACHE_ENABLED: 'false',
      },
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
    },
  );
}

test('claim deletion route is linked and remains behind admin authentication', () => {
  const response = readProbeResult(runDeleteRouteProbe());

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_REQUIRED');
});

test('claim deletion route rejects non-supervisor administrators', () => {
  const response = readProbeResult(runRoleRouteProbe());

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'SUPERVISOR_ONLY');
});

test('claim deletion is supervisor-only, transactional, and preserves shared history', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const routes = fs.readFileSync(routesPath, 'utf8');
  const publicBundle = fs.readFileSync(publicBundlePath, 'utf8');
  const adminBundle = fs.readFileSync(adminBundlePath, 'utf8');

  assert.match(publicBundle, /async function Jy\(c\)\{return fe\(`\/admin\/claims\/\$\{c\}`,\{method:"DELETE"/);
  assert.match(adminBundle, /await mN\(p\.id\)/);
  assert.match(routes, /deleteClaim/);
  assert.match(
    routes,
    /adminRoutes\.delete\(\s*['"]\/claims\/:id['"]\s*,\s*requireSupervisor\s*,\s*asyncHandler\(deleteClaim\)\s*\)/s,
  );
  assert.match(controller, /export async function deleteClaim/);
  assert.match(controller, /req\.admin\?\.role !== ['"]supervisor['"]/);
  assert.match(controller, /transaction\(async \(tx\)/);
  assert.match(controller, /DELETE FROM QuestionnaireAnswer WHERE claimId = \?/);
  assert.match(controller, /DELETE FROM ClaimStatusHistory WHERE claimId = \?/);
  assert.match(controller, /DELETE FROM ClaimNote WHERE claimId = \?/);
  assert.match(controller, /DELETE FROM ClaimBankDetails WHERE claimId = \?/);
  assert.match(controller, /DELETE FROM FlightInfo WHERE claimId = \?/);
  assert.match(controller, /DELETE FROM Passenger WHERE claimId = \?/);
  assert.match(controller, /DELETE FROM UploadedFile WHERE claimId = \?/);
  assert.match(controller, /UPDATE Notification SET claimId = NULL WHERE claimId = \?/);
  assert.match(controller, /UPDATE MessageLog SET claimId = NULL WHERE claimId = \?/);
  assert.match(controller, /UPDATE SupportTicket SET claimId = NULL WHERE claimId = \?/);
  assert.match(controller, /DELETE FROM Claim WHERE id = \?/);
  assert.match(controller, /path\.relative\(/);
});
