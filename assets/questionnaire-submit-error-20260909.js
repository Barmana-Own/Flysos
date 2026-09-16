(() => {
  const ERROR_TEXT_MARKER = 'تمام سوالات بخش انتخاب‌شده';
  const SUBMIT_TEXT_MARKER = 'ثبت و ارسال پرونده';

  function findQuestionnaireError() {
    return [...document.querySelectorAll('p[role="alert"]')].find((element) =>
      element.textContent.includes(ERROR_TEXT_MARKER),
    );
  }

  function scrollErrorIntoView(source) {
    if (!source || typeof source.scrollIntoView !== 'function') return;

    source.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    const button = target instanceof Element ? target.closest('button') : null;
    if (!button || !button.textContent.includes(SUBMIT_TEXT_MARKER)) return;

    window.setTimeout(() => {
      const source = findQuestionnaireError();
      if (!source) return;

      scrollErrorIntoView(source);
    }, 0);
  }, true);
})();
