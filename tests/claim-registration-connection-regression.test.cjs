const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const controllerPath = path.resolve(
  __dirname,
  '..',
  'backend',
  'controllers',
  'claimController.js',
);
const notificationServicePath = path.resolve(
  __dirname,
  '..',
  'backend',
  'services',
  'claimNotificationJobService.js',
);

test('claim submission responds from committed state and queues notification work', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const notificationService = fs.readFileSync(notificationServicePath, 'utf8');

  assert.match(controller, /scheduleRegistrationNotification/);
  assert.match(controller, /const updatedClaim = \{/);
  assert.match(controller, /scheduleRegistrationNotification\(\{ claim: updatedClaim \}\)/);
  assert.doesNotMatch(
    controller,
    /const freshClaims = await query\('SELECT \* FROM Claim WHERE id = \? LIMIT 1'/,
  );
  assert.match(notificationService, /setImmediate/);
  assert.match(notificationService, /processRegistrationNotification/);
});

test('registration notification service sends after commit and contains no database dependency', async () => {
  process.env.DB_NAME = 'claim_registration_notification_regression';
  process.env.DB_USER = 'claim_registration_notification_regression';
  process.env.DB_PASSWORD = '';

  const {
    processRegistrationNotification,
    scheduleRegistrationNotification,
  } = await import('../backend/services/claimNotificationJobService.js');

  const calls = [];
  const result = await processRegistrationNotification(
    {
      claim: {
        id: 'claim-1',
        trackingCode: 'FS123456',
        phoneNumber: '09123456789',
      },
    },
    {
      getSmsTemplate: async (key, variables) => {
        calls.push(['template', key, variables]);
        return 'registration message';
      },
      sendAutomaticSms: async (phoneNumber, message, metadata) => {
        calls.push(['send', phoneNumber, message, metadata]);
        return { ok: true };
      },
    },
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [
    ['template', 'registration', { trackingCode: 'FS123456' }],
    ['send', '09123456789', 'registration message', { claimId: 'claim-1' }],
  ]);

  let queuedCallback;
  let processed = false;
  const queued = scheduleRegistrationNotification(
    { claim: { id: 'claim-1', trackingCode: 'FS123456', phoneNumber: '09123456789' } },
    {
      enqueue: (callback) => {
        queuedCallback = callback;
        return 'queued';
      },
      process: async () => {
        processed = true;
      },
    },
  );

  assert.equal(queued, 'queued');
  assert.equal(processed, false);
  await queuedCallback();
  assert.equal(processed, true);
});

test('registration notification queue absorbs provider failures', async () => {
  const { scheduleRegistrationNotification } = await import(
    '../backend/services/claimNotificationJobService.js'
  );

  let queuedCallback;
  const queued = scheduleRegistrationNotification(
    { claim: { id: 'claim-1', trackingCode: 'FS123456', phoneNumber: '09123456789' } },
    {
      enqueue: (callback) => {
        queuedCallback = callback;
        return 'queued';
      },
      process: async () => {
        throw Object.assign(new Error('provider unavailable'), { code: 'ETIMEDOUT' });
      },
    },
  );

  assert.equal(queued, 'queued');
  await assert.doesNotReject(() => queuedCallback());
});
