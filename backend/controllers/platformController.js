import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

import { query, transaction } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import {
  createExpertSchema,
  updateCustomerSchema,
  updateExpertSchema,
  updateSettingsSchema,
  sendDirectSmsSchema,
} from '../validation/platformSchemas.js';
import { mapClaimForAdmin } from '../services/claimMapper.js';
import { getFlightCacheSummary } from '../services/flightCacheService.js';
import { isSmsConfigured, sendSms } from '../services/smsService.js';
import { ensureCustomerProfileColumns } from '../services/customerProfileService.js';
import {
  DEFAULT_SMS_TEMPLATES,
  ensureSmsTemplateColumn,
  getStoredSmsTemplates,
  normalizeSmsTemplates,
} from '../services/smsTemplateService.js';

const roleLabels = {
  supervisor: 'مدیر ارشد',
  content_admin: 'ادمین محتوایی',
  passenger_admin: 'ادمین مدیریت مسافران',
  senior_expert: 'کارشناس ارشد',
  expert: 'کارشناس',
  expert_domestic: 'کارشناس پرواز داخلی',
  expert_intl: 'کارشناس پرواز خارجی',
};

const accessLabels = {
  all: 'همه پرونده‌ها',
  new: 'پرونده‌های جدید',
  under_review: 'در حال بررسی',
  needs_action: 'نیاز به اقدام',
  pending_info: 'در انتظار اطلاعات',
  approved: 'تأیید شده',
  rejected: 'رد شده',
  closed: 'بسته شده',
};

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

function formatPersianDate(value) {
  if (!value) return '';

  try {
    return new Intl.DateTimeFormat('fa-IR').format(new Date(value));
  } catch {
    return '';
  }
}

function mapAdmin(admin) {
  return {
    id: admin.id,
    name: admin.name || admin.username,
    username: admin.username,
    email: admin.email || '',
    phone: admin.phone || '',
    photoUrl: admin.photoUrl || '',
    role: admin.role,
    roleLabel: roleLabels[admin.role] || admin.role,
    status: admin.status,
    accessLevel: admin.accessLevel,
    accessLevelLabel:
      accessLabels[admin.accessLevel] || admin.accessLevel,
    createdAt: admin.createdAt,
  };
}

function mapCustomer(customer) {
  const name = customer.name || customer.nationalId;
  const parts = name.split(' ').filter(Boolean);

  return {
    id: customer.id,
    name,
    firstName: parts[0] === customer.nationalId ? '' : parts[0] || '',
    lastName: parts[0] === customer.nationalId ? '' : parts.slice(1).join(' '),
    nationalId: customer.nationalId,
    email: customer.email || '',
    phone: customer.phoneNumber || '',
    birthDate: customer.birthDate || '',
    notes: customer.notes || '',
    claimsCount: customer.claimsCount || 0,
    status: customer.status,
    regDate: formatPersianDate(customer.createdAt),
    createdAt: customer.createdAt,
  };
}

function mapNotification(notification) {
  return {
    id: notification.id,
    claimId: notification.claimId || null,
    type: notification.type,
    text: notification.message,
    time: formatPersianDate(notification.createdAt),
    createdAt: notification.createdAt,
    read: Boolean(notification.readAt),
  };
}

let legalDocumentColumnsReady;

async function ensureLegalDocumentColumns() {
  if (!legalDocumentColumnsReady) {
    legalDocumentColumnsReady = (async () => {
      const columns = await query(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "AppSetting" AND COLUMN_NAME = "powerOfAttorneyUrl"'
      );
      if (!columns.length) {
        await query('ALTER TABLE AppSetting ADD COLUMN powerOfAttorneyUrl LONGTEXT NULL AFTER requireNationalId');
      }
    })().catch((error) => {
      legalDocumentColumnsReady = undefined;
      throw error;
    });
  }
  return legalDocumentColumnsReady;
}

async function getDefaultSettings() {
  await ensureLegalDocumentColumns();
  const smsColumnReady = await ensureSmsTemplateColumn();
  const settingsList = await query('SELECT * FROM AppSetting WHERE id = "default" LIMIT 1');
  if (settingsList.length > 0) {
    return settingsList[0];
  }

  // Create default settings if not exists
  if (smsColumnReady) {
    await query(
      'INSERT INTO AppSetting (id, siteName, smsGateway, defaultCommission, autoSms, maintenanceMode, requireNationalId, smsTemplates) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['default', 'سامانه حقوقی فلای‌سوس', '', 20, true, false, true, JSON.stringify(DEFAULT_SMS_TEMPLATES)]
    );
  } else {
    await query(
      'INSERT INTO AppSetting (id, siteName, smsGateway, defaultCommission, autoSms, maintenanceMode, requireNationalId) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['default', 'سامانه حقوقی فلای‌سوس', '', 20, true, false, true]
    );
  }

  const freshSettings = await query('SELECT * FROM AppSetting WHERE id = "default" LIMIT 1');
  return freshSettings[0];
}

async function loadFullClaim(claimId, tx = null) {
  await ensureCustomerProfileColumns();
  const runner = tx || { query };
  const claims = await runner.query('SELECT * FROM Claim WHERE id = ?', [claimId]);
  if (!claims.length) return null;
  const claim = claims[0];

  claim.acceptedTerms = Boolean(claim.acceptedTerms);
  claim.createdAt = claim.createdAt ? new Date(claim.createdAt) : new Date();
  claim.updatedAt = claim.updatedAt ? new Date(claim.updatedAt) : new Date();

  const customers = claim.customerId
    ? await runner.query('SELECT * FROM Customer WHERE id = ? LIMIT 1', [claim.customerId])
    : [];
  claim.customer = customers[0] || null;

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

export async function dashboard(req, res) {
  const canSeeAllClaims = ['supervisor', 'passenger_admin'].includes(req.admin?.role);
  const claimWhere = canSeeAllClaims ? '' : 'WHERE status = ? OR assignedAdminId = ?';
  const claimParams = canSeeAllClaims ? [] : [req.admin.accessLevel, req.admin.id];

  const [
    totalRes,
    byStatus,
    byType,
    recentClaimsRes,
    openTicketsRes,
    unreadNotificationsRes,
    flightCacheSummary,
  ] = await Promise.all([
    query(`SELECT COUNT(*) as total FROM Claim ${claimWhere}`, claimParams),
    query(`SELECT status, COUNT(*) as cnt FROM Claim ${claimWhere} GROUP BY status`, claimParams),
    query(`SELECT claimType, COUNT(*) as cnt FROM Claim ${claimWhere} GROUP BY claimType`, claimParams),
    query(`SELECT id FROM Claim ${claimWhere} ORDER BY createdAt DESC LIMIT 5`, claimParams),
    query('SELECT COUNT(*) as total FROM SupportTicket WHERE status = "open"'),
    query('SELECT COUNT(*) as total FROM Notification WHERE readAt IS NULL AND (recipientAdminId = ? OR recipientAdminId IS NULL)', [req.admin.id]),
    getFlightCacheSummary().catch((error) => ({ error: error.message, totalSnapshots: 0, byStatus: {}, recentFlights: [], runs: [], sources: [] })),
  ]);

  const recentClaims = (await Promise.all(
    recentClaimsRes.map((c) => loadFullClaim(c.id))
  )).filter(Boolean);

  res.json({
    total: totalRes[0]?.total || 0,
    byStatus: byStatus.map((item) => ({
      status: item.status,
      count: item.cnt,
    })),
    byType: byType.map((item) => ({
      type: item.claimType,
      count: item.cnt,
    })),
    recent: recentClaims.map(mapClaimForAdmin),
    openTickets: openTicketsRes[0]?.total || 0,
    unreadNotifications: unreadNotificationsRes[0]?.total || 0,
    flightCache: flightCacheSummary,
  });
}

export async function listUsers(_req, res) {
  await ensureCustomerProfileColumns();
  const customers = await query(
    'SELECT c.*, (SELECT COUNT(*) FROM Claim WHERE customerId = c.id) as claimsCount FROM Customer c ORDER BY c.createdAt DESC'
  );

  const mappedCustomers = customers.map(cust => {
    cust.createdAt = cust.createdAt ? new Date(cust.createdAt) : new Date();
    cust.updatedAt = cust.updatedAt ? new Date(cust.updatedAt) : new Date();
    return mapCustomer(cust);
  });

  res.json(mappedCustomers);
}

export async function updateUser(req, res) {
  const body = parseOrThrow(updateCustomerSchema, req.body);
  await ensureCustomerProfileColumns();

  const existingList = await query('SELECT * FROM Customer WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingList.length) {
    throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
  }

  const existing = existingList[0];

  const updateFields = [];
  const updateParams = [];

  if (body.name !== undefined) {
    updateFields.push('name = ?');
    updateParams.push(body.name);
  } else if (body.firstName !== undefined || body.lastName !== undefined) {
    const existingParts = String(existing.name || '').split(/\s+/).filter(Boolean);
    const firstName = body.firstName !== undefined ? body.firstName || '' : existingParts[0] || '';
    const lastName = body.lastName !== undefined ? body.lastName || '' : existingParts.slice(1).join(' ');
    updateFields.push('name = ?');
    updateParams.push([firstName, lastName].filter(Boolean).join(' ') || null);
  }
  if (body.email !== undefined) {
    updateFields.push('email = ?');
    updateParams.push(body.email || null);
  }
  if (body.phoneNumber !== undefined) {
    updateFields.push('phoneNumber = ?');
    updateParams.push(body.phoneNumber || null);
  }
  if (body.birthDate !== undefined) {
    updateFields.push('birthDate = ?');
    updateParams.push(body.birthDate || null);
  }
  if (body.notes !== undefined) {
    updateFields.push('notes = ?');
    updateParams.push(body.notes || null);
  }
  if (body.status !== undefined) {
    updateFields.push('status = ?');
    updateParams.push(body.status);
  }

  if (updateFields.length > 0) {
    updateParams.push(existing.id);
    await query(
      `UPDATE Customer SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
  }

  const updatedList = await query(
    'SELECT c.*, (SELECT COUNT(*) FROM Claim WHERE customerId = c.id) as claimsCount FROM Customer c WHERE c.id = ? LIMIT 1',
    [existing.id]
  );
  const updated = updatedList[0];
  updated.createdAt = updated.createdAt ? new Date(updated.createdAt) : new Date();
  updated.updatedAt = updated.updatedAt ? new Date(updated.updatedAt) : new Date();

  res.json(mapCustomer(updated));
}

export async function listExperts(_req, res) {
  const admins = await query('SELECT * FROM AdminUser ORDER BY createdAt DESC');

  const mappedAdmins = admins.map(adm => {
    adm.createdAt = adm.createdAt ? new Date(adm.createdAt) : new Date();
    adm.updatedAt = adm.updatedAt ? new Date(adm.updatedAt) : new Date();
    return mapAdmin(adm);
  });

  res.json(mappedAdmins);
}

export async function createExpert(req, res) {
  const body = parseOrThrow(createExpertSchema, req.body);

  const exists = await query(
    'SELECT id FROM AdminUser WHERE username = ? OR (email IS NOT NULL AND email = ?) LIMIT 1',
    [body.username, body.email || null]
  );

  if (exists.length > 0) {
    throw new AppError('Username or email already exists.', 409, 'ADMIN_ALREADY_EXISTS');
  }

  const adminId = `cladm-${randomUUID()}`;
  const passwordHash = await bcrypt.hash(body.password, 12);

  await query(
    'INSERT INTO AdminUser (id, username, passwordHash, name, email, phone, role, status, accessLevel, photoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      adminId,
      body.username,
      passwordHash,
      body.name || null,
      body.email || null,
      body.phone || null,
      body.role,
      body.status,
      body.accessLevel,
      body.photoUrl || null,
    ]
  );

  const createdList = await query('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [adminId]);
  const created = createdList[0];
  created.createdAt = created.createdAt ? new Date(created.createdAt) : new Date();

  res.status(201).json(mapAdmin(created));
}

export async function updateExpert(req, res) {
  const body = parseOrThrow(updateExpertSchema, req.body);
  const existingList = await query('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [req.params.id]);

  if (!existingList.length) {
    throw new AppError('Admin user not found.', 404, 'ADMIN_NOT_FOUND');
  }

  const existing = existingList[0];

  if (body.username && body.username !== existing.username) {
    const usernameTaken = await query('SELECT id FROM AdminUser WHERE username = ? LIMIT 1', [body.username]);
    if (usernameTaken.length > 0) throw new AppError('Username already exists.', 409, 'USERNAME_TAKEN');
  }

  if (body.email && body.email !== existing.email) {
    const emailTaken = await query('SELECT id FROM AdminUser WHERE email = ? LIMIT 1', [body.email]);
    if (emailTaken.length > 0) throw new AppError('Email already exists.', 409, 'EMAIL_TAKEN');
  }

  const updateFields = [];
  const updateParams = [];

  if (body.username !== undefined) {
    updateFields.push('username = ?');
    updateParams.push(body.username);
  }
  if (body.name !== undefined) {
    updateFields.push('name = ?');
    updateParams.push(body.name || null);
  }
  if (body.email !== undefined) {
    updateFields.push('email = ?');
    updateParams.push(body.email || null);
  }
  if (body.phone !== undefined) {
    updateFields.push('phone = ?');
    updateParams.push(body.phone || null);
  }
  if (body.role !== undefined) {
    updateFields.push('role = ?');
    updateParams.push(body.role);
  }
  if (body.status !== undefined) {
    updateFields.push('status = ?');
    updateParams.push(body.status);
  }
  if (body.accessLevel !== undefined) {
    updateFields.push('accessLevel = ?');
    updateParams.push(body.accessLevel);
  }
  if (body.photoUrl !== undefined) {
    updateFields.push('photoUrl = ?');
    updateParams.push(body.photoUrl || null);
  }
  if (body.password) {
    updateFields.push('passwordHash = ?');
    const hash = await bcrypt.hash(body.password, 12);
    updateParams.push(hash);
  }

  if (updateFields.length > 0) {
    updateParams.push(existing.id);
    await query(
      `UPDATE AdminUser SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
  }

  const updatedList = await query('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [existing.id]);
  const updated = updatedList[0];
  updated.createdAt = updated.createdAt ? new Date(updated.createdAt) : new Date();

  res.json(mapAdmin(updated));
}

export async function deleteExpert(req, res) {
  if (req.params.id === req.admin.id) {
    throw new AppError('You cannot delete your own account.', 400, 'ADMIN_SELF_DELETE_NOT_ALLOWED');
  }

  const existingList = await query('SELECT id FROM AdminUser WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingList.length) {
    throw new AppError('Admin user not found.', 404, 'ADMIN_NOT_FOUND');
  }

  await query('DELETE FROM AdminUser WHERE id = ?', [req.params.id]);
  res.status(204).end();
}

export async function listNotifications(req, res) {
  const notifications = await query(
    'SELECT * FROM Notification WHERE recipientAdminId = ? OR recipientAdminId IS NULL ORDER BY createdAt DESC LIMIT 50',
    [req.admin.id]
  );

  const mappedNotifications = notifications.map(notif => {
    notif.createdAt = notif.createdAt ? new Date(notif.createdAt) : new Date();
    notif.readAt = notif.readAt ? new Date(notif.readAt) : null;
    return mapNotification(notif);
  });

  res.json(mappedNotifications);
}

export async function markNotificationRead(req, res) {
  const notifications = await query(
    'SELECT * FROM Notification WHERE id = ? AND (recipientAdminId = ? OR recipientAdminId IS NULL) LIMIT 1',
    [req.params.id, req.admin.id]
  );

  if (!notifications.length) {
    throw new AppError(
      'Notification not found.',
      404,
      'NOTIFICATION_NOT_FOUND'
    );
  }

  const notification = notifications[0];
  const readAt = notification.readAt || new Date();

  await query(
    'UPDATE Notification SET readAt = ? WHERE id = ?',
    [readAt, notification.id]
  );

  const updatedList = await query('SELECT * FROM Notification WHERE id = ? LIMIT 1', [notification.id]);
  const updated = updatedList[0];
  updated.createdAt = updated.createdAt ? new Date(updated.createdAt) : new Date();
  updated.readAt = updated.readAt ? new Date(updated.readAt) : null;

  res.json(mapNotification(updated));
}

export async function getSettings(_req, res) {
  const settings = await getDefaultSettings();
  const smsTemplates = await getStoredSmsTemplates(settings);

  res.json({
    siteName: settings.siteName,
    smsGateway: settings.smsGateway || 'پیشگام رایان',
    defaultCommission: settings.defaultCommission,
    autoSms: Boolean(settings.autoSms),
    maintenanceMode: Boolean(settings.maintenanceMode),
    requireNationalId: Boolean(settings.requireNationalId),
    powerOfAttorneyUrl: settings.powerOfAttorneyUrl || '',
    smsTemplates,
    smsConfigured: isSmsConfigured(),
  });
}

export async function getPublicLegalDocuments(_req, res) {
  const settings = await getDefaultSettings();
  res.json({ powerOfAttorneyUrl: settings.powerOfAttorneyUrl || '' });
}

export async function sendUserSms(req, res) {
  const body = parseOrThrow(sendDirectSmsSchema, req.body);
  const customers = await query('SELECT id, phoneNumber FROM Customer WHERE id = ? LIMIT 1', [req.params.id]);
  if (!customers.length) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
  const result = await sendSms(customers[0].phoneNumber, body.message);
  if (!result.ok) {
    const gatewayMessages = {
      SMS_NOT_CONFIGURED: 'توکن یا شماره خط ارسال‌کننده پیامک تنظیم نشده است.',
      INVALID_PHONE_NUMBER: 'شماره موبایل گیرنده معتبر نیست.',
      SMS_IP_NOT_ALLOWED: 'IP خروجی سرور در بخش «کاربران ← آی‌پی‌های امن» پنل پیشگام رایان مجاز نشده است.',
      SMS_TOKEN_MISSING: 'توکن پیامک به درگاه ارسال نشده است.',
      SMS_TOKEN_INVALID: 'توکن پیامک نامعتبر یا هنوز تأییدنشده است.',
      SMS_SENDER_INVALID: 'شماره خط ارسال‌کننده نامعتبر یا غیرفعال است.',
      SMS_RECIPIENT_BLACKLISTED: 'شماره گیرنده در فهرست سیاه پیامکی است.',
      SMS_PERMISSION_DENIED: 'دسترسی ارسال پیامک برای این توکن در پنل پیشگام رایان فعال نیست.',
      SMS_CREDIT_INSUFFICIENT: 'اعتبار پنل پیامک برای ارسال کافی نیست.',
      SMS_FILTERED_CONTENT: 'متن پیامک توسط سامانه پالایش مسدود شده است.',
      SMS_LINK_NOT_ALLOWED: 'ارسال لینک در متن پیامک برای این خط مجاز نیست.',
      SMS_EMPTY_MESSAGE: 'متن پیامک خالی است.',
      SMS_TIMEOUT: 'درگاه پیامک در زمان مقرر پاسخ نداد.',
      SMS_REQUEST_FAILED: 'اتصال سرور به درگاه پیامک برقرار نشد.',
    };
    const message = gatewayMessages[result.reason]
      || `ارسال پیامک توسط درگاه انجام نشد${result.statusCode ? ` (کد ${result.statusCode})` : ''}.`;
    throw new AppError(
      message,
      502,
      result.reason || 'SMS_SEND_FAILED',
      {
        providerStatusCode: result.statusCode,
        providerMessage: result.providerMessage || '',
        httpStatus: result.httpStatus,
      }
    );
  }
  res.json(result);
}

export async function updateSettings(req, res) {
  const body = parseOrThrow(updateSettingsSchema, req.body);
  await ensureLegalDocumentColumns();
  const smsColumnReady = await ensureSmsTemplateColumn();

  const settingsList = await query('SELECT * FROM AppSetting WHERE id = "default" LIMIT 1');
  const current = settingsList[0] || {};
  const currentSmsTemplates = normalizeSmsTemplates(current.smsTemplates);
  const smsTemplates = normalizeSmsTemplates({
    ...currentSmsTemplates,
    ...(body.smsTemplates || {}),
  });

  if (settingsList.length > 0) {
    if (smsColumnReady) {
      await query(
        'UPDATE AppSetting SET siteName = ?, smsGateway = ?, defaultCommission = ?, autoSms = ?, maintenanceMode = ?, requireNationalId = ?, powerOfAttorneyUrl = ?, smsTemplates = ? WHERE id = "default"',
        [
          body.siteName ?? current.siteName ?? 'سامانه حقوقی فلای‌سوس',
          body.smsGateway ?? current.smsGateway ?? '',
          body.defaultCommission ?? current.defaultCommission ?? 20,
          body.autoSms ?? Boolean(current.autoSms ?? true),
          body.maintenanceMode ?? Boolean(current.maintenanceMode ?? false),
          body.requireNationalId ?? Boolean(current.requireNationalId ?? true),
          body.powerOfAttorneyUrl ?? current.powerOfAttorneyUrl ?? '',
          JSON.stringify(smsTemplates),
        ]
      );
    } else {
      await query(
        'UPDATE AppSetting SET siteName = ?, smsGateway = ?, defaultCommission = ?, autoSms = ?, maintenanceMode = ?, requireNationalId = ?, powerOfAttorneyUrl = ? WHERE id = "default"',
        [
          body.siteName ?? current.siteName ?? 'سامانه حقوقی فلای‌سوس',
          body.smsGateway ?? current.smsGateway ?? '',
          body.defaultCommission ?? current.defaultCommission ?? 20,
          body.autoSms ?? Boolean(current.autoSms ?? true),
          body.maintenanceMode ?? Boolean(current.maintenanceMode ?? false),
          body.requireNationalId ?? Boolean(current.requireNationalId ?? true),
          body.powerOfAttorneyUrl ?? current.powerOfAttorneyUrl ?? '',
        ]
      );
    }
  } else {
    if (smsColumnReady) {
      await query(
        'INSERT INTO AppSetting (id, siteName, smsGateway, defaultCommission, autoSms, maintenanceMode, requireNationalId, powerOfAttorneyUrl, smsTemplates) VALUES ("default", ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          body.siteName || 'سامانه حقوقی فلای‌سوس',
          body.smsGateway || 'پیشگام رایان',
          body.defaultCommission ?? 20,
          body.autoSms ?? true,
          body.maintenanceMode ?? false,
          body.requireNationalId ?? true,
          body.powerOfAttorneyUrl ?? '',
          JSON.stringify(smsTemplates),
        ]
      );
    } else {
      await query(
        'INSERT INTO AppSetting (id, siteName, smsGateway, defaultCommission, autoSms, maintenanceMode, requireNationalId, powerOfAttorneyUrl) VALUES ("default", ?, ?, ?, ?, ?, ?, ?)',
        [
          body.siteName || 'سامانه حقوقی فلای‌سوس',
          body.smsGateway || 'پیشگام رایان',
          body.defaultCommission ?? 20,
          body.autoSms ?? true,
          body.maintenanceMode ?? false,
          body.requireNationalId ?? true,
          body.powerOfAttorneyUrl ?? '',
        ]
      );
    }
  }

  const updatedSettings = await getDefaultSettings();
  const updatedSmsTemplates = await getStoredSmsTemplates(updatedSettings);

  res.json({
    siteName: updatedSettings.siteName,
    smsGateway: updatedSettings.smsGateway || 'پیشگام رایان',
    defaultCommission: updatedSettings.defaultCommission,
    autoSms: Boolean(updatedSettings.autoSms),
    maintenanceMode: Boolean(updatedSettings.maintenanceMode),
    requireNationalId: Boolean(updatedSettings.requireNationalId),
    powerOfAttorneyUrl: updatedSettings.powerOfAttorneyUrl || '',
    smsTemplates: updatedSmsTemplates,
    smsConfigured: isSmsConfigured(),
  });
}
