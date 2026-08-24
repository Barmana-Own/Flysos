import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { query, transaction } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { mapClaimForAdmin } from '../services/claimMapper.js';
import { ensureCustomerProfileColumns } from '../services/customerProfileService.js';
import { sendAutomaticSms } from '../services/smsService.js';
import { getSmsTemplate } from '../services/smsTemplateService.js';
import { uploadClaimFiles } from './claimController.js';
import { getFlightCacheSummary, syncFlightFeeds } from '../services/flightCacheService.js';
import {
  getCancelledFlightsLast24h,
  getDelayedFlightsLast24h,
  getExternalFlights,
  getExternalFlightsCount,
  parseFlightLimit,
} from '../services/externalFlightService.js';
import {
  addNoteSchema,
  loginSchema,
  updateBankDetailsSchema,
  updateClaimSchema,
  updateClaimStatusSchema,
} from '../validation/adminSchemas.js';
import {
  ensureAdminAccessLevelsColumn,
  getAdminAccessLevels,
  parseAdminAccessLevels,
} from '../services/adminPermissionService.js';

const claimStageLabels = {
  1: 'بررسی اولیه',
  2: 'تکمیل مدارک',
  3: 'تنظیم و تأیید وکالت‌نامه',
  4: 'اقدامات حقوقی',
  5: 'انتظار رأی',
  6: 'وصول خسارت',
  7: 'تسویه با مسافر',
};

async function sendClaimStageSms(claim, stageLabel) {
  return sendAutomaticSms(
    claim.phoneNumber || claim.customer?.phoneNumber,
    await getSmsTemplate('statusUpdate', {
      trackingCode: claim.trackingCode,
      status: stageLabel,
      stage: stageLabel,
    })
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

async function loadFullClaim(claimId, tx = null) {
  await ensureCustomerProfileColumns();
  const runner = tx || { query };
  const claims = await runner.query('SELECT * FROM Claim WHERE id = ?', [claimId]);
  if (!claims.length) return null;
  const claim = claims[0];

  // Normalize booleans and date types
  claim.acceptedTerms = Boolean(claim.acceptedTerms);
  claim.createdAt = claim.createdAt ? new Date(claim.createdAt) : new Date();
  claim.updatedAt = claim.updatedAt ? new Date(claim.updatedAt) : new Date();

  const customers = claim.customerId
    ? await runner.query('SELECT * FROM Customer WHERE id = ? LIMIT 1', [claim.customerId])
    : [];
  claim.customer = customers[0] || null;

  // Load passenger
  const passengers = await runner.query('SELECT * FROM Passenger WHERE claimId = ?', [claimId]);
  claim.passenger = passengers[0] || null;

  // Load flightInfo
  const flightInfos = await runner.query('SELECT * FROM FlightInfo WHERE claimId = ?', [claimId]);
  claim.flightInfo = flightInfos[0] || null;

  // Load bankDetails
  const bankDetails = await runner.query('SELECT * FROM ClaimBankDetails WHERE claimId = ?', [claimId]);
  claim.bankDetails = bankDetails[0] || null;

  // Load assignedAdmin
  let assignedAdmin = null;
  if (claim.assignedAdminId) {
    const admins = await runner.query('SELECT id, username, name FROM AdminUser WHERE id = ?', [claim.assignedAdminId]);
    assignedAdmin = admins[0] || null;
  }
  claim.assignedAdmin = assignedAdmin;

  // Load files
  const files = await runner.query('SELECT * FROM UploadedFile WHERE claimId = ?', [claimId]);
  claim.files = files.map(file => ({
    ...file,
    createdAt: file.createdAt ? new Date(file.createdAt) : new Date(),
  }));

  // Load questionnaire answers
  const questionnaire = await runner.query('SELECT * FROM QuestionnaireAnswer WHERE claimId = ?', [claimId]);
  claim.questionnaire = questionnaire.map(q => ({
    ...q,
    answer: q.answer === null ? null : Boolean(q.answer),
    createdAt: q.createdAt ? new Date(q.createdAt) : new Date(),
  }));

  // Load status history
  const statusHistory = await runner.query('SELECT * FROM ClaimStatusHistory WHERE claimId = ? ORDER BY createdAt ASC', [claimId]);
  claim.statusHistory = statusHistory.map(sh => ({
    ...sh,
    createdAt: sh.createdAt ? new Date(sh.createdAt) : new Date(),
  }));

  // Load notes
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

function isSupervisor(admin) {
  return ['supervisor', 'passenger_admin'].includes(admin?.role);
}

function canAccessClaim(admin, claim) {
  if (!admin || !claim) return false;
  if (isSupervisor(admin)) return true;
  if (claim.assignedAdminId && claim.assignedAdminId === admin.id) return true;
  const accessLevels = getAdminAccessLevels(admin);
  return accessLevels.includes('all') || accessLevels.includes(claim.status);
}

function assertCanAccessClaim(admin, claim) {
  if (!canAccessClaim(admin, claim)) {
    throw new AppError('You do not have access to this claim.', 403, 'CLAIM_ACCESS_DENIED');
  }
}

export async function login(req, res) {
  const { username, password } = parseOrThrow(loginSchema, req.body);

  const users = await query('SELECT * FROM AdminUser WHERE username = ? LIMIT 1', [username]);
  const admin = users[0];

  if (!admin || admin.status !== 'active') {
    throw new AppError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash);
  if (!validPassword) {
    throw new AppError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (!env.jwtSecret) {
    throw new AppError('JWT_SECRET key is not configured in the environment.', 500, 'JWT_CONFIG_ERROR');
  }

  await ensureAdminAccessLevelsColumn();
  const accessRows = await query(
    'SELECT accessLevels FROM AdminUser WHERE id = ? LIMIT 1',
    [admin.id]
  );
  const accessLevels = parseAdminAccessLevels(accessRows[0]?.accessLevels, admin.accessLevel);
  const accessLevel = accessLevels.includes('all') ? 'all' : accessLevels[0];

  const token = jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      name: admin.name || admin.username,
      role: admin.role,
      accessLevel,
      accessLevels,
    },
    env.jwtSecret,
    { expiresIn: '8h' }
  );

  res.json({
    admin: {
      id: admin.id,
      username: admin.username,
      name: admin.name || admin.username,
      role: admin.role,
      accessLevel,
      accessLevels,
    },
    token,
  });
}

export async function listClaims(req, res) {
  const admin = req.admin;
  let claims;

  if (isSupervisor(admin)) {
    claims = await query('SELECT id FROM Claim ORDER BY createdAt DESC');
  } else {
    const accessLevels = getAdminAccessLevels(admin);
    if (accessLevels.includes('all')) {
      claims = await query('SELECT id FROM Claim ORDER BY createdAt DESC');
    } else {
      const placeholders = accessLevels.map(() => '?').join(', ');
      claims = await query(
        `SELECT id FROM Claim WHERE status IN (${placeholders}) OR assignedAdminId = ? ORDER BY createdAt DESC`,
        [...accessLevels, admin.id]
      );
    }
  }

  const loadedClaims = (await Promise.all(
    claims.map((c) => loadFullClaim(c.id))
  )).filter(Boolean);

  res.json(loadedClaims.filter((claim) => canAccessClaim(admin, claim)).map(mapClaimForAdmin));
}

export async function getClaim(req, res) {
  const claim = await loadFullClaim(req.params.id);

  if (!claim) {
    throw new AppError('Claim not found.', 404, 'CLAIM_NOT_FOUND');
  }

  assertCanAccessClaim(req.admin, claim);

  res.json(mapClaimForAdmin(claim));
}

export async function updateClaim(req, res) {
  const body = parseOrThrow(updateClaimSchema, req.body);
  await ensureCustomerProfileColumns();

  const claim = await loadFullClaim(req.params.id);
  if (!claim) {
    throw new AppError('Claim not found.', 404, 'CLAIM_NOT_FOUND');
  }

  assertCanAccessClaim(req.admin, claim);

  if (body.assignedAdminId !== undefined && !['supervisor', 'passenger_admin'].includes(req.admin?.role)) {
    throw new AppError('Only supervisors can assign claims.', 403, 'SUPERVISOR_ONLY');
  }

  if (body.assignedAdminId) {
    const adminExists = await query('SELECT id FROM AdminUser WHERE id = ? LIMIT 1', [body.assignedAdminId]);
    if (!adminExists.length) {
      throw new AppError('Assigned admin not found.', 404, 'ADMIN_NOT_FOUND');
    }
  }

  const updatedClaim = await transaction(async (tx) => {
    const updateFields = [];
    const updateParams = [];

    if (body.assignedAdminId !== undefined) {
      updateFields.push('assignedAdminId = ?');
      updateParams.push(body.assignedAdminId);
    }
    if (body.stage !== undefined) {
      updateFields.push('stage = ?');
      updateParams.push(body.stage);
    }
    if (body.status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(body.status);
    }

    if (updateFields.length > 0) {
      updateParams.push(claim.id);
      await tx.query(
        `UPDATE Claim SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams
      );
    }

    if (body.extractedTicketData !== undefined) {
      await tx.query(
        'UPDATE Claim SET extractedTicketData = ? WHERE id = ?',
        [body.extractedTicketData === null ? null : typeof body.extractedTicketData === 'string' ? body.extractedTicketData : JSON.stringify(body.extractedTicketData), claim.id]
      );
    }

    if (body.passenger) {
      const passengers = await tx.query('SELECT id FROM Passenger WHERE claimId = ? LIMIT 1', [claim.id]);
      if (passengers.length) {
        await tx.query('UPDATE Passenger SET name = ? WHERE claimId = ?', [body.passenger.name ?? null, claim.id]);
      } else {
        await tx.query(
          'INSERT INTO Passenger (id, claimId, name) VALUES (?, ?, ?)',
          [`clpas-${randomUUID()}`, claim.id, body.passenger.name ?? null]
        );
      }
      if (body.passenger.name && claim.customerId) {
        await tx.query('UPDATE Customer SET name = ? WHERE id = ?', [body.passenger.name, claim.customerId]);
      }
    }

    if (body.customer && claim.customerId) {
      const customerRows = await tx.query('SELECT * FROM Customer WHERE id = ? LIMIT 1', [claim.customerId]);
      const customer = customerRows[0] || {};
      const existingNameParts = String(customer.name || '').split(/\s+/).filter(Boolean);
      const firstName = body.customer.firstName !== undefined
        ? body.customer.firstName || ''
        : existingNameParts[0] || '';
      const lastName = body.customer.lastName !== undefined
        ? body.customer.lastName || ''
        : existingNameParts.slice(1).join(' ');
      const providedCustomerFields = [];
      const customerValues = [];

      if (body.customer.firstName !== undefined || body.customer.lastName !== undefined) {
        providedCustomerFields.push('name = ?');
        customerValues.push([firstName, lastName].filter(Boolean).join(' ') || null);
      }
      for (const field of ['email', 'phoneNumber', 'birthDate', 'notes']) {
        if (body.customer[field] !== undefined) {
          providedCustomerFields.push(`${field} = ?`);
          customerValues.push(body.customer[field] || null);
        }
      }
      if (providedCustomerFields.length) {
        await tx.query(
          `UPDATE Customer SET ${providedCustomerFields.join(', ')} WHERE id = ?`,
          [...customerValues, claim.customerId]
        );
      }

      const claimFields = [];
      const claimValues = [];
      if (body.customer.phoneNumber !== undefined) {
        claimFields.push('phoneNumber = ?');
        claimValues.push(body.customer.phoneNumber || claim.phoneNumber);
      }
      if (body.customer.birthDate !== undefined) {
        claimFields.push('birthDate = ?');
        claimValues.push(body.customer.birthDate || claim.birthDate);
      }
      if (claimFields.length) {
        await tx.query(
          `UPDATE Claim SET ${claimFields.join(', ')} WHERE id = ?`,
          [...claimValues, claim.id]
        );
        await tx.query(
          `UPDATE Passenger SET ${claimFields.map((field) => field.replace('phoneNumber', 'phone')).join(', ')} WHERE claimId = ?`,
          [...claimValues, claim.id]
        );
      }
    }

    if (body.flightInfo) {
      const allowedFlightFields = ['passengerName', 'airline', 'flightNumber', 'flightDate', 'scheduledTime', 'origin', 'destination', 'route', 'pnrCode', 'ticketNumber', 'ticketAmount', 'flightClass', 'rawText'];
      const providedFlightFields = allowedFlightFields.filter((field) => body.flightInfo[field] !== undefined);
      const flightRows = await tx.query('SELECT id FROM FlightInfo WHERE claimId = ? LIMIT 1', [claim.id]);
      if (flightRows.length && providedFlightFields.length) {
        await tx.query(
          `UPDATE FlightInfo SET ${providedFlightFields.map((field) => `${field} = ?`).join(', ')} WHERE claimId = ?`,
          [...providedFlightFields.map((field) => body.flightInfo[field] ?? null), claim.id]
        );
      } else if (!flightRows.length) {
        const values = allowedFlightFields.map((field) => body.flightInfo[field] ?? null);
        await tx.query(
          `INSERT INTO FlightInfo (id, claimId, ${allowedFlightFields.join(', ')}) VALUES (${allowedFlightFields.map(() => '?').concat(['?', '?']).slice(0, allowedFlightFields.length + 2).join(', ')})`,
          [`clfli-${randomUUID()}`, claim.id, ...values]
        );
      }
    }

    if (body.bankDetails) {
      const allowedBankFields = ['bankName', 'cardHolder', 'cardNumber', 'accountNumber', 'sheba'];
      const providedBankFields = allowedBankFields.filter((field) => body.bankDetails[field] !== undefined);
      const bankRows = await tx.query('SELECT id FROM ClaimBankDetails WHERE claimId = ? LIMIT 1', [claim.id]);
      if (bankRows.length && providedBankFields.length) {
        await tx.query(
          `UPDATE ClaimBankDetails SET ${providedBankFields.map((field) => `${field} = ?`).join(', ')} WHERE claimId = ?`,
          [...providedBankFields.map((field) => body.bankDetails[field] ?? null), claim.id]
        );
      } else if (!bankRows.length) {
        await tx.query(
          'INSERT INTO ClaimBankDetails (id, claimId, bankName, cardHolder, cardNumber, accountNumber, sheba) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [`clbd-${randomUUID()}`, claim.id, ...allowedBankFields.map((field) => body.bankDetails[field] ?? null)]
        );
      }
    }

    // Write claim status history if status changed
    if (body.status && body.status !== claim.status) {
      await tx.query(
        'INSERT INTO ClaimStatusHistory (id, claimId, fromStatus, toStatus, note) VALUES (?, ?, ?, ?, ?)',
        [`clsh-${randomUUID()}`, claim.id, claim.status, body.status, 'وضعیت پرونده توسط کارشناس بروزرسانی شد.']
      );

      // Create notification
      await tx.query(
        'INSERT INTO Notification (id, claimId, type, message) VALUES (?, ?, "claim_status_changed", ?)',
        [
          `clnot-${randomUUID()}`,
          claim.id,
          `وضعیت پرونده ${claim.trackingCode} به «${body.status}» تغییر یافت.`,
        ]
      );
    }

    return loadFullClaim(claim.id, tx);
  });

  const stageChanged = body.stage !== undefined && Number(body.stage) !== Number(claim.stage);
  if (stageChanged) {
    const progressLabel = claimStageLabels[body.stage] || body.stage;
    await sendClaimStageSms(updatedClaim, progressLabel);
  }

  res.json(mapClaimForAdmin(updatedClaim));
}

export async function addClaimNote(req, res) {
  const { body } = parseOrThrow(addNoteSchema, req.body);

  const claim = await loadFullClaim(req.params.id);
  if (!claim) {
    throw new AppError('Claim not found.', 404, 'CLAIM_NOT_FOUND');
  }

  assertCanAccessClaim(req.admin, claim);

  const noteId = `clnt-${randomUUID()}`;
  await query(
    'INSERT INTO ClaimNote (id, claimId, authorAdminId, body) VALUES (?, ?, ?, ?)',
    [noteId, req.params.id, req.admin.id, body]
  );

  const notes = await query(
    'SELECT cn.*, au.id as authorId, au.username, au.name as authorName FROM ClaimNote cn LEFT JOIN AdminUser au ON cn.authorAdminId = au.id WHERE cn.id = ? LIMIT 1',
    [noteId]
  );
  const note = notes[0];

  res.status(201).json({
    id: note.id,
    body: note.body,
    createdAt: note.createdAt ? new Date(note.createdAt) : new Date(),
    updatedAt: note.updatedAt ? new Date(note.updatedAt) : new Date(),
    author: note.authorId ? {
      id: note.authorId,
      username: note.username,
      name: note.authorName || note.username,
    } : null,
  });
}

export async function updateClaimBankDetails(req, res) {
  const body = parseOrThrow(updateBankDetailsSchema, req.body);

  const fullClaim = await loadFullClaim(req.params.id);
  if (!fullClaim) {
    throw new AppError('Claim not found.', 404, 'CLAIM_NOT_FOUND');
  }

  assertCanAccessClaim(req.admin, fullClaim);

  const bankDetailsExists = await query('SELECT id FROM ClaimBankDetails WHERE claimId = ? LIMIT 1', [req.params.id]);

  if (bankDetailsExists.length > 0) {
    await query(
      'UPDATE ClaimBankDetails SET bankName = ?, cardHolder = ?, cardNumber = ?, accountNumber = ?, sheba = ? WHERE claimId = ?',
      [
        body.bankName || null,
        body.cardHolder || null,
        body.cardNumber || null,
        body.accountNumber || null,
        body.sheba || null,
        req.params.id,
      ]
    );
  } else {
    await query(
      'INSERT INTO ClaimBankDetails (id, claimId, bankName, cardHolder, cardNumber, accountNumber, sheba) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        `clbd-${randomUUID()}`,
        req.params.id,
        body.bankName || null,
        body.cardHolder || null,
        body.cardNumber || null,
        body.accountNumber || null,
        body.sheba || null,
      ]
    );
  }

  const updatedBank = await query('SELECT * FROM ClaimBankDetails WHERE claimId = ? LIMIT 1', [req.params.id]);

  res.json(updatedBank[0]);
}


export const adminLogin = login;

export async function updateClaimStatus(req, res) {
  const { status, note } = parseOrThrow(updateClaimStatusSchema, req.body);

  const claim = await loadFullClaim(req.params.id);

  if (!claim) {
    throw new AppError('Claim not found.', 404, 'CLAIM_NOT_FOUND');
  }

  assertCanAccessClaim(req.admin, claim);

  const updatedClaim = await transaction(async (tx) => {
    await tx.query('UPDATE Claim SET status = ? WHERE id = ?', [status, claim.id]);

    if (status !== claim.status) {
      await tx.query(
        'INSERT INTO ClaimStatusHistory (id, claimId, fromStatus, toStatus, note) VALUES (?, ?, ?, ?, ?)',
        [`clsh-${randomUUID()}`, claim.id, claim.status, status, note || 'وضعیت پرونده توسط کارشناس بروزرسانی شد.']
      );

      await tx.query(
        'INSERT INTO Notification (id, claimId, type, message) VALUES (?, ?, "claim_status_changed", ?)',
        [`clnot-${randomUUID()}`, claim.id, `وضعیت پرونده ${claim.trackingCode} به «${status}» تغییر یافت.`]
      );
    }

    return loadFullClaim(claim.id, tx);
  });

  res.json(mapClaimForAdmin(updatedClaim));
}

export async function downloadClaimFile(req, res) {
  const rows = await query('SELECT * FROM UploadedFile WHERE id = ? LIMIT 1', [req.params.fileId]);
  const file = rows[0];

  if (!file) {
    throw new AppError('File not found.', 404, 'FILE_NOT_FOUND');
  }

  const claim = await loadFullClaim(file.claimId);
  assertCanAccessClaim(req.admin, claim);

  const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
  const storedPath = path.resolve(file.path || path.join(uploadRoot, file.filename));

  if (!storedPath.startsWith(uploadRoot)) {
    throw new AppError('Invalid file path.', 400, 'INVALID_FILE_PATH');
  }

  await fs.access(storedPath);

  res.download(storedPath, file.originalName || file.filename);
}

export async function replaceClaimFile(req, res) {
  const claim = await loadFullClaim(req.params.id);
  if (!claim) {
    throw new AppError('Claim not found.', 404, 'CLAIM_NOT_FOUND');
  }
  assertCanAccessClaim(req.admin, claim);

  const type = req.body?.type || 'ticket';
  if (type !== 'admin_attachment') {
    const previousFiles = await query('SELECT * FROM UploadedFile WHERE claimId = ? AND type = ?', [claim.id, type]);
    for (const previousFile of previousFiles) {
      const previousPath = path.resolve(previousFile.path || '');
      const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
      if (previousPath.startsWith(uploadRoot)) {
        await fs.unlink(previousPath).catch(() => undefined);
      }
    }
    await query('DELETE FROM UploadedFile WHERE claimId = ? AND type = ?', [claim.id, type]);
  }

  return uploadClaimFiles(req, res);
}

export async function adminExternalFlights(req, res) {
  const limit = parseFlightLimit(req.query.limit);
  res.json(await getExternalFlights(limit));
}

export async function adminCancelledFlightsLast24h(req, res) {
  const limit = parseFlightLimit(req.query.limit);
  res.json(await getCancelledFlightsLast24h(limit));
}

export async function adminDelayedFlightsLast24h(req, res) {
  const limit = parseFlightLimit(req.query.limit);
  res.json(await getDelayedFlightsLast24h(limit));
}

export async function adminExternalFlightsCount(_req, res) {
  res.json({ count: await getExternalFlightsCount() });
}


export async function adminFlightCacheSummary(_req, res) {
  res.json(await getFlightCacheSummary());
}

export async function adminSyncFlightCache(req, res) {
  const limit = parseFlightLimit(req.query.limit);
  res.json(await syncFlightFeeds({ limit, force: true }));
}
