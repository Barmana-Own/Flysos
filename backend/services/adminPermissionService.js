import { query } from '../config/db.js';

export const roleDefaultPermissions = {
  supervisor: ['manage_system', 'manage_experts', 'view_reports', 'manage_content', 'manage_passengers', 'view_all_claims', 'edit_claims', 'add_notes', 'send_sms', 'manage_support'],
  content_admin: ['manage_content'],
  passenger_admin: ['manage_passengers', 'view_all_claims', 'edit_claims', 'add_notes', 'send_sms'],
  senior_expert: ['view_assigned_claims', 'edit_claims', 'add_notes'],
  expert: ['view_assigned_claims', 'add_notes'],
  expert_domestic: ['view_assigned_claims', 'edit_claims', 'add_notes'],
  expert_intl: ['view_assigned_claims', 'edit_claims', 'add_notes'],
};

export const adminAccessLevelValues = Object.freeze([
  'all',
  'new',
  'under_review',
  'needs_action',
  'pending_info',
  'approved',
  'waiting_poa_draft',
  'waiting_passenger_poa_approval',
  'lawyer_action',
  'waiting_judgment',
  'waiting_enforcement_order',
  'waiting_compensation',
  'finance_review',
  'waiting_customer_payment',
  'rejected',
  'closed',
]);

let permissionsColumnReady = false;
let accessLevelsColumnReady;

export async function ensureAdminPermissionsColumn() {
  if (permissionsColumnReady) return;
  const columns = await query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AdminUser' AND COLUMN_NAME = 'permissions'`);
  if (!columns.length) {
    await query('ALTER TABLE AdminUser ADD COLUMN permissions LONGTEXT NULL AFTER accessLevel');
  }
  permissionsColumnReady = true;
}

export async function ensureAdminAccessLevelsColumn() {
  if (!accessLevelsColumnReady) {
    accessLevelsColumnReady = (async () => {
      const columns = await query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AdminUser' AND COLUMN_NAME = 'accessLevels'`);
      if (!columns.length) {
        await query('ALTER TABLE AdminUser ADD COLUMN accessLevels LONGTEXT NULL AFTER accessLevel');
      }
      return true;
    })().catch((error) => {
      accessLevelsColumnReady = undefined;
      throw error;
    });
  }
  return accessLevelsColumnReady;
}

function accessLevelCandidates(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Legacy values may be stored as a comma-separated list.
  }

  return value.split(',');
}

export function parseAdminAccessLevels(value, fallback = 'under_review') {
  const candidates = accessLevelCandidates(value)
    .map((item) => String(item).trim())
    .filter((item) => adminAccessLevelValues.includes(item));
  const normalized = [...new Set(candidates)];

  if (normalized.includes('all')) return ['all'];
  if (normalized.length) return normalized;

  const fallbackValue = String(fallback || 'under_review').trim();
  return adminAccessLevelValues.includes(fallbackValue) ? [fallbackValue] : ['under_review'];
}

export function getAdminAccessLevels(admin) {
  return parseAdminAccessLevels(admin?.accessLevels, admin?.accessLevel);
}

export function parseAdminPermissions(value, role = 'expert') {
  if (Array.isArray(value)) {
    const parsed = [...new Set(value.map(String).filter(Boolean))];
    return parsed.length ? parsed : [...(roleDefaultPermissions[role] || roleDefaultPermissions.expert)];
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const normalized = [...new Set(parsed.map(String).filter(Boolean))];
        return normalized.length ? normalized : [...(roleDefaultPermissions[role] || roleDefaultPermissions.expert)];
      }
    } catch {
      const normalized = value.split(',').map((item) => item.trim()).filter(Boolean);
      return normalized.length ? normalized : [...(roleDefaultPermissions[role] || roleDefaultPermissions.expert)];
    }
  }
  return [...(roleDefaultPermissions[role] || roleDefaultPermissions.expert)];
}

export function hasAdminPermission(admin, permission) {
  if (admin?.role === 'supervisor') {
    return true;
  }
  return parseAdminPermissions(admin?.permissions, admin?.role).includes(permission);
}
