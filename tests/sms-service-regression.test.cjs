const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..', 'backend');
const PROBE_TIMEOUT_MS = 30_000;

function runSmsProbe({ senderNumber, script }) {
  const env = {
    ...process.env,
    DB_NAME: 'sms_service_regression',
    DB_USER: 'sms_service_regression',
    DB_PASSWORD: '',
    SMS_API_BASE_URL: 'https://sms-provider.invalid',
    SMS_API_TOKEN: 'regression-test-token',
    SMS_SENDER_NUMBER: senderNumber,
    SMS_TIMEOUT_MS: '1000',
  };

  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { cwd: backendRoot, env, encoding: 'utf8', timeout: PROBE_TIMEOUT_MS },
  );

  assert.equal(
    result.status,
    0,
    `SMS probe failed:\nstdout=${result.stdout}\nstderr=${result.stderr}`,
  );

  const output = result.stdout.trim().split(/\r?\n/).at(-1);
  return JSON.parse(output);
}

test('normalizes Persian and Arabic-Indic Iranian mobile digits', () => {
  const result = runSmsProbe({
    senderNumber: '30001234567',
    script: `
      const { normalizeIranianMobile } = await import('./services/smsService.js');
      console.log(JSON.stringify({
        persian: normalizeIranianMobile('۰۹۱۲۳۴۵۶۷۸۹'),
        arabicIndic: normalizeIranianMobile('٠٩١٢٣٤٥٦٧٨٩'),
        international: normalizeIranianMobile('+989123456789'),
      }));
    `,
  });

  assert.deepEqual(result, {
    persian: '989123456789',
    arabicIndic: '989123456789',
    international: '989123456789',
  });
});

test('rejects a non-numeric sender before calling the provider', () => {
  const result = runSmsProbe({
    senderNumber: 'خط ارسال پیامک',
    script: `
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        throw new Error('provider must not be called with an invalid sender');
      };
      const { sendSms } = await import('./services/smsService.js');
      const sms = await sendSms('09123456789', 'پیام تست');
      console.log(JSON.stringify({ sms, fetchCalled }));
    `,
  });

  assert.equal(result.fetchCalled, false);
  assert.equal(result.sms.ok, false);
  assert.equal(result.sms.reason, 'SMS_SENDER_INVALID');
});

test('maps the provider send-window failure to an actionable reason', () => {
  const result = runSmsProbe({
    senderNumber: '30001234567',
    script: `
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ statusCode: 12 }),
      });
      const { sendSms } = await import('./services/smsService.js');
      const sms = await sendSms('09123456789', 'پیام تست');
      console.log(JSON.stringify(sms));
    `,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'SMS_SEND_TIME_NOT_ALLOWED');
  assert.equal(result.statusCode, 12);
});

test('sends the provider contract with a normalized recipient', () => {
  const result = runSmsProbe({
    senderNumber: '30001234567',
    script: `
      let request;
      globalThis.fetch = async (_url, options) => {
        request = { url: _url, options };
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            statusCode: 1,
            messageId: 42,
            blackListCount: 0,
            invalidInputs: [],
          }),
        };
      };
      const { sendSms } = await import('./services/smsService.js');
      const sms = await sendSms('۰۹۱۲۳۴۵۶۷۸۹', 'پیام تست');
      console.log(JSON.stringify({
        sms,
        url: request.url,
        authorization: request.options.headers.Authorization,
        body: JSON.parse(request.options.body),
      }));
    `,
  });

  assert.equal(result.sms.ok, true);
  assert.equal(result.url, 'https://sms-provider.invalid/Messages/Send');
  assert.equal(result.authorization, 'regression-test-token');
  assert.deepEqual(result.body, {
    senderNumber: '30001234567',
    messageBodies: ['پیام تست'],
    recipientNumbers: ['989123456789'],
  });
});
