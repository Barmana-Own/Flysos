const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('rights page fallback supplies complete editable content and download CTA', async () => {
  const {
    getCanonicalRightsBlocks,
    normalizeRightsBlocks,
    normalizeRightsSeo,
  } = await import('../backend/services/rightsPageContentService.js');

  const blocks = getCanonicalRightsBlocks();
  assert.deepEqual(
    blocks.map((block) => block.id),
    [
      'rights-hero',
      'rights-principles',
      'rights-delays',
      'rights-delays-international',
      'rights-faq',
    ],
  );
  assert.equal(blocks[0].content.primaryLabel, 'دانلود آیین‌نامه رسمی حقوق مسافر');
  assert.match(blocks[0].content.primaryUrl, /^https:\/\/regulations\.caa\.ir\//u);
  assert.equal(blocks[0].content.title, 'آیین‌نامه حقوق مسافر در پروازهای داخلی و خارجی');
  assert.equal(blocks[1].content.title, 'اصول کلی حقوق مسافر هوایی');
  assert.equal(blocks[1].content.items[0].description, 'ارائه اطلاعات دقیق، به‌موقع و قابل دسترس در تمامی مراحل سفر و فرآیند خرید بلیت.');
  assert.equal(blocks[2].content.items[1].question, 'بین ۲ ساعت تا ۵ ساعت');
  assert.match(blocks[2].content.items[1].answer, /پرداخت غرامت معادل ۳۰٪ قیمت بلیت/u);
  assert.equal(blocks[3].content.items[0].question, 'کمتر از ۳ ساعت');
  assert.match(blocks[4].content.items[0].question, /فورس ماژور/u);
  assert.equal(normalizeRightsBlocks([{ id: 'rights-hero', content: { title: '????' } }])[0].id, 'rights-hero');
  assert.equal(normalizeRightsBlocks(blocks), blocks);
  assert.equal(normalizeRightsSeo({ metaTitle: '????' }).metaTitle, 'آیین‌نامه حقوق مسافر در پروازهای داخلی و خارجی | Flysos');

  const corrupted = structuredClone(blocks);
  corrupted[0].content.primaryLabel += ' تصدنهثسصبدصن';
  assert.equal(
    normalizeRightsBlocks(corrupted)[0].content.primaryLabel,
    'دانلود آیین‌نامه رسمی حقوق مسافر',
  );
});

test('rights normalization preserves edits when a saved block is incomplete', async () => {
  const { getCanonicalRightsBlocks, normalizeRightsBlocks } = await import('../backend/services/rightsPageContentService.js');
  const canonical = getCanonicalRightsBlocks();
  const partial = [
    {
      ...canonical[0],
      content: {
        ...canonical[0].content,
        title: 'عنوان ویرایش‌شده حقوق مسافر',
      },
    },
    canonical[1],
  ];

  const normalized = normalizeRightsBlocks(partial);

  assert.deepEqual(normalized.map((block) => block.id), canonical.map((block) => block.id));
  assert.equal(normalized[0].content.title, 'عنوان ویرایش‌شده حقوق مسافر');
  assert.equal(normalized[2].content.items[1].question, 'بین ۲ ساعت تا ۵ ساعت');
});

test('rights normalization is scoped and does not rewrite other page content', async () => {
  const { normalizeRightsBlocks } = await import('../backend/services/rightsPageContentService.js');
  const otherPageBlocks = [{ id: 'about-custom', type: 'paragraph', content: { text: 'محتوای سفارشی' } }];

  assert.strictEqual(normalizeRightsBlocks(otherPageBlocks, 'about'), otherPageBlocks);
  assert.deepEqual(normalizeRightsBlocks(otherPageBlocks, 'rights').map((block) => block.id), [
    'rights-hero',
    'rights-principles',
    'rights-delays',
    'rights-delays-international',
    'rights-faq',
  ]);
});

test('CMS controller applies the repair only to the rights slug', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'controllers', 'cmsController.js'),
    'utf8',
  );

  assert.match(source, /!\['rights', 'about'\]\.includes\(row\.slug\)/u);
  assert.match(source, /normalizeRightsBlocks\(storedBlocks, slug\)/u);
  assert.match(source, /normalizeRightsSeo\(storedSeo\)/u);
  assert.match(source, /incomingDraftBlocks[\s\S]{0,260}normalizeRightsBlocks\(incomingDraftBlocks, slug\)/u);
  assert.match(source, /incomingDraftBlocks = cleanBlockList\(draftBlocksFrom\(existing, true\)\)[\s\S]{0,260}normalizeRightsBlocks\(incomingDraftBlocks, existing\.slug\)/u);
  assert.match(source, /\['rights', 'about'\]\.includes\(slug\)[\s\S]{0,180}Cache-Control[\s\S]{0,120}no-store/u);
});
