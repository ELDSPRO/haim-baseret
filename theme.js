/* Apply the display preference before styles load; game state is independent. */
(function () {
  'use strict';
  const KEY = 'haim-baseret-theme-v1';
  const COLORS = { classic: '#dedabd', light: '#f7f3e9', dark: '#192124' };
  const CONTROLS = 'button[data-theme-toggle]';
  const MODES = ['classic', 'light', 'dark'];
  const LABELS = { classic: 'קלאסי', light: 'בהיר', dark: 'כהה' };
  const ICONS = {
    classic: '<path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="10" cy="6.8" r=".8"/><circle cx="14" cy="6.8" r=".8"/><circle cx="17" cy="10" r=".8"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    dark: '<path d="M20.5 13.3A8.5 8.5 0 0 1 10.7 3.5a8.5 8.5 0 1 0 9.8 9.8Z"/>'
  };
  const nextMode = () => MODES[(MODES.indexOf(current) + 1) % MODES.length];
  const valid = value => Object.prototype.hasOwnProperty.call(COLORS, value);
  let current = 'classic';
  let storage = null;

  function sync() {
    const label = `צבעים: ${LABELS[current]}. מעבר למצב ${LABELS[nextMode()]}`;
    document.querySelectorAll(CONTROLS).forEach(button => {
      button.dataset.theme = current;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[current]}</svg>`;
    });
  }

  function apply(value) {
    current = valid(value) ? value : 'classic';
    document.documentElement.dataset.theme = current;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COLORS[current]);
    sync();
  }

  try {
    storage = window.localStorage;
    current = storage.getItem(KEY);
  } catch (_) { /* The preference also works when browser storage is blocked. */ }
  apply(current);

  // Dialogs can add another button, then sync it after inserting their HTML.
  window.FilmTheme = { sync };
  function bind() {
    sync();
    document.addEventListener('click', event => {
      const button = event.target?.closest?.(CONTROLS);
      if (!button || button.disabled) return;
      apply(nextMode());
      try { if (storage) storage.setItem(KEY, current); } catch (_) { /* Keep this tab's choice. */ }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.addEventListener('storage', event => {
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key === KEY || event.key === null) apply(event.key === null ? null : event.newValue);
  });
})();
