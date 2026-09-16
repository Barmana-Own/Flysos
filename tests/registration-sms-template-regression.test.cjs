const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

process.env.DB_NAME ||= 'registration_sms_template_regression';
process.env.DB_USER ||= 'registration_sms_template_regression';

test('registration SMS template has a safe default and renders the tracking code', async () => {
  const {
    DEFAULT_SMS_TEMPLATES,
    renderSmsTemplate,
  } = await import('../backend/services/smsTemplateService.js');

  assert.match(DEFAULT_SMS_TEMPLATES.registration, /\{trackingCode\}/u);
  assert.match(
    renderSmsTemplate(DEFAULT_SMS_TEMPLATES.registration, { trackingCode: 'FS134553' }),
    /FS134553/u,
  );
  assert.doesNotMatch(
    renderSmsTemplate(DEFAULT_SMS_TEMPLATES.registration, { trackingCode: 'FS134553' }),
    /\{trackingCode\}/u,
  );
});

test('settings contract and registration notification use the registration template', async () => {
  const { updateSettingsSchema } = await import('../backend/validation/platformSchemas.js');
  const result = updateSettingsSchema.safeParse({
    smsTemplates: { registration: 'پرونده {trackingCode} ثبت شد.' },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.smsTemplates.registration, 'پرونده {trackingCode} ثبت شد.');

  const source = fs.readFileSync(
    path.join(repoRoot, 'backend/services/claimNotificationJobService.js'),
    'utf8',
  );
  assert.match(source, /renderTemplate\('registration'/u);
});

test('active admin settings bundle exposes an editable registration SMS template', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'assets/AdminPanel-CmsReadyAdminFix20260820.js'),
    'utf8',
  );

  assert.match(source, /smsTemplates:\{[^}]*registration:/u);
  assert.match(source, /\[\["registration","پیام ثبت پرونده"\]/u);
});

test('admin entrypoints use the cache key for the registration template bundle', () => {
  const expectedVersion = '20260916-claim-assignment-selector-v1';
  const files = [
    'index.html',
    'admin/v2/login/index.html',
    'assets/index-CmsReadyAdminFix20260820.js',
    'assets/AdminPanel-CmsReadyAdminFix20260820.js',
  ];

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    assert.ok(source.includes(`?v=${expectedVersion}`), relativePath);
  }
});
