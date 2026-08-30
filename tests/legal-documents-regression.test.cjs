const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');
const backendRequire = createRequire(path.join(repoRoot, 'backend', 'package.json'));
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('settings schema accepts the passenger-rights field and legacy alias', () => {
  const source = read('backend/validation/platformSchemas.js');

  assert.match(source, /passengerRightsUrl:\s*z\.string\(\)\.trim\(\)\.max\(2000\)\.nullable\(\)\.optional\(\)/);
  assert.match(source, /rightsDocumentUrl:\s*z\.string\(\)\.trim\(\)\.max\(2000\)\.nullable\(\)\.optional\(\)/);
});

test('settings schema parses a rights-only update at runtime', async () => {
  const { updateSettingsSchema } = await import('../backend/validation/platformSchemas.js');
  const result = updateSettingsSchema.safeParse({
    passengerRightsUrl: ' /uploads/cms/rights.pdf ',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.passengerRightsUrl, '/uploads/cms/rights.pdf');
});

test('settings controller persists and exposes the passenger-rights URL', () => {
  const source = read('backend/controllers/platformController.js');

  assert.match(source, /rightsDocumentUrl\s*=\s*\?/);
  assert.match(source, /passengerRightsUrl/);
  assert.match(source, /getPublicLegalDocuments[\s\S]*mapLegalDocumentResponse/);
});

test('PDF fallback MIME values still require a PDF extension and signature', async () => {
  const {
    isSupportedUploadMetadata,
    hasPdfSignature,
  } = await import('../backend/utils/fileValidation.js');

  assert.equal(
    isSupportedUploadMetadata({ originalname: 'rights.pdf', mimetype: 'application/octet-stream' }),
    true,
  );
  assert.equal(
    isSupportedUploadMetadata({ originalname: 'rights.pdf', mimetype: 'image/png' }),
    false,
  );
  assert.equal(hasPdfSignature(Buffer.from('%PDF-1.7\n')), true);
  assert.equal(hasPdfSignature(Buffer.from('not a pdf')), false);
});

test('CMS upload middleware accepts generic PDF MIME values in isolated storage', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'flysos-cms-upload-'));
  const previousEnvironment = {
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
  };

  process.env.DB_NAME = process.env.DB_NAME || 'test';
  process.env.DB_USER = process.env.DB_USER || 'test';
  process.env.UPLOAD_DIR = tempDirectory;

  try {
    const express = backendRequire('express');
    const { cmsUpload } = await import('../backend/middleware/upload.js');
    const app = express();
    app.post('/upload', cmsUpload.single('file'), (req, res) => {
      res.json({ path: req.file.path });
    });
    app.use((error, _req, res, _next) => {
      res.status(error.statusCode || 500).json({ code: error.code || 'UPLOAD_ERROR' });
    });

    const server = await new Promise((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });

    try {
      const form = new FormData();
      form.append(
        'file',
        new Blob([Buffer.from('%PDF-1.7\n')], { type: 'application/octet-stream' }),
        'rights.pdf',
      );
      const response = await fetch(`http://127.0.0.1:${server.address().port}/upload`, {
        method: 'POST',
        body: form,
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.match(payload.path, new RegExp(`${path.sep.replaceAll('\\', '\\\\')}cms${path.sep.replaceAll('\\', '\\\\')}`));
      assert.equal(fs.existsSync(payload.path), true);
      assert.equal(fs.readFileSync(payload.path).subarray(0, 5).toString('ascii'), '%PDF-');
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('legal document mappings bridge legacy and canonical storage names', async () => {
  const {
    normalizeLegalDocumentUrls,
    resolveLegalDocumentUrls,
  } = await import('../backend/utils/legalDocument.js');

  assert.deepEqual(
    normalizeLegalDocumentUrls({
      powerOfAttorneyUrl: null,
      powerOfAttorneyDocumentUrl: '/uploads/legacy-power.pdf',
      rightsDocumentUrl: null,
      passengerRightsUrl: '/uploads/legacy-rights.pdf',
    }),
    {
      powerOfAttorneyUrl: '/uploads/legacy-power.pdf',
      passengerRightsUrl: '/uploads/legacy-rights.pdf',
    },
  );

  assert.deepEqual(
    resolveLegalDocumentUrls(
      { passengerRightsUrl: '/uploads/new-rights.pdf' },
      { rightsDocumentUrl: '/uploads/old-rights.pdf' },
    ),
    {
      powerOfAttorneyUrl: '',
      passengerRightsUrl: '/uploads/new-rights.pdf',
    },
  );

  assert.deepEqual(
    normalizeLegalDocumentUrls({
      rightsDocumentUrl: '',
      passengerRightsUrl: '/uploads/legacy-rights.pdf',
    }),
    {
      powerOfAttorneyUrl: '',
      passengerRightsUrl: '',
    },
  );
});

test('public upload serving is scoped to CMS media', () => {
  const source = read('backend/app.js');
  const cmsController = read('backend/controllers/cmsController.js');

  assert.match(source, /['"]\/uploads\/cms['"][\s\S]*express\.static/);
  assert.match(source, /['"]\/api\/uploads\/cms['"][\s\S]*express\.static/);
  assert.match(source, /app\.get\(['"]\/api\/uploads\/:filename['"]/);
  assert.doesNotMatch(source, /app\.use\(['"]\/uploads['"]\s*,\s*express\.static\(/);
  assert.match(cmsController, /SELECT [`"]filename[`"],[`"]mimetype[`"] FROM [`"]CmsMedia[`"] WHERE [`"]filename[`"]=\?/);
  assert.match(cmsController, /path\.relative\(uploadRoot, candidate\)/);
});

test('CMS route uses the CMS-specific upload middleware', () => {
  const source = read('backend/routes/adminRoutes.js');

  assert.match(source, /cmsUpload\.single\(['"]file['"]\)/);
});

test('legal migration is idempotent and preserves legacy document values', () => {
  const source = read('backend/scripts/runLegalDocumentsMigration.js');

  assert.match(source, /addColumn\(connection, 'AppSetting', 'powerOfAttorneyUrl'/);
  assert.match(source, /addColumn\(connection, 'AppSetting', 'rightsDocumentUrl'/);
  assert.match(source, /COALESCE\(powerOfAttorneyUrl, powerOfAttorneyDocumentUrl\)/);
  assert.match(source, /COALESCE\(rightsDocumentUrl, passengerRightsUrl\)/);
});

test('active browser bundles preserve the passenger-rights flow', () => {
  const entryHtml = read('index.html');
  const adminEntryHtml = read('admin/v2/login/index.html');
  const publicBundle = read('assets/index-CmsReadyAdminFix20260820.js');
  const adminBundle = read('assets/AdminPanel-CmsReadyAdminFix20260820.js');

  assert.match(entryHtml, /index-CmsReadyAdminFix20260820\.js/);
  assert.match(adminEntryHtml, /index-CmsReadyAdminFix20260820\.js/);
  assert.match(publicBundle, /AdminPanel-CmsReadyAdminFix20260820/);
  assert.match(publicBundle, /uc\(\)\.then\([^)]*passengerRightsUrl/);
  assert.match(publicBundle, /startsWith\(['"]\/uploads\/['"]\)\?`\/api\$\{c\}`/);
  assert.match(adminBundle, /title:"آیین‌نامه حقوق مسافر"/);
  assert.match(adminBundle, /passengerRightsUrl:S\.url/);
});
