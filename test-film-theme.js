'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'theme.js'), 'utf8');
const KEY = 'haim-baseret-theme-v1';
const COLORS = { classic: '#dedabd', light: '#f7f3e9', dark: '#192124' };
const tests = [];
const test = (name, run) => tests.push({ name, run });

function browser(options = {}) {
  const data = new Map([['kobi-lives-in-film-v1', '{"project":{"stage":"edit"}}'], ['kobi-lives-in-film-sound', 'true']]);
  if (options.stored !== undefined) data.set(KEY, options.stored);
  const calls = [], nodes = [], documentEvents = new Map(), windowEvents = new Map();
  const storage = {
    getItem(key) { calls.push(['get', key]); if (options.readBlocked) throw Error('Storage read blocked'); return data.get(key) ?? null; },
    setItem(key, value) { calls.push(['set', key, value]); if (options.writeBlocked) throw Error('Storage write blocked'); data.set(key, value); }
  };
  const add = (events, type, fn, config = {}) => {
    if (!events.has(type)) events.set(type, []);
    events.get(type).push({ fn, once: config.once });
  };
  const emit = (events, type, event = {}) => {
    for (const listener of [...events.get(type) || []]) {
      listener.fn(event);
      if (listener.once) events.set(type, events.get(type).filter(item => item !== listener));
    }
  };
  const meta = { content: '#dedabd', setAttribute(name, value) { assert.equal(name, 'content'); this.content = value; } };
  const document = {
    readyState: options.readyState || 'loading', documentElement: { dataset: {} },
    querySelector(selector) { assert.equal(selector, 'meta[name="theme-color"]'); return options.noMeta ? null : meta; },
    querySelectorAll(selector) {
      assert.equal(selector, '#theme-select, select[data-theme-select]');
      return nodes.filter(node => node.matches(selector));
    },
    addEventListener(type, fn, config) { add(documentEvents, type, fn, config); }
  };
  const window = { document, addEventListener(type, fn, config) { add(windowEvents, type, fn, config); } };
  Object.defineProperty(window, 'localStorage', { get() { if (options.getterBlocked) throw Error('Storage access blocked'); return storage; } });
  // Any accidental dependency on the engine or rendering should fail the test.
  for (const name of ['FilmGame', 'game', 'state', 'render', 'location']) Object.defineProperty(window, name, { get() { throw Error('Theme accessed game/navigation: ' + name); } });
  vm.runInNewContext(source, { window, document }, { filename: 'theme.js' });
  return {
    data, calls, document, window, meta, storage, documentEvents, windowEvents,
    select(id = 'theme-select', marked = true) {
      const node = { id, tagName: 'SELECT', value: 'classic', matches: () => id === 'theme-select' || marked };
      nodes.push(node); return node;
    },
    ready() { document.readyState = 'interactive'; emit(documentEvents, 'DOMContentLoaded'); },
    change(target) { const event = { target, preventDefault() { throw Error('Native input was intercepted'); } }; emit(documentEvents, 'change', event); },
    storageEvent(event) { emit(windowEvents, 'storage', { storageArea: storage, ...event }); }
  };
}

test('stored preferences apply before DOMContentLoaded and do not write during startup', () => {
  for (const [theme, color] of Object.entries(COLORS)) {
    const b = browser({ stored: theme });
    assert.equal(b.document.readyState, 'loading');
    assert.equal(b.document.documentElement.dataset.theme, theme);
    assert.equal(b.meta.content, color);
    assert.deepEqual(b.calls, [['get', KEY]]);
    const select = b.select(); b.ready();
    assert.equal(select.value, theme);
  }
});

test('missing or invalid preferences safely use classic without rewriting storage', () => {
  for (const stored of [undefined, '', 'system', 'LIGHT', '__proto__', 'constructor', 'dark;display:none', null]) {
    const b = browser({ stored });
    assert.equal(b.document.documentElement.dataset.theme, 'classic');
    assert.equal(b.meta.content, COLORS.classic);
    assert.ok(!b.calls.some(call => call[0] === 'set'));
  }
});

test('blocked storage access, reads or writes never prevent a live theme change', () => {
  for (const options of [{ getterBlocked: true }, { readBlocked: true }, { writeBlocked: true }]) {
    const b = browser(options), select = b.select(); b.ready();
    select.value = 'dark'; b.change(select);
    assert.equal(b.document.documentElement.dataset.theme, 'dark');
    assert.equal(b.meta.content, COLORS.dark);
    assert.equal(select.value, 'dark');
    assert.ok(b.calls.every(call => call[1] === KEY));
  }
});

test('native change events update immediately, persist only the preference and survive reload', () => {
  const b = browser(), select = b.select(); b.ready();
  const savedGame = b.data.get('kobi-lives-in-film-v1');
  for (const theme of ['light', 'dark', 'classic']) {
    select.value = theme; b.change(select);
    assert.equal(b.document.documentElement.dataset.theme, theme);
    assert.equal(b.meta.content, COLORS[theme]);
    assert.equal(b.data.get(KEY), theme);
    assert.equal(browser({ stored: b.data.get(KEY) }).document.documentElement.dataset.theme, theme);
  }
  assert.equal(b.data.get('kobi-lives-in-film-v1'), savedGame);
  assert.equal(b.data.get('kobi-lives-in-film-sound'), 'true');
  assert.ok(b.calls.every(call => call[1] === KEY));
  assert.deepEqual([...b.documentEvents.keys()].sort(), ['DOMContentLoaded', 'change']);
  assert.ok(!b.documentEvents.has('keydown') && !b.documentEvents.has('click'), 'keyboard selection remains browser-native');
});

test('late dialog controls synchronize and changes stay consistent with the navigation selector', () => {
  const b = browser({ stored: 'dark' }), nav = b.select(); b.ready();
  const dialog = b.select('welcome-theme-select');
  b.window.FilmTheme.sync();
  assert.equal(dialog.value, 'dark');
  dialog.value = 'light'; b.change(dialog);
  assert.equal(nav.value, 'light');
  nav.value = 'classic'; b.change(nav);
  assert.equal(dialog.value, 'classic');
  assert.equal(b.data.get(KEY), 'classic');
});

test('unrelated controls and invalid option values cannot change the theme or save data', () => {
  const b = browser({ stored: 'dark' }), nav = b.select(), unrelated = b.select('difficulty', false); b.ready();
  const before = [...b.data];
  unrelated.value = 'light'; b.change(unrelated);
  b.change({ tagName: 'INPUT', value: 'light', matches: () => true });
  nav.value = 'invalid'; b.change(nav);
  assert.equal(b.document.documentElement.dataset.theme, 'dark');
  assert.equal(nav.value, 'dark');
  assert.deepEqual([...b.data], before);
});

test('cross-tab updates synchronize controls without writing back or responding to game saves', () => {
  const b = browser(), nav = b.select(); b.ready();
  const dialog = b.select('welcome-theme-select'); b.window.FilmTheme.sync();
  b.storageEvent({ key: KEY, newValue: 'dark' });
  assert.equal(nav.value, 'dark'); assert.equal(dialog.value, 'dark');
  assert.equal(b.meta.content, COLORS.dark);
  b.storageEvent({ key: 'kobi-lives-in-film-v1', newValue: 'light' });
  b.storageEvent({ key: KEY, newValue: 'light', storageArea: {} });
  assert.equal(nav.value, 'dark');
  assert.ok(!b.calls.some(call => call[0] === 'set'), 'storage events never create a feedback loop');
  b.storageEvent({ key: KEY, newValue: 'unknown' });
  assert.equal(nav.value, 'classic');
  b.storageEvent({ key: KEY, newValue: 'light' });
  b.storageEvent({ key: KEY, newValue: null });
  assert.equal(nav.value, 'classic', 'removing the preference restores the default');
  b.storageEvent({ key: KEY, newValue: 'dark' });
  b.storageEvent({ key: null, newValue: null });
  assert.equal(nav.value, 'classic', 'clearing localStorage restores the default');
});

test('loading after DOM readiness still binds once; absent theme-color metadata is harmless', () => {
  const b = browser({ readyState: 'complete', stored: 'dark', noMeta: true }), select = b.select();
  b.window.FilmTheme.sync(); select.value = 'light'; b.change(select);
  assert.equal(b.document.documentElement.dataset.theme, 'light');
  assert.equal(b.calls.filter(call => call[0] === 'set').length, 1);
  assert.equal(b.documentEvents.has('DOMContentLoaded'), false);
});

test('HTML provides labeled native options and applies the controller before every stylesheet', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const script = html.match(/<script\b[^>]*src="theme\.js(?:\?v=[^" ]+)?"[^>]*><\/script>/);
  assert.ok(script, 'theme controller is loaded');
  assert.ok(!/\b(?:defer|async)\b|\btype\s*=/.test(script[0]), 'controller is a blocking classic script');
  const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
  assert.ok(styles.length > 0 && styles.every(style => script.index < style.index));
  assert.match(styles.at(-1)[0], /href="themes\.css(?:\?v=[^" ]+)?"/);
  assert.match(html, /<label\b[^>]*for="theme-select"[^>]*>[^<]+<\/label>/);
  const select = html.match(/<select\b[^>]*id="theme-select"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, 'native keyboard-operable select exists');
  assert.ok(!/\b(?:role|tabindex|disabled)=/.test(select[0]), 'native semantics and focus order are retained');
  const options = [...select[1].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(options, [['classic', 'קלאסי'], ['light', 'בהיר'], ['dark', 'כהה']]);
  assert.match(html, /class="theme-control"/);
});

test('static build and test runner explicitly include the theme runtime and regression suite', () => {
  const build = fs.readFileSync(path.join(__dirname, 'scripts/build-site.py'), 'utf8');
  const runner = fs.readFileSync(path.join(__dirname, 'scripts/test-all.py'), 'utf8');
  for (const filename of ['theme.js', 'themes.css']) assert.ok(build.includes("'" + filename + "'"));
  assert.ok(runner.includes("'theme'"));
});

test('light and dark palettes keep actual interface text pairs at least 4.5:1', () => {
  const css = fs.readFileSync(path.join(__dirname, 'themes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = body => Object.fromEntries(body.split(';').filter(row => row.includes(':')).map(row => {
    const colon = row.indexOf(':');
    return [row.slice(0, colon).trim(), row.slice(colon + 1).trim()];
  }));
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), values: declarations(match[2]) }));
  const scopedRule = suffix => {
    const rule = rules.findLast(rule => rule.selector.startsWith('html:is(') && rule.selector.endsWith(suffix));
    assert.ok(rule, 'missing themed text/background rule: ' + suffix);
    return rule.values;
  };
  const color = (value, palette) => {
    assert.equal(typeof value, 'string', 'a tested text/background declaration is missing');
    const variable = value.match(/^var\((--ui-[a-z-]+)(?:,\s*[^)]+)?\)$/);
    if (variable) {
      assert.ok(Object.hasOwn(palette, variable[1]), 'undefined palette token: ' + variable[1]);
      value = palette[variable[1]];
    }
    assert.match(value, /^#(?:[\da-f]{3}|[\da-f]{6})$/i, 'tested text pairs must resolve to opaque colors');
    return value.length === 4 ? '#' + [...value.slice(1)].map(char => char + char).join('') : value;
  };
  const luminance = hex => {
    const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const linear = rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  // Read the actual action-family token assignments too: changing either a
  // palette value or which family a card uses must preserve readable labels.
  const encounters = fs.readFileSync(path.join(__dirname, 'encounters.css'), 'utf8');
  const families = [...encounters.matchAll(/\.action--([a-z]+)\s*\{([^{}]*)\}/g)].map(match => ({ name: match[1], values: declarations(match[2]) }));
  assert.equal(families.length, 6, 'all six existing action families are covered');
  const failures = [];
  for (const theme of ['light', 'dark']) {
    const palette = rules.find(rule => rule.selector === `:root[data-theme="${theme}"]`)?.values;
    assert.ok(palette, 'missing palette: ' + theme);
    const token = name => `var(--ui-${name})`;
    const check = (label, foreground, background) => {
      const fg = color(foreground, palette), bg = color(background, palette);
      const [low, high] = [luminance(fg), luminance(bg)].sort((a, b) => a - b);
      const ratio = (high + 0.05) / (low + 0.05);
      if (ratio < 4.5) failures.push(`${theme} ${label}: ${fg} on ${bg} = ${ratio.toFixed(3)}:1`);
    };
    for (const surface of ['page', 'surface', 'surface-alt', 'surface-inset', 'surface-hover']) {
      for (const text of ['ink', 'muted']) check(`${text}/${surface}`, token(text), token(surface));
    }
    for (const text of ['muted', 'faint']) check(`${text}/disabled`, token(text), token('surface-disabled'));
    for (const surface of ['primary', 'primary-hover']) check(`button/${surface}`, token('on-primary'), token(surface));
    for (const text of ['on-header', 'header-muted']) check(`${text}/header`, token(text), token('header'));
    for (const family of families) {
      const surface = family.values['--action-tint'];
      check(`${family.name} action label`, family.values['--action-accent'], surface);
      for (const text of ['ink', 'muted']) check(`${family.name} action ${text}`, token(text), surface);
    }
    check('negative outcome', token('negative'), token('negative-surface'));
    const hover = scopedRule(' .site-header .quiet-button:hover');
    check('header hover', hover.color, token('header'));
    for (const suffix of [' .result-medal', ' .icon-button[aria-pressed="true"]', ' .selected .location-label']) {
      const pair = scopedRule(suffix);
      check(suffix.trim(), pair.color, pair.background);
    }
  }
  assert.deepEqual(failures, [], 'text contrast below 4.5:1 (decorative borders and artwork are intentionally excluded)');
});

let passed = 0;
for (const { name, run } of tests) { run(); passed++; console.log('PASS ' + name); }
console.log(`${passed}/${tests.length} theme tests passed.`);
