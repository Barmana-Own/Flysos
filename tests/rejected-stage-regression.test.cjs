const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

process.env.DB_NAME ||= 'rejected_stage_regression';
process.env.DB_USER ||= 'rejected_stage_regression';

test('admin claim updates accept the rejected stage and reject later stages', async () => {
  const { updateClaimSchema } = await import('../backend/validation/adminSchemas.js');

  assert.equal(updateClaimSchema.safeParse({ stage: 8 }).success, true);
  assert.equal(updateClaimSchema.safeParse({ stage: 9 }).success, false);
});

test('rejected claims use a dedicated SMS template', async () => {
  const {
    DEFAULT_SMS_TEMPLATES,
    renderSmsTemplate,
  } = await import('../backend/services/smsTemplateService.js');

  assert.match(DEFAULT_SMS_TEMPLATES.rejected, /رد شده/u);
  assert.equal(
    renderSmsTemplate(DEFAULT_SMS_TEMPLATES.rejected, { trackingCode: 'FS-REJECTED-1' })
      .includes('{trackingCode}'),
    false,
  );
  assert.match(
    renderSmsTemplate(DEFAULT_SMS_TEMPLATES.rejected, { trackingCode: 'FS-REJECTED-1' }),
    /FS-REJECTED-1/u,
  );
});

test('public claim mapping exposes the rejected stage only for rejected claims', async () => {
  const { mapClaimForPublic } = await import('../backend/services/claimMapper.js');

  const normal = mapClaimForPublic({
    trackingCode: 'FS-NORMAL-1',
    claimType: 'delay',
    status: 'under_review',
    stage: 7,
    updatedAt: new Date(),
  });
  const rejected = mapClaimForPublic({
    trackingCode: 'FS-REJECTED-1',
    claimType: 'delay',
    status: 'rejected',
    stage: 1,
    updatedAt: new Date(),
  });

  assert.equal(normal.stageTimeline.length, 7);
  assert.equal(normal.stage, 7);
  assert.equal(rejected.stage, 8);
  assert.equal(rejected.currentStage.title, 'رد شده');
  assert.equal(rejected.stageTimeline.at(-1).stage, 8);
});

test('admin status and stage flows both persist rejected status and send the rejected template', () => {
  const controller = fs.readFileSync(
    path.join(repoRoot, 'backend/controllers/adminController.js'),
    'utf8',
  );
  const adminBundle = fs.readFileSync(
    path.join(repoRoot, 'assets/AdminPanel-CmsReadyAdminFix20260820.js'),
    'utf8',
  );

  assert.match(controller, /stage = 8/u);
  assert.match(controller, /templateKey: 'rejected'/u);
  assert.match(controller, /requestedStatus = body\.stage === 8/u);
  assert.match(adminBundle, /id:8,label:"رد شده"/u);
  assert.match(adminBundle, /L="rejected"/u);
});

test('the rejected stage uses the dedicated status request contract', () => {
  const adminBundle = fs.readFileSync(
    path.join(repoRoot, 'assets/AdminPanel-CmsReadyAdminFix20260820.js'),
    'utf8',
  );

  assert.match(
    adminBundle,
    /P===8\?await pN\(p,"rejected"\):await dn\(p,\{stage:P,status:L\}\)/u,
  );
});

test('rejected notification is retried for an unfinished rejected claim without breaking the status response', () => {
  const controller = fs.readFileSync(
    path.join(repoRoot, 'backend/controllers/adminController.js'),
    'utf8',
  );

  assert.match(
    controller,
    /status === 'rejected'[\s\S]*status !== claim\.status \|\| Number\(claim\.stage\) !== 8/u,
  );
  assert.match(controller, /sendClaimStageSmsBestEffort\(updatedClaim/u);
});
