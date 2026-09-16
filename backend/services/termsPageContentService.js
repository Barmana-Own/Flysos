const TERMS_PAGE_TITLE = 'شرایط و ضوابط خدمات';

const TERMS_PAGE_SEO = Object.freeze({
  metaTitle: 'شرایط و ضوابط خدمات | Flysos',
  metaDescription: 'شرایط استفاده از خدمات Flysos.ir، تعهدات مسافر، حق‌الزحمه، محرمانگی و نحوه پیگیری حقوق پرواز.',
  keywords: 'شرایط و ضوابط Flysos, قوانین خدمات, حقوق مسافر, پیگیری خسارت پرواز',
  category: 'قوانین و شرایط',
  tags: 'Flysos, شرایط خدمات, حقوق مسافر',
  canonical: 'https://flysos.ir/terms/',
  robotsIndex: true,
  robotsFollow: true,
  openGraphTitle: 'شرایط و ضوابط خدمات | Flysos',
  openGraphDescription: 'چارچوب حقوقی همکاری مسافر و Flysos.ir برای پیگیری حقوق و خسارت پرواز.',
  openGraphImage: '',
});

function block(id, type, order, content, styles) {
  return {
    id,
    type,
    order,
    visible: true,
    content,
    styles,
    settings: {},
    animations: { type: 'none', delay: 0, duration: 500 },
    responsive: {},
    children: [],
  };
}

const canonicalTermsItems = [
  ['تعاریف و کلیات', 'این توافق‌نامه قرارداد حقوقی میان مسافر و flysos.ir و منطبق با قوانین جمهوری اسلامی ایران و آیین‌نامه‌های سازمان هواپیمایی کشوری است.'],
  ['حوزه خدمات و نحوه پیگیری', 'خدمات شامل استعلام پرواز، تطبیق تاخیر، ثبت دادخواست، پیگیری قضایی و وصول غرامت است.'],
  ['وکالت و وکلای پایه یک دادگستری', 'ثبت نهایی پرونده منوط به تایید وکالت‌نامه رسمی در سامانه ثنا توسط مسافر است.'],
  ['حق‌الزحمه و نحوه تقسیم خسارت', 'هیچ هزینه اولیه‌ای دریافت نمی‌شود؛ پس از موفقیت ۲۰٪ کارمزد و ۸۰٪ سهم مسافر است.'],
  ['تعهدات مسافر', 'مسافر باید اطلاعات هویتی، پرواز و اسناد را مطابق واقعیت ارائه کند.'],
  ['قطع همکاری و انصراف', 'تا پیش از ثبت دادخواست و تایید وکالت ثنا، انصراف بدون جریمه امکان‌پذیر است.'],
  ['محرمانگی اطلاعات', 'اطلاعات هویتی و مدارک صرفاً برای پیگیری حقوقی استفاده و محرمانه نگهداری می‌شوند.'],
].map(([question, answer], index) => ({
  id: `rules-${index + 1}`,
  question,
  answer,
}));

const canonicalTermsBlocks = [
  block(
    'rules-main',
    'accordion',
    0,
    {
      title: 'شرایط و ضوابط خدمات flysos.ir',
      description: 'چارچوب حقوقی همکاری بین مسافر و flysos.ir',
      items: canonicalTermsItems,
    },
    { background: '#f8fafc', padding: '64px 24px' },
  ),
];

function isPlainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function containsCorruptedText(value) {
  if (typeof value === 'string') return /\?{2,}|�|تصدنهثسصبدصن|(?:ط§ط|ط±ط|ط¨ط|طµط|ط¯ط|ظ…ط|أ¢â‚¬)/u.test(value);
  if (Array.isArray(value)) return value.some(containsCorruptedText);
  if (value && typeof value === 'object') return Object.values(value).some(containsCorruptedText);
  return false;
}

function mergeTermsValue(base, override) {
  if (override === undefined) return structuredClone(base);
  if (typeof override === 'string' && containsCorruptedText(override)) return structuredClone(base);

  if (Array.isArray(base) && Array.isArray(override)) {
    const baseItemsHaveIds = base.every((item) => isPlainRecord(item) && typeof item.id === 'string');
    const overrideItemsHaveIds = override.every((item) => isPlainRecord(item) && typeof item.id === 'string');
    if (baseItemsHaveIds && overrideItemsHaveIds) {
      const overridesById = new Map(override.map((item) => [item.id, item]));
      const baseIds = new Set(base.map((item) => item.id));
      return [
        ...base.map((item) => overridesById.has(item.id)
          ? mergeTermsValue(item, overridesById.get(item.id))
          : structuredClone(item)),
        ...override.filter((item) => !baseIds.has(item.id)).map((item) => structuredClone(item)),
      ];
    }
    return structuredClone(override);
  }

  if (isPlainRecord(base) && isPlainRecord(override)) {
    const merged = structuredClone(base);
    for (const [key, value] of Object.entries(override)) merged[key] = mergeTermsValue(base[key], value);
    return merged;
  }

  return structuredClone(override);
}

function hasRequiredTermsBlock(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  return blocks.some((item) => item?.id === 'rules-main');
}

export function getCanonicalTermsBlocks() {
  return structuredClone(canonicalTermsBlocks);
}

export function normalizeTermsBlocks(blocks, slug = 'terms') {
  if (!['terms', 'rules'].includes(slug)) return blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return getCanonicalTermsBlocks();

  const storedBlocks = blocks.filter((item) => isPlainRecord(item) && typeof item.id === 'string');
  if (storedBlocks.length === 0) return getCanonicalTermsBlocks();

  const storedMain = storedBlocks.find((item) => item.id === 'rules-main');
  if (hasRequiredTermsBlock(storedBlocks) && !containsCorruptedText(storedBlocks)) {
    const canonicalMain = canonicalTermsBlocks[0];
    const normalizedMain = mergeTermsValue(canonicalMain, storedMain);
    return storedBlocks.map((item) => item.id === 'rules-main' ? normalizedMain : structuredClone(item));
  }

  const storedById = new Map(storedBlocks.map((item) => [item.id, item]));
  const merged = canonicalTermsBlocks.map((canonical) => storedById.has(canonical.id)
    ? mergeTermsValue(canonical, storedById.get(canonical.id))
    : structuredClone(canonical));
  const canonicalIds = new Set(canonicalTermsBlocks.map((item) => item.id));

  return [
    ...merged,
    ...storedBlocks.filter((item) => !canonicalIds.has(item.id)).map((item) => structuredClone(item)),
  ];
}

export function normalizeTermsSeo(seo) {
  if (!isPlainRecord(seo)) return structuredClone(TERMS_PAGE_SEO);
  return mergeTermsValue(TERMS_PAGE_SEO, seo);
}

export function normalizeTermsTitle(title) {
  const value = String(title ?? '').trim();
  return !value || containsCorruptedText(value) ? TERMS_PAGE_TITLE : value;
}

export function isTermsContentCorrupted(blocks) {
  return !hasRequiredTermsBlock(blocks) || containsCorruptedText(blocks);
}

export { TERMS_PAGE_SEO, TERMS_PAGE_TITLE };
