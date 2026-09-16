const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..', 'backend');

function runSchedulerConfigProbe({ enabled, interval }) {
  const script = String.raw`
    process.env.DB_NAME = 'flight_scheduler_regression';
    process.env.DB_USER = 'flight_scheduler_regression';
    process.env.DB_PASSWORD = '';
    process.env.FLIGHT_CACHE_ENABLED = ${JSON.stringify(enabled)};
    process.env.FLIGHT_CACHE_INTERVAL_MS = ${JSON.stringify(interval)};

    const { getFlightCacheSchedulerConfig } = await import('./services/flightCacheService.js');
    console.log(JSON.stringify(getFlightCacheSchedulerConfig()));
  `;

  return spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: backendRoot,
      env: { ...process.env },
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
}

function readProbe(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const line = result.stdout.trim().split(/\r?\n/).at(-1);
  return JSON.parse(line);
}

test('flight cache scheduler honors the ten-minute production interval', () => {
  const result = runSchedulerConfigProbe({ enabled: 'true', interval: '600000' });
  assert.deepEqual(readProbe(result), { enabled: true, intervalMs: 600000 });
});

test('flight cache scheduler can be disabled without changing its interval policy', () => {
  const result = runSchedulerConfigProbe({ enabled: 'false', interval: '600000' });
  assert.deepEqual(readProbe(result), { enabled: false, intervalMs: 600000 });
});

test('flight cache scheduler rejects intervals below one minute and uses ten minutes', () => {
  const result = runSchedulerConfigProbe({ enabled: 'true', interval: '59999' });
  assert.deepEqual(readProbe(result), { enabled: true, intervalMs: 600000 });
});
