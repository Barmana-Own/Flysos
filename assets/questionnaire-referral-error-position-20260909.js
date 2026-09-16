(() => {
  const ERROR_TEXT_MARKER = 'حداقل یک گزینه از نحوه آشنایی با ما را انتخاب کنید';
  const QUESTIONNAIRE_SECTION_SELECTOR = 'div.border-t.border-slate-200.bg-white.p-5';

  function moveReferralError() {
    const error = [...document.querySelectorAll('p')].find((element) =>
      element.textContent.includes(ERROR_TEXT_MARKER),
    );
    if (!error) return;

    const questionnaireSection = error.closest(QUESTIONNAIRE_SECTION_SELECTOR);
    const sectionParent = questionnaireSection?.parentElement;
    if (!questionnaireSection || !sectionParent || error.parentElement === sectionParent) return;

    sectionParent.insertBefore(error, questionnaireSection);
  }

  const root = document.getElementById('root') || document.body;
  if (!root) return;

  const observer = new MutationObserver(moveReferralError);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  moveReferralError();
})();
