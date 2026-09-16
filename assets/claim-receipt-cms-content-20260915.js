(function installClaimReceiptCmsContent() {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__flysosClaimReceiptCmsInstalled) return;
  window.__flysosClaimReceiptCmsInstalled = true;

  const fallback = {
    'نام سامانه': 'Flysos.ir',
    'زیرعنوان سامانه': 'متخصص در امور مسافران هوایی',
    'عنوان رسید': 'رسید دیجیتال ثبت نهایی دادخواست دریافت خسارت پروازی',
    'عنوان کد پیگیری': 'کد پیگیری اختصاصی پرونده شما',
    'برچسب کد ملی مسافر': 'کد ملی مسافر',
    'برچسب شماره تلفن همراه': 'شماره تلفن همراه',
    'برچسب نوع خسارت انتخابی': 'نوع خسارت انتخابی',
    'برچسب فایل بلیت ثبت‌شده': 'فایل بلیت ثبت‌شده',
    'برچسب فایل کارت پرواز': 'فایل کارت پرواز',
    'برچسب تاریخ ثبت درخواست': 'تاریخ ثبت درخواست',
    'برچسب وضعیت اولیه پرونده': 'وضعیت اولیه پرونده',
    'متن نوع خسارت ابطال': 'ابطال پرواز (ابطال‌شده)',
    'متن نوع خسارت تأخیر': 'تاخیر پرواز (دیرکرد)',
    'متن فایل بارگذاری‌نشده': 'بارگذاری نشده',
    'متن وضعیت اولیه': 'ثبت‌شده (در حال توزیع به تیم کارشناسی حقوقی)',
    'عنوان تعهد': 'تعهد رسمی تیم تخصصی Flysos.ir',
    'متن تعهد': 'تمامی هزینه‌های دادرسی بر عهده ماست. دریافت کارمزد فقط در صورت موفقیت نهایی پرونده.',
    'متن تماس': 'تلفن: 02128421314 | پیام‌رسان‌ها: @flysos | ایمیل: info@flysos.ir',
    'متن پابرگ': 'Flysos.ir | Air Passenger Rights Specialists',
  };
  let receipt = { ...fallback };

  const aliases = {
    'نام سامانه': ['نام سامانه', 'brand'],
    'زیرعنوان سامانه': ['زیرعنوان سامانه', 'subtitle'],
    'عنوان رسید': ['عنوان رسید', 'receiptTitle'],
    'عنوان کد پیگیری': ['عنوان کد پیگیری', 'trackingTitle'],
    'برچسب کد ملی مسافر': ['برچسب کد ملی مسافر', 'nationalIdLabel'],
    'برچسب شماره تلفن همراه': ['برچسب شماره تلفن همراه', 'phoneLabel'],
    'برچسب نوع خسارت انتخابی': ['برچسب نوع خسارت انتخابی', 'claimTypeLabel'],
    'برچسب فایل بلیت ثبت‌شده': ['برچسب فایل بلیت ثبت‌شده', 'ticketFileLabel'],
    'برچسب فایل کارت پرواز': ['برچسب فایل کارت پرواز', 'boardingPassFileLabel'],
    'برچسب تاریخ ثبت درخواست': ['برچسب تاریخ ثبت درخواست', 'submittedAtLabel'],
    'برچسب وضعیت اولیه پرونده': ['برچسب وضعیت اولیه پرونده', 'initialStatusLabel'],
    'متن نوع خسارت ابطال': ['متن نوع خسارت ابطال', 'cancellationClaimType'],
    'متن نوع خسارت تأخیر': ['متن نوع خسارت تأخیر', 'delayClaimType'],
    'متن فایل بارگذاری‌نشده': ['متن فایل بارگذاری‌نشده', 'missingFile'],
    'متن وضعیت اولیه': ['متن وضعیت اولیه', 'initialStatus'],
    'عنوان تعهد': ['عنوان تعهد', 'legalTitle'],
    'متن تعهد': ['متن تعهد', 'legalText'],
    'متن تماس': ['متن تماس', 'contactText'],
    'متن پابرگ': ['متن پابرگ', 'footerText'],
  };

  const readText = (source, keys, defaultValue) => {
    for (const key of keys) {
      if (typeof source?.[key] === 'string' && source[key].trim()) return source[key].trim();
    }
    return defaultValue;
  };

  const findBlock = (blocks, id) => {
    for (const block of Array.isArray(blocks) ? blocks : []) {
      if (block?.id === id) return block;
      const nested = findBlock(block?.children, id);
      if (nested) return nested;
    }
    return null;
  };

  const buildReplacementMap = () => {
    const map = new Map([
      ['Flysos.ir', readText(receipt, aliases['نام سامانه'], fallback['نام سامانه'])],
      ['متخصص در امور مسافران هوایی', readText(receipt, aliases['زیرعنوان سامانه'], fallback['زیرعنوان سامانه'])],
      ['متخصص در امور حقوق مسافران هوایی', readText(receipt, aliases['زیرعنوان سامانه'], fallback['زیرعنوان سامانه'])],
      ['رسید دیجیتال ثبت نهایی دادخواست دریافت خسارت پروازی', readText(receipt, aliases['عنوان رسید'], fallback['عنوان رسید'])],
      ['کد پیگیری اختصاصی پرونده شما', readText(receipt, aliases['عنوان کد پیگیری'], fallback['عنوان کد پیگیری'])],
      ['کد ملی مسافر', readText(receipt, aliases['برچسب کد ملی مسافر'], fallback['برچسب کد ملی مسافر'])],
      ['شماره تلفن همراه', readText(receipt, aliases['برچسب شماره تلفن همراه'], fallback['برچسب شماره تلفن همراه'])],
      ['نوع خسارت انتخابی', readText(receipt, aliases['برچسب نوع خسارت انتخابی'], fallback['برچسب نوع خسارت انتخابی'])],
      ['فایل بلیت ثبت‌شده', readText(receipt, aliases['برچسب فایل بلیت ثبت‌شده'], fallback['برچسب فایل بلیت ثبت‌شده'])],
      ['فایل کارت پرواز', readText(receipt, aliases['برچسب فایل کارت پرواز'], fallback['برچسب فایل کارت پرواز'])],
      ['تاریخ ثبت درخواست', readText(receipt, aliases['برچسب تاریخ ثبت درخواست'], fallback['برچسب تاریخ ثبت درخواست'])],
      ['وضعیت اولیه پرونده', readText(receipt, aliases['برچسب وضعیت اولیه پرونده'], fallback['برچسب وضعیت اولیه پرونده'])],
      ['ابطال پرواز (ابطال‌شده)', readText(receipt, aliases['متن نوع خسارت ابطال'], fallback['متن نوع خسارت ابطال'])],
      ['تاخیر پرواز (دیرکرد)', readText(receipt, aliases['متن نوع خسارت تأخیر'], fallback['متن نوع خسارت تأخیر'])],
      ['تأخیر پرواز (دیرکرد)', readText(receipt, aliases['متن نوع خسارت تأخیر'], fallback['متن نوع خسارت تأخیر'])],
      ['بارگذاری نشده', readText(receipt, aliases['متن فایل بارگذاری‌نشده'], fallback['متن فایل بارگذاری‌نشده'])],
      ['ثبت‌شده (در حال توزیع به تیم کارشناسی حقوقی)', readText(receipt, aliases['متن وضعیت اولیه'], fallback['متن وضعیت اولیه'])],
      ['تعهد رسمی تیم تخصصی Flysos.ir', readText(receipt, aliases['عنوان تعهد'], fallback['عنوان تعهد'])],
      ['تمامی هزینه‌های دادرسی بر عهده ماست. دریافت کارمزد فقط در صورت موفقیت نهایی پرونده.', readText(receipt, aliases['متن تعهد'], fallback['متن تعهد'])],
      ['تلفن: 02128421314 | پیام‌رسان‌ها: @flysos | ایمیل: info@flysos.ir', readText(receipt, aliases['متن تماس'], fallback['متن تماس'])],
      ['Flysos.ir | Air Passenger Rights Specialists', readText(receipt, aliases['متن پابرگ'], fallback['متن پابرگ'])],
    ]);
    return map;
  };

  const canvasPrototype = typeof window.CanvasRenderingContext2D !== 'undefined'
    ? window.CanvasRenderingContext2D.prototype
    : null;
  if (canvasPrototype && typeof canvasPrototype.fillText === 'function') {
    const originalFillText = canvasPrototype.fillText;
    canvasPrototype.fillText = function patchedReceiptFillText(text, ...args) {
      const canvas = this.canvas;
      if (canvas && (canvas.width === 750 && canvas.height === 980) && typeof text === 'string') {
        text = buildReplacementMap().get(text) || text;
      }
      return originalFillText.call(this, text, ...args);
    };
  }

  const loadReceiptContent = async () => {
    try {
      const response = await fetch('/api/pages/track?_receipt_cms=20260915', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const block = findBlock(payload?.blocks, 'track-success');
      const content = block?.content || {};
      const cmsReceipt = content['رسید نهایی'] || content.receipt;
      if (!cmsReceipt || typeof cmsReceipt !== 'object' || Array.isArray(cmsReceipt)) return;
      receipt = { ...receipt, ...cmsReceipt };
    } catch {
      // The hardcoded defaults keep receipt downloads usable if CMS is unavailable.
    }
  };

  void loadReceiptContent();
})();
