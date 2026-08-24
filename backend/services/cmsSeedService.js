import { randomUUID } from 'node:crypto';

const block = (id, type, order, content = {}, styles = {}, children = []) => ({
  id, type, order, visible: true, content, styles, settings: {},
  animations: { type: 'none', delay: 0, duration: 500 }, responsive: {}, children,
});

const homeBlocks = [
  block('home-hero-main', 'hero', 0, {
    title: 'حقوق خود را در پروازهای هوایی زنده کنید!', highlightedTitle: 'بدون هزینه اولیه',
    description: 'پروازتان لغو شده یا با تاخیر مواجه شده است؟ Flysos.ir به عنوان تیم حقوقی شما، تمامی مراحل قانونی و قضایی دریافت خسارت از شرکت‌های هواپیمایی را تا واریز به حسابتان پیگیری می‌کند. تمامی هزینه‌های پیگیری، شامل هزینه وکلا، طرح شکایت و دادرسی، کاملاً بر عهده ماست و فقط در صورت موفقیت در دریافت خسارت، ۲۰٪ از مبلغ وصول‌شده به‌عنوان حق‌الزحمه دریافت می‌شود.',
    image: '', overlay: 72,
  }, { background: '#0f172a', color: '#ffffff', padding: '72px 32px' }),
  block('claim-form-main', 'claim-form', 1, {
    title: 'خسارت تاخیر یا ابطال پروازتان را پیگیری کنید',
    description: 'پس از بررسی اطلاعات و مدارک، پیگیری پرونده شما را تا چند روز کاری از طریق تماس تلفنی برای ثبت وکالت در سامانه قضایی انجام می‌دهیم.',
    nationalIdLabel: 'کد ملی', birthDateLabel: 'تاریخ تولد', phoneLabel: 'شماره تلفن همراه',
    termsText: 'با مطالعه و پذیرش قوانین و شرایط استفاده موافقت می‌کنم. تمام هزینه‌های قانونی، وکیل، ثبت دادخواست و دادرسی بر عهده Flysos.ir است و فقط در صورت موفقیت و وصول خسارت، ۲۰٪ از مبلغ دریافتی به‌عنوان حق‌الزحمه کسر می‌شود.',
    submitLabel: 'ادامه و بارگذاری بلیت', trackingEnabled: true,
  }, { background: '#ffffff', color: '#0f172a', padding: '28px', borderRadius: '24px' }),
  block('home-obstacles', 'features', 2, { title: 'چرا اکثر مسافران از حق خود می‌گذرند؟', items: [
    { id: 'obstacle-time', title: 'کمبود وقت برای پیگیری', description: 'مشغله‌های روزمره مانع می‌شود برای پیگیری زمان کافی بگذارید.' },
    { id: 'obstacle-law', title: 'ابهام در قوانین', description: 'قوانین پیچیده و تعابیر مبهم باعث سردرگمی مسافران می‌شود.' },
    { id: 'obstacle-process', title: 'پیچیدگی فرآیند حقوقی', description: 'فرآیندهای اداری و حقوقی طولانی و زمان‌بر است.' },
  ] }, { background: '#f8fafc', color: '#0f172a', padding: '64px 24px' }),
  block('home-compensation', 'pricing', 3, { title: 'چقدر خسارت می‌گیرید؟', description: 'مبالغ تقریبی بر اساس قوانین هواپیمایی کشوری', items: [
    { id: 'delay-2-5', title: 'تاخیر ۲ تا ۵ ساعت', price: '۳۰٪ مبلغ بلیت', description: 'پرداخت غرامت نقدی بر اساس قیمت بلیت همراه با پذیرایی.' },
    { id: 'delay-over-5', title: 'تاخیر بیش از ۵ ساعت', price: '۱۰۰٪ مبلغ بلیت', description: 'پرداخت غرامت نقدی بر اساس قیمت بلیت همراه با پذیرایی.' },
    { id: 'cancelled', title: 'ابطال پرواز', price: 'حداقل ۱۰٪ بهای بلیت', description: 'مبلغ خسارت را قاضی تعیین می‌کند، معمولاً حداقل ۱۰٪ بهای بلیت.', note: 'بسته به زمان اعلام لغو پرواز، مشمول دریافت غرامت قانونی اضافی خواهید بود.' },
  ] }, { background: '#ffffff', color: '#0f172a', padding: '64px 24px' }),
  block('home-process', 'services', 4, { title: 'روند کار چگونه است؟', description: 'از ثبت تا دریافت خسارت - همه چیز آنلاین', items: [
    { id: 'process-1', title: 'ثبت اطلاعات اولیه', description: 'اطلاعات خود و بلیت را در سایت وارد کنید.' },
    { id: 'process-2', title: 'بررسی درخواست', description: 'تیم حقوقی مدارک شما را بررسی و وضعیت مشمولیت را اعلام می‌کند.' },
    { id: 'process-3', title: 'ثبت وکالت', description: 'پس از تأیید مدارک، وکالت به‌صورت غیرحضوری و الکترونیکی در سامانه قضایی ثبت می‌شود.' },
    { id: 'process-4', title: 'پیگیری و دریافت خسارت', description: 'وکلای Flysos.ir در سیستم قضایی تشکیل پرونده می‌دهند و تا دریافت خسارت و واریز آن به حساب مسافر پیگیر خواهند بود.', note: 'تمامی هزینه‌های دادرسی و پیگیری قضایی با Flysos.ir است؛ ۲۰٪ کارمزد پس از موفقیت و ۸۰٪ واریز به مسافر.' },
  ] }, { background: '#f8fafc', color: '#0c2a5c', padding: '72px 24px' }),
  block('home-live-flights', 'live-flights', 5, { title: 'وضعیت زنده پروازهای فرودگاه‌های تهران', description: 'پایش لحظه‌ای پروازهای فرودگاه مهرآباد و امام خمینی (ره)', actionLabel: 'مشاهده کامل وضعیت پروازها' }, { background: '#f8fafc', color: '#0f172a', padding: '56px 24px' }),
  block('home-faq', 'faq', 6, { title: 'سوالات متداول', description: 'پاسخ به رایج‌ترین پرسش‌های مسافران', items: [
    { id: 'home-faq-1', question: 'آیا ثبت و پیگیری پرونده هزینه اولیه دارد؟', answer: 'خیر، ثبت پرونده و پیگیری آن در تمام مراحل کاملاً رایگان است.' },
    { id: 'home-faq-2', question: 'چه مدارکی برای شروع لازم است؟', answer: 'تصویر بلیت و در صورت وجود کارت پرواز برای بررسی اولیه کافی است.' },
    { id: 'home-faq-3', question: 'چگونه وضعیت پرونده را پیگیری کنم؟', answer: 'با کد پیگیری صادرشده می‌توانید وضعیت پرونده را در سایت مشاهده کنید.' },
  ] }, { background: '#ffffff', color: '#0f172a', padding: '72px 24px' }),
];

const faqItems = [
  ['آیا باید اطلاعات پرواز را وارد کنم؟','اگر تصویر بلیت را بارگذاری کنید، نیازی به ورود دستی اطلاعات پرواز نیست و سامانه اطلاعات لازم را با OCR استخراج می‌کند.'],
  ['چه اتفاقی بعد از ثبت درخواست می‌افتد؟','پس از ثبت آنلاین، کارشناسان Flysos.ir مدارک را بررسی می‌کنند و در صورت مشمول بودن پرونده با مسافر تماس می‌گیرند. فرآیند حقوقی معمولاً بین ۱ تا ۳ ماه زمان می‌برد.'],
  ['آیا امکان پیگیری درخواست وجود دارد؟','بله. با کد انتهای ثبت درخواست می‌توانید از آخرین وضعیت قضایی و اداری پرونده مطلع شوید.'],
  ['چه مدارکی برای ثبت درخواست لازم است؟','تصویر واضح بلیت برای ثبت اولیه الزامی است؛ کارت پرواز و مستندات تکمیلی سرعت بررسی را افزایش می‌دهد.'],
  ['آیا برای ثبت درخواست نیاز به وکیل دارم؟','خیر. وکلای همکار Flysos.ir تمام مراحل را با نمایندگی قانونی از طرف شما پیگیری می‌کنند.'],
  ['هزینه‌ها و حق‌الزحمه چگونه محاسبه می‌شود؟','تمام هزینه‌های قانونی و پیگیری بر عهده Flysos.ir است و فقط در صورت موفقیت و وصول خسارت، ۲۰ درصد از مبلغ دریافتی به‌عنوان حق‌الزحمه کسر می‌شود.'],
  ['مدت زمان بررسی و دریافت خسارت چقدر است؟','بررسی اولیه معمولاً ظرف ۲۴ ساعت انجام می‌شود و فرآیند حقوقی و وصول خسارت معمولاً بین ۱ تا ۳ ماه زمان می‌برد.'],
  ['سامانه ثنا و ثبت وکالت چطور انجام می‌شود؟','ثبت وکالت از طریق سامانه ثنا و با تایید رمز موقت پیامکی مسافر انجام می‌شود.'],
  ['نحوه واریز خسارت چگونه است؟','پس از وصول غرامت، ۸۰٪ وجه از طریق شماره شبای مسافر واریز می‌شود.'],
].map(([question, answer], index) => ({ id: `faq-page-${index + 1}`, question, answer }));

const trackSuccessBlocks = [block('track-success', 'section', 0, {
  step1Label: '۱. اطلاعات هویتی',
  step2Label: '۲. بارگذاری مدارک',
  step3Label: '۳. پرسشنامه',
  step4Label: '۴. ثبت موفق',
  mobileStep1Label: 'اطلاعات هویتی',
  mobileStep2Label: 'بارگذاری مدارک',
  mobileStep3Label: 'پرسشنامه پاسخگویی',
  mobileStep4Label: 'ثبت موفق پرونده',
  successTitle: 'درخواست شما با موفقیت ثبت شد',
  trackingCodeLabel: 'کد پیگیری درخواست شما:',
  documentsTitle: 'بررسی و ارزیابی مدارک اولیه',
  documentsDescription: 'مدارک و اطلاعات پرواز شما توسط تیم حقوقی Flysos.ir به سرعت بررسی می‌شود. چنانچه پرواز شما بر اساس مقررات و آیین‌نامه حقوق مسافران سازمان هواپیمایی کشوری مشمول دریافت خسارت نقدی باشد، حداکثر تا ۴۸ ساعت آینده جهت انجام هماهنگی‌های بعدی با شما تماس تلفنی برقرار خواهیم کرد.',
  receiptLabel: 'دانلود خلاصه دادخواست اولیه ثبت‌شده (رسید تصویری)',
  powerOfAttorneyTitle: 'ثبت وکالت‌نامه در سامانه قضایی (ثنا)',
  powerOfAttorneyDescription: 'جهت آغاز پیگیری قضایی، پس از تایید نهایی مدارک توسط کارشناسان، کد تأیید پیامکی (OTP) برای واگذاری وکالت به وکلای همکار Flysos.ir به شماره همراه شما ارسال خواهد شد که جهت فعال‌سازی باید آن را تلفنی به ما اعلام فرمایید.',
  powerOfAttorneyLinkLabel: 'مشاهده و دانلود نمونه وکالت‌نامه رسمی ←',
  powerOfAttorneyPendingLabel: 'نمونه وکالت‌نامه به‌زودی بارگذاری می‌شود',
  guaranteeTitle: 'تعهد و تضمین Flysos.ir:',
  guaranteeText: 'از این لحظه به بعد، تمامی فرآیندهای دادرسی و اداری کاملاً بر عهده Flysos.ir است. ما تا دریافت خسارت نهایی هیچ هزینه‌ای از شما دریافت نمی‌کنیم و در صورت موفقیت، غرامت پس از کسر کارمزد ۲۰ درصدی مستقیماً به حساب شبا اعلامی شما واریز خواهد شد.',
  supportTitle: 'پشتیبانی تلفنی و شبکه‌های اجتماعی',
  supportDescription: 'پاسخگویی سریع در خصوص وضعیت پرونده',
  supportPhone: '02128421314',
  supportHandle: '@flysos',
  backHomeLabel: 'بازگشت به صفحه اصلی',
  otherCasesLabel: 'مشاهده وضعیت سایر پرونده‌ها',
  processingFinalText: 'در حال ثبت پرونده و استخراج اطلاعات بلیت هستیم',
  processingNextText: 'در حال انتقال امن به مرحله بعد هستید',
  processingDescription: 'برای جلوگیری از ثبت درخواست تکراری، تا پایان عملیات دسترسی صفحه موقتاً بسته شده است.',
}, { background: '#ffffff', color: '#0f172a', padding: '40px 24px' })];

const pageSeeds = {
  articles: [block('articles-page-main', 'blog-list', 0, {
    title: 'مقالات و راهنمای حقوق مسافر',
    description: 'مطالب آموزشی Flysos.ir درباره تأخیر، ابطال پرواز و شیوه پیگیری خسارت',
    items: [
      { id: 'article-delay-rights', category: 'تاخیر پرواز', tags: 'تاخیر، خسارت پرواز', title: 'حقوق مسافر در تأخیر پرواز', description: 'راهنمای مدارک، شرایط و مراحل پیگیری خسارت ناشی از تأخیر پرواز.' },
      { id: 'article-cancellation-rights', category: 'ابطال پرواز', tags: 'ابطال، لغو پرواز', title: 'در صورت ابطال پرواز چه کنیم؟', description: 'اقدام‌های ضروری پس از لغو پرواز و روش ثبت درخواست خسارت.' },
      { id: 'article-required-documents', category: 'راهنمای پرونده', tags: 'بلیت، کارت پرواز، مدارک', title: 'مدارک لازم برای پیگیری خسارت', description: 'بلیت، کارت پرواز و اطلاعاتی که بررسی پرونده را سریع‌تر می‌کند.' },
    ],
  }, { background: '#f8fafc', color: '#0f172a', padding: '64px 24px' })],
  faq: [block('faq-page-main', 'faq', 0, { title: 'سوالات متداول مسافران', description: 'پاسخ به رایج‌ترین پرسش‌های شما درباره ثبت و پیگیری خسارت پرواز', items: faqItems }, { background: '#f8fafc', padding: '64px 24px' })],
  about: [
    block('about-hero', 'hero', 0, { title: 'پشتیبان و حامی حقوق مسافران در سفرهای هوایی', subtitle: 'درباره flysos.ir', description: 'flysos.ir به عنوان پلتفرم تخصصی احقاق حقوق مسافران هوایی با تلفیق دانش حقوقی، تجربه هوانوردی و فناوری اطلاعات فعالیت می‌کند.' }, { background: '#ffffff', color: '#0f172a', padding: '64px 32px' }),
    block('about-advantages', 'features', 1, { title: 'چرا به تیم flysos.ir اعتماد می‌کنند؟', items: [
      { id:'about-a1', title:'۱. ۱۵ سال تجربه مدیریتی در صنعت هوایی', description:'بهره‌گیری از تخصص مدیران باسابقه در حقوق هوانوردی، بازرسی، دیسپچ و خدمات فرودگاهی.' },
      { id:'about-a2', title:'۲. سابقه فعالیت در نهادهای کلیدی', description:'سابقه همکاری و مشاوره با نهادهای کلیدی صنعت هوانوردی و حمایت از حقوق مصرف‌کنندگان.' },
      { id:'about-a3', title:'۳. وکلای تراز اول و کارشناسان رسمی', description:'دفاع قضایی توسط وکلای مجرب هوانوردی و کارشناسان رسمی دادگستری.' },
      { id:'about-a4', title:'۴. تیم IT و هوش مصنوعی هوانوردی', description:'پایش هوشمند تاخیر و لغو پرواز و تخمین درصد موفقیت پرونده.' },
    ] }, { background:'#f8fafc', padding:'64px 24px' }),
    block('about-mission', 'banner', 2, { title:'ماموریت ما در flysos.ir', text:'ماموریت ما ترویج آگاهی از حقوق مسافر، بهبود پاسخگویی ایرلاین‌ها و تسریع دریافت غرامت‌های قانونی است.' }, { background:'#0f172a', color:'#ffffff', padding:'56px 32px', borderRadius:'24px' }),
    block('about-difference', 'features', 3, { title:'آنچه ما را متمایز می‌کند', items:[
      {id:'about-d1',title:'دقت و تخصص بی‌نظیر',description:'تمرکز کامل بر قوانین حقوق مسافر و مراجع قضایی هوانوردی.'},
      {id:'about-d2',title:'مشتری‌مداری واقعی',description:'پشتیبانی مستمر و اطلاع‌رسانی روند پرونده.'},
      {id:'about-d3',title:'شفافیت و پاسخگویی',description:'بدون مراجعه حضوری یا پرداخت مبالغ علی‌الحساب.'},
    ] }, { background:'#ffffff', padding:'64px 24px' }),
  ],
  rights: [
    block('rights-hero','hero',0,{title:'حقوق مسافر در پروازهای هوایی',subtitle:'حقوق قانونی شما در پرواز',description:'مرجع جامع قوانین، خدمات و غرامت‌های مصوب مسافران پروازهای داخلی و بین‌المللی.'},{background:'#ffffff',color:'#0f172a',padding:'64px 32px'}),
    block('rights-principles','features',1,{title:'اصول بنیادین حقوق مسافر',items:[
      {id:'rights-p1',title:'اطلاع‌رسانی شفاف',description:'ارائه اطلاعات دقیق، به‌موقع و قابل دسترس در تمامی مراحل سفر و خرید بلیت.'},
      {id:'rights-p2',title:'احترام و کرامت انسانی',description:'رعایت شأن مسافر در فرآیندهای فرودگاهی و پروازی.'},
      {id:'rights-p3',title:'جبران خسارت و خدمات',description:'ارائه خدمات رفاهی و جبران خسارت در تاخیر، ابطال و ممانعت از پرواز.'},
      {id:'rights-p4',title:'پاسخگویی و رسیدگی',description:'ثبت و رسیدگی سریع به شکایات قانونی مسافران هوایی.'},
    ]},{background:'#f8fafc',padding:'64px 24px'}),
    block('rights-delays','accordion',2,{title:'خدمات و غرامت تاخیر پروازهای داخلی',items:[
      {id:'rights-d1',question:'کمتر از ۲ ساعت',answer:'اطلاع‌رسانی صحیح و پذیرایی نوع اول در صورت وجود زمان کافی.'},
      {id:'rights-d2',question:'بین ۲ تا ۵ ساعت',answer:'پذیرایی مناسب و انتخاب بین پرواز جایگزین یا استرداد وجه، همراه با غرامت معادل ۳۰٪ قیمت بلیت.'},
      {id:'rights-d3',question:'بیشتر از ۵ ساعت',answer:'پذیرایی و انتخاب بین پرواز جایگزین یا استرداد وجه، همراه با غرامت معادل یک برابر قیمت بلیت.'},
    ]},{background:'#ffffff',padding:'64px 24px'}),
    block('rights-faq','faq',3,{title:'پرسش‌های حقوق مسافر',items:[
      {id:'rights-f1',question:'آیا لغو پرواز به دلیل شرایط جوی مشمول غرامت است؟',answer:'در فورس ماژور غرامت نقدی اضافی تعلق نمی‌گیرد، اما عودت وجه یا پرواز جایگزین بدون جریمه الزامی است.'},
      {id:'rights-f2',question:'مبلغ غرامت تاخیر پرواز داخلی چگونه محاسبه می‌شود؟',answer:'بر اساس مدت تاخیر و جدول مصوب سازمان هواپیمایی کشوری محاسبه می‌شود.'},
    ]},{background:'#f8fafc',padding:'64px 24px'}),
  ],
  rules: [block('rules-main','accordion',0,{title:'شرایط و ضوابط خدمات flysos.ir',description:'چارچوب حقوقی همکاری بین مسافر و flysos.ir',items:[
    ['تعاریف و کلیات','این توافق‌نامه قرارداد حقوقی میان مسافر و flysos.ir و منطبق با قوانین جمهوری اسلامی ایران و آیین‌نامه‌های سازمان هواپیمایی کشوری است.'],
    ['حوزه خدمات و نحوه پیگیری','خدمات شامل استعلام پرواز، تطبیق تاخیر، ثبت دادخواست، پیگیری قضایی و وصول غرامت است.'],
    ['وکالت و وکلای پایه یک دادگستری','ثبت نهایی پرونده منوط به تایید وکالت‌نامه رسمی در سامانه ثنا توسط مسافر است.'],
    ['حق‌الزحمه و نحوه تقسیم خسارت','هیچ هزینه اولیه‌ای دریافت نمی‌شود؛ پس از موفقیت ۲۰٪ کارمزد و ۸۰٪ سهم مسافر است.'],
    ['تعهدات مسافر','مسافر باید اطلاعات هویتی، پرواز و اسناد را مطابق واقعیت ارائه کند.'],
    ['قطع همکاری و انصراف','تا پیش از ثبت دادخواست و تایید وکالت ثنا، انصراف بدون جریمه امکان‌پذیر است.'],
    ['محرمانگی اطلاعات','اطلاعات هویتی و مدارک صرفاً برای پیگیری حقوقی استفاده و محرمانه نگهداری می‌شوند.'],
  ].map(([question,answer],index)=>({id:`rules-${index+1}`,question,answer}))},{background:'#f8fafc',padding:'64px 24px'})],
  services: [
    block('services-title','hero',0,{title:'خدمات Flysos.ir',subtitle:'پیگیری تخصصی حقوق مسافران هوایی',description:'بررسی تأخیر و ابطال پرواز، تکمیل مدارک، پیگیری حقوقی و وصول خسارت.'},{background:'#ffffff',color:'#0f172a',padding:'64px 32px'}),
    block('services-list','services',1,{title:'خدمات ما',items:[
      {id:'service-delay',title:'خسارت تأخیر پرواز',description:'بررسی مشمول بودن و پیگیری قانونی خسارت تأخیر پرواز.'},
      {id:'service-cancel',title:'خسارت ابطال پرواز',description:'پیگیری استرداد وجه، پرواز جایگزین و غرامت ابطال.'},
      {id:'service-legal',title:'پیگیری حقوقی کامل',description:'تنظیم وکالت‌نامه، دادخواست، رأی و وصول غرامت.'},
    ]},{background:'#f8fafc',padding:'64px 24px'}),
  ],
  privacy: [
    block('privacy-title','hero',0,{title:'حریم خصوصی',subtitle:'حفاظت از اطلاعات مسافران',description:'نحوه جمع‌آوری، نگهداری و استفاده از اطلاعات هویتی و پرونده‌های کاربران.'},{background:'#ffffff',color:'#0f172a',padding:'64px 32px'}),
    block('privacy-content','accordion',1,{title:'سیاست حریم خصوصی',items:[
      {id:'privacy-identity',question:'اطلاعات هویتی',answer:'اطلاعات هویتی صرفاً برای بررسی و پیگیری قانونی پرونده استفاده می‌شود.'},
      {id:'privacy-docs',question:'اسناد و مدارک',answer:'بلیت، کارت پرواز و مدارک بارگذاری‌شده محرمانه نگهداری می‌شوند.'},
      {id:'privacy-contact',question:'اطلاعات تماس',answer:'اطلاعات تماس فقط برای اطلاع‌رسانی وضعیت پرونده و پشتیبانی استفاده می‌شود.'},
    ]},{background:'#f8fafc',padding:'64px 24px'}),
  ],
  contact: [
    block('contact-title','hero',0,{title:'تماس با Flysos.ir',subtitle:'پشتیبانی مسافران',description:'برای پرسش‌های حقوقی، پیگیری پرونده و پشتیبانی با ما در ارتباط باشید.'},{background:'#ffffff',color:'#0f172a',padding:'64px 32px'}),
    block('contact-info','cards',1,{title:'راه‌های ارتباطی',items:[
      {id:'contact-phone',title:'تلفن',description:'02128421314'},
      {id:'contact-email',title:'ایمیل',description:'info@flysos.ir'},
      {id:'contact-hours',title:'ساعات پاسخ‌گویی',description:'شنبه تا چهارشنبه ۹ تا ۱۶، پنجشنبه ۹ تا ۱۲'},
    ]},{background:'#f8fafc',padding:'64px 24px'}),
    block('contact-form','contact-form',2,{title:'ارسال پیام',description:'پیام شما مستقیماً در پنل پشتیبانی ثبت می‌شود.'},{background:'#ffffff',padding:'48px 24px'}),
  ],
};

const globalSeeds = {
  header: [block('global-header-main','site-header',0,{brand:'flysos.ir',subtitle:'متخصص در امور حقوق مسافران هوایی',ctaLabel:'ورود و پیگیری پرونده',sticky:true,items:[
    {id:'nav-home',label:'صفحه اصلی',page:'home',visible:true}, {id:'nav-rights',label:'حقوق مسافر',page:'rights',visible:true},
    {id:'nav-faq',label:'سوالات متداول',page:'faq',visible:true}, {id:'nav-about',label:'درباره ما',page:'about',visible:true},
    {id:'nav-articles',label:'مقالات',page:'articles',visible:true},
  ]},{background:'#ffffff',color:'#0f172a',padding:'0 24px'})],
  footer: [block('global-footer-main','site-footer',0,{brand:'Flysos.ir',description:'متخصص در امور حقوق مسافران هوایی',phone:'02128421314',email:'info@flysos.ir',hours:'شنبه تا چهارشنبه ۹ تا ۱۶، پنجشنبه ۹ تا ۱۲',copyright:'طراحی و توسعه توسط شرکت بارمانا',copyrightUrl:'https://bog.co.ir/',showEnamad:true,enamadPosition:'bottom-left',enamadUrl:'https://trustseal.enamad.ir/?id=760585&Code=8nt2quMm25MRCFZiptLDMtUijRdWsCUD',enamadImage:'https://trustseal.enamad.ir/logo.aspx?id=760585&Code=8nt2quMm25MRCFZiptLDMtUijRdWsCUD',enamadAlt:'نماد اعتماد الکترونیکی',columns:[
    {id:'footer-services',title:'خدمات ما',links:[{id:'fs1',label:'پیگیری خسارت تاخیر پرواز',page:'track'},{id:'fs2',label:'پیگیری ابطال پرواز',page:'track'}]},
    {id:'footer-fast',title:'دسترسی سریع',links:[{id:'ff1',label:'حقوق مسافر',page:'rights'},{id:'ff2',label:'سوالات متداول',page:'faq'},{id:'ff3',label:'شرایط و ضوابط خدمات',page:'terms'},{id:'ff4',label:'درباره ما',page:'about'},{id:'ff5',label:'مقالات',page:'articles'}]},
  ],socials:[{id:'social-bale',label:'بله',href:'https://ble.ir/flysos'},{id:'social-telegram',label:'تلگرام',href:'https://t.me/flysos'},{id:'social-instagram',label:'اینستاگرام',href:'https://instagram.com/flysos'}]},{background:'#0b1120',color:'#cbd5e1',padding:'48px 24px'})],
};

function parseBlocks(value) { if (Array.isArray(value)) return value; try { return JSON.parse(value || '[]'); } catch { return []; } }

async function ensureTrackPage(connection) {
  const [rows] = await connection.query('SELECT `id`,`blocks`,`draftBlocks`,`publishedBlocks` FROM `CmsPage` WHERE `slug`=? LIMIT 1', ['track']);
  const blocks = JSON.stringify(trackSuccessBlocks);
  const seo = JSON.stringify({
    metaTitle: 'ثبت و پیگیری پرونده | Flysos.ir',
    metaDescription: 'ثبت و پیگیری پرونده حقوق مسافران هوایی در Flysos.ir',
    canonical: 'https://flysos.ir/track',
    robotsIndex: false,
    robotsFollow: true,
  });
  if (rows[0]) {
    const hasContent = [rows[0].draftBlocks, rows[0].publishedBlocks, rows[0].blocks].some((value) => parseBlocks(value).length > 0);
    if (hasContent) return 'existing';
    await connection.query(
      'UPDATE `CmsPage` SET `status`=\'published\',`blocks`=?,`seo`=?,`draftBlocks`=?,`publishedBlocks`=?,`draftSeo`=?,`publishedSeo`=?,`publishedAt`=COALESCE(`publishedAt`,NOW(3)),`updatedAt`=NOW(3) WHERE `id`=?',
      [blocks, seo, blocks, blocks, seo, seo, rows[0].id],
    );
    return 'migrated';
  }
  await connection.query(
    `INSERT INTO \`CmsPage\` (\`id\`,\`title\`,\`slug\`,\`status\`,\`blocks\`,\`seo\`,\`draftBlocks\`,\`publishedBlocks\`,\`draftSeo\`,\`publishedSeo\`,\`publishedAt\`,\`pageType\`,\`category\`,\`tags\`,\`keywords\`,\`featuredImageUrl\`) VALUES (?,?,?,'published',?,?,?,?,?,?,NOW(3),'page','',?,?,'')`,
    [randomUUID(), 'ثبت و پیگیری پرونده', 'track', blocks, seo, blocks, blocks, seo, seo, '[]', '[]'],
  );
  return 'created';
}

function composeHomeHero(blocks) {
  if (!Array.isArray(blocks) || blocks.some((item) => item?.id === 'home-hero-composition')) return blocks;
  const heroIndex = blocks.findIndex((item) => item?.type === 'hero');
  const formIndex = blocks.findIndex((item) => item?.type === 'claim-form');
  if (heroIndex < 0 || formIndex < 0) return blocks;
  const hero = structuredClone(blocks[heroIndex]);
  const form = structuredClone(blocks[formIndex]);
  const image = hero.content?.image || '';
  const overlayOpacity = Number(hero.content?.overlay ?? 72);
  hero.content = { ...hero.content, image: '', overlay: 0 };
  hero.styles = { ...hero.styles, background: 'transparent', padding: '32px 16px' };
  hero.order = 0; form.order = 1;
  const section = block('home-hero-composition','section',Math.min(heroIndex,formIndex),{
    backgroundImage:image, overlayOpacity, migrationVersion:'home-hero-composition-v3',
  },{background:'#0f172a',color:'#ffffff',padding:'48px 32px',minHeight:'560px',display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(320px,500px)',alignItems:'center',gap:'36px',backgroundPosition:'center',backgroundSize:'cover'},[hero,form]);
  section.responsive = { tablet:{gridTemplateColumns:'minmax(0,1fr) minmax(300px,420px)',gap:'24px'},mobile:{gridTemplateColumns:'1fr',padding:'32px 16px',minHeight:'auto',gap:'24px'} };
  const next = blocks.filter((_,index)=>index!==heroIndex&&index!==formIndex);
  next.splice(Math.min(heroIndex,formIndex),0,section);
  return next.map((item,order)=>({...item,order}));
}

function finalizeHomeComposition(blocks) {
  return blocks.map((item) => item?.id !== 'home-hero-composition' ? item : {
    ...item,
    children: (item.children || []).map((child) => child?.type !== 'claim-form' ? child : {
      ...child, content: { ...child.content, embedded: true },
      styles: { ...child.styles, background: 'transparent', padding: '0' },
    }),
  });
}

function refreshHomeContent(blocks) {
  const seeds = new Map(homeBlocks.map((item) => [item.id, item]));
  return blocks.map((item) => {
    if (item?.id === 'home-hero-composition') {
      const children = (item.children || []).map((child) => {
        const seed = seeds.get(child.id);
        if (!seed) return child;
        return {
          ...child,
          content: {
            ...child.content,
            ...structuredClone(seed.content),
            ...(child.type === 'claim-form' ? { embedded: true } : {}),
          },
        };
      });
      return {
        ...item,
        content: {
          ...item.content,
          backgroundImage: '',
          overlayOpacity: 72,
          migrationVersion: 'home-pdf-corrections-v7',
        },
        styles: {
          ...item.styles,
          padding: '48px 32px',
          minHeight: '560px',
          gap: '36px',
        },
        responsive: {
          ...item.responsive,
          tablet: {
            ...item.responsive?.tablet,
            gridTemplateColumns: 'minmax(0,1fr) minmax(300px,420px)',
            gap: '24px',
          },
          mobile: {
            ...item.responsive?.mobile,
            gridTemplateColumns: '1fr',
            padding: '32px 16px',
            minHeight: 'auto',
            gap: '24px',
          },
        },
        children,
      };
    }
    const seed = seeds.get(item?.id);
    return seed ? { ...item, content: structuredClone(seed.content) } : item;
  });
}

async function seedPage(connection, slug, blocks) {
  const [rows] = await connection.query('SELECT `id`,`blocks`,`draftBlocks`,`publishedBlocks` FROM `CmsPage` WHERE `slug`=? LIMIT 1',[slug]);
  if (!rows[0]) return 'missing';
  const hasContent = [rows[0].draftBlocks,rows[0].publishedBlocks,rows[0].blocks].some((value)=>parseBlocks(value).length>0);
  if (hasContent) return 'skipped';
  await connection.query('UPDATE `CmsPage` SET `draftBlocks`=?,`updatedAt`=NOW(3) WHERE `id`=?',[JSON.stringify(blocks),rows[0].id]);
  return 'migrated';
}

async function repairHome(connection) {
  const marker = 'home-pdf-corrections-v7';
  const [done] = await connection.query('SELECT `id` FROM `CmsMigration` WHERE `id`=? LIMIT 1',[marker]);
  if (done[0]) return 'skipped';
  const [rows] = await connection.query('SELECT `id`,`draftBlocks`,`publishedBlocks`,`blocks` FROM `CmsPage` WHERE `slug`=? LIMIT 1',['home']);
  if (!rows[0]) return 'missing';
  const draft = refreshHomeContent(finalizeHomeComposition(composeHomeHero(parseBlocks(rows[0].draftBlocks || rows[0].blocks))));
  const publishedInput = parseBlocks(rows[0].publishedBlocks);
  const published = publishedInput.length ? refreshHomeContent(finalizeHomeComposition(composeHomeHero(publishedInput))) : null;
  await connection.query('UPDATE `CmsPage` SET `draftBlocks`=?,`publishedBlocks`=? WHERE `id`=?',[JSON.stringify(draft),published ? JSON.stringify(published) : null,rows[0].id]);
  await connection.query('INSERT IGNORE INTO `CmsMigration` (`id`) VALUES (?)',[marker]);
  return 'migrated';
}

async function restoreBuiltInPageFallbacks(connection) {
  const marker = 'built-in-page-fallbacks-v1';
  const [done] = await connection.query('SELECT `id` FROM `CmsMigration` WHERE `id`=? LIMIT 1',[marker]);
  if (done[0]) return 'skipped';

  for (const [slug, blocks] of Object.entries(pageSeeds)) {
    await connection.query(
      'UPDATE `CmsPage` SET `status`=?,`draftBlocks`=?,`publishedBlocks`=NULL,`publishedSeo`=NULL,`publishedAt`=NULL WHERE `slug`=?',
      ['draft', JSON.stringify(blocks), slug],
    );
  }
  await connection.query(
    'UPDATE `CmsPage` SET `status`=?,`publishedBlocks`=NULL,`publishedSeo`=NULL,`publishedAt`=NULL WHERE `slug`=?',
    ['draft', 'home'],
  );
  await connection.query('INSERT IGNORE INTO `CmsMigration` (`id`) VALUES (?)',[marker]);
  return 'migrated';
}

async function refreshEditorDrafts(connection) {
  const marker = 'page-builder-visual-parity-v2';
  const [done] = await connection.query('SELECT `id` FROM `CmsMigration` WHERE `id`=? LIMIT 1',[marker]);
  if (done[0]) return 'skipped';

  const [homeRows] = await connection.query(
    'SELECT `id`,`draftBlocks`,`blocks` FROM `CmsPage` WHERE `slug`=? LIMIT 1',
    ['home'],
  );
  if (homeRows[0]) {
    const source = parseBlocks(homeRows[0].draftBlocks || homeRows[0].blocks);
    const draft = refreshHomeContent(finalizeHomeComposition(composeHomeHero(source.length ? source : homeBlocks)));
    await connection.query(
      'UPDATE `CmsPage` SET `draftBlocks`=?,`updatedAt`=NOW(3) WHERE `id`=?',
      [JSON.stringify(draft), homeRows[0].id],
    );
  }

  for (const [slug, blocks] of Object.entries(pageSeeds)) {
    // Articles are authored by the dedicated article manager. Never replace
    // an editor's saved article list with bundled seed content.
    if (slug === 'articles') continue;
    await connection.query(
      'UPDATE `CmsPage` SET `draftBlocks`=?,`updatedAt`=NOW(3) WHERE `slug`=?',
      [JSON.stringify(blocks), slug],
    );
  }

  await connection.query('INSERT IGNORE INTO `CmsMigration` (`id`) VALUES (?)',[marker]);
  return homeRows[0] ? 'migrated' : 'home-missing';
}

async function seedGlobals(connection) {
  for (const type of ['header','footer']) {
    await connection.query('INSERT IGNORE INTO `CmsGlobalLayout` (`id`,`layoutType`,`title`,`status`,`draftBlocks`) VALUES (?,?,?,?,?)',[
      `global-${type}`,type,type==='header'?'هدر سایت':'فوتر سایت','draft',JSON.stringify(globalSeeds[type]),
    ]);
  }
}

async function repairGlobals(connection) {
  const marker = 'global-contact-navigation-v1';
  const [done] = await connection.query('SELECT `id` FROM `CmsMigration` WHERE `id`=? LIMIT 1',[marker]);
  if (done[0]) return 'skipped';

  for (const type of ['header','footer']) {
    const [rows] = await connection.query('SELECT `id`,`draftBlocks`,`publishedBlocks` FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1',[type]);
    if (!rows[0]) continue;
    const updateBlocks = (value) => {
      const blocks = parseBlocks(value);
      if (!blocks.length) return blocks;
      const first = blocks[0];
      if (type === 'header') {
        const navItems = Array.isArray(first.content?.navItems) ? first.content.navItems : [];
        if (!navItems.some((item) => item.page === 'articles')) navItems.push({id:'nav-articles',label:'مقالات',page:'articles',visible:true});
        first.content = {...first.content, brand:'Flysos.ir', navItems};
      } else {
        const columns = Array.isArray(first.content?.columns) ? first.content.columns.map((column) => ({
          ...column,
          links: Array.isArray(column.links) ? column.links.filter((link) => !String(link.label || '').includes('گم‌شدن بار')) : [],
        })) : [];
        first.content = {
          ...first.content,
          brand:'Flysos.ir',
          description:'متخصص در امور حقوق مسافران هوایی',
          phone:'02128421314',
          hours:'شنبه تا چهارشنبه ۹ تا ۱۶، پنجشنبه ۹ تا ۱۲',
          columns,
          socials:[
            {id:'social-bale',label:'بله',href:'https://ble.ir/flysos'},
            {id:'social-telegram',label:'تلگرام',href:'https://t.me/flysos'},
            {id:'social-instagram',label:'اینستاگرام',href:'https://instagram.com/flysos'},
          ],
        };
      }
      return blocks;
    };
    const draft = updateBlocks(rows[0].draftBlocks);
    const publishedInput = parseBlocks(rows[0].publishedBlocks);
    const published = publishedInput.length ? updateBlocks(publishedInput) : null;
    await connection.query('UPDATE `CmsGlobalLayout` SET `draftBlocks`=?,`publishedBlocks`=? WHERE `id`=?',[JSON.stringify(draft),published ? JSON.stringify(published) : null,rows[0].id]);
  }
  await connection.query('INSERT IGNORE INTO `CmsMigration` (`id`) VALUES (?)',[marker]);
  return 'migrated';
}

async function addEditableFooterTrustSeal(connection) {
  const marker = 'editable-footer-trust-seal-v1';
  const [done] = await connection.query('SELECT `id` FROM `CmsMigration` WHERE `id`=? LIMIT 1',[marker]);
  if (done[0]) return 'skipped';
  const [rows] = await connection.query('SELECT `id`,`draftBlocks`,`publishedBlocks` FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1',['footer']);
  if (!rows[0]) return 'missing';
  const enrich = (value) => {
    const blocks = parseBlocks(value);
    if (!blocks.length) return blocks;
    blocks[0].content = {
      ...blocks[0].content,
      showEnamad: blocks[0].content?.showEnamad !== false,
      enamadPosition: blocks[0].content?.enamadPosition || 'bottom-left',
      enamadUrl: blocks[0].content?.enamadUrl || 'https://trustseal.enamad.ir/?id=760585&Code=8nt2quMm25MRCFZiptLDMtUijRdWsCUD',
      enamadImage: blocks[0].content?.enamadImage || 'https://trustseal.enamad.ir/logo.aspx?id=760585&Code=8nt2quMm25MRCFZiptLDMtUijRdWsCUD',
      enamadAlt: blocks[0].content?.enamadAlt || 'نماد اعتماد الکترونیکی',
    };
    return blocks;
  };
  const draft = enrich(rows[0].draftBlocks);
  const publishedSource = parseBlocks(rows[0].publishedBlocks);
  const published = publishedSource.length ? enrich(publishedSource) : null;
  await connection.query('UPDATE `CmsGlobalLayout` SET `draftBlocks`=?,`publishedBlocks`=? WHERE `id`=?',[JSON.stringify(draft),published ? JSON.stringify(published) : null,rows[0].id]);
  await connection.query('INSERT IGNORE INTO `CmsMigration` (`id`) VALUES (?)',[marker]);
  return 'migrated';
}

async function addBarmanaFooterSignature(connection) {
  const marker = 'barmana-footer-signature-v1';
  const [done] = await connection.query('SELECT `id` FROM `CmsMigration` WHERE `id`=? LIMIT 1',[marker]);
  if (done[0]) return 'skipped';
  const [rows] = await connection.query('SELECT `id`,`draftBlocks`,`publishedBlocks` FROM `CmsGlobalLayout` WHERE `layoutType`=? LIMIT 1',['footer']);
  if (!rows[0]) return 'missing';
  const enrich = (value) => {
    const blocks = parseBlocks(value);
    if (!blocks.length) return blocks;
    blocks[0].content = {
      ...blocks[0].content,
      copyright: 'طراحی و توسعه توسط شرکت بارمانا',
      copyrightUrl: 'https://bog.co.ir/',
    };
    return blocks;
  };
  const draft = enrich(rows[0].draftBlocks);
  const publishedSource = parseBlocks(rows[0].publishedBlocks);
  const published = publishedSource.length ? enrich(publishedSource) : null;
  await connection.query('UPDATE `CmsGlobalLayout` SET `draftBlocks`=?,`publishedBlocks`=? WHERE `id`=?',[JSON.stringify(draft),published ? JSON.stringify(published) : null,rows[0].id]);
  await connection.query('INSERT IGNORE INTO `CmsMigration` (`id`) VALUES (?)',[marker]);
  return 'migrated';
}

export async function seedCmsPageContent(connection) {
  const homeResult = await seedPage(connection,'home',homeBlocks);
  const trackResult = await ensureTrackPage(connection);
  const results = { home:homeResult, track:trackResult };
  for (const [slug,blocks] of Object.entries(pageSeeds)) {
    if (slug === 'track' && trackResult === 'created') continue;
    results[slug] = await seedPage(connection,slug,blocks);
  }
  results.homeHero = await repairHome(connection);
  results.publicFallbacks = await restoreBuiltInPageFallbacks(connection);
  results.editorDrafts = await refreshEditorDrafts(connection);
  await seedGlobals(connection);
  results.globals = await repairGlobals(connection);
  results.footerTrustSeal = await addEditableFooterTrustSeal(connection);
  results.footerSignature = await addBarmanaFooterSignature(connection);
  console.log(`CMS seed: ${JSON.stringify(results)}`);
}
