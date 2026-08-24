import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { query, transaction } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

import {
  fileTypeSchema,
  questionnaireSchema,
  startClaimSchema,
  submitClaimSchema,
  trackClaimSchema,
} from '../validation/claimSchemas.js';

import {
  extractTicketData,
  hasTicketFields,
} from '../services/ticketExtractionService.js';
import { mapClaimForPublic } from '../services/claimMapper.js';
import { sendAutomaticSms } from '../services/smsService.js';
import { getSmsTemplate } from '../services/smsTemplateService.js';

function createTrackingCode() {
  return `FS${Math.floor(100000 + Math.random() * 900000)}`;
}

async function createUniqueTrackingCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const trackingCode = createTrackingCode();

    const existing = await query('SELECT id FROM Claim WHERE trackingCode = ? LIMIT 1', [trackingCode]);

    if (!existing.length) {
      return trackingCode;
    }
  }

  throw new AppError(
    'Could not generate a unique tracking code.',
    500,
    'TRACKING_CODE_ERROR'
  );
}

function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(
      result.error.issues[0]?.message || 'Invalid request data.',
      400,
      'VALIDATION_ERROR'
    );
  }

  return result.data;
}

function mapUploadedFile(file) {
  return {
    id: file.id,
    type: file.type,
    originalName: file.originalName,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    createdAt: file.createdAt,
  };
}

async function loadFullClaim(claimId, tx = null) {
  const runner = tx || { query };
  const claims = await runner.query('SELECT * FROM Claim WHERE id = ?', [claimId]);
  if (!claims.length) return null;
  const claim = claims[0];

  claim.acceptedTerms = Boolean(claim.acceptedTerms);
  claim.createdAt = claim.createdAt ? new Date(claim.createdAt) : new Date();
  claim.updatedAt = claim.updatedAt ? new Date(claim.updatedAt) : new Date();

  const passengers = await runner.query('SELECT * FROM Passenger WHERE claimId = ?', [claimId]);
  claim.passenger = passengers[0] || null;

  const flightInfos = await runner.query('SELECT * FROM FlightInfo WHERE claimId = ?', [claimId]);
  claim.flightInfo = flightInfos[0] || null;

  const bankDetails = await runner.query('SELECT * FROM ClaimBankDetails WHERE claimId = ?', [claimId]);
  claim.bankDetails = bankDetails[0] || null;

  let assignedAdmin = null;
  if (claim.assignedAdminId) {
    const admins = await runner.query('SELECT id, username, name FROM AdminUser WHERE id = ?', [claim.assignedAdminId]);
    assignedAdmin = admins[0] || null;
  }
  claim.assignedAdmin = assignedAdmin;

  const files = await runner.query('SELECT * FROM UploadedFile WHERE claimId = ?', [claimId]);
  claim.files = files.map(file => ({
    ...file,
    createdAt: file.createdAt ? new Date(file.createdAt) : new Date(),
  }));

  const questionnaire = await runner.query('SELECT * FROM QuestionnaireAnswer WHERE claimId = ?', [claimId]);
  claim.questionnaire = questionnaire.map(q => ({
    ...q,
    answer: q.answer === null ? null : Boolean(q.answer),
    createdAt: q.createdAt ? new Date(q.createdAt) : new Date(),
  }));

  const statusHistory = await runner.query('SELECT * FROM ClaimStatusHistory WHERE claimId = ? ORDER BY createdAt ASC', [claimId]);
  claim.statusHistory = statusHistory.map(sh => ({
    ...sh,
    createdAt: sh.createdAt ? new Date(sh.createdAt) : new Date(),
  }));

  const notes = await runner.query(
    'SELECT cn.*, au.id as authorId, au.username, au.name as authorName FROM ClaimNote cn LEFT JOIN AdminUser au ON cn.authorAdminId = au.id WHERE cn.claimId = ? ORDER BY cn.createdAt DESC',
    [claimId]
  );
  claim.notes = notes.map(n => ({
    id: n.id,
    body: n.body,
    createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
    updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date(),
    authorAdmin: n.authorId ? {
      id: n.authorId,
      username: n.username,
      name: n.authorName || n.username,
    } : null,
  }));

  return claim;
}

export async function startClaim(req, res) {
  const body = parseOrThrow(startClaimSchema, req.body);

  // Treat rapid repeated clicks/retries as the same draft instead of creating
  // several database records and notifications for one passenger action.
  const recentDrafts = await query(
    'SELECT id, trackingCode, status FROM Claim WHERE nationalId = ? AND phoneNumber = ? AND birthDate = ? AND status = "new" AND createdAt >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) ORDER BY createdAt DESC LIMIT 1',
    [body.nationalId, body.phoneNumber, body.birthDate],
  );
  if (recentDrafts.length) {
    return res.json(recentDrafts[0]);
  }

  const trackingCode = await createUniqueTrackingCode();

  const claim = await transaction(async (tx) => {
    // Upsert customer
    const existing = await tx.query('SELECT id FROM Customer WHERE nationalId = ? LIMIT 1', [body.nationalId]);
    let customerId;

    if (existing.length > 0) {
      customerId = existing[0].id;
      await tx.query(
        'UPDATE Customer SET phoneNumber = ?, birthDate = ? WHERE id = ?',
        [body.phoneNumber, body.birthDate, customerId]
      );
    } else {
      customerId = `clcust-${randomUUID()}`;
      await tx.query(
        'INSERT INTO Customer (id, nationalId, name, email, phoneNumber, birthDate, status) VALUES (?, ?, NULL, NULL, ?, ?, "active")',
        [customerId, body.nationalId, body.phoneNumber, body.birthDate]
      );
    }

    const claimId = `clm-${randomUUID()}`;
    await tx.query(
      'INSERT INTO Claim (id, trackingCode, customerId, nationalId, birthDate, phoneNumber, acceptedTerms, claimType, status, stage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "new", 1)',
      [
        claimId,
        trackingCode,
        customerId,
        body.nationalId,
        body.birthDate,
        body.phoneNumber,
        body.acceptedTerms ? 1 : 0,
        body.claimType,
      ]
    );

    // Create Passenger
    await tx.query(
      'INSERT INTO Passenger (id, claimId, nationalId, birthDate, phone) VALUES (?, ?, ?, ?, ?)',
      [`clpsg-${randomUUID()}`, claimId, body.nationalId, body.birthDate, body.phoneNumber]
    );

    // Create Status History
    await tx.query(
      'INSERT INTO ClaimStatusHistory (id, claimId, toStatus, note) VALUES (?, ?, "new", "Claim started")',
      [`clsh-${randomUUID()}`, claimId]
    );

    // Create Notification
    await tx.query(
      'INSERT INTO Notification (id, claimId, type, message) VALUES (?, ?, "claim_created", ?)',
      [`clnot-${randomUUID()}`, claimId, `پرونده ${trackingCode} در سامانه ثبت شد.`]
    );

    const freshClaims = await tx.query('SELECT * FROM Claim WHERE id = ? LIMIT 1', [claimId]);
    return freshClaims[0];
  });

  res.status(201).json({
    id: claim.id,
    trackingCode: claim.trackingCode,
    status: claim.status,
  });
}

export async function uploadClaimFiles(req, res) {
  const claims = await query('SELECT * FROM Claim WHERE id = ? LIMIT 1', [req.params.id]);

  if (!claims.length) {
    throw new AppError(
      'Claim not found.',
      404,
      'CLAIM_NOT_FOUND'
    );
  }

  const claim = claims[0];

  const uploadedFiles = Array.isArray(req.files)
    ? req.files
    : req.file
      ? [req.file]
      : [];

  if (!uploadedFiles.length) {
    throw new AppError(
      'No files uploaded.',
      400,
      'NO_FILES_UPLOADED'
    );
  }

  const requestedType = parseOrThrow(
    fileTypeSchema,
    req.body?.type || 'ticket'
  );

  const createdFiles = [];
  let extractedTicketData = null;
  let extractionWarning = null;
  let extractionSucceeded = false;

  for (const file of uploadedFiles) {
    let record;
    const duplicateFiles = await query(
      'SELECT * FROM UploadedFile WHERE claimId = ? AND type = ? AND originalName = ? AND size = ? LIMIT 1',
      [claim.id, requestedType, file.originalname, file.size]
    );

    if (duplicateFiles.length) {
      const duplicate = duplicateFiles[0];
      await fs.unlink(duplicate.path).catch(() => undefined);
      await query(
        'UPDATE UploadedFile SET filename = ?, mimetype = ?, path = ? WHERE id = ?',
        [file.filename, file.mimetype, file.path, duplicate.id]
      );

      const records = await query('SELECT * FROM UploadedFile WHERE id = ? LIMIT 1', [duplicate.id]);
      record = records[0];
    } else {
      const fileId = `clfil-${randomUUID()}`;
      await query(
        'INSERT INTO UploadedFile (id, claimId, type, originalName, filename, mimetype, size, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [fileId, claim.id, requestedType, file.originalname, file.filename, file.mimetype, file.size, file.path]
      );

      const records = await query('SELECT * FROM UploadedFile WHERE id = ? LIMIT 1', [fileId]);
      record = records[0];
    }

    record.createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
    createdFiles.push(record);

    if (requestedType !== 'ticket') {
      continue;
    }

    try {
      const extractedData = await extractTicketData(
        file.path,
        file.mimetype,
        {
          nationalId: claim.nationalId,
        }
      );

      extractedTicketData = extractedData;
      extractionSucceeded = hasTicketFields(extractedData);
      const safeExtractedData = extractionSucceeded
        ? extractedData
        : { rawText: extractedData.rawText || '' };

      // Save extracted JSON on claim
      await query(
        'UPDATE Claim SET extractedTicketData = ? WHERE id = ?',
        [JSON.stringify(safeExtractedData), claim.id]
      );

      // Upsert FlightInfo
      const flightExists = await query('SELECT id FROM FlightInfo WHERE claimId = ? LIMIT 1', [claim.id]);
      if (flightExists.length > 0) {
        if (extractionSucceeded) {
          await query(
            'UPDATE FlightInfo SET passengerName = ?, airline = ?, flightNumber = ?, flightDate = ?, scheduledTime = ?, origin = ?, destination = ?, route = ?, pnrCode = ?, ticketNumber = ?, ticketAmount = ?, flightClass = ?, rawText = ? WHERE claimId = ?',
            [
              extractedData.passengerName || null, extractedData.airline || null,
              extractedData.flightNumber || null, extractedData.flightDate || null,
              extractedData.scheduledTime || null, extractedData.origin || null,
              extractedData.destination || null, extractedData.route || null,
              extractedData.pnrCode || null, extractedData.ticketNumber || null,
              extractedData.ticketAmount || null, extractedData.flightClass || null,
              extractedData.rawText || null, claim.id,
            ]
          );
        } else {
          await query('UPDATE FlightInfo SET rawText = ? WHERE claimId = ?', [extractedData.rawText || null, claim.id]);
        }
      } else {
        await query(
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
          ]
        );
      }

      if (extractionSucceeded && extractedData.passengerName) {
        // Update Passenger Name
        await query(
          'UPDATE Passenger SET name = ? WHERE claimId = ?',
          [extractedData.passengerName, claim.id]
        );

        if (claim.customerId) {
          // Update Customer Name
          await query(
            'UPDATE Customer SET name = ? WHERE id = ?',
            [extractedData.passengerName, claim.customerId]
          );
        }
      }

      if (!extractionSucceeded) {
        extractionWarning =
          'Ticket text was read, but key flight fields could not be identified automatically.';
      }
    } catch (error) {
      console.warn(
        `[OCR] Automatic extraction failed for ${file.filename}: ${error.message}`
      );

      extractionWarning =
        'The file was saved, but automatic ticket extraction failed.';
    }
  }

  res.status(201).json({
    files: createdFiles.map(mapUploadedFile),
    extractedTicketData,
    ocr: {
      attempted: requestedType === 'ticket',
      extracted: extractionSucceeded,
      warning: extractionWarning,
    },
  });
}

export async function saveQuestionnaire(req, res) {
  const body = parseOrThrow(questionnaireSchema, req.body);

  const claims = await query('SELECT id FROM Claim WHERE id = ? LIMIT 1', [req.params.id]);

  if (!claims.length) {
    throw new AppError(
      'Claim not found.',
      404,
      'CLAIM_NOT_FOUND'
    );
  }

  const claim = claims[0];

  await transaction(async (tx) => {
    // Delete existing questionnaire answers
    await tx.query('DELETE FROM QuestionnaireAnswer WHERE claimId = ?', [claim.id]);

    // Insert answers in loop (safely parameterized)
    for (const answer of body.answers) {
      await tx.query(
        'INSERT INTO QuestionnaireAnswer (id, claimId, questionId, question, answer) VALUES (?, ?, ?, ?, ?)',
        [`clqa-${randomUUID()}`, claim.id, answer.questionId, answer.question, answer.answer ? 1 : 0]
      );
    }
  });

  res.json({ ok: true });
}

export async function submitClaim(req, res) {
  const body = parseOrThrow(submitClaimSchema, req.body);

  const claims = await query('SELECT * FROM Claim WHERE id = ? LIMIT 1', [req.params.id]);

  if (!claims.length) {
    throw new AppError(
      'Claim not found.',
      404,
      'CLAIM_NOT_FOUND'
    );
  }

  const claim = claims[0];

  await transaction(async (tx) => {
    const newClaimType = body.claimType || claim.claimType;

    await tx.query(
      'UPDATE Claim SET claimType = ?, status = "under_review" WHERE id = ?',
      [newClaimType, claim.id]
    );

    // Create status history log
    await tx.query(
      'INSERT INTO ClaimStatusHistory (id, claimId, fromStatus, toStatus, note) VALUES (?, ?, ?, "under_review", "Claim submitted")',
      [`clsh-${randomUUID()}`, claim.id, claim.status]
    );
  });

  const freshClaims = await query('SELECT * FROM Claim WHERE id = ? LIMIT 1', [claim.id]);
  const updatedClaim = freshClaims[0];

  await sendAutomaticSms(
    updatedClaim.phoneNumber,
    await getSmsTemplate('registration', { trackingCode: updatedClaim.trackingCode })
  );

  res.json({
    id: updatedClaim.id,
    trackingCode: updatedClaim.trackingCode,
    status: updatedClaim.status,
  });
}

export async function trackClaim(req, res) {
  const querySchema = parseOrThrow(trackClaimSchema, req.query);

  const claims = querySchema.nationalId
    ? await query(
        'SELECT id FROM Claim WHERE trackingCode = ? AND nationalId = ? LIMIT 1',
        [querySchema.trackingCode, querySchema.nationalId]
      )
    : await query(
        'SELECT id FROM Claim WHERE trackingCode = ? LIMIT 1',
        [querySchema.trackingCode]
      );

  if (!claims.length) {
    throw new AppError(
      'Claim not found.',
      404,
      'CLAIM_NOT_FOUND'
    );
  }

  const claim = await loadFullClaim(claims[0].id);

  res.json(mapClaimForPublic(claim));
}

export async function deleteUploadedFile(fileId, claimId) {
  const files = await query(
    'SELECT * FROM UploadedFile WHERE id = ? AND claimId = ? LIMIT 1',
    [fileId, claimId]
  );

  if (!files.length) {
    throw new AppError(
      'File not found.',
      404,
      'FILE_NOT_FOUND'
    );
  }

  const file = files[0];

  await query('DELETE FROM UploadedFile WHERE id = ?', [file.id]);

  await fs.unlink(file.path).catch(() => undefined);
}
