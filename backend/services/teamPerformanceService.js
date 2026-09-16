const TEAM_PERFORMANCE_ROLES = Object.freeze([
  'supervisor',
  'passenger_admin',
  'senior_expert',
  'expert',
  'expert_domestic',
  'expert_intl',
]);

const roleLabels = Object.freeze({
  supervisor: 'مدیر ارشد',
  passenger_admin: 'ادمین مدیریت مسافران',
  senior_expert: 'کارشناس ارشد',
  expert: 'کارشناس',
  expert_domestic: 'کارشناس پرواز داخلی',
  expert_intl: 'کارشناس پرواز خارجی',
});

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

function normalizeId(value) {
  return value === null || value === undefined || value === ''
    ? ''
    : String(value);
}

function toTimestamp(value) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function roundMetric(value) {
  return Number(value.toFixed(2));
}

function firstClosedAtByClaim(statusHistory) {
  const closedAtByClaim = new Map();

  for (const entry of statusHistory || []) {
    if (String(entry?.toStatus || '').trim() !== 'closed') continue;

    const claimId = normalizeId(entry?.claimId);
    const timestamp = toTimestamp(entry?.createdAt);
    if (!claimId || timestamp === null) continue;

    const previous = closedAtByClaim.get(claimId);
    if (previous === undefined || timestamp < previous) {
      closedAtByClaim.set(claimId, timestamp);
    }
  }

  return closedAtByClaim;
}

function reviewDurationHours(claim, closedAtByClaim) {
  const start = toTimestamp(claim?.createdAt);
  if (start === null) return null;

  const historyClosedAt = closedAtByClaim.get(normalizeId(claim?.id));
  const end = historyClosedAt ?? toTimestamp(claim?.updatedAt);
  if (end === null || end < start) return null;

  return (end - start) / MILLISECONDS_PER_HOUR;
}

export function buildTeamPerformance({
  admins = [],
  claims = [],
  statusHistory = [],
} = {}) {
  const closedAtByClaim = firstClosedAtByClaim(statusHistory);
  const claimsByAdmin = new Map();

  for (const claim of claims) {
    const adminId = normalizeId(claim?.assignedAdminId);
    if (!adminId) continue;

    const assignedClaims = claimsByAdmin.get(adminId) || [];
    assignedClaims.push(claim);
    claimsByAdmin.set(adminId, assignedClaims);
  }

  const allowedRoles = new Set(TEAM_PERFORMANCE_ROLES);

  return admins
    .filter((admin) => allowedRoles.has(String(admin?.role || '')))
    .map((admin) => {
      const id = normalizeId(admin?.id);
      const assignedClaims = claimsByAdmin.get(id) || [];
      const closedClaims = assignedClaims.filter(
        (claim) => String(claim?.status || '').trim() === 'closed',
      );
      const reviewDurations = closedClaims
        .map((claim) => reviewDurationHours(claim, closedAtByClaim))
        .filter((hours) => hours !== null);

      return {
        id,
        name: admin?.name || admin?.username || 'بدون نام',
        username: admin?.username || '',
        role: String(admin?.role || ''),
        roleLabel: roleLabels[admin?.role] || String(admin?.role || ''),
        assignedClaimsCount: assignedClaims.length,
        closedClaimsCount: closedClaims.length,
        averageReviewHours: reviewDurations.length
          ? roundMetric(
            reviewDurations.reduce((sum, hours) => sum + hours, 0) / reviewDurations.length,
          )
          : null,
        // There is no persisted passenger-satisfaction response in the current schema.
        satisfactionScore: null,
        satisfactionResponseCount: 0,
      };
    });
}

export { TEAM_PERFORMANCE_ROLES };
