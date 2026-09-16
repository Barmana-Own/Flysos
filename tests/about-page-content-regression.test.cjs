const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('about page canonical content matches the public page and includes an editable CTA', async () => {
  const {
    getCanonicalAboutBlocks,
    normalizeAboutBlocks,
    normalizeAboutSeo,
    normalizeAboutTitle,
  } = await import('../backend/services/aboutPageContentService.js');

  const blocks = getCanonicalAboutBlocks();
  assert.deepEqual(blocks.map((block) => block.id), [
    'about-hero',
    'about-advantages',
    'about-mission',
    'about-difference',
    'about-cta',
  ]);
  assert.equal(blocks[0].content.subtitle, 'درباره Flysos.ir');
  assert.match(blocks[0].content.description, /اولین و بزرگ‌ترین پلتفرم تخصصی احقاق حقوق مسافران هوایی/u);
  assert.equal(blocks[1].content.items.length, 4);
  assert.equal(blocks[1].content.items[1].description, 'سابقه همکاری مستقیم یا مشاوره به سازمان هواپیمایی کشوری، سازمان حمایت از حقوق مصرف کنندگان، سازمان بازرسی کل کشور و کانون کارشناسان رسمی.');
  assert.equal(blocks[2].content.title, 'ماموریت ما در Flysos.ir');
  assert.match(blocks[2].content.text, /مجهزترین ابزارهای قانونی و سیستم‌های مکانیزه آنلاین/u);
  assert.equal(blocks[3].content.items.length, 3);
  assert.equal(blocks[4].content.primaryLabel, 'ثبت درخواست دریافت خسارت');
  assert.equal(blocks[4].content.secondaryUrl, '/rights');

  assert.equal(normalizeAboutTitle(''), 'درباره ما');
  assert.equal(normalizeAboutSeo({}).canonical, 'https://flysos.ir/about/');
  assert.deepEqual(normalizeAboutBlocks(blocks), blocks);
});

test('about normalization upgrades legacy defaults without discarding real editor changes', async () => {
  const { getCanonicalAboutBlocks, normalizeAboutBlocks } = await import('../backend/services/aboutPageContentService.js');
  const canonical = getCanonicalAboutBlocks();
  const legacy = [
    {
      ...canonical[0],
      content: {
        ...canonical[0].content,
        subtitle: 'درباره flysos.ir',
        description: 'flysos.ir به عنوان پلتفرم تخصصی احقاق حقوق مسافران هوایی با تلفیق دانش حقوقی، تجربه هوانوردی و فناوری اطلاعات فعالیت می‌کند.',
      },
    },
    {
      ...canonical[1],
      content: {
        ...canonical[1].content,
        title: 'عنوان سفارشی مدیر',
        items: canonical[1].content.items.map((item, index) => index === 0
          ? { ...item, description: 'توضیح سفارشی مدیر' }
          : item),
      },
    },
    {
      ...canonical[2],
      content: {
        ...canonical[2].content,
        title: 'ماموریت ما در flysos.ir',
        text: 'ماموریت ما ترویج آگاهی از حقوق مسافر و تسریع دریافت غرامت‌های قانونی است.',
      },
    },
    canonical[3],
  ];

  const normalized = normalizeAboutBlocks(legacy);

  assert.deepEqual(normalized.map((block) => block.id), canonical.map((block) => block.id));
  assert.equal(normalized[0].content.subtitle, 'درباره Flysos.ir');
  assert.equal(normalized[0].content.description, canonical[0].content.description);
  assert.equal(normalized[1].content.title, 'عنوان سفارشی مدیر');
  assert.equal(normalized[1].content.items[0].description, 'توضیح سفارشی مدیر');
  assert.equal(normalized[2].content.title, 'ماموریت ما در Flysos.ir');
  assert.equal(normalized[4].content.primaryLabel, 'ثبت درخواست دریافت خسارت');
});

test('about normalization is scoped and the CMS controller applies it to admin and public paths', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'controllers', 'cmsController.js'),
    'utf8',
  );

  assert.match(source, /normalizeAboutBlocks/u);
  assert.match(source, /normalizeAboutBlocks\(storedBlocks, slug\)/u);
  assert.match(source, /normalizeAboutSeo\(storedSeo\)/u);
  assert.match(source, /incomingDraftBlocks[\s\S]{0,260}normalizeAboutBlocks\(incomingDraftBlocks, slug\)/u);
  assert.match(source, /incomingDraftBlocks = cleanBlockList\(draftBlocksFrom\(existing, true\)\)[\s\S]{0,260}normalizeAboutBlocks\(incomingDraftBlocks, existing\.slug\)/u);
  assert.match(source, /\['rights', 'about'\]\.includes\(slug\)[\s\S]{0,180}Cache-Control[\s\S]{0,120}no-store/u);
});
