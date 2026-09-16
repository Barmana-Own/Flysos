const OFFICIAL_RIGHTS_DOCUMENT_URL = 'https://regulations.caa.ir/rules/view-document/12121/category/0';

const RIGHTS_PAGE_TITLE = 'آیین‌نامه حقوق مسافر در پروازهای داخلی و خارجی';
const RIGHTS_PAGE_SEO = Object.freeze({
  metaTitle: 'آیین‌نامه حقوق مسافر در پروازهای داخلی و خارجی | Flysos',
  metaDescription: 'دستورالعمل حقوق مسافر هوایی و خدمات قابل ارائه در تأخیر و ابطال پروازهای داخلی و خارجی.',
  canonical: 'https://flysos.ir/rights/',
  robotsIndex: true,
  robotsFollow: true,
  openGraphTitle: 'آیین‌نامه حقوق مسافر در پروازهای داخلی و خارجی | Flysos',
  openGraphDescription: 'راهنمای حقوق قانونی مسافران در پروازهای داخلی و خارجی.',
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

const canonicalRightsBlocks = [
  block(
    'rights-hero',
    'hero',
    0,
    {
      title: RIGHTS_PAGE_TITLE,
      subtitle: 'حقوق قانونی شما در پرواز',
      description: 'دستورالعمل حقوق مسافر هوایی مصوب سازمان هواپیمایی کشوری، حقوق پایه‌ای مسافران را در موارد تاخیر، ابطال پرواز، ممانعت از سفر و گم‌شدن بار تضمین می‌کند. ما در Flysos.ir به عنوان وکیل شما، بر رعایت دقیق این قوانین پافشاری می‌کنیم.',
      variant: 'editorial',
      primaryLabel: 'دانلود آیین‌نامه رسمی حقوق مسافر',
      primaryUrl: OFFICIAL_RIGHTS_DOCUMENT_URL,
      highlights: [],
      sideTitle: 'مرجع حقوق مسافر',
      sideIcon: 'file-text',
      sideDescription: 'قوانین و غرامت‌های مصوب پروازهای داخلی و خارجی',
    },
    { background: '#f8fafc', color: '#0f172a', padding: '48px 0' },
  ),
  block(
    'rights-principles',
    'features',
    1,
    {
      title: 'اصول کلی حقوق مسافر هوایی',
      items: [
        { id: 'rights-p1', title: 'اطلاع‌رسانی شفاف', description: 'ارائه اطلاعات دقیق، به‌موقع و قابل دسترس در تمامی مراحل سفر و فرآیند خرید بلیت.' },
        { id: 'rights-p2', title: 'احترام و کرامت انسانی', description: 'رعایت احترام، شأن و کرامت مسافر در تمام فرآیندهای فرودگاهی و پروازی توسط کادر فنی و زمینی.' },
        { id: 'rights-p3', title: 'جبران خسارت و خدمات', description: 'ارائه حداقل خدمات رفاهی و جبران خسارت مالی و نقدی در موارد تاخیر، ابطال و ممانعت از پرواز.' },
        { id: 'rights-p4', title: 'پاسخگویی و رسیدگی', description: 'ایجاد بسترهای مناسب برای ثبت، رسیدگی سریع و مؤثر به شکایات و اعتراضات قانونی مسافران هوایی.' },
      ],
    },
    { background: '#ffffff', padding: '64px 24px' },
  ),
  block(
    'rights-delays',
    'accordion',
    2,
    {
      title: 'جدول اقدامات و خدمات قابل ارائه در زمان تأخیر پروازها',
      description: '',
      items: [
        { id: 'rights-d1', question: 'کمتر از ۲ ساعت', answer: 'اطلاع رسانی صحیح به مسافران توسط نماینده شرکت هواپیمایی\nانجام پذیرایی نوع اول (ارائه این پذیرایی مشروط به داشتن زمان کافی)' },
        { id: 'rights-d2', question: 'بین ۲ ساعت تا ۵ ساعت', answer: 'اطلاع رسانی صحیح به مسافران توسط نماینده شرکت هواپیمایی\nانجام پذیرایی مناسب حداقل نوع اول، پذیرایی نوع دوم\nانتخاب مسافر از یکی از گزینه‌های زیر:\n• ارائه بلیت مشابه (مسیر پروازی) در اولین فرصت و پرداخت غرامت معادل ۳۰٪ قیمت بلیت\n• استرداد وجه بلیت ظرف مدت ۴۸ ساعت و پرداخت غرامت معادل ۳۰٪ قیمت بلیت' },
        { id: 'rights-d3', question: 'بیشتر از ۵ ساعت', answer: 'اطلاع رسانی صحیح به مسافران توسط نماینده شرکت هواپیمایی\nانجام پذیرایی مناسب نوع اول و دوم\nانتخاب مسافر از یکی از گزینه‌های زیر:\n• ارائه بلیت مشابه (مسیر پروازی) در اولین فرصت و پرداخت غرامت ۱ برابر قیمت بلیت\n• استرداد وجه بلیت در صورت انصراف مسافر از پرواز و پرداخت غرامت معادل ۱ برابر قیمت بلیت' },
      ],
    },
    { background: '#f8fafc', padding: '52px 24px' },
  ),
  block(
    'rights-delays-international',
    'accordion',
    3,
    {
      title: 'جدول اقدامات و خدمات قابل ارائه در زمان تأخیر پروازها',
      description: '',
      items: [
        { id: 'rights-i1', question: 'کمتر از ۳ ساعت', answer: 'اطلاع رسانی صحیح به مسافران توسط نماینده شرکت هواپیمایی\nانجام پذیرایی نوع اول (ارائه این پذیرایی مشروط به داشتن زمان کافی)' },
        { id: 'rights-i2', question: 'بین ۳ ساعت تا ۵ ساعت', answer: 'اطلاع رسانی صحیح به مسافران توسط نماینده شرکت هواپیمایی\nانجام پذیرایی نوع اول و دوم\n• ارائه بلیت مشابه (از نظر کلاس و مسیر پروازی) در اولین فرصت و پرداخت غرامت برابر قیمت بلیت\n• استرداد وجه بلیت در صورت انصراف مسافر از پرواز و پرداخت غرامت برابر قیمت بلیت' },
        { id: 'rights-i3', question: 'بیشتر از ۵ ساعت', answer: 'اطلاع رسانی صحیح به مسافرین توسط نماینده شرکت هواپیمایی\nانجام پذیرایی نوع اول و دوم\nانتخاب مسافر از یکی از گزینه‌های زیر:\n• ارائه بلیت مشابه (از نظر کلاس و مسیر پروازی) در اولین فرصت و پرداخت غرامت ۱ برابر قیمت بلیت\n• استرداد وجه بلیت در صورت انصراف مسافر از پرواز و پرداخت غرامت ۱ برابر قیمت بلیت' },
      ],
    },
    { background: '#ffffff', padding: '52px 24px' },
  ),
  block(
    'rights-faq',
    'faq',
    4,
    {
      title: 'پرسش‌های حقوق مسافر',
      items: [
        { id: 'rights-f1', question: 'آیا لغو پرواز به دلیل شرایط نامساعد جوی (فورس ماژور) مشمول غرامت است؟', answer: 'خیر. طبق آیین‌نامه حقوق مسافر، در مواردی که ابطال یا تاخیر پرواز به دلیل شرایط جوی ناپایدار، نقص فنی امنیتی ناگهانی یا شرایط فورس ماژور فرودگاهی باشد، شرکت هواپیمایی ملزم به پرداخت غرامت نقدی اضافی نیست؛ اما همچنان موظف به عودت کامل وجه بلیت یا تامین پرواز جایگزین بدون کسر جریمه است.' },
        { id: 'rights-f2', question: 'مبلغ غرامت تاخیر پروازهای داخلی چگونه محاسبه می‌شود؟', answer: 'غرامت بر اساس درصد تاخیر (۳۰٪ یا ۱۰۰٪ بهای بلیت) و با توجه به جدول تایید شده سازمان هواپیمایی کشوری تعیین می‌گردد. Flysos.ir بر اساس نوع کلاس پروازی و میزان دقیق تاخیر ثبت‌شده در پورتال فرودگاهی، حداکثر غرامت ممکن را از شرکت هواپیمایی مطالبه خواهد کرد.' },
        { id: 'rights-f3', question: 'آیا برای مسافران نوزاد یا کودکان نیز خسارت کامل پرداخت می‌شود؟', answer: 'بله. برای هر بلیت صادر شده دارای صندلی مستقل (کودکان ۲ تا ۱۲ سال) خسارت به صورت کامل محاسبه می‌شود. برای نوزادان (زیر ۲ سال) که بلیت بدون صندلی صادر گردیده، خسارت متناسب با بهای پرداخت‌شده بلیت نوزاد محاسبه و وصول می‌گردد.' },
      ],
    },
    { background: '#f8fafc', padding: '52px 24px' },
  ),
];

function containsCorruptedText(value) {
  if (typeof value === 'string') {
    return /\?{2,}|�|تصدنهثسصبدصن|(?:ط§ط|ط±ط|ط¨ط|طµط|ط¯ط|ظ…ط|أ¢â‚¬)/u.test(value);
  }
  if (Array.isArray(value)) return value.some(containsCorruptedText);
  if (value && typeof value === 'object') return Object.values(value).some(containsCorruptedText);
  return false;
}

function hasRequiredRightsBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length < canonicalRightsBlocks.length) return false;
  const ids = new Set(blocks.map((item) => item?.id));
  return canonicalRightsBlocks.every((item) => ids.has(item.id));
}

function isPlainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeRightsValue(base, override) {
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
          ? mergeRightsValue(item, overridesById.get(item.id))
          : structuredClone(item)),
        ...override.filter((item) => !baseIds.has(item.id)).map((item) => structuredClone(item)),
      ];
    }
    return structuredClone(override);
  }

  if (isPlainRecord(base) && isPlainRecord(override)) {
    const merged = structuredClone(base);
    for (const [key, value] of Object.entries(override)) merged[key] = mergeRightsValue(base[key], value);
    return merged;
  }

  return structuredClone(override);
}

export function getCanonicalRightsBlocks() {
  return structuredClone(canonicalRightsBlocks);
}

export function normalizeRightsBlocks(blocks, slug = 'rights') {
  if (slug !== 'rights') return blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return getCanonicalRightsBlocks();

  const storedBlocks = blocks.filter((item) => isPlainRecord(item) && typeof item.id === 'string');
  if (storedBlocks.length === 0) return getCanonicalRightsBlocks();
  if (hasRequiredRightsBlocks(storedBlocks) && !containsCorruptedText(storedBlocks)) return blocks;

  const storedById = new Map(storedBlocks.map((item) => [item.id, item]));
  const canonicalIds = new Set(canonicalRightsBlocks.map((item) => item.id));
  const containsCanonicalBlock = storedBlocks.some((item) => canonicalIds.has(item.id));
  const merged = canonicalRightsBlocks.map((canonical) => storedById.has(canonical.id)
    ? mergeRightsValue(canonical, storedById.get(canonical.id))
    : structuredClone(canonical));

  // Preserve any additional rights-only blocks created by the editor while
  // restoring required canonical blocks that were accidentally omitted.
  return [
    ...merged,
    ...(containsCanonicalBlock
      ? storedBlocks
        .filter((item) => !canonicalIds.has(item.id))
        .map((item) => structuredClone(item))
      : []),
  ];
}

export function normalizeRightsSeo(seo) {
  if (!isPlainRecord(seo)) return structuredClone(RIGHTS_PAGE_SEO);
  return mergeRightsValue(RIGHTS_PAGE_SEO, seo);
}

export function normalizeRightsTitle(title) {
  const value = String(title ?? '').trim();
  return !value || containsCorruptedText(value) ? RIGHTS_PAGE_TITLE : value;
}

export function isRightsContentCorrupted(blocks) {
  return !hasRequiredRightsBlocks(blocks) || containsCorruptedText(blocks);
}

export { OFFICIAL_RIGHTS_DOCUMENT_URL, RIGHTS_PAGE_TITLE };
