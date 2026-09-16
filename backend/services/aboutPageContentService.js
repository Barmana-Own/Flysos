const ABOUT_PAGE_TITLE = 'درباره ما';

const ABOUT_PAGE_SEO = Object.freeze({
  metaTitle: 'درباره Flysos.ir | پشتیبان حقوق مسافران هوایی',
  metaDescription: 'با Flysos.ir و تیم حقوقی و هوانوردی آن درباره پیگیری حقوق و خسارت مسافران هوایی آشنا شوید.',
  keywords: 'درباره Flysos, حقوق مسافر, خسارت پرواز',
  category: 'درباره ما',
  tags: 'Flysos, حقوق مسافران هوایی',
  canonical: 'https://flysos.ir/about/',
  robotsIndex: true,
  robotsFollow: true,
  openGraphTitle: 'درباره Flysos.ir | پشتیبان حقوق مسافران هوایی',
  openGraphDescription: 'آشنایی با تیم و مأموریت Flysos.ir در احقاق حقوق مسافران هوایی.',
  openGraphImage: '',
});

function block(id, type, order, content, styles, children = []) {
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
    children,
  };
}

const canonicalAboutBlocks = [
  block(
    'about-hero',
    'hero',
    0,
    {
      title: 'پشتیبان و حامی حقوق مسافران در سفرهای هوایی',
      subtitle: 'درباره Flysos.ir',
      description: 'Flysos.ir به عنوان اولین و بزرگ‌ترین پلتفرم تخصصی احقاق حقوق مسافران هوایی در کشور فعالیت می‌کند. ما با تلفیق دانش حقوقی وکلای پایه یک دادگستری، تخصص مدیران با تجربه هوانوردی و زیرساخت‌های نوین فناوری اطلاعات، به مسافران هوایی کمک می‌کنیم تا غرامت قانونی لغو یا تاخیر طولانی پرواز خود را بدون نیاز به هیچ‌گونه دوندگی اداری یا پیش‌پرداخت مالی، به صورت کامل دریافت نمایند.',
    },
    { background: '#ffffff', color: '#0f172a', padding: '64px 32px' },
  ),
  block(
    'about-advantages',
    'features',
    1,
    {
      title: 'چرا به تیم Flysos.ir اعتماد می‌کنند؟',
      items: [
        { id: 'about-a1', title: '۱. ۱۵ سال تجربه مدیریتی در صنعت هوایی', description: 'بهره‌گیری از تخصص مدیران باسابقه در حوزه‌های حقوق هوانوردی، بازرسی و نظارت، دیسپچ، بازرگانی هوانوردی و خدمات فرودگاهی.' },
        { id: 'about-a2', title: '۲. سابقه فعالیت در نهادهای کلیدی', description: 'سابقه همکاری مستقیم یا مشاوره به سازمان هواپیمایی کشوری، سازمان حمایت از حقوق مصرف کنندگان، سازمان بازرسی کل کشور و کانون کارشناسان رسمی.' },
        { id: 'about-a3', title: '۳. وکلای تراز اول و کارشناسان رسمی', description: 'تشکیل پرونده و دفاع قضایی توسط تیمی متشکل از وکلای مجرب هوانوردی و کارشناسان رسمی دادگستری در رشته هوانوردی.' },
        { id: 'about-a4', title: '۴. تیم IT و هوش مصنوعی هوانوردی', description: 'بهره‌گیری از سامانه‌های هوشمند پایش تاخیرات پروازی، استعلام خودکار وضعیت لغو پرواز و تخمین درصد موفقیت پرونده.' },
      ],
    },
    { background: '#f8fafc', padding: '64px 24px' },
  ),
  block(
    'about-mission',
    'banner',
    2,
    {
      title: 'ماموریت ما در Flysos.ir',
      text: 'ماموریت ما، ترویج فرهنگ آگاهی از حقوق مسافر، بهبود پاسخگویی و مسئولیت‌پذیری شرکت‌های هواپیمایی و تسریع در فرآیند دریافت غرامت‌های قانونی با مجهزترین ابزارهای قانونی و سیستم‌های مکانیزه آنلاین است. ما تلاش می‌کنیم مسافران در زمان بروز اختلال‌های پروازی، احساس تنهایی و درماندگی نکنند.',
    },
    { background: '#0f172a', color: '#ffffff', padding: '56px 32px', borderRadius: '24px' },
  ),
  block(
    'about-difference',
    'features',
    3,
    {
      title: 'آنچه ما را متمایز می‌کند',
      items: [
        { id: 'about-d1', title: 'دقت و تخصص بی نظیر', description: 'تمرکز صددرصدی بر روی قوانین حقوق مسافر، مراجع قضایی هوانوردی و آیین‌نامه‌های اختصاصی صنعت حمل‌ونقل هوایی.' },
        { id: 'about-d2', title: 'مشتری‌مداری واقعی', description: 'پشتیبانی مستمر تلفنی و چت آنلاین، به‌روزرسانی لحظه‌ای روند پرونده و اولویت‌دهی صددرصدی به رضایت و راحتی مسافران.' },
        { id: 'about-d3', title: 'شفافیت و پاسخگویی', description: 'اطلاع‌رسانی بلادرنگ تغییرات پرونده بدون نیاز به مراجعه حضوری مسافر یا پرداخت هرگونه مبالغ علی‌الحساب.' },
      ],
    },
    { background: '#ffffff', padding: '64px 24px' },
  ),
  block(
    'about-cta',
    'hero',
    4,
    {
      title: '«حق شما، مسئولیت ماست»',
      description: 'ما در کنار شما هستیم تا هر سفر، تجربه‌ای امن، عادلانه و منصفانه باشد. همین حالا اقدام کنید و پیگیری خسارت پرواز خود را آغاز فرمایید.',
      primaryLabel: 'ثبت درخواست دریافت خسارت',
      primaryUrl: '/track',
      secondaryLabel: 'مطالعه آیین‌نامه‌ها و قوانین',
      secondaryUrl: '/rights',
    },
    { background: '#0ea5e9', color: '#ffffff', padding: '40px 32px', borderRadius: '24px' },
  ),
];

const LEGACY_ABOUT_TEXTS = new Set([
  'درباره flysos.ir',
  'درباره Flysos',
  'flysos.ir به عنوان پلتفرم تخصصی احقاق حقوق مسافران هوایی با تلفیق دانش حقوقی، تجربه هوانوردی و فناوری اطلاعات فعالیت می‌کند.',
  'Flysos پلتفرم تخصصی احقاق حقوق مسافران هوایی است.',
  'چرا به تیم flysos.ir اعتماد می‌کنند؟',
  'سابقه همکاری و مشاوره با نهادهای کلیدی صنعت هوانوردی و حمایت از حقوق مصرف‌کنندگان.',
  'دفاع قضایی توسط وکلای مجرب هوانوردی و کارشناسان رسمی دادگستری.',
  'پایش هوشمند تاخیر و لغو پرواز و تخمین درصد موفقیت پرونده.',
  'تمرکز کامل بر قوانین حقوق مسافر و مراجع قضایی هوانوردی.',
  'پشتیبانی مستمر و اطلاع‌رسانی روند پرونده.',
  'بدون مراجعه حضوری یا پرداخت مبالغ علی‌الحساب.',
  'ماموریت ما در flysos.ir',
  'ماموریت ما ترویج آگاهی از حقوق مسافر، بهبود پاسخگویی ایرلاین‌ها و تسریع دریافت غرامت‌های قانونی است.',
  'دقت و تخصص بی‌نظیر',
  'تمرکز صددرصدی بر قوانین حقوق مسافر و مراجع قضایی هوانوردی.',
]);

function isPlainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function containsCorruptedText(value) {
  if (typeof value === 'string') {
    return /\?{2,}|�|تصدنهثسصبدصن|(?:ط§ط|ط±ط|ط¨ط|طµط|ط¯ط|ظ…ط|أ¢â‚¬)/u.test(value);
  }
  if (Array.isArray(value)) return value.some(containsCorruptedText);
  if (value && typeof value === 'object') return Object.values(value).some(containsCorruptedText);
  return false;
}

function containsLegacyText(value) {
  if (typeof value === 'string') return LEGACY_ABOUT_TEXTS.has(value.trim());
  if (Array.isArray(value)) return value.some(containsLegacyText);
  if (value && typeof value === 'object') return Object.values(value).some(containsLegacyText);
  return false;
}

function mergeAboutValue(base, override) {
  if (override === undefined) return structuredClone(base);
  if (typeof override === 'string' && (containsCorruptedText(override) || LEGACY_ABOUT_TEXTS.has(override.trim()))) {
    return structuredClone(base);
  }

  if (Array.isArray(base) && Array.isArray(override)) {
    const baseItemsHaveIds = base.every((item) => isPlainRecord(item) && typeof item.id === 'string');
    const overrideItemsHaveIds = override.every((item) => isPlainRecord(item) && typeof item.id === 'string');
    if (baseItemsHaveIds && overrideItemsHaveIds) {
      const overridesById = new Map(override.map((item) => [item.id, item]));
      const baseIds = new Set(base.map((item) => item.id));
      return [
        ...base.map((item) => overridesById.has(item.id)
          ? mergeAboutValue(item, overridesById.get(item.id))
          : structuredClone(item)),
        ...override.filter((item) => !baseIds.has(item.id)).map((item) => structuredClone(item)),
      ];
    }
    return structuredClone(override);
  }

  if (isPlainRecord(base) && isPlainRecord(override)) {
    const merged = structuredClone(base);
    for (const [key, value] of Object.entries(override)) merged[key] = mergeAboutValue(base[key], value);
    return merged;
  }

  return structuredClone(override);
}

function hasRequiredAboutBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length < canonicalAboutBlocks.length) return false;
  const ids = new Set(blocks.map((item) => item?.id));
  return canonicalAboutBlocks.every((item) => ids.has(item.id));
}

export function getCanonicalAboutBlocks() {
  return structuredClone(canonicalAboutBlocks);
}

export function normalizeAboutBlocks(blocks, slug = 'about') {
  if (slug !== 'about') return blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return getCanonicalAboutBlocks();

  const storedBlocks = blocks.filter((item) => isPlainRecord(item) && typeof item.id === 'string');
  if (storedBlocks.length === 0) return getCanonicalAboutBlocks();
  if (hasRequiredAboutBlocks(storedBlocks) && !containsCorruptedText(storedBlocks) && !containsLegacyText(storedBlocks)) return blocks;

  const storedById = new Map(storedBlocks.map((item) => [item.id, item]));
  const canonicalIds = new Set(canonicalAboutBlocks.map((item) => item.id));
  const containsCanonicalBlock = storedBlocks.some((item) => canonicalIds.has(item.id));
  const merged = canonicalAboutBlocks.map((canonical) => storedById.has(canonical.id)
    ? mergeAboutValue(canonical, storedById.get(canonical.id))
    : structuredClone(canonical));

  return [
    ...merged,
    ...(containsCanonicalBlock
      ? storedBlocks.filter((item) => !canonicalIds.has(item.id)).map((item) => structuredClone(item))
      : []),
  ];
}

export function normalizeAboutSeo(seo) {
  if (!isPlainRecord(seo)) return structuredClone(ABOUT_PAGE_SEO);
  return mergeAboutValue(ABOUT_PAGE_SEO, seo);
}

export function normalizeAboutTitle(title) {
  const value = String(title ?? '').trim();
  return !value || containsCorruptedText(value) ? ABOUT_PAGE_TITLE : value;
}

export function isAboutContentCorrupted(blocks) {
  return !hasRequiredAboutBlocks(blocks) || containsCorruptedText(blocks);
}

export { ABOUT_PAGE_SEO, ABOUT_PAGE_TITLE };
