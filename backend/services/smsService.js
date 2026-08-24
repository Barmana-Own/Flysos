import { env } from '../config/env.js';
import { query } from '../config/db.js';

export function normalizeIranianMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return `98${digits.slice(1)}`;
  if (/^989\d{9}$/.test(digits)) return digits;
  return null;
}

export function isSmsConfigured() {
  return Boolean(env.smsApiToken && env.smsSenderNumber);
}

const SMS_PROVIDER_REASONS = new Map([
  [5, 'SMS_FILTERED_CONTENT'],
  [6, 'SMS_LINK_NOT_ALLOWED'],
  [17, 'SMS_SENDER_INVALID'],
  [22, 'SMS_RECIPIENT_BLACKLISTED'],
  [24, 'SMS_EMPTY_MESSAGE'],
  [33, 'SMS_TOKEN_MISSING'],
  [34, 'SMS_TOKEN_INVALID'],
  [35, 'SMS_IP_NOT_ALLOWED'],
  [62, 'SMS_PERMISSION_DENIED'],
  [66, 'SMS_CREDIT_INSUFFICIENT'],
]);

export async function sendSms(phoneNumber, message) {
  const recipient = normalizeIranianMobile(phoneNumber);
  if (!recipient) return { ok: false, skipped: true, reason: 'INVALID_PHONE_NUMBER' };
  if (!isSmsConfigured()) return { ok: false, skipped: true, reason: 'SMS_NOT_CONFIGURED' };

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
        senderNumber: env.smsSenderNumber,
        messageBodies: [String(message).trim()],
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

export async function sendAutomaticSms(phoneNumber, message) {
  const rows = await query('SELECT autoSms FROM AppSetting WHERE id = "default" LIMIT 1').catch(() => []);
  if (rows.length && !Boolean(rows[0].autoSms)) {
    return { ok: false, skipped: true, reason: 'AUTOMATIC_SMS_DISABLED' };
  }
  const result = await sendSms(phoneNumber, message);
  if (!result.ok && !result.skipped) console.warn('Automatic SMS failed:', result);
  return result;
}
