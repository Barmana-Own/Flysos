const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('terms page exposes complete editable CMS content and SEO defaults', async () => {
  const {
    getCanonicalTermsBlocks,
    normalizeTermsBlocks,
    normalizeTermsSeo,
    normalizeTermsTitle,
  } = await import('../backend/services/termsPageContentService.js');

  const blocks = getCanonicalTermsBlocks();
  assert.deepEqual(blocks.map((item) => item.id), ['rules-main']);
  assert.equal(blocks[0].type, 'accordion');
  assert.equal(blocks[0].content.items.length, 7);
  assert.equal(blocks[0].content.items[0].question, 'تعاریف و کلیات');
  assert.equal(blocks[0].content.items[6].question, 'محرمانگی اطلاعات');
  assert.equal(normalizeTermsTitle(''), 'شرایط و ضوابط خدمات');
  assert.equal(normalizeTermsSeo({}).canonical, 'https://flysos.ir/terms/');
  assert.deepEqual(normalizeTermsBlocks(blocks), blocks);
});
test('terms normalization adds missing canonical items without discarding editor changes', async () => {
  const { getCanonicalTermsBlocks, normalizeTermsBlocks } = await import('../backend/services/termsPageContentService.js');
  const canonical = getCanonicalTermsBlocks();
  const saved = [{
    ...canonical[0],
    content: {
      ...canonical[0].content,
      title: 'عنوان ویرایش‌شده توسط مدیر',
      items: [{ ...canonical[0].content.items[0], answer: 'متن سفارشی مدیر' }],
    },
  }, {
    id: 'terms-custom-note',
    type: 'paragraph',
    content: { text: 'یادداشت سفارشی مدیر' },
  }];

  const normalized = normalizeTermsBlocks(saved, 'terms');
  const main = normalized.find((item) => item.id === 'rules-main');

  assert.equal(main.content.title, 'عنوان ویرایش‌شده توسط مدیر');
  assert.equal(main.content.items[0].answer, 'متن سفارشی مدیر');
  assert.equal(main.content.items.length, 7);
  assert.equal(normalized.some((item) => item.id === 'terms-custom-note'), true);
});

test('terms normalization is scoped and the CMS controller exposes the terms alias', async () => {
  const { normalizeTermsBlocks } = await import('../backend/services/termsPageContentService.js');
  const otherPageBlocks = [{ id: 'about-custom', type: 'paragraph', content: { text: 'محتوای سفارشی' } }];
  assert.strictEqual(normalizeTermsBlocks(otherPageBlocks, 'about'), otherPageBlocks);

  const controller = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'controllers', 'cmsController.js'),
    'utf8',
  );
  const seed = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'services', 'cmsSeedService.js'),
    'utf8',
  );

  assert.match(controller, /normalizeTermsBlocks/u);
  assert.match(controller, /normalizeTermsSeo/u);
  assert.match(controller, /slug === 'rules' \? 'terms' : slug/u);
  assert.match(controller, /\['terms', 'rules'\]\.includes\(requestedSlug\)/u);
  assert.match(controller, /canonicalPublicPageSlug\(cleanSlug\(req\.body\?\.slug\)\)/u);
  assert.match(seed, /terms:\s*\[block\('rules-main'/u);
  assert.match(seed, /ensureTermsPage/u);
  assert.match(seed, /terms-public-content-unification-v1/u);
});
