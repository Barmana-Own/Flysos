import { randomUUID } from 'node:crypto';

const MIGRATION_ID = 'cms-builder-content-v7-round6-20260720';

const block = (id, type, order, content = {}, styles = {}, children = []) => ({
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
});

const homeBlocks = [
  block('home-hero-main', 'hero', 0, {
    title: 'حقوق خود را در پروازهای هوایی زنده کنید!',
    highlightedTitle: 'بدون هزینه اولیه',
    description: 'پروازتان لغو شده یا با تأخیر مواجه شده است؟ Flysos به عنوان تیم حقوقی شما، تمامی مراحل قانونی و قضایی دریافت خسارت از شرکت‌های هواپیمایی را تا واریز به حسابتان پیگیری می‌کند.',
    image: '/assets/flysos-airport-passenger-hero.jpg',
    overlay: 72,
  }, { background: '#0f172a', color: '#ffffff', padding: '72px 32px' }),
  block('claim-form-main', 'claim-form', 1, {
    title: 'خسارت تأخیر یا ابطال پروازتان را پیگیری کنید',
    description: 'پس از بررسی اطلاعات و مدارک، پیگیری پرونده شما را برای ثبت وکالت در سامانه قضایی به‌صورت غیرحضوری انجام می‌دهیم.',
    nationalIdLabel: 'کد ملی',
    birthDateLabel: 'تاریخ تولد',
    phoneLabel: 'شماره تلفن همراه',
    termsText: 'با مطالعه و پذیرش قوانین و شرایط استفاده موافقت می‌کنم. تمام هزینه‌های قانونی، وکیل، ثبت دادخواست و دادرسی بر عهده Flysos است و فقط در صورت موفقیت و وصول خسارت، ۲۰٪ از مبلغ دریافتی به‌عنوان حق‌الزحمه کسر می‌شود.',
    submitLabel: 'ادامه و بارگذاری بلیت',
    trackingEnabled: true,
    trackingTitle: 'پیگیری پرونده',
    trackingDescription: 'کد پیگیری پیامک‌شده و کد ملی خود را وارد کنید تا آخرین وضعیت پرونده نمایش داده شود.',
  }, { background: '#ffffff', color: '#0f172a', padding: '28px', borderRadius: '24px' }),
  block('home-obstacles', 'features', 2, {
    title: 'چرا اکثر مسافران از حق خود می‌گذرند؟',
    items: [
      { id: 'obstacle-time', title: 'کمبود وقت برای پیگیری', description: 'مشغله‌های روزمره مانع می‌شود برای پیگیری زمان کافی بگذارید.' },
      { id: 'obstacle-law', title: 'ابهام در قوانین', description: 'قوانین پیچیده و تعابیر مبهم باعث سردرگمی مسافران می‌شود.' },
      { id: 'obstacle-process', title: 'پیچیدگی فرایند حقوقی', description: 'فرایندهای اداری و حقوقی طولانی و زمان‌بر است.' },
    ],
  }, { background: '#f8fafc', color: '#0f172a', padding: '48px 24px' }),
  block('home-compensation', 'pricing', 3, {
    title: 'چقدر خسارت می‌گیرید؟',
    description: 'مبالغ تقریبی بر اساس قوانین سازمان هواپیمایی کشوری',
    items: [
      { id: 'delay-2-5', title: 'تأخیر ۲ تا ۵ ساعت', price: '۳۰٪ مبلغ بلیت', description: 'پرداخت غرامت نقدی بر اساس قیمت بلیت همراه با پذیرایی.' },
      { id: 'delay-over-5', title: 'تأخیر بیش از ۵ ساعت', price: '۱۰۰٪ مبلغ بلیت', description: 'پرداخت غرامت نقدی بر اساس قیمت بلیت همراه با پذیرایی.' },
      { id: 'cancelled', title: 'ابطال پرواز', price: 'حداقل ۱۰۰٪ بهای بلیت', description: 'مبلغ نهایی خسارت با توجه به شرایط پرونده تعیین می‌شود.' },
    ],
  }, { background: '#ffffff', color: '#0f172a', padding: '48px 24px' }),
  block('home-process', 'services', 4, {
    title: 'روند کار چگونه است؟',
    description: 'از ثبت تا دریافت خسارت، همه مراحل آنلاین است',
    items: [
      { id: 'process-1', title: 'ثبت اطلاعات اولیه', description: 'اطلاعات خود و بلیت را در سایت وارد کنید.' },
      { id: 'process-2', title: 'بررسی درخواست', description: 'تیم حقوقی مدارک شما را بررسی و مشمولیت پرونده را اعلام می‌کند.' },
      { id: 'process-3', title: 'ثبت وکالت', description: 'پس از تأیید مدارک، وکالت به‌صورت غیرحضوری و الکترونیکی در سامانه قضایی ثبت می‌شود.' },
      { id: 'process-4', title: 'پیگیری و دریافت خسارت', description: 'وکلای Flysos پرونده را تا اخذ خسارت و واریز آن به حساب مسافر پیگیری می‌کنند.' },
    ],
  }, { background: '#f8fafc', color: '#0c2a5c', padding: '52px 24px' }),
  block('home-live-flights', 'live-flights', 5, {
    title: 'وضعیت زنده پروازهای فرودگاه‌های تهران',
    description: 'پایش لحظه‌ای پروازهای فرودگاه مهرآباد و امام خمینی (ره)',
    actionLabel: 'مشاهده آمار کامل پروازها',
  }, { background: '#f8fafc', color: '#0f172a', padding: '48px 24px' }),
  block('home-faq', 'faq', 6, {
    title: 'سوالات متداول',
    description: 'پاسخ به رایج‌ترین پرسش‌های مسافران',
    items: [
      { id: 'home-faq-1', question: 'آیا ثبت و پیگیری پرونده هزینه اولیه دارد؟', answer: 'خیر، تمام هزینه‌های پیگیری بر عهده Flysos است و حق‌الزحمه فقط در صورت وصول خسارت کسر می‌شود.' },
      { id: 'home-faq-2', question: 'چه مدارکی برای شروع لازم است؟', answer: 'تصویر واضح بلیت الزامی است. کارت پرواز فقط در پرونده تأخیر و به‌صورت اختیاری بارگذاری می‌شود.' },
      { id: 'home-faq-3', question: 'چگونه وضعیت پرونده را پیگیری کنم؟', answer: 'با کد ملی و کد پیگیری پیامک‌شده می‌توانید وضعیت پرونده را در سایت مشاهده کنید.' },
    ],
  }, { background: '#ffffff', color: '#0f172a', padding: '52px 24px' }),
];

const composeHome = (blocks) => {
  const hero = structuredClone(blocks[0]);
  const form = structuredClone(blocks[1]);
  const image = hero.content.image;
  hero.content.image = '';
  hero.content.overlay = 0;
  hero.styles = { ...hero.styles, background: 'transparent', padding: '32px 16px' };
  form.content.embedded = true;
  form.styles = { ...form.styles, background: 'transparent', padding: '0' };
  const section = block('home-hero-composition', 'section', 0, {
    backgroundImage: image,
    overlayOpacity: 72,
    migrationVersion: MIGRATION_ID,
  }, {
    background: '#0f172a',
    color: '#ffffff',
    padding: '64px 32px',
    minHeight: '680px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1fr) minmax(320px,500px)',
    alignItems: 'center',
    gap: '48px',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  }, [hero, form]);
  section.responsive = {
    tablet: { gridTemplateColumns: 'minmax(0,1fr) minmax(300px,420px)', gap: '28px' },
    mobile: { gridTemplateColumns: '1fr', padding: '40px 16px', minHeight: 'auto' },
  };
  return [section, ...blocks.slice(2)].map((item, order) => ({ ...item, order }));
};

const faqItems = [
  ['آیا باید اطلاعات پرواز را وارد کنم؟', 'برای سهولت کار، اگر تصویر واضح بلیت را بارگذاری کرده باشید نیازی به ورود دستی اطلاعات پرواز نیست و سامانه اطلاعات را از بلیت استخراج می‌کند.'],
  ['چه اتفاقی بعد از ثبت درخواست می‌افتد؟', 'کارشناسان Flysos مدارک را بررسی می‌کنند و در صورتی که مشمول دریافت خسارت باشید، برای تکمیل وکالت و ادامه مراحل قانونی با شما تماس می‌گیرند.'],
  ['آیا امکان پیگیری درخواست وجود دارد؟', 'بله، با کد ملی و کد پیگیری پیامک‌شده می‌توانید آخرین وضعیت پرونده را مشاهده کنید.'],
  ['چه مدارکی برای ثبت درخواست لازم است؟', 'تصویر واضح بلیت الزامی است. کارت پرواز فقط برای حالت تأخیر و به‌صورت اختیاری قابل بارگذاری است.'],
  ['آیا برای ثبت درخواست نیاز به وکیل دارم؟', 'خیر، وکلای Flysos تمام مراحل پیگیری را به نمایندگی از شما انجام می‌دهند.'],
  ['هزینه‌ها و حق‌الزحمه چگونه محاسبه می‌شود؟', 'تمام هزینه‌های پیگیری بر عهده Flysos است و فقط در صورت موفقیت، کارمزد ۲۰ درصدی از مبلغ خسارت دریافتی کسر می‌شود.'],
  ['مدت زمان بررسی و دریافت خسارت چقدر است؟', 'مدت رسیدگی به شرایط پرونده و مراجع قانونی بستگی دارد و معمولاً بین ۱ تا ۳ ماه است.'],
].map(([question, answer], index) => ({ id: `faq-page-${index + 1}`, question, answer }));

const pages = {
  home: {
    title: 'صفحه اصلی',
    blocks: composeHome(homeBlocks),
    seo: {
      metaTitle: 'Flysos | مرکز تخصصی پیگیری خسارت تأخیر و ابطال پرواز',
      metaDescription: 'ثبت و پیگیری تخصصی خسارت تأخیر و ابطال پرواز بدون هزینه اولیه.',
      canonical: 'https://flysos.ir/',
      robotsIndex: true,
      robotsFollow: true,
      openGraphTitle: 'Flysos | پیگیری خسارت پرواز',
      openGraphDescription: 'پیگیری حقوقی خسارت تأخیر و ابطال پرواز بدون هزینه اولیه',
      openGraphImage: 'https://flysos.ir/assets/flysos-airport-passenger-hero.jpg',
    },
  },
  faq: {
    title: 'سوالات متداول',
    blocks: [block('faq-page-main', 'faq', 0, { title: 'سوالات متداول مسافران', description: 'پاسخ به پرسش‌های ثبت، مدارک، هزینه‌ها و پیگیری پرونده', items: faqItems }, { background: '#f8fafc', padding: '52px 24px' })],
  },
  about: {
    title: 'درباره ما',
    blocks: [
      block('about-hero', 'hero', 0, { title: 'پشتیبان و حامی حقوق مسافران در سفرهای هوایی', subtitle: 'درباره Flysos', description: 'Flysos پلتفرم تخصصی احقاق حقوق مسافران هوایی است و با تلفیق دانش حقوقی، تجربه هوانوردی و فناوری اطلاعات فعالیت می‌کند.' }, { background: '#ffffff', color: '#0f172a', padding: '56px 32px' }),
      block('about-advantages', 'features', 1, { title: 'چرا به تیم Flysos اعتماد می‌کنند؟', items: [
        { id: 'about-a1', title: 'تجربه مدیریتی در صنعت هوایی', description: 'بهره‌گیری از مدیران و کارشناسان باسابقه صنعت هوانوردی.' },
        { id: 'about-a2', title: 'تخصص حقوقی', description: 'همکاری با وکلای مجرب و کارشناسان رسمی در پرونده‌های حقوق مسافر.' },
        { id: 'about-a3', title: 'پیگیری شفاف', description: 'اطلاع‌رسانی مستمر وضعیت پرونده تا وصول و واریز خسارت.' },
      ] }, { background: '#f8fafc', padding: '52px 24px' }),
    ],
  },
  rights: {
    title: 'حقوق مسافر',
    blocks: [
      block('rights-hero', 'hero', 0, { title: 'حقوق مسافر در پروازهای هوایی', subtitle: 'حقوق قانونی شما در پرواز', description: 'مرجع قوانین، خدمات و غرامت‌های مصوب مسافران پروازهای داخلی و خارجی.' }, { background: '#ffffff', color: '#0f172a', padding: '56px 32px' }),
      block('rights-delays', 'accordion', 1, { title: 'خدمات و غرامت تأخیر پرواز', items: [
        { id: 'rights-d1', question: 'کمتر از ۲ ساعت', answer: 'اطلاع‌رسانی و پذیرایی متناسب با زمان و امکانات فرودگاه.' },
        { id: 'rights-d2', question: 'بین ۲ تا ۵ ساعت', answer: 'پذیرایی، انتخاب پرواز جایگزین یا استرداد وجه و غرامت بر اساس مقررات.' },
        { id: 'rights-d3', question: 'بیشتر از ۵ ساعت', answer: 'استرداد کامل وجه یا پرواز جایگزین و غرامت مطابق مقررات سازمان هواپیمایی کشوری.' },
      ] }, { background: '#f8fafc', padding: '52px 24px' }),
    ],
  },
  rules: {
    title: 'قوانین',
    blocks: [block('rules-main', 'accordion', 0, { title: 'شرایط و ضوابط خدمات Flysos', description: 'چارچوب حقوقی همکاری با مسافر', items: [
      ['حوزه خدمات', 'خدمات شامل بررسی مدارک، استعلام پرواز، ثبت وکالت، طرح دعوا، پیگیری قضایی و وصول غرامت است.'],
      ['حق‌الزحمه', 'هیچ هزینه اولیه‌ای دریافت نمی‌شود و فقط پس از موفقیت، ۲۰٪ از خسارت وصول‌شده به عنوان حق‌الزحمه کسر می‌شود.'],
      ['تعهدات مسافر', 'مسافر متعهد است اطلاعات هویتی، پرواز و مدارک را صحیح و کامل ارائه کند.'],
      ['محرمانگی', 'اطلاعات و مدارک صرفاً برای پیگیری پرونده استفاده و محرمانه نگهداری می‌شوند.'],
    ].map(([question, answer], index) => ({ id: `rules-${index + 1}`, question, answer })) }, { background: '#f8fafc', padding: '52px 24px' })],
  },
  articles: {
    title: 'مقالات',
    blocks: [
      block('articles-heading', 'heading', 0, { text: 'مقالات و راهنماهای حقوق مسافر', level: 1 }, { textAlign: 'center', padding: '40px 24px 8px' }),
      block('articles-intro', 'paragraph', 1, { text: 'آخرین مطالب تخصصی درباره خسارت تأخیر، ابطال پرواز، مدارک و مراحل پیگیری قانونی.' }, { textAlign: 'center', padding: '0 24px 24px' }),
      block('articles-list', 'blog-list', 2, { title: 'آخرین مقالات', categoryFilter: true, searchEnabled: true, pageSize: 12 }, { background: '#f8fafc', padding: '40px 24px' }),
    ],
  },
  services: {
    title: 'خدمات',
    blocks: [block('services-main', 'services', 0, { title: 'خدمات Flysos', description: 'پیگیری تخصصی حقوق مسافران هوایی', items: [
      { id: 'service-delay', title: 'پیگیری خسارت تأخیر پرواز', description: 'بررسی مشمولیت و پیگیری حقوقی خسارت تأخیر.' },
      { id: 'service-cancel', title: 'پیگیری خسارت ابطال پرواز', description: 'پیگیری استرداد، غرامت و خسارت ناشی از ابطال.' },
      { id: 'service-legal', title: 'ثبت و پیگیری قضایی', description: 'ثبت وکالت، دادخواست و پیگیری تا دریافت خسارت.' },
    ] }, { background: '#f8fafc', padding: '52px 24px' })],
  },
  contact: {
    title: 'تماس با ما',
    blocks: [
      block('contact-title', 'heading', 0, { text: 'تماس با Flysos', level: 1 }, { textAlign: 'center', padding: '48px 24px 12px' }),
      block('contact-info', 'features', 1, { title: 'راه‌های ارتباطی', items: [
        { id: 'contact-phone', title: 'تلفن', description: '02128421314' },
        { id: 'contact-email', title: 'ایمیل', description: 'info@flysos.ir' },
        { id: 'contact-social', title: 'شبکه‌های اجتماعی', description: '@flysos' },
        { id: 'contact-hours', title: 'ساعات پاسخ‌گویی', description: 'شنبه تا چهارشنبه ۹ تا ۱۶، پنج‌شنبه ۹ تا ۱۲' },
      ] }, { background: '#f8fafc', padding: '40px 24px' }),
      block('contact-form', 'contact-form', 2, { title: 'ارسال پیام', submitLabel: 'ارسال پیام' }, { background: '#ffffff', padding: '40px 24px' }),
    ],
  },
  privacy: {
    title: 'حریم خصوصی',
    blocks: [block('privacy-main', 'accordion', 0, { title: 'سیاست حفظ حریم خصوصی', items: [
      { id: 'privacy-1', question: 'اطلاعات دریافتی', answer: 'اطلاعات هویتی، تماس، پرواز و مدارک فقط برای ارائه خدمات و پیگیری حقوقی دریافت می‌شود.' },
      { id: 'privacy-2', question: 'نحوه استفاده', answer: 'اطلاعات فقط در محدوده پرونده، ارتباط با مسافر و الزامات قانونی استفاده خواهد شد.' },
      { id: 'privacy-3', question: 'امنیت اطلاعات', answer: 'دسترسی به اطلاعات بر اساس سطح دسترسی کارشناسان محدود و ثبت می‌شود.' },
    ] }, { background: '#f8fafc', padding: '52px 24px' })],
  },
};

const headerBlocks = [block('global-header-main', 'site-header', 0, {
  brand: 'Flysos',
  subtitle: 'متخصص در امور حقوق مسافران هوایی',
  ctaLabel: 'ثبت/پیگیری پرونده',
  sticky: true,
  items: [
    { id: 'nav-home', label: 'صفحه اصلی', page: 'home', visible: true },
    { id: 'nav-rights', label: 'حقوق مسافر', page: 'rights', visible: true },
    { id: 'nav-faq', label: 'سوالات متداول', page: 'faq', visible: true },
    { id: 'nav-articles', label: 'مقالات', page: 'articles', visible: true },
    { id: 'nav-about', label: 'درباره ما', page: 'about', visible: true },
  ],
}, { background: '#ffffff', color: '#0f172a', padding: '0 24px' })];

const footerBlocks = [block('global-footer-main', 'site-footer', 0, {
  brand: 'Flysos',
  description: 'متخصص در امور حقوق مسافران هوایی',
  phone: '02128421314',
  email: 'info@flysos.ir',
  hours: 'شنبه تا چهارشنبه ۹ تا ۱۶، پنج‌شنبه ۹ تا ۱۲',
  copyright: 'تمامی حقوق مادی و معنوی این وب‌سایت متعلق به Flysos است.',
  columns: [
    { id: 'footer-services', title: 'خدمات ما', links: [
      { id: 'fs1', label: 'پیگیری خسارت تأخیر پرواز', page: 'home' },
      { id: 'fs2', label: 'پیگیری ابطال پرواز', page: 'home' },
    ] },
    { id: 'footer-fast', title: 'دسترسی سریع', links: [
      { id: 'ff1', label: 'حقوق مسافر', page: 'rights' },
      { id: 'ff2', label: 'سوالات متداول', page: 'faq' },
      { id: 'ff3', label: 'مقالات', page: 'articles' },
      { id: 'ff4', label: 'شرایط و ضوابط خدمات', page: 'rules' },
      { id: 'ff5', label: 'درباره ما', page: 'about' },
    ] },
  ],
  socials: [
    { id: 'social-bale', label: 'بله', href: 'https://ble.ir/flysos' },
    { id: 'social-telegram', label: 'تلگرام', href: 'https://t.me/flysos' },
    { id: 'social-linkedin', label: 'لینکدین', href: 'https://www.linkedin.com/company/flysos/' },
  ],
  socialHandle: '@flysos',
}, { background: '#0b1120', color: '#cbd5e1', padding: '40px 24px' })];

async function upsertPage(connection, slug, page) {
  const [rows] = await connection.query('SELECT `id` FROM `CmsPage` WHERE `slug`=? LIMIT 1', [slug]);
  const blocks = JSON.stringify(page.blocks);
  const seo = JSON.stringify(page.seo || {
    metaTitle: `${page.title} | Flysos`,
    metaDescription: `${page.title} در سامانه تخصصی حقوق مسافران هوایی Flysos`,
    canonical: `https://flysos.ir/${slug === 'home' ? '' : `${slug}/`}`,
    robotsIndex: true,
    robotsFollow: true,
  });
  if (rows[0]) {
    await connection.query(
      `UPDATE \`CmsPage\` SET \`title\`=?,\`status\`='published',\`blocks\`=?,\`seo\`=?,\`draftBlocks\`=?,\`publishedBlocks\`=?,\`draftSeo\`=?,\`publishedSeo\`=?,\`publishedAt\`=COALESCE(\`publishedAt\`,NOW(3)),\`pageType\`='page',\`updatedAt\`=NOW(3) WHERE \`id\`=?`,
      [page.title, blocks, seo, blocks, blocks, seo, seo, rows[0].id]
    );
    return rows[0].id;
  }
  const id = randomUUID();
  await connection.query(
    `INSERT INTO \`CmsPage\` (\`id\`,\`title\`,\`slug\`,\`status\`,\`blocks\`,\`seo\`,\`draftBlocks\`,\`publishedBlocks\`,\`draftSeo\`,\`publishedSeo\`,\`publishedAt\`,\`pageType\`,\`category\`,\`tags\`,\`keywords\`,\`featuredImageUrl\`) VALUES (?,?,?,'published',?,?,?,?,?,?,NOW(3),'page','',?,?,'')`,
    [id, page.title, slug, blocks, seo, blocks, blocks, seo, seo, '[]', '[]']
  );
  return id;
}

async function upsertGlobal(connection, type, title, blocks) {
  const payload = JSON.stringify(blocks);
  const [rows] = await connection.query('SELECT `id` FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1', [type]);
  if (rows[0]) {
    await connection.query(
      `UPDATE \`CmsGlobalLayout\` SET \`title\`=?,\`status\`='published',\`draftBlocks\`=?,\`publishedBlocks\`=?,\`publishedAt\`=COALESCE(\`publishedAt\`,NOW(3)),\`updatedAt\`=NOW(3) WHERE \`id\`=?`,
      [title, payload, payload, rows[0].id]
    );
    return;
  }
  await connection.query(
    'INSERT INTO `CmsGlobalLayout` (`id`,`layoutType`,`title`,`status`,`draftBlocks`,`publishedBlocks`,`publishedAt`) VALUES (?,?,?,\'published\',?,?,NOW(3))',
    [`global-${type}`, type, title, payload, payload]
  );
}

export async function syncLatestBuilderContent(connection) {
  const [done] = await connection.query('SELECT `id` FROM `CmsMigration` WHERE `id`=? LIMIT 1', [MIGRATION_ID]);
  if (done[0]) return { status: 'skipped', migration: MIGRATION_ID };

  const synced = [];
  for (const [slug, page] of Object.entries(pages)) {
    await upsertPage(connection, slug, page);
    synced.push(slug);
  }
  await upsertGlobal(connection, 'header', 'هدر سایت', headerBlocks);
  await upsertGlobal(connection, 'footer', 'فوتر سایت', footerBlocks);
  await connection.query('INSERT INTO `CmsMigration` (`id`) VALUES (?)', [MIGRATION_ID]);
  return { status: 'migrated', migration: MIGRATION_ID, pages: synced, globals: ['header', 'footer'] };
}
