(function syncAboutCmsContent() {
  'use strict';

  if (window.location.pathname.replace(/\/+$/u, '') !== '/about') return;

  const slots = new Map();
  let page = null;
  let scheduled = false;

  function findBlock(blocks, id) {
    for (const block of Array.isArray(blocks) ? blocks : []) {
      if (block && block.id === id) return block;
      const nested = findBlock(block && block.children, id);
      if (nested) return nested;
    }
    return null;
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function findElement(slot, selectors, fallbackTexts) {
    const previous = slots.get(slot);
    if (previous && previous.isConnected) return previous;

    const allowed = new Set(fallbackTexts.map((value) => text(value)).filter(Boolean));
    for (const element of document.querySelectorAll(selectors)) {
      if (allowed.has(text(element.textContent))) {
        slots.set(slot, element);
        return element;
      }
    }
    return null;
  }

  function write(slot, selectors, fallbackTexts, value) {
    const next = text(value);
    if (!next) return;
    const element = findElement(slot, selectors, [...fallbackTexts, next]);
    if (!element || element.textContent === next) return;
    element.textContent = next;
    element.dataset.flysosAboutCmsSlot = slot;
    slots.set(slot, element);
  }

  function apply() {
    const cta = findBlock(page && page.blocks, 'about-cta');
    const content = cta && cta.content;
    if (!content) return;

    write(
      'title',
      'h1, h2, h3',
      ['«حق شما، مسئولیت ماست»'],
      content.title,
    );
    write(
      'description',
      'p',
      ['ما در کنار شما هستیم تا هر سفر، تجربه‌ای امن، عادلانه و منصفانه باشد. همین حالا اقدام کنید و پیگیری خسارت پرواز خود را آغاز فرمایید.'],
      content.description || content.text,
    );
    write(
      'primary-label',
      'button',
      ['ثبت درخواست دریافت خسارت'],
      content.primaryLabel,
    );
    write(
      'secondary-label',
      'button',
      ['مطالعه آیین‌نامه‌ها و قوانین'],
      content.secondaryLabel,
    );
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleApply();

  fetch(`/api/pages/about?aboutCmsSync=20260910`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      page = data;
      scheduleApply();
    })
    .catch(() => undefined);
})();
