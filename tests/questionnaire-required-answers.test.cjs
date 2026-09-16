const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

async function loadQuestionnaireService() {
  return import('../backend/services/questionnaireService.js');
}

function answer(questionId, value = false) {
  return { questionId, question: `Question ${questionId}`, answer: value };
}

test('cancellation questionnaire requires every visible question', async () => {
  const { validateQuestionnaireAnswers } = await loadQuestionnaireService();
  const answers = ['c1', 'c3', 'c4', 'c5', 'c8', 'c9'].map((id) => answer(id));

  const result = validateQuestionnaireAnswers(answers, 'cancellation');

  assert.equal(result.ok, true);
  assert.deepEqual(result.activeQuestionIds, ['c1', 'c3', 'c4', 'c5', 'c8', 'c9']);
});

test('missing cancellation answer is rejected before persistence', async () => {
  const { validateQuestionnaireAnswers } = await loadQuestionnaireService();
  const answers = ['c1', 'c3', 'c5', 'c8', 'c9'].map((id) => answer(id));

  const result = validateQuestionnaireAnswers(answers, 'cancellation');

  assert.equal(result.ok, false);
  assert.equal(result.code, 'QUESTIONNAIRE_ANSWERS_REQUIRED');
  assert.deepEqual(result.missingQuestionIds, ['c4']);
});

test('conditional questions become required when their parent answer is yes', async () => {
  const { validateQuestionnaireAnswers } = await loadQuestionnaireService();
  const answers = [
    answer('c1', true),
    answer('c3'),
    answer('c4'),
    answer('c5', true),
    answer('c8'),
    answer('c9'),
    answer('c2'),
    answer('c6'),
  ];

  const result = validateQuestionnaireAnswers(answers, 'cancellation');

  assert.equal(result.ok, false);
  assert.equal(result.code, 'QUESTIONNAIRE_ANSWERS_REQUIRED');
  assert.deepEqual(result.missingQuestionIds, ['c7']);
});

test('delay questionnaire requires all active questions and rejects null answers', async () => {
  const { validateQuestionnaireAnswers } = await loadQuestionnaireService();
  const answers = [
    answer('d1'),
    answer('d2', true),
    answer('d5'),
    answer('d6'),
    answer('d7', true),
    answer('d9'),
    answer('d10', true),
    answer('d3'),
    answer('d4'),
    answer('d8'),
    answer('d11'),
    answer('d12', null),
  ];

  const result = validateQuestionnaireAnswers(answers, 'delay');

  assert.equal(result.ok, false);
  assert.equal(result.code, 'QUESTIONNAIRE_ANSWERS_REQUIRED');
  assert.deepEqual(result.missingQuestionIds, ['d12']);
});

test('unknown and duplicate question ids are rejected', async () => {
  const { validateQuestionnaireAnswers } = await loadQuestionnaireService();
  const answers = [
    answer('c1'),
    answer('c1', true),
    answer('c3'),
    answer('c4'),
    answer('c5'),
    answer('c8'),
    answer('c9'),
    answer('x1'),
  ];

  const result = validateQuestionnaireAnswers(answers, 'cancellation');

  assert.equal(result.ok, false);
  assert.equal(result.code, 'QUESTIONNAIRE_INVALID');
  assert.deepEqual(result.duplicateQuestionIds, ['c1']);
  assert.deepEqual(result.invalidQuestionIds, ['x1']);
});

test('admin claim mapping exposes the questionnaire section and localized label', async () => {
  const { mapClaimForAdmin } = await import('../backend/services/claimMapper.js');
  const claim = mapClaimForAdmin({
    id: 'claim-1',
    trackingCode: 'FS123456',
    claimType: 'delay',
    status: 'new',
    stage: 1,
    nationalId: '0012345678',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    questionnaire: [
      { id: 'answer-d1', questionId: 'd1', question: 'تاخیر؟', answer: true },
      { id: 'answer-referral', questionId: 'referral_sms', question: 'نحوه آشنایی', answer: false },
    ],
    files: [],
    statusHistory: [],
    notes: [],
  });

  assert.equal(claim.delayAnswers[0].section, 'delay');
  assert.equal(claim.delayAnswers[0].sectionLabel, 'تاخیر پرواز');
  assert.equal(claim.questionnaireAnswers[0].section, 'delay');
  assert.equal(claim.questionnaireAnswers[1].section, 'referral');
});

test('active public and admin bundles contain the questionnaire safeguards', () => {
  const publicHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const adminHtml = fs.readFileSync(
    path.join(__dirname, '..', 'admin', 'v2', 'login', 'index.html'),
    'utf8',
  );
  const publicBundle = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'index-CmsReadyAdminFix20260820.js'),
    'utf8',
  );
  const submitErrorScript = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'questionnaire-submit-error-20260909.js'),
    'utf8',
  );
  const referralErrorScript = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'questionnaire-referral-error-position-20260909.js'),
    'utf8',
  );
  const adminBundle = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'AdminPanel-CmsReadyAdminFix20260820.js'),
    'utf8',
  );

  assert.match(publicHtml, /20260916-claim-assignment-selector-v1/);
  assert.match(publicHtml, /questionnaire-submit-error-20260909\.js\?v=20260909-submit-error-v3/);
  assert.doesNotMatch(publicHtml, /questionnaire-submit-error-20260909\.css/);
  assert.match(
    publicHtml,
    /questionnaire-referral-error-position-20260909\.js\?v=20260909-referral-error-v2/,
  );
  assert.match(adminHtml, /20260916-claim-assignment-selector-v1/);
  assert.match(publicBundle, /activeQuestionnaire\.some\(/);
  assert.match(publicBundle, /تمام سوالات بخش انتخاب‌شده/);
  assert.match(publicBundle, /questionnaireError/);
  assert.match(publicBundle, /setQuestionnaireError\("لطفاً به تمام سوالات بخش انتخاب‌شده پاسخ دهید\."\)/);
  assert.match(publicBundle, /role:"alert"/);
  assert.doesNotMatch(publicBundle, /alert\("لطفاً به تمام سوالات بخش انتخاب‌شده پاسخ دهید\."\)/);
  assert.match(submitErrorScript, /تمام سوالات بخش انتخاب‌شده/);
  assert.match(submitErrorScript, /ثبت و ارسال پرونده/);
  assert.match(submitErrorScript, /scrollIntoView/);
  assert.match(submitErrorScript, /document\.addEventListener\('click'/);
  assert.doesNotMatch(submitErrorScript, /flysos-questionnaire-submit-error|MutationObserver|getBoundingClientRect/);
  assert.match(referralErrorScript, /حداقل یک گزینه از نحوه آشنایی با ما را انتخاب کنید/);
  assert.match(referralErrorScript, /querySelectorAll\('p'\)/);
  assert.match(referralErrorScript, /border-t\.border-slate-200\.bg-white\.p-5/);
  assert.match(referralErrorScript, /insertBefore\(error, questionnaireSection\)/);
  assert.match(publicBundle, /JSON\.stringify\(\{answers:u,claimType:o\}\)/);
  assert.match(
    publicBundle,
    /AdminPanel-CmsReadyAdminFix20260820\.js\?v=20260916-claim-assignment-selector-v1/,
  );
  assert.match(adminBundle, /بخش: لغو \/ ابطال پرواز/);
  assert.match(adminBundle, /sectionLabel/);
});

test('claim controller validates questionnaire data before replacing persisted answers', () => {
  const controller = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'controllers', 'claimController.js'),
    'utf8',
  );

  assert.match(controller, /validateQuestionnaireAnswers\(body\.answers, claimType\)/);
  assert.match(controller, /validateQuestionnaireAnswers\(questionnaireAnswers, claimType\)/);
  assert.match(controller, /answer\.answer === true \? 1 : 0/);
  assert.doesNotMatch(controller, /answer\.answer \? 1 : 0/);
});
