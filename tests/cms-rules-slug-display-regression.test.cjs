const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const bundlePath = path.join(
  __dirname,
  '..',
  'assets',
  'AdminPanel-CmsReadyAdminFix20260820.js',
);

test('admin content summary displays the public terms path for the internal rules slug', () => {
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  const summaryStart = bundle.indexOf('children:["/",(l==null?void 0:l.slug)');

  assert.notEqual(summaryStart, -1, 'content summary slug renderer was not found');
  const summary = bundle.slice(summaryStart, summaryStart + 260);
  assert.match(summary, /\(l==null\?void 0:l\.slug\)==="rules"\?"terms"/u);
});
