import { query } from '../config/db.js';

export const DEFAULT_SMS_TEMPLATES = Object.freeze({
  registration: [
    'مسافر عزیز',
    '',
    'پرونده خسارت پرواز شما با شماره {trackingCode} در Flysos ثبت گردید.',
    '',
    'وکلای ما پس از بررسی پرونده برای تنظیم رایگان وکالتنامه و راهنمایی مراحل بعدی با شما تماس خواهند گرفت 📞',
    '',
    '«تمامی هزینه‌های دادرسی و وکلا با Flysos است»',
    '',
    'حامی حقوق مسافر | Flysos 🛫',
  ].join('\n'),
  statusUpdate: [
    'مسافر گرامی',
    '',
    'پرونده شما بروزرسانی شد. جهت مشاهده وضعیت پرونده خود می‌توانید به سایت Flysos.ir مراجعه فرمایید.🌐',
    '',
    'حامی حقوق مسافر | Flysos 🛫',
  ].join('\n'),
  replacementTicket: 'مسافر گرامی، لطفاً تصویر واضح کارت پرواز خود را برای پرونده {trackingCode} ارسال کنید.',
  bankDetails: 'مسافر گرامی، لطفاً اطلاعات شبا و نام صاحب حساب پرونده {trackingCode} را بررسی و تأیید کنید.',
  supportReceived: 'پیام شما دریافت شد. کد پیگیری پشتیبانی: {ticketId}',
  supportReply: 'پاسخ پشتیبانی: {message}',
});

let smsTemplateColumnReady;

export async function ensureSmsTemplateColumn() {
  if (!smsTemplateColumnReady) {
    smsTemplateColumnReady = (async () => {
      try {
        const columns = await query(
          'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "AppSetting" AND COLUMN_NAME = "smsTemplates"'
        );
        if (!columns.length) {
          await query('ALTER TABLE AppSetting ADD COLUMN smsTemplates LONGTEXT NULL AFTER powerOfAttorneyUrl');
        }
        return true;
      } catch (error) {
        smsTemplateColumnReady = undefined;
        console.warn('[sms-templates] storage is unavailable; using defaults:', error?.message || error);
        return false;
      }
    })();
  }
  return smsTemplateColumnReady;
}

export function normalizeSmsTemplates(raw) {
  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_SMS_TEMPLATES).map(([key, fallback]) => {
      const value = typeof source[key] === 'string' && source[key].trim()
        ? source[key].trim()
        : fallback;
      return [key, value];
    })
  );
}

export async function getStoredSmsTemplates(settingsRow = null) {
  await ensureSmsTemplateColumn();
  let row = settingsRow;
  if (!row || !Object.prototype.hasOwnProperty.call(row, 'smsTemplates')) {
    try {
      const rows = await query('SELECT smsTemplates FROM AppSetting WHERE id = "default" LIMIT 1');
      row = rows[0] || {};
    } catch {
      row = {};
    }
  }
  return normalizeSmsTemplates(row.smsTemplates);
}

export function renderSmsTemplate(template, variables = {}) {
  let rendered = String(template || '');
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = value == null ? '' : String(value);
    rendered = rendered
      .split('{' + key + '}').join(safeValue)
      .split('{{' + key + '}}').join(safeValue);
  }
  // Do not allow an old hard-coded sender prefix to leak into the message body.
  return rendered.replace(/^\s*(?:فلای[\u200c\s-]?سوس|Flysos)\s*:\s*/i, '').trim();
}

export async function getSmsTemplate(key, variables = {}) {
  const templates = await getStoredSmsTemplates();
  return renderSmsTemplate(templates[key] || DEFAULT_SMS_TEMPLATES[key] || '', variables);
}
