const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bundlePath = path.join(__dirname, '..', 'assets', 'index-CmsReadyAdminFix20260820.js');

test('rights public CTA reads its label from the CMS hero block', () => {
  const bundle = fs.readFileSync(bundlePath, 'utf8');

  assert.match(
    bundle,
    /Se\(y,"primaryLabel","دانلود آیین‌نامه رسمی حقوق مسافر"\)/,
    'the rights hero CTA should use the CMS primaryLabel value with a fallback',
  );
  assert.doesNotMatch(
    bundle,
    /children:"دانلود آیین‌نامه رسمی حقوق مسافر"/,
    'the public CTA must not render a hard-coded label',
  );
});
