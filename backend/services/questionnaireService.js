const questionnaireDefinitions = Object.freeze({
  cancellation: Object.freeze([
    { id: 'c1' },
    { id: 'c2', dependsOn: 'c1' },
    { id: 'c3' },
    { id: 'c4' },
    { id: 'c5' },
    { id: 'c6', dependsOn: 'c5' },
    { id: 'c7', dependsOn: 'c5' },
    { id: 'c8' },
    { id: 'c9' },
  ]),
  delay: Object.freeze([
    { id: 'd1' },
    { id: 'd2' },
    { id: 'd3', dependsOn: 'd2' },
    { id: 'd4', dependsOn: 'd2' },
    { id: 'd5' },
    { id: 'd6' },
    { id: 'd7' },
    { id: 'd8', dependsOn: 'd7' },
    { id: 'd9' },
    { id: 'd10' },
    { id: 'd11', dependsOn: 'd10' },
    { id: 'd12', dependsOn: 'd10' },
  ]),
});

function getDefinition(claimType) {
  return questionnaireDefinitions[claimType] || null;
}

export function getActiveQuestionIds(claimType, answers = []) {
  const definition = getDefinition(claimType);
  if (!definition) return [];

  const answerById = new Map(
    answers.map((answer) => [String(answer?.questionId || ''), answer?.answer]),
  );

  return definition
    .filter(({ dependsOn }) => !dependsOn || answerById.get(dependsOn) === true)
    .map(({ id }) => id);
}

export function validateQuestionnaireAnswers(answers, claimType) {
  const definition = getDefinition(claimType);
  if (!definition || !Array.isArray(answers)) {
    return {
      ok: false,
      code: 'QUESTIONNAIRE_INVALID',
      missingQuestionIds: [],
    };
  }

  const answerById = new Map();
  const duplicateQuestionIds = [];

  for (const answer of answers) {
    const questionId = String(answer?.questionId || '');
    if (answerById.has(questionId)) duplicateQuestionIds.push(questionId);
    answerById.set(questionId, answer?.answer);
  }

  const allowedQuestionIds = new Set(definition.map(({ id }) => id));
  const invalidQuestionIds = answers
    .map((answer) => String(answer?.questionId || ''))
    .filter(
      (questionId) =>
        !questionId.startsWith('referral_') && !allowedQuestionIds.has(questionId),
    );

  if (duplicateQuestionIds.length || invalidQuestionIds.length) {
    return {
      ok: false,
      code: 'QUESTIONNAIRE_INVALID',
      missingQuestionIds: [],
      duplicateQuestionIds,
      invalidQuestionIds,
    };
  }

  const activeQuestionIds = getActiveQuestionIds(claimType, answers);
  const missingQuestionIds = activeQuestionIds.filter(
    (questionId) =>
      answerById.get(questionId) !== true && answerById.get(questionId) !== false,
  );
  const missingReferralAnswerIds = answers
    .map((answer) => String(answer?.questionId || ''))
    .filter(
      (questionId) =>
        questionId.startsWith('referral_') &&
        answerById.get(questionId) !== true &&
        answerById.get(questionId) !== false,
    );
  missingQuestionIds.push(...missingReferralAnswerIds);

  if (missingQuestionIds.length) {
    return {
      ok: false,
      code: 'QUESTIONNAIRE_ANSWERS_REQUIRED',
      missingQuestionIds,
    };
  }

  return {
    ok: true,
    activeQuestionIds,
    answers: answers.filter((answer) => {
      const questionId = String(answer?.questionId || '');
      return questionId.startsWith('referral_') || activeQuestionIds.includes(questionId);
    }),
  };
}
