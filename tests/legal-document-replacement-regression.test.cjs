const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('legal document replacement resolves only supported document slots', async () => {
  const {
    resolveLegalDocumentDefinition,
  } = await import('../backend/services/legalDocumentReplacementService.js');

  assert.equal(
    resolveLegalDocumentDefinition({ documentKey: 'passengerRights' }).settingColumn,
    'rightsDocumentUrl',
  );
  assert.equal(
    resolveLegalDocumentDefinition({ title: 'آیین‌نامه حقوق مسافر' }).settingColumn,
    'rightsDocumentUrl',
  );
  assert.equal(
    resolveLegalDocumentDefinition({ title: 'نمونه وکالت‌نامه رسمی' }).settingColumn,
    'powerOfAttorneyUrl',
  );
  assert.equal(resolveLegalDocumentDefinition({ title: 'تصویر عمومی' }), null);
});

test('replaced document cleanup is confined to the configured upload directory', async () => {
  const {
    resolveManagedUploadPath,
    removeManagedUploadFile,
  } = await import('../backend/services/legalDocumentReplacementService.js');
  const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'flysos-legal-replace-'));

  try {
    const oldPath = path.join(uploadDirectory, 'cms', 'old-rights.pdf');
    fs.mkdirSync(path.dirname(oldPath), { recursive: true });
    fs.writeFileSync(oldPath, '%PDF-1.7\n');
    const oldRootPath = path.join(uploadDirectory, 'old-power-of-attorney.pdf');
    fs.writeFileSync(oldRootPath, '%PDF-1.7\n');

    assert.equal(
      resolveManagedUploadPath('/uploads/cms/old-rights.pdf', uploadDirectory),
      oldPath,
    );
    assert.equal(resolveManagedUploadPath('https://example.com/old.pdf', uploadDirectory), null);
    assert.equal(resolveManagedUploadPath('https://example.com/uploads/cms/old-rights.pdf', uploadDirectory), null);
    assert.equal(resolveManagedUploadPath('/uploads/cms/%2e%2e/secret.pdf', uploadDirectory), null);

    const result = await removeManagedUploadFile(oldPath, uploadDirectory);
    assert.deepEqual(result, { removed: true });
    assert.equal(fs.existsSync(oldPath), false);

    const rootResult = await removeManagedUploadFile(oldRootPath, uploadDirectory);
    assert.deepEqual(rootResult, { removed: true });
    assert.equal(fs.existsSync(oldRootPath), false);
  } finally {
    fs.rmSync(uploadDirectory, { recursive: true, force: true });
  }
});

test('CMS legal uploads update the setting transactionally and clean the old file after commit', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'backend/controllers/cmsController.js'),
    'utf8',
  );
  const serviceSource = fs.readFileSync(
    path.join(__dirname, '..', 'backend/services/legalDocumentReplacementService.js'),
    'utf8',
  );

  assert.match(source, /resolveLegalDocumentDefinition/);
  assert.match(source, /await transaction\(async \(tx\) =>/);
  assert.match(source, /UPDATE .*AppSetting.*SET/);
  assert.match(source, /await cleanupReplacedLegalDocument/);
  assert.match(source, /committed = true/);
  assert.match(source, /if \(replacement\.settingsUpdated\)/);
  assert.match(source, /INVALID_LEGAL_DOCUMENT/);
  assert.equal(source.includes('return `/api/uploads/${relative}`'), true);
  assert.match(serviceSource, /fs\.realpath\(uploadRoot\)/);
  assert.match(serviceSource, /stats\.isSymbolicLink\(\)/);
});
