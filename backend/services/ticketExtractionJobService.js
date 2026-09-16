import { randomUUID } from 'node:crypto';

import { query, transaction } from '../config/db.js';
import {
  extractTicketData,
  hasTicketFields,
} from './ticketExtractionService.js';

function safeErrorCode(error) {
  const code = String(error?.code || error?.name || 'UNKNOWN_ERROR');
  return /^[A-Z0-9_:-]{1,64}$/u.test(code) ? code : 'UNKNOWN_ERROR';
}

function safeFileLabel(file) {
  return String(file?.filename || file?.originalname || 'ticket')
    .replace(/[\r\n]/gu, ' ')
    .slice(0, 120);
}

function jobResult(overrides = {}) {
  return {
    ok: false,
    extracted: false,
    warning: null,
    ...overrides,
  };
}

/**
 * Runs expensive ticket extraction after the upload request has persisted the
 * file and returned. Database writes are kept outside the OCR phase so a slow
 * PDF/image cannot hold an HTTP request open while OCR workers are running.
 */
export async function processTicketExtraction(
  { file, claim },
  dependencies = {},
) {
  const runQuery = dependencies.query || query;
  const runTransaction = dependencies.transaction || transaction;
  const runExtraction = dependencies.extractTicketData || extractTicketData;
  const detectTicketFields = dependencies.hasTicketFields || hasTicketFields;
  const filePath = String(file?.path || '');
  const fileLabel = safeFileLabel(file);

  let extractedData;
  try {
    extractedData = await runExtraction(
      filePath,
      file?.mimetype,
      { nationalId: claim?.nationalId },
    );
  } catch (error) {
    console.warn(
      `[OCR] Automatic extraction failed for ${fileLabel} (${safeErrorCode(error)}).`,
    );
    return jobResult({
      warning: 'The file was saved, but automatic ticket extraction failed.',
    });
  }

  const extractionSucceeded = detectTicketFields(extractedData);
  const safeExtractedData = extractionSucceeded
    ? extractedData
    : { rawText: extractedData?.rawText || '' };

  try {
    // Do not let an older background job overwrite a newer replacement.
    if (file?.id) {
      const activeFiles = await runQuery(
        'SELECT id FROM UploadedFile WHERE id = ? AND path = ? LIMIT 1',
        [file.id, filePath],
      );
      if (!activeFiles.length) {
        return jobResult({ stale: true });
      }
    }

    await runTransaction(async (tx) => {
      await tx.query(
        'UPDATE Claim SET extractedTicketData = ? WHERE id = ?',
        [JSON.stringify(safeExtractedData), claim.id],
      );

      const flightExists = await tx.query(
        'SELECT id FROM FlightInfo WHERE claimId = ? LIMIT 1',
        [claim.id],
      );
      if (flightExists.length > 0) {
        if (extractionSucceeded) {
          await tx.query(
            'UPDATE FlightInfo SET passengerName = ?, airline = ?, flightNumber = ?, flightDate = ?, scheduledTime = ?, origin = ?, destination = ?, route = ?, pnrCode = ?, ticketNumber = ?, ticketAmount = ?, flightClass = ?, rawText = ? WHERE claimId = ?',
            [
              extractedData.passengerName || null,
              extractedData.airline || null,
              extractedData.flightNumber || null,
              extractedData.flightDate || null,
              extractedData.scheduledTime || null,
              extractedData.origin || null,
              extractedData.destination || null,
              extractedData.route || null,
              extractedData.pnrCode || null,
              extractedData.ticketNumber || null,
              extractedData.ticketAmount || null,
              extractedData.flightClass || null,
              extractedData.rawText || null,
              claim.id,
            ],
          );
        } else {
          await tx.query(
            'UPDATE FlightInfo SET rawText = ? WHERE claimId = ?',
            [extractedData.rawText || null, claim.id],
          );
        }
      } else {
        await tx.query(
          'INSERT INTO FlightInfo (id, claimId, passengerName, airline, flightNumber, flightDate, scheduledTime, origin, destination, route, pnrCode, ticketNumber, ticketAmount, flightClass, rawText) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            `clfli-${randomUUID()}`,
            claim.id,
            extractionSucceeded ? extractedData.passengerName || null : null,
            extractionSucceeded ? extractedData.airline || null : null,
            extractionSucceeded ? extractedData.flightNumber || null : null,
            extractionSucceeded ? extractedData.flightDate || null : null,
            extractionSucceeded ? extractedData.scheduledTime || null : null,
            extractionSucceeded ? extractedData.origin || null : null,
            extractionSucceeded ? extractedData.destination || null : null,
            extractionSucceeded ? extractedData.route || null : null,
            extractionSucceeded ? extractedData.pnrCode || null : null,
            extractionSucceeded ? extractedData.ticketNumber || null : null,
            extractionSucceeded ? extractedData.ticketAmount || null : null,
            extractionSucceeded ? extractedData.flightClass || null : null,
            extractedData.rawText || null,
          ],
        );
      }

      if (extractionSucceeded && extractedData.passengerName) {
        await tx.query(
          'UPDATE Passenger SET name = ? WHERE claimId = ?',
          [extractedData.passengerName, claim.id],
        );

        if (claim.customerId) {
          await tx.query(
            'UPDATE Customer SET name = ? WHERE id = ?',
            [extractedData.passengerName, claim.customerId],
          );
        }
      }
    });
  } catch (error) {
    // Persistence failures must remain visible and must not be mislabeled as
    // OCR failures or turn an already completed upload into a 500 response.
    console.error(
      `[OCR] Ticket data persistence failed for ${fileLabel} (${safeErrorCode(error)}).`,
    );
    return jobResult({
      extracted: extractionSucceeded,
      warning: 'Ticket extraction completed, but the extracted data could not be saved.',
    });
  }

  return {
    ok: true,
    extracted: extractionSucceeded,
    extractedTicketData: extractedData,
    warning: extractionSucceeded
      ? null
      : 'Ticket text was read, but key flight fields could not be identified automatically.',
  };
}

/**
 * Enqueue without awaiting. The rejection handler prevents a background OCR
 * failure from becoming an unhandled promise rejection in Passenger.
 */
export function scheduleTicketExtraction(job, dependencies = {}) {
  const enqueue = dependencies.enqueue || ((callback) => setImmediate(callback));
  const processJob = dependencies.process || processTicketExtraction;

  return enqueue(() => Promise.resolve().then(() => processJob(job)).catch((error) => {
    console.error(
      `[OCR] Background ticket extraction job failed (${safeErrorCode(error)}).`,
    );
  }));
}
