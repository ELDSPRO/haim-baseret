/* Apply the display preference before styles load; game state is independent. */
(function () {
  'use strict';
  const KEY = 'haim-baseret-theme-v1';
  const COLORS = { classic: '#dedabd', light: '#f7f3e9', dark: '#192124' };
  const CONTROLS = '#theme-select, select[data-theme-select]';
  const valid = value => Object.prototype.hasOwnProperty.call(COLORS, value);
  let current = 'classic';
  let storage = null;

  function sync() {
    document.querySelectorAll(CONTROLS).forEach(select => { select.value = current; });
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

  // Dialogs can add another native select, then sync it after inserting their HTML.
  window.FilmTheme = { sync };
  function bind() {
    sync();
    document.addEventListener('change', event => {
      const select = event.target;
      if (!select || select.tagName !== 'SELECT' || !select.matches(CONTROLS)) return;
      if (!valid(select.value)) { sync(); return; }
      apply(select.value);
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
