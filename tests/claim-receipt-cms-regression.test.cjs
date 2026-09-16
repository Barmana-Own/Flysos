const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('stage-four receipt content is editable through the track CMS block', async () => {
  const {
    CLAIM_RECEIPT_CONTENT,
    RECEIPT_CONTENT_KEY,
    normalizeTrackBlocks,
  } = await import('../backend/services/claimReceiptContentService.js');

  const saved = [
    {
      id: 'track-success',
      type: 'section',
      order: 0,
      visible: true,
      content: {
        successTitle: 'عنوان موفقیت سفارشی',
        [RECEIPT_CONTENT_KEY]: {
          'عنوان رسید': 'رسید سفارشی مدیر',
          'برچسب کد ملی مسافر': 'شماره ملی مسافر',
        },
      },
      children: [],
    },
    { id: 'track-custom', type: 'paragraph', order: 1, content: { text: 'محتوای سفارشی' }, children: [] },
  ];

  const normalized = normalizeTrackBlocks(saved);
  const receipt = normalized[0].content[RECEIPT_CONTENT_KEY];

  assert.equal(receipt['عنوان رسید'], 'رسید سفارشی مدیر');
  assert.equal(receipt['برچسب کد ملی مسافر'], 'شماره ملی مسافر');
  assert.equal(receipt['نام سامانه'], CLAIM_RECEIPT_CONTENT['نام سامانه']);
  assert.equal(receipt['وضعیت اولیه پرونده'], CLAIM_RECEIPT_CONTENT['وضعیت اولیه پرونده']);
  assert.equal(normalized[0].content.successTitle, 'عنوان موفقیت سفارشی');
  assert.equal(normalized[1].content.text, 'محتوای سفارشی');
  assert.equal(normalizeTrackBlocks(saved, 'home'), saved);
});

test('receipt CMS is wired to admin/public normalization and the generated canvas', () => {
  const controller = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'controllers', 'cmsController.js'),
    'utf8',
  );
  const seed = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'services', 'cmsSeedService.js'),
    'utf8',
  );
  const publicHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const receiptScript = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'claim-receipt-cms-content-20260915.js'),
    'utf8',
  );

  assert.match(controller, /normalizeTrackBlocks/u);
  assert.match(controller, /row\.slug === 'track'/u);
  assert.match(controller, /slug === 'track'\s*\n?\s*\?/u);
  assert.match(seed, /RECEIPT_CONTENT_KEY/u);
  assert.match(seed, /editable-track-receipt-content-v1/u);
  assert.match(publicHtml, /claim-receipt-cms-content-20260915\.js\?v=20260915-claim-receipt-v1/u);
  assert.match(publicHtml, /claim-receipt-cms-content-20260915\.js[\s\S]*index-CmsReadyAdminFix20260820\.js/u);
  assert.match(receiptScript, /\/api\/pages\/track/u);
  assert.match(receiptScript, /750\s*&&\s*canvas\.height\s*===\s*980/u);
  assert.match(receiptScript, /کد پیگیری اختصاصی پرونده شما/u);
  assert.match(receiptScript, /تعهد رسمی تیم تخصصی Flysos\.ir/u);
  assert.match(receiptScript, /Flysos\.ir \| Air Passenger Rights Specialists/u);
});
