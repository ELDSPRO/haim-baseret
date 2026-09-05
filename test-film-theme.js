'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'theme.js'), 'utf8');
const KEY = 'haim-baseret-theme-v1';
const COLORS = { classic: '#dedabd', light: '#f7f3e9', dark: '#192124' };
const LABELS = { classic: 'קלאסי', light: 'בהיר', dark: 'כהה' };
const ORDER = ['classic', 'light', 'dark'];
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
      assert.ok(selector.includes('[data-theme-toggle]'), 'controls use the delegated toggle marker');
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
    button(id = 'theme-toggle', marked = true) {
      const attributes = {};
      const node = {
        id, tagName: 'BUTTON', type: 'button', disabled: false, dataset: {}, innerHTML: '',
        matches: selector => marked && selector.includes('[data-theme-toggle]'),
        closest(selector) { return this.matches(selector) ? this : null; },
        setAttribute(name, value) { attributes[name] = String(value); },
        getAttribute(name) { return attributes[name] ?? null; },
        get title() { return attributes.title || ''; },
        set title(value) { attributes.title = String(value); }
      };
      nodes.push(node); return node;
    },
    child(button, tagName = 'svg') {
      return { tagName, closest(selector) { return button.closest(selector); } };
    },
    ready() { document.readyState = 'interactive'; emit(documentEvents, 'DOMContentLoaded'); },
    click(target) { emit(documentEvents, 'click', { target, preventDefault() {} }); },
    storageEvent(event) { emit(windowEvents, 'storage', { storageArea: storage, ...event }); }
  };
}
function checkButton(button, theme) {
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  assert.equal(button.dataset.theme, theme, 'button metadata reflects the actual current theme');
  for (const attribute of ['title', 'aria-label']) {
    const text = button.getAttribute(attribute);
    assert.ok(text && text.includes(LABELS[theme]), `${attribute} names the current theme`);
    assert.ok(text.includes(LABELS[next]), `${attribute} names the next theme`);
    assert.ok(text.indexOf(LABELS[theme]) < text.indexOf(LABELS[next]), `${attribute} distinguishes current from next`);
  }
  assert.match(button.innerHTML, /<svg\b/, 'button displays an icon');
}

test('stored preferences apply before DOMContentLoaded and synchronize accessible buttons without startup writes', () => {
  for (const [theme, color] of Object.entries(COLORS)) {
    const b = browser({ stored: theme });
    assert.equal(b.document.readyState, 'loading');
    assert.equal(b.document.documentElement.dataset.theme, theme);
    assert.equal(b.meta.content, color);
    assert.deepEqual(b.calls, [['get', KEY]]);
    const button = b.button(); b.ready(); checkButton(button, theme);
  }
});

test('missing or invalid preferences safely use classic without rewriting storage', () => {
  for (const stored of [undefined, '', 'system', 'LIGHT', '__proto__', 'constructor', 'dark;display:none', null]) {
    const b = browser({ stored });
    assert.equal(b.document.documentElement.dataset.theme, 'classic');
    assert.equal(b.meta.content, COLORS.classic);
    assert.ok(!b.calls.some(call => call[0] === 'set'));
    const button = b.button(); b.ready(); checkButton(button, 'classic');
  }
});

test('blocked storage access, reads or writes never prevent the complete live theme cycle', () => {
  for (const options of [{ getterBlocked: true }, { readBlocked: true }, { writeBlocked: true }]) {
    const b = browser(options), button = b.button(); b.ready();
    for (const theme of ['light', 'dark', 'classic']) {
      b.click(button);
      assert.equal(b.document.documentElement.dataset.theme, theme);
      assert.equal(b.meta.content, COLORS[theme]); checkButton(button, theme);
    }
    assert.ok(b.calls.every(call => call[1] === KEY));
  }
});

test('each native click advances one step through full cycles, persists only the preference and survives reload', () => {
  const b = browser(), button = b.button(); b.ready();
  const savedGame = b.data.get('kobi-lives-in-film-v1'), icons = new Map();
  checkButton(button, 'classic'); icons.set('classic', button.innerHTML);
  for (const theme of ['light', 'dark', 'classic', 'light', 'dark', 'classic']) {
    const writes = b.calls.filter(call => call[0] === 'set').length;
    b.click(button);
    assert.equal(b.document.documentElement.dataset.theme, theme);
    assert.equal(b.meta.content, COLORS[theme]); checkButton(button, theme);
    assert.equal(b.data.get(KEY), theme);
    assert.equal(b.calls.filter(call => call[0] === 'set').length, writes + 1, 'one click causes one preference write');
    assert.equal(browser({ stored: b.data.get(KEY) }).document.documentElement.dataset.theme, theme);
    if (icons.has(theme)) assert.equal(button.innerHTML, icons.get(theme), 'returning to a theme restores its icon');
    icons.set(theme, button.innerHTML);
  }
  assert.equal(new Set(icons.values()).size, 3, 'all three theme states have distinct icons');
  assert.equal(b.data.get('kobi-lives-in-film-v1'), savedGame);
  assert.equal(b.data.get('kobi-lives-in-film-sound'), 'true');
  assert.ok(b.calls.every(call => call[1] === KEY));
  assert.deepEqual([...b.documentEvents.keys()].sort(), ['DOMContentLoaded', 'click']);
  assert.ok(!b.documentEvents.has('keydown') && !b.documentEvents.has('change'), 'button keyboard activation uses its native click, without duplicate custom handlers');
});

test('clicking an SVG or nested path reaches its parent toggle through closest exactly once', () => {
  const b = browser(), button = b.button(); b.ready();
  b.click(b.child(button, 'svg')); checkButton(button, 'light');
  b.click(b.child(button, 'path')); checkButton(button, 'dark');
  b.click(button); checkButton(button, 'classic');
  assert.deepEqual(b.calls.filter(call => call[0] === 'set'), [
    ['set', KEY, 'light'], ['set', KEY, 'dark'], ['set', KEY, 'classic']
  ]);
});

test('late welcome buttons synchronize and clicks update both controls without rebinding', () => {
  const b = browser({ stored: 'dark' }), nav = b.button(); b.ready();
  const dialog = b.button('welcome-theme-toggle'); b.window.FilmTheme.sync();
  checkButton(dialog, 'dark'); checkButton(nav, 'dark');
  b.click(dialog); checkButton(dialog, 'classic'); checkButton(nav, 'classic');
  b.click(b.child(nav)); checkButton(dialog, 'light'); checkButton(nav, 'light');
  assert.equal(b.documentEvents.get('click').length, 1, 'dynamic buttons share one delegated listener');
  assert.equal(b.data.get(KEY), 'light');
});

test('unrelated controls and their children cannot change the theme or save data', () => {
  const b = browser({ stored: 'dark' }), nav = b.button(), unrelated = b.button('difficulty', false); b.ready();
  const before = [...b.data];
  b.click(unrelated); b.click(b.child(unrelated));
  b.click({ tagName: 'INPUT', closest: () => null });
  assert.equal(b.document.documentElement.dataset.theme, 'dark'); checkButton(nav, 'dark');
  assert.deepEqual([...b.data], before);
  assert.ok(!b.calls.some(call => call[0] === 'set'));
});

test('disabled toggles and non-element click targets do not advance or persist a theme', () => {
  const b = browser({ stored: 'dark' }), button = b.button(); b.ready();
  const before = [...b.data]; button.disabled = true;
  b.click(button); b.click(b.child(button)); b.click(null); b.click({});
  checkButton(button, 'dark'); assert.deepEqual([...b.data], before);
  assert.ok(!b.calls.some(call => call[0] === 'set'));
  button.disabled = false; b.click(button); checkButton(button, 'classic');
  assert.deepEqual(b.calls.filter(call => call[0] === 'set'), [['set', KEY, 'classic']]);
});

test('cross-tab updates synchronize labels and icons without writing back or responding to game saves', () => {
  const b = browser(), nav = b.button(); b.ready();
  const dialog = b.button('welcome-theme-toggle'); b.window.FilmTheme.sync();
  b.storageEvent({ key: KEY, newValue: 'dark' });
  checkButton(nav, 'dark'); checkButton(dialog, 'dark'); assert.equal(b.meta.content, COLORS.dark);
  b.storageEvent({ key: 'kobi-lives-in-film-v1', newValue: 'light' });
  b.storageEvent({ key: KEY, newValue: 'light', storageArea: {} });
  checkButton(nav, 'dark');
  assert.ok(!b.calls.some(call => call[0] === 'set'), 'storage events never create a feedback loop');
  b.storageEvent({ key: KEY, newValue: 'unknown' }); checkButton(nav, 'classic');
  b.storageEvent({ key: KEY, newValue: 'light' });
  b.storageEvent({ key: KEY, newValue: null }); checkButton(nav, 'classic');
  b.storageEvent({ key: KEY, newValue: 'dark' });
  b.storageEvent({ key: null, newValue: null }); checkButton(nav, 'classic'); checkButton(dialog, 'classic');
  b.storageEvent({ key: KEY, newValue: 'light' });
  b.click(nav); checkButton(nav, 'dark'); checkButton(dialog, 'dark');
  assert.deepEqual(b.calls.filter(call => call[0] === 'set'), [['set', KEY, 'dark']], 'click advances from the theme received from the other tab');
});

test('loading after DOM readiness still binds once; absent theme-color metadata is harmless', () => {
  const b = browser({ readyState: 'complete', stored: 'dark', noMeta: true }), button = b.button();
  b.window.FilmTheme.sync(); b.click(button); checkButton(button, 'classic');
  assert.equal(b.document.documentElement.dataset.theme, 'classic');
  assert.equal(b.calls.filter(call => call[0] === 'set').length, 1);
  assert.equal(b.documentEvents.has('DOMContentLoaded'), false);
});

test('HTML provides native accessible toggle buttons and applies the controller before every stylesheet', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, 'game-ui.js'), 'utf8');
  const script = html.match(/<script\b[^>]*src="theme\.js(?:\?v=[^" ]+)?"[^>]*><\/script>/);
  assert.ok(script, 'theme controller is loaded');
  assert.ok(!/\b(?:defer|async)\b|\btype\s*=/.test(script[0]), 'controller is a blocking classic script');
  const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
  assert.ok(styles.length > 0 && styles.every(style => script.index < style.index));
  assert.match(styles.at(-1)[0], /href="themes\.css(?:\?v=[^" ]+)?"/);
  for (const [text, id] of [[html, 'theme-toggle'], [ui, 'welcome-theme-toggle']]) {
    const button = text.match(new RegExp('<button\\b[^>]*id="' + id + '"[^>]*>[\\s\\S]*?<\\/button>'));
    assert.ok(button, id + ' is a native keyboard-operable button');
    assert.match(button[0], /\btype="button"/, 'theme toggle cannot submit the welcome form');
    assert.match(button[0], /\bdata-theme-toggle\b/);
    assert.match(button[0], /\baria-label="[^"]+"/);
    assert.ok(!/\b(?:role|tabindex|disabled)=/.test(button[0]), 'native button semantics and focus order are retained');
  }
  assert.ok(!/<select\b[^>]*(?:id="(?:welcome-)?theme-select"|data-theme-select)/.test(html + ui), 'obsolete selects are not rendered');
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
