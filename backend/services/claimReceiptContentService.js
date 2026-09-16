const PROTECTED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export const RECEIPT_CONTENT_KEY = 'رسید نهایی';

export const CLAIM_RECEIPT_CONTENT = Object.freeze({
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
});

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : fallback;
}

export function normalizeReceiptContent(value) {
  const source = isRecord(value) ? value : {};
  const normalized = {};

  for (const [key, item] of Object.entries(source)) {
    if (PROTECTED_KEYS.has(key) || Object.prototype.hasOwnProperty.call(CLAIM_RECEIPT_CONTENT, key)) continue;
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') normalized[key] = item;
  }

  for (const [key, fallback] of Object.entries(CLAIM_RECEIPT_CONTENT)) {
    normalized[key] = normalizeText(source[key], fallback);
  }

  return normalized;
}

function normalizeBlock(block, slug) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return block;
  const next = { ...block };
  if (Array.isArray(block.children)) next.children = normalizeTrackBlocks(block.children, slug);

  if (block.id === 'track-success') {
    const content = isRecord(block.content) ? { ...block.content } : {};
    const existing = content[RECEIPT_CONTENT_KEY] || content.receipt;
    content[RECEIPT_CONTENT_KEY] = normalizeReceiptContent(existing);
    next.content = content;
  }

  return next;
}

export function normalizeTrackBlocks(blocks, slug = 'track') {
  if (slug !== 'track' || !Array.isArray(blocks)) return blocks;
  return blocks.map((block) => normalizeBlock(block, slug));
}
