(() => {
  const ERROR_TEXT_MARKERS = [
    'بارگذاری فایل بلیت الزامی است',
    'لطفاً فایل بلیت را دوباره انتخاب کنید',
  ];
  const SUBMIT_TEXT_MARKER = 'ادامه و تکمیل پرسشنامه';
  const TOP_ERROR_ATTRIBUTE = 'data-ticket-upload-error-top';

  function findStage() {
    const heading = [...document.querySelectorAll('h2')].find((element) =>
      element.textContent.includes('مرحله دوم: بارگذاری'),
    );
    const headingBlock = heading?.parentElement;
    return { stage: headingBlock?.parentElement, headingBlock };
  }

  function findSource(stage) {
    return [...stage.querySelectorAll('p')].find((element) => {
      if (element.hasAttribute(TOP_ERROR_ATTRIBUTE)) return false;
      const text = element.textContent || '';
      return ERROR_TEXT_MARKERS.some((marker) => text.includes(marker));
    });
  }

  function findTopError(stage) {
    return stage.querySelector(`[${TOP_ERROR_ATTRIBUTE}]`);
  }

  function syncError() {
    const { stage, headingBlock } = findStage();
    if (!stage || !headingBlock) return;

    const source = findSource(stage);
    const topError = findTopError(stage);
    if (!source) {
      topError?.remove();
      return;
    }

    source.hidden = true;
    source.setAttribute('aria-hidden', 'true');

    const alert = topError || document.createElement('p');
    if (!topError) {
      alert.setAttribute('role', 'alert');
      alert.setAttribute('aria-live', 'assertive');
      alert.setAttribute(TOP_ERROR_ATTRIBUTE, 'true');
      alert.className =
        'rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-600';
      stage.insertBefore(alert, headingBlock.nextSibling);
    }

    if (alert.textContent !== source.textContent) {
      alert.textContent = source.textContent;
    }
    alert.hidden = false;
    alert.style.scrollMarginTop = '6rem';
  }

  function showAndScroll() {
    syncError();
    const { stage } = findStage();
    const topError = stage && findTopError(stage);
    if (!topError || !topError.textContent.trim()) return;

    topError.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  }

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      const button = target instanceof Element ? target.closest('button') : null;
      if (!button || !button.textContent.includes(SUBMIT_TEXT_MARKER)) return;

      window.setTimeout(showAndScroll, 0);
    },
    true,
  );

  const root = document.getElementById('root') || document.body;
  if (!root) return;

  const observer = new MutationObserver(syncError);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  syncError();
})();
