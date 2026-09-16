const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('claims table exposes an inline responsible-expert selector wired to the existing assignment mutation', () => {
  const adminBundle = read('assets/AdminPanel-CmsReadyAdminFix20260820.js');

  assert.match(
    adminBundle,
    /h&&\(q==="experts"\|\|q==="claims"\)&&qj\(\)\.then\(Ce\)/,
    'the claims page must load the existing expert list before rendering assignment controls',
  );
  assert.match(adminBundle, /value:p\.assignedAdminId\|\|""/);
  assert.match(adminBundle, /onClick:P=>P\.stopPropagation\(\)/);
  assert.match(
    adminBundle,
    /onChange:P=>\{P\.stopPropagation\(\);void Oj\(p\.id,P\.target\.value\)\}/,
  );
  assert.match(
    adminBundle,
    /pe\.filter\(P=>P\.status==="active"\|\|P\.id===p\.assignedAdminId\)\.map\(P=>/,
  );
  assert.match(adminBundle, /children:"بدون تخصیص"/);
  assert.match(adminBundle, /assignedAdminId:null/);
});

test('responsible-expert assignment keeps the existing nullable backend contract', async () => {
  const { updateClaimSchema } = await import('../backend/validation/adminSchemas.js');

  assert.equal(updateClaimSchema.safeParse({ assignedAdminId: 'admin-1' }).success, true);
  assert.equal(updateClaimSchema.safeParse({ assignedAdminId: null }).success, true);
  assert.equal(updateClaimSchema.safeParse({ assignedAdminId: '' }).success, true);
});
