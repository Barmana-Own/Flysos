import { sendAutomaticSms } from './smsService.js';
import { getSmsTemplate } from './smsTemplateService.js';

function safeErrorCode(error) {
  const code = String(error?.code || error?.name || 'UNKNOWN_ERROR');
  return /^[A-Z0-9_:-]{1,64}$/u.test(code) ? code : 'UNKNOWN_ERROR';
}

export async function processRegistrationNotification(
  { claim },
  dependencies = {},
) {
  const renderTemplate = dependencies.getSmsTemplate || getSmsTemplate;
  const sendNotification = dependencies.sendAutomaticSms || sendAutomaticSms;
  const message = await renderTemplate('registration', {
    trackingCode: claim.trackingCode,
  });

  return sendNotification(claim.phoneNumber, message, { claimId: claim.id });
}

/**
 * Registration is already committed before this job is scheduled. Notification
 * delivery must not extend the claim request or turn a successful claim into a
 * browser-level failure when the SMS provider/database log is unavailable.
 */
export function scheduleRegistrationNotification(
  job,
  dependencies = {},
) {
  const enqueue = dependencies.enqueue || ((callback) => setImmediate(callback));
  const processJob = dependencies.process || processRegistrationNotification;

  return enqueue(() => Promise.resolve()
    .then(() => processJob(job))
    .catch((error) => {
      console.warn(
        `[SMS] Registration notification job failed (${safeErrorCode(error)}).`,
      );
    }));
}
