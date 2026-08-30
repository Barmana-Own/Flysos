const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(repoRoot, 'backend');
const importSecret = 'test-flight-import-secret-0123456789-abcdefghijklmnopqrstuvwxyz';

function runPublicImportProbe({ configuredSecret = importSecret, suppliedSecret, payload }) {
  const requestHeaders = { 'content-type': 'application/json' };
  if (suppliedSecret !== undefined) {
    requestHeaders['x-flysos-import-key'] = suppliedSecret;
  }

  const script = `
    import express from 'express';
    import { publicRoutes } from './routes/publicRoutes.js';
    import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api', publicRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    const server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
      const response = await fetch(
        \`http://127.0.0.1:\${server.address().port}/api/flights/import\`,
        {
          method: 'POST',
          headers: ${JSON.stringify(requestHeaders)},
          body: JSON.stringify(${JSON.stringify(payload)}),
        },
      );
      const body = await response.json();
      console.log(JSON.stringify({ status: response.status, body }));
    } finally {
      server.close();
    }
  `;

  const env = {
    ...process.env,
    DB_NAME: 'flight_api_regression',
    DB_USER: 'flight_api_regression',
    DB_PASSWORD: '',
    FLIGHT_CACHE_ENABLED: 'false',
  };

  if (configuredSecret === null) {
    delete env.FLIGHT_IMPORT_SECRET;
  } else {
    env.FLIGHT_IMPORT_SECRET = configuredSecret;
  }

  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { cwd: backendRoot, env, encoding: 'utf8', timeout: 15_000 },
  );
}

function runAppImportSizeProbe(size) {
  const script = `
    import { app } from './app.js';

    const server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
      const response = await fetch(
        \`http://127.0.0.1:\${server.address().port}/api/flights/import\`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-flysos-import-key': 'wrong-flight-import-secret',
          },
          body: JSON.stringify({
            feeds: {
              all_recent: [{ payload: 'x'.repeat(${size}) }],
            },
          }),
        },
      );
      const body = await response.json();
      console.log(JSON.stringify({ status: response.status, body }));
    } finally {
      server.close();
    }
  `;

  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        DB_NAME: 'flight_api_regression',
        DB_USER: 'flight_api_regression',
        DB_PASSWORD: '',
        FLIGHT_IMPORT_SECRET: importSecret,
        FLIGHT_CACHE_ENABLED: 'false',
      },
      encoding: 'utf8',
      timeout: 15_000,
    },
  );
}

function runAdminPushStatusProbe() {
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
        \`http://127.0.0.1:\${server.address().port}/api/admin/flight-cache/push-status\`,
      );
      const body = await response.json();
      console.log(JSON.stringify({ status: response.status, body }));
    } finally {
      server.close();
    }
  `;

  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        DB_NAME: 'flight_api_regression',
        DB_USER: 'flight_api_regression',
        DB_PASSWORD: '',
        JWT_SECRET: 'test-jwt-secret-for-flight-api-regression',
        FLIGHT_CACHE_ENABLED: 'false',
      },
      encoding: 'utf8',
      timeout: 15_000,
    },
  );
}

function runLegacyRelayConfigProbe() {
  const script = `
    import { env } from './config/env.js';
    console.log(JSON.stringify({ externalFlightsBaseUrl: env.externalFlightsBaseUrl }));
  `;

  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        DB_NAME: 'flight_api_regression',
        DB_USER: 'flight_api_regression',
        DB_PASSWORD: '',
        EXTERNAL_FLIGHTS_BASE_URL: '',
        EXTERNAL_FLIGHTS_RELAY_URL: 'https://flights-api.example.test/api/flights',
      },
      encoding: 'utf8',
      timeout: 15_000,
    },
  );
}

function readProbeResult(result) {
  assert.equal(
    result.status,
    0,
    `probe failed with status ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  const line = result.stdout.trim().split(/\r?\n/).at(-1);
  return JSON.parse(line);
}

test('public flight import route is linked and rejects an invalid key', () => {
  const result = runPublicImportProbe({
    suppliedSecret: 'wrong-flight-import-secret',
    payload: { feeds: { all_recent: [] } },
  });
  const response = readProbeResult(result);

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: 'INVALID_FLIGHT_IMPORT_KEY',
      message: 'Invalid flight import key.',
    },
  });
});

test('flight import fails clearly when the server secret is not configured', () => {
  const result = runPublicImportProbe({
    configuredSecret: null,
    suppliedSecret: importSecret,
    payload: { feeds: { all_recent: [] } },
  });
  const response = readProbeResult(result);

  assert.equal(response.status, 503);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, 'FLIGHT_IMPORT_NOT_CONFIGURED');
});

test('authenticated flight import rejects malformed feeds before background persistence', () => {
  const result = runPublicImportProbe({
    suppliedSecret: importSecret,
    payload: { feeds: [] },
  });
  const response = readProbeResult(result);

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, 'INVALID_FLIGHT_IMPORT_PAYLOAD');
});

test('authenticated well-formed flight import is acknowledged before persistence', () => {
  const result = runPublicImportProbe({
    suppliedSecret: importSecret,
    payload: {
      feeds: {
        all_recent: [],
        cancelled_last_24h: [],
        delayed_last_24h: [],
      },
      providerCount: 0,
    },
  });
  const response = readProbeResult(result);

  assert.equal(response.status, 202);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.accepted, true);
  assert.equal(response.body.mode, 'push_https_async');
});

test('the application keeps the larger JSON bound scoped to the flight import route', () => {
  const result = runAppImportSizeProbe(1_100_000);
  const response = readProbeResult(result);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_FLIGHT_IMPORT_KEY');
});

test('oversized flight import bodies return a bounded 413 response', () => {
  const result = runAppImportSizeProbe(5_300_000);
  const response = readProbeResult(result);

  assert.equal(response.status, 413);
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large.',
    },
  });
});

test('admin flight push status remains behind administrator authentication', () => {
  const result = runAdminPushStatusProbe();
  const response = readProbeResult(result);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_REQUIRED');
});

test('the legacy relay setting remains a compatible alias for the provider URL', () => {
  const result = runLegacyRelayConfigProbe();
  const response = readProbeResult(result);

  assert.equal(response.externalFlightsBaseUrl, 'https://flights-api.example.test/api/flights');
});
