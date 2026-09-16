const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('public legal settings expose the configured Goftino widget id', async () => {
  const { mapLegalDocumentResponse } = await import('../backend/utils/legalDocument.js');
  const response = mapLegalDocumentResponse({ goftinoWidgetId: 'abc_123' });

  assert.equal(response.goftinoWidgetId, 'abc_123');
});

test('public legal settings can use the configured environment fallback without a database write', async () => {
  const { mapLegalDocumentResponse } = await import('../backend/utils/legalDocument.js');
  const response = mapLegalDocumentResponse({}, '4ehzFt');

  assert.equal(response.goftinoWidgetId, '4ehzFt');
});

test('settings schema accepts a Goftino widget id update', async () => {
  const { updateSettingsSchema } = await import('../backend/validation/platformSchemas.js');
  const result = updateSettingsSchema.safeParse({ goftinoWidgetId: 'abc_123' });

  assert.equal(result.success, true);
  assert.equal(result.data.goftinoWidgetId, 'abc_123');
});

test('settings persistence checks the existing column without running a migration', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'backend/controllers/platformController.js'),
    'utf8',
  );

  assert.match(source, /hasGoftinoWidgetColumn/);
  assert.match(source, /goftinoWidgetId\s*=\s*\?/);
  assert.doesNotMatch(source, /ALTER TABLE AppSetting ADD COLUMN goftinoWidgetId/);
});
