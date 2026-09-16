import { randomUUID } from 'node:crypto';
import { query } from '../config/db.js';

function getLogStatus(result) {
  if (result?.ok) return 'sent';
  if (result?.skipped) return 'skipped';
  return 'failed';
}

export async function recordSmsLog({
  claimId = null,
  adminId = null,
  recipient = null,
  message = '',
  result = {},
}) {
  try {
    await query(
      `INSERT INTO MessageLog
        (id,claimId,adminId,direction,channel,recipient,body,status,providerMessageId)
       VALUES (?, ?, ?, 'outbound', 'sms', ?, ?, ?, ?)`,
      [
        randomUUID(),
        claimId,
        adminId,
        recipient,
        String(message || ''),
        getLogStatus(result),
        result?.messageId ? String(result.messageId) : null,
      ],
    );
  } catch (error) {
    console.warn('[sms-log] Could not record SMS history:', error?.message || error);
  }
}
