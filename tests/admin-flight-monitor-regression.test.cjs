const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const flightCacheSource = fs.readFileSync(
  path.join(repoRoot, 'backend/services/flightCacheService.js'),
  'utf8',
);
const platformControllerSource = fs.readFileSync(
  path.join(repoRoot, 'backend/controllers/platformController.js'),
  'utf8',
);
const adminBundleSource = fs.readFileSync(
  path.join(repoRoot, 'assets/AdminPanel-CmsReadyAdminFix20260820.js'),
  'utf8',
);
const mainBundleSource = fs.readFileSync(
  path.join(repoRoot, 'assets/index-CmsReadyAdminFix20260820.js'),
  'utf8',
);

test('admin flight snapshot queries place the latest scheduled flight first', () => {
  assert.match(
    flightCacheSource,
    /SELECT \* FROM ExternalFlightSnapshot ORDER BY fetchedAt DESC, scheduledTime DESC, flightNumber DESC LIMIT 80/,
  );
  assert.match(
    flightCacheSource,
    /SELECT \* FROM ExternalFlightSnapshot WHERE sourceName = \? AND fetchedAt >= DATE_SUB\(\?, INTERVAL 2 SECOND\) ORDER BY scheduledTime DESC, flightNumber DESC LIMIT 12/,
  );
});

test('dashboard reads the cache summary through its GET refresh path', () => {
  assert.match(platformControllerSource, /getFlightCacheSummary\(\)/);
  assert.match(mainBundleSource, /function Uy\(\)\{return fe\("\/admin\/dashboard",\{headers:je\(\)\}\)\}/);
  assert.match(adminBundleSource, /setInterval\(p,6e4\)/);
});

test('server-side flight refresh keeps the ten-minute provider GET schedule', () => {
  assert.match(flightCacheSource, /const DEFAULT_SYNC_INTERVAL_MS = 10 \* 60 \* 1000;/);
  assert.match(flightCacheSource, /method: 'GET', signal: controller.signal/);
  assert.match(flightCacheSource, /setInterval\(run, intervalMs\)/);
});
