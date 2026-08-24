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

let permissionsColumnReady = false;

export async function ensureAdminPermissionsColumn() {
  if (permissionsColumnReady) return;
  const columns = await query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AdminUser' AND COLUMN_NAME = 'permissions'`);
  if (!columns.length) {
    await query('ALTER TABLE AdminUser ADD COLUMN permissions LONGTEXT NULL AFTER accessLevel');
  }
  permissionsColumnReady = true;
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
