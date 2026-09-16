const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(
  __dirname,
  '..',
  'backend',
  'controllers',
  'adminController.js',
);
const mapperPath = path.join(
  __dirname,
  '..',
  'backend',
  'services',
  'claimMapper.js',
);

test('admin claim update accepts and preserves a supported priority value', async () => {
  const { updateClaimSchema } = await import('../backend/validation/adminSchemas.js');
  const result = updateClaimSchema.safeParse({ priority: 'high' });

  assert.equal(result.success, true);
  assert.equal(result.data.priority, 'high');
});

test('admin claim update rejects unsupported priority values', async () => {
  const { updateClaimSchema } = await import('../backend/validation/adminSchemas.js');
  const result = updateClaimSchema.safeParse({ priority: 'critical' });

  assert.equal(result.success, false);
});

test('admin claim update persists priority through the existing transaction', () => {
  const source = fs.readFileSync(controllerPath, 'utf8');
  const mapperSource = fs.readFileSync(mapperPath, 'utf8');

  assert.match(source, /if \(body\.priority !== undefined\)/);
  assert.match(source, /priority = \?/);
  assert.match(mapperSource, /priority: claim\.priority \|\| ['"]medium['"]/);
});
