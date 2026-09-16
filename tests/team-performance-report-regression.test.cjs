const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

async function loadTeamPerformanceService() {
  return import('../backend/services/teamPerformanceService.js');
}

test('team performance keeps only claim-team roles and calculates assignment/closure metrics', async () => {
  const { buildTeamPerformance } = await loadTeamPerformanceService();

  const rows = buildTeamPerformance({
    admins: [
      { id: 'admin-1', name: 'کارشناس یک', username: 'expert-one', role: 'senior_expert' },
      { id: 'admin-2', name: 'ادمین محتوا', username: 'content', role: 'content_admin' },
      { id: 'admin-3', name: 'کارشناس دو', username: 'expert-two', role: 'expert_domestic' },
    ],
    claims: [
      {
        id: 'claim-1',
        assignedAdminId: 'admin-1',
        status: 'closed',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'claim-2',
        assignedAdminId: 'admin-1',
        status: 'closed',
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-04T12:00:00.000Z',
      },
      {
        id: 'claim-3',
        assignedAdminId: 'admin-1',
        status: 'under_review',
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T02:00:00.000Z',
      },
      {
        id: 'claim-4',
        assignedAdminId: 'admin-3',
        status: 'rejected',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      },
    ],
    statusHistory: [
      { claimId: 'claim-1', toStatus: 'closed', createdAt: '2026-09-01T18:00:00.000Z' },
      { claimId: 'claim-2', toStatus: 'closed', createdAt: '2026-09-04T12:00:00.000Z' },
    ],
  });

  assert.deepEqual(rows.map((row) => row.id), ['admin-1', 'admin-3']);
  assert.deepEqual(rows[0], {
    id: 'admin-1',
    name: 'کارشناس یک',
    username: 'expert-one',
    role: 'senior_expert',
    roleLabel: 'کارشناس ارشد',
    assignedClaimsCount: 3,
    closedClaimsCount: 2,
    averageReviewHours: 27,
    satisfactionScore: null,
    satisfactionResponseCount: 0,
  });
  assert.equal(rows[1].assignedClaimsCount, 1);
  assert.equal(rows[1].closedClaimsCount, 0);
  assert.equal(rows[1].averageReviewHours, null);
  assert.equal(rows[1].satisfactionScore, null);
});

test('team performance falls back to the claim update timestamp for legacy closed claims', async () => {
  const { buildTeamPerformance } = await loadTeamPerformanceService();

  const [row] = buildTeamPerformance({
    admins: [{ id: 'admin-1', username: 'expert-one', role: 'expert' }],
    claims: [{
      id: 'claim-1',
      assignedAdminId: 'admin-1',
      status: 'closed',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T06:00:00.000Z',
    }],
    statusHistory: [],
  });

  assert.equal(row.averageReviewHours, 30);
});

test('team performance includes the active staff shown by expert management', async () => {
  const { buildTeamPerformance } = await loadTeamPerformanceService();

  const rows = buildTeamPerformance({
    admins: [
      { id: 'admin-supervisor', name: 'Flysos Admin', role: 'supervisor' },
      { id: 'admin-passenger-one', name: 'محسن ملکی', role: 'passenger_admin' },
      { id: 'admin-passenger-two', name: 'مریم احسانی', role: 'passenger_admin' },
    ],
    claims: [],
  });

  assert.deepEqual(rows.map((row) => row.name), [
    'Flysos Admin',
    'محسن ملکی',
    'مریم احسانی',
  ]);
  assert.deepEqual(rows.map((row) => row.assignedClaimsCount), [0, 0, 0]);
});

test('the report endpoint and active admin bundle are wired to the same team-performance contract', () => {
  const controller = read('backend/controllers/platformController.js');
  const routes = read('backend/routes/adminRoutes.js');
  const mainBundle = read('assets/index-CmsReadyAdminFix20260820.js');
  const adminBundle = read('assets/AdminPanel-CmsReadyAdminFix20260820.js');

  assert.match(controller, /export async function getTeamPerformanceReport/);
  assert.match(controller, /FROM ClaimStatusHistory history/);
  assert.match(controller, /WHERE history\.toStatus = \?/);
  assert.match(routes, /\/reports\/team-performance/);
  assert.match(routes, /requireSupervisor/);
  assert.match(mainBundle, /getAdminTeamPerformance\(\)\{return fe\("\/admin\/reports\/team-performance"/);
  assert.match(mainBundle, /getAdminTeamPerformance as ao/);
  assert.match(adminBundle, /ao as getAdminTeamPerformance/);
  assert.match(adminBundle, /k&&q==="reports"&&\(setTeamPerformance\(\[\]\),getAdminTeamPerformance\(\)\.then\(setTeamPerformance\)/);
  assert.match(adminBundle, /children:teamPerformance\.map\(p=>s\.jsxs\("tr",\{className:"font-bold text-slate-700"/);
  assert.match(adminBundle, /p\.satisfactionScore===null\|\|p\.satisfactionScore===void 0\?"ثبت نشده"/);
});
