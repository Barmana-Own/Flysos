import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { recordSmsLog } from './smsLogService.js';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalizeDigits(value) {
  return String(value || '')
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));
}

export function normalizeIranianMobile(value) {
  const digits = normalizeDigits(value).replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return `98${digits.slice(1)}`;
  if (/^989\d{9}$/.test(digits)) return digits;
  return null;
}

export function normalizeSmsSenderNumber(value) {
  const senderNumber = normalizeDigits(value)
    .trim()
    .replace(/[\s()-]/g, '');

  if (!/^\+?\d{4,20}$/.test(senderNumber)) return null;

  return senderNumber.replace(/^\+/, '');
}

function hasSmsToken(value) {
  const token = String(value || '').trim();
  return Boolean(token && !/^(?:PUT_|YOUR_|CHANGE_ME)/i.test(token));
}

export function isSmsConfigured() {
  return hasSmsToken(env.smsApiToken) && Boolean(normalizeSmsSenderNumber(env.smsSenderNumber));
}

const SMS_PROVIDER_REASONS = new Map([
  [4, 'SMS_RECIPIENT_MESSAGE_COUNT_MISMATCH'],
  [5, 'SMS_FILTERED_CONTENT'],
  [6, 'SMS_LINK_NOT_ALLOWED'],
  [7, 'SMS_RECIPIENTS_EMPTY'],
  [8, 'SMS_ORGANIZATION_UNAVAILABLE'],
  [9, 'SMS_ORGANIZATION_INACTIVE'],
  [10, 'SMS_ORGANIZATION_EXPIRED'],
  [11, 'SMS_ORGANIZATION_HIERARCHY_INACTIVE'],
  [12, 'SMS_SEND_TIME_NOT_ALLOWED'],
  [13, 'SMS_USER_SEND_DISABLED'],
  [14, 'SMS_USER_EXPIRED'],
  [15, 'SMS_USER_UNAVAILABLE'],
  [16, 'SMS_PARENT_ORGANIZATION_EXPIRED'],
  [17, 'SMS_SENDER_INVALID'],
  [18, 'SMS_SENDER_INACTIVE'],
  [19, 'SMS_SENDER_EXPIRED'],
  [20, 'SMS_PROVIDER_OUT_OF_SERVICE'],
  [21, 'SMS_QUEUE_INSERT_FAILED'],
  [22, 'SMS_RECIPIENT_BLACKLISTED'],
  [23, 'SMS_RECIPIENT_COUNT_INVALID'],
  [24, 'SMS_EMPTY_MESSAGE'],
  [25, 'SMS_PROVIDER_FAILED'],
  [26, 'SMS_RECIPIENT_LIMIT_EXCEEDED'],
  [27, 'SMS_QUEUE_INSERT_FAILED'],
  [33, 'SMS_TOKEN_MISSING'],
  [34, 'SMS_TOKEN_INVALID'],
  [35, 'SMS_IP_NOT_ALLOWED'],
  [37, 'SMS_SEND_DATE_INVALID'],
  [45, 'SMS_CREDIT_DEDUCTION_FAILED'],
  [55, 'SMS_SENDER_TYPE_INVALID'],
  [56, 'SMS_AGENT_SEND_TIME_NOT_ALLOWED'],
  [57, 'SMS_FILTERED_CONTENT'],
  [62, 'SMS_PERMISSION_DENIED'],
  [66, 'SMS_CREDIT_INSUFFICIENT'],
]);

export async function sendSms(phoneNumber, message) {
  const recipient = normalizeIranianMobile(phoneNumber);
  if (!recipient) return { ok: false, skipped: true, reason: 'INVALID_PHONE_NUMBER' };

  if (!hasSmsToken(env.smsApiToken)) {
    return { ok: false, skipped: true, reason: 'SMS_NOT_CONFIGURED' };
  }

  const senderNumber = normalizeSmsSenderNumber(env.smsSenderNumber);
  if (!senderNumber) {
    return { ok: false, reason: 'SMS_SENDER_INVALID' };
  }

  const messageBody = String(message || '').trim();
  if (!messageBody) {
    return { ok: false, skipped: true, reason: 'SMS_EMPTY_MESSAGE' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.smsTimeoutMs);
  try {
    const response = await fetch(`${env.smsApiBaseUrl.replace(/\/$/, '')}/Messages/Send`, {
      method: 'POST',
      headers: {
        Authorization: env.smsApiToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        senderNumber,
        messageBodies: [messageBody],
        recipientNumbers: [recipient],
      }),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = {};
    }
    const ok = response.ok && [1, 2].includes(Number(payload?.statusCode));
    const statusCode = Number(payload?.statusCode);
    const reason = ok
      ? undefined
      : SMS_PROVIDER_REASONS.get(statusCode)
        || (statusCode ? `SMS_PROVIDER_${statusCode}` : 'SMS_PROVIDER_ERROR');
    return {
      ok,
      reason,
      statusCode: payload?.statusCode,
      providerMessage: String(
        payload?.errorMessage
        || payload?.message
        || payload?.title
        || responseText
        || ''
      ).trim().slice(0, 500),
      messageId: payload?.messageId,
      blackListCount: payload?.blackListCount || 0,
      invalidInputs: payload?.invalidInputs || [],
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === 'AbortError' ? 'SMS_TIMEOUT' : 'SMS_REQUEST_FAILED',
      providerMessage: String(error?.message || '').slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendAutomaticSms(phoneNumber, message, metadata = {}) {
  const rows = await query('SELECT autoSms FROM AppSetting WHERE id = "default" LIMIT 1').catch(() => []);
  if (rows.length && !Boolean(rows[0].autoSms)) {
    const result = { ok: false, skipped: true, reason: 'AUTOMATIC_SMS_DISABLED' };
    await recordSmsLog({ ...metadata, recipient: phoneNumber, message, result });
    return result;
  }
  const result = await sendSms(phoneNumber, message);
  await recordSmsLog({ ...metadata, recipient: phoneNumber, message, result });
  if (!result.ok && !result.skipped) console.warn('Automatic SMS failed:', result);
  return result;
}
