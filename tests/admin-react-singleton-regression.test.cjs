const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const publicHtml = read('index.html');
const adminHtml = read('admin/v2/login/index.html');
const mainBundle = read('assets/index-CmsReadyAdminFix20260820.js');
const adminBundle = read('assets/AdminPanel-CmsReadyAdminFix20260820.js');

const entrySrc = (html) => {
  const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
  assert.ok(match, 'the HTML entry module must be present');
  return match[1];
};

test('public and admin routes load one cache-key-stable React module graph', () => {
  const publicEntry = entrySrc(publicHtml);
  const adminEntry = entrySrc(adminHtml);
  assert.equal(adminEntry, publicEntry, 'admin and public HTML must share the same entry URL');

  const mainAdminImport = mainBundle.match(/import\("(\.\/AdminPanel-CmsReadyAdminFix20260820\.js\?v=[^"]+)"\)/);
  assert.ok(mainAdminImport, 'the main bundle must lazy-load the canonical admin bundle');

  const adminMainImport = adminBundle.match(/}from"(\.\/index-CmsReadyAdminFix20260820\.js\?v=[^"]+)"/);
  assert.ok(adminMainImport, 'the admin bundle must import the canonical main bundle');

  const expectedEntry = '/assets/index-CmsReadyAdminFix20260820.js?v=20260916-claim-assignment-selector-v1';
  const expectedAdmin = './AdminPanel-CmsReadyAdminFix20260820.js?v=20260916-claim-assignment-selector-v1';
  const expectedMain = './index-CmsReadyAdminFix20260820.js?v=20260916-claim-assignment-selector-v1';

  assert.equal(publicEntry, expectedEntry);
  assert.equal(mainAdminImport[1], expectedAdmin);
  assert.equal(adminMainImport[1], expectedMain);
  assert.doesNotMatch(adminBundle, /index-CmsReadyAdminFix20260820\.js\?v=20260825-admin-runtime-fix-v2/);
  assert.doesNotMatch(adminBundle, /index-CmsReadyAdminFix20260820\.js\?v=20260906-rights-cta-v1/);
});
