/* Pure guide regressions plus real, resource-preserving onboarding playthroughs. */
'use strict';
const assert = require('node:assert/strict');
const G = require('./game-engine.js');
const T = require('./film-tutorial.js');
const STEPS = ['resources', 'goals', 'home', 'film', 'production', 'work', 'rest', 'people', 'funding', 'festivals', 'rival', 'cut'];
const STATUS = ['idle', 'active', 'skipped', 'complete'];
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const progress = (step = 'resources', status = 'active') => ({ version: 1, status, step });
const fresh = (characterId = 'kobi', difficulty = 'normal') => G.createGame({ characterId, difficulty, seed: `tutorial:${characterId}:${difficulty}` });
const context = (state = fresh(), selected = 'home') => ({ state, selected, actions: location => G.getActions(state, location) });
const tests = [];
const test = (name, run) => tests.push({ name, run });

function read(method, p, c, event) {
  const stateBefore = copy(c.state), progressBefore = copy(p), eventBefore = copy(event), selectedBefore = c.selected;
  const value = method === 'view' ? T.view(p, c) : T.transition(p, event, c);
  assert.deepEqual(c.state, stateBefore, `${method} must not change game state, resources, history or RNG`);
  assert.deepEqual(p, progressBefore, `${method} must not mutate its progress input`);
  assert.deepEqual(event, eventBefore, `${method} must not mutate its event input`);
  assert.equal(c.selected, selectedBefore, `${method} must not navigate on behalf of the player`);
  return value;
}
const view = (p, c) => read('view', p, c);
const move = (p, event, c) => read('transition', p, c, event);
const next = (p, c) => move(p, { type: 'next' }, c);
const withoutTutorial = state => { const value = copy(state); delete value.tutorial; return value; };
function saved(state) {
  const before = copy(state), result = G.validateSave(JSON.stringify(state));
  assert.ok(result, 'the actual engine accepts this complete saved game');
  assert.deepEqual(result, before, 'save/load keeps game state and tutorial metadata exactly');
  assert.deepEqual(state, before, 'validation does not mutate the source game');
  return result;
}

test('twelve ordered steps expose complete, zero-based view metadata without browser globals', () => {
  assert.deepEqual(T.STEPS, STEPS);
  const c = context();
  for (const [index, id] of STEPS.entries()) {
    const hint = view(progress(id), c);
    assert.equal(hint.id, id); assert.equal(hint.index, index); assert.equal(hint.total, 12);
    for (const key of ['title', 'body', 'target', 'nextLabel']) assert.ok(typeof hint[key] === 'string' && hint[key].trim(), `${id}.${key}`);
    assert.equal(typeof hint.actionRequired, 'boolean');
    assert.equal(typeof hint.blocked, 'string');
  }
});

test('normalization rejects malformed progress and strips unrelated fields without mutating input', () => {
  const idle = progress('resources', 'idle');
  const invalid = [undefined, null, false, true, 0, 1, '', 'active', [], ['resources'], {},
    { version: 2, status: 'active', step: 'work' }, { status: 'active', step: 'work' },
    { version: 1, status: 'running', step: 'work' }, { version: 1, status: 'active', step: 'unknown' },
    { version: 1, status: 'active', step: 3 }, { version: 1, status: '__proto__', step: 'work' }];
  for (const raw of invalid) { const before = copy(raw); assert.deepEqual(T.normalize(raw), idle); assert.deepEqual(raw, before); }
  for (const status of STATUS) for (const step of STEPS) {
    const raw = { ...progress(step, status), cash: 999999, extra: { ignored: true } }, before = copy(raw);
    const normalized = T.normalize(raw);
    assert.deepEqual(normalized, progress(step, status)); assert.deepEqual(raw, before);
    assert.deepEqual(T.normalize(JSON.parse(JSON.stringify(normalized))), normalized, 'normalized metadata survives JSON storage');
    normalized.step = 'cut'; assert.deepEqual(raw, before, 'output is independent of input');
  }
});

test('start restarts any status at resources; inactive guides ignore other events', () => {
  const c = context();
  for (const status of STATUS) {
    const p = progress('work', status);
    assert.deepEqual(move(p, { type: 'start' }, c), progress());
    if (status !== 'active') for (const event of [{ type: 'next' }, { type: 'back' }, { type: 'skip' }, { type: 'skip-step' }, { type: 'location', id: 'home' }, { type: 'action', id: 'set.work', ok: true }]) {
      assert.deepEqual(move(p, event, c), p, `inactive ${status} ignores ${event.type}`);
    }
  }
  assert.deepEqual(move(undefined, { type: 'start' }, c), progress());
});

test('next advances informational steps but never bypasses an available required interaction', () => {
  const c = context();
  for (const step of ['resources', 'goals', 'production', 'rival']) {
    assert.equal(view(progress(step), c).actionRequired, false);
    assert.deepEqual(next(progress(step), c), progress(STEPS[STEPS.indexOf(step) + 1]));
  }
  for (const step of ['home', 'film', 'work', 'rest', 'people', 'funding', 'festivals']) {
    const p = progress(step); assert.equal(view(p, c).actionRequired, true, step);
    assert.deepEqual(next(p, c), p, 'next does not execute or bypass ' + step);
  }
});

test('only the expected home location event advances home, even when it was already selected', () => {
  for (const selected of ['home', 'set', 'cafe']) {
    const c = context(fresh(), selected), p = progress('home');
    assert.equal(view(p, c).target, '[data-location="home"]');
    for (const event of [{ type: 'location', id: 'set' }, { type: 'location' }, { type: 'action', id: 'home.rest', ok: true }]) assert.deepEqual(move(p, event, c), p);
    assert.deepEqual(move(p, { type: 'location', id: 'home' }, c), progress('film'));
  }
});

test('film creation advances only after a successful real start action and an existing project', () => {
  const state = fresh(), c = context(state), p = progress('film');
  assert.equal(view(p, c).target, '#start-film-choice');
  assert.deepEqual(move(p, { type: 'action', id: 'home.start_short', ok: true }, c), p, 'a stale success without a project does not advance');
  const result = G.act(state, 'home.start_short'); assert.equal(result.ok, true);
  for (const event of [{ type: 'action', id: 'home.start_short', ok: false }, { type: 'action', id: 'home.start_short' }, { type: 'action', id: 'home.write', ok: true }, { type: 'action', id: 'set.work', ok: true }]) assert.deepEqual(move(p, event, c), p);
  assert.deepEqual(move(p, { type: 'action', id: 'home.start_short', ok: result.ok }, c), progress('production'));
});

test('work and rest highlight the map before navigation, then the real action without auto-advancing', () => {
  for (const [step, location, action] of [['work', 'set', 'set.work'], ['rest', 'home', 'home.rest']]) {
    const c = context(fresh(), 'cafe'), p = progress(step);
    assert.equal(view(p, c).target, `[data-location="${location}"]`);
    assert.equal(view(p, c).actionRequired, true);
    c.selected = location;
    assert.deepEqual(move(p, { type: 'location', id: location }, c), p, 'navigation alone does not complete a work/rest step');
    assert.equal(view(p, c).target, `[data-action="${action}"]`);
    assert.equal(view(p, c).actionRequired, true);
    for (const event of [{ type: 'next' }, { type: 'action', id: action, ok: false }, { type: 'action', id: action }, { type: 'action', id: action, ok: 1 }, { type: 'action', id: action, ok: 'true' }, { type: 'action', id: 'set.shoot_full', ok: true }]) assert.deepEqual(move(p, event, c), p);
    const result = G.act(c.state, action); assert.equal(result.ok, true);
    assert.equal(move(p, { type: 'action', id: action, ok: result.ok }, c).step, STEPS[STEPS.indexOf(step) + 1]);
  }
});

test('cafe, funding and festival visits require no purchase and unlock next only at their location', () => {
  for (const [step, location] of [['people', 'cafe'], ['funding', 'bank'], ['festivals', 'festival']]) {
    const c = context(), p = progress(step), before = copy(c.state);
    assert.equal(view(p, c).actionRequired, true); assert.equal(view(p, c).target, `[data-location="${location}"]`);
    assert.deepEqual(next(p, c), p);
    c.selected = location;
    assert.deepEqual(move(p, { type: 'location', id: location }, c), p);
    assert.equal(view(p, c).actionRequired, false);
    assert.ok(!view(p, c).target.startsWith('[data-location='));
    assert.equal(next(p, c).step, STEPS[STEPS.indexOf(step) + 1]);
    assert.deepEqual(c.state, before, 'visiting for guidance never spends resources');
  }
});

test('unaffordable, exhausted or unavailable actions always allow next without performing them', () => {
  const cases = [
    ['film', s => { s.cash = 0; }], ['film', s => { s.hours = 0; }], ['film', s => { s.energy = 0; }],
    ['work', s => { s.hours = 0; }], ['work', s => { s.energy = 0; }], ['work', s => { s.used.work = 3; }],
    ['rest', s => { s.hours = 0; }]
  ];
  for (const [step, alter] of cases) {
    const s = fresh(); alter(s); const c = context(s, 'cafe'), p = progress(step), before = copy(s);
    const hint = view(p, c); assert.equal(hint.actionRequired, false, step); assert.ok(hint.blocked.trim(), 'blocking reason is explained');
    assert.equal(next(p, c).step, STEPS[STEPS.indexOf(step) + 1]);
    assert.deepEqual(s, before, 'continuing from a blocked action never supplies missing resources');
  }
  for (const step of ['film', 'work', 'rest']) {
    const c = context(); c.actions = () => [];
    assert.equal(view(progress(step), c).actionRequired, false);
    assert.equal(next(progress(step), c).step, STEPS[STEPS.indexOf(step) + 1]);
  }
});

test('an existing project and full energy turn their lessons into read-only explanations', () => {
  const s = fresh(); assert.equal(G.act(s, 'home.start_short').ok, true);
  const c = context(s, 'cafe'), existing = copy(s.project);
  assert.equal(view(progress('film'), c).actionRequired, false);
  assert.equal(next(progress('film'), c).step, 'production'); assert.deepEqual(s.project, existing);
  s.energy = 100; s.hours = 0;
  assert.equal(view(progress('rest'), c).actionRequired, false);
  assert.equal(view(progress('rest'), c).blocked, '', 'full energy is an explanation, not a resource-error trap');
  assert.equal(next(progress('rest'), c).step, 'people');
  assert.equal(s.energy, 100); assert.equal(s.hours, 0);
});

test('ended and retired games remain navigable through every lesson without demanding actions', () => {
  for (const status of ['won', 'lost', 'retired']) for (const step of STEPS) {
    const state = fresh(); state.status = status; const c = context(state, 'cafe'), p = progress(step);
    assert.equal(view(p, c).actionRequired, false, `${status}/${step}`);
    assert.ok(view(p, c).blocked);
    const result = next(p, c);
    assert.equal(result.step, step === 'cut' ? 'cut' : STEPS[STEPS.indexOf(step) + 1]);
    assert.equal(result.status, step === 'cut' ? 'complete' : 'active');
  }
});

test('back is bounded, skip-step always progresses, and skip/complete are stable until restart', () => {
  const c = context(), initial = copy(c.state);
  assert.deepEqual(move(progress(), { type: 'back' }, c), progress());
  for (let i = 1; i < STEPS.length; i++) assert.deepEqual(move(progress(STEPS[i]), { type: 'back' }, c), progress(STEPS[i - 1]));
  let p = progress();
  for (const step of STEPS) { assert.equal(p.step, step); p = move(p, { type: 'skip-step' }, c); }
  assert.deepEqual(p, progress('cut', 'complete'));
  assert.deepEqual(next(progress('cut'), c), progress('cut', 'complete'));
  for (const step of STEPS) {
    const skipped = move(progress(step), { type: 'skip' }, c);
    assert.deepEqual(skipped, progress(step, 'skipped'));
    assert.deepEqual(next(skipped, c), skipped);
  }
  assert.deepEqual(c.state, initial, 'all navigation and skips leave the simulation unchanged');
});

test('tutorial metadata round-trips through real saves, including legacy saves without metadata', () => {
  const original = fresh(); assert.equal(saved(original).tutorial, undefined);
  for (const status of STATUS) for (const step of STEPS) {
    const s = copy(original); s.tutorial = progress(step, status);
    const loaded = saved(s);
    assert.deepEqual(T.normalize(loaded.tutorial), s.tutorial);
    assert.deepEqual(withoutTutorial(loaded), original);
  }
});

test('all lesson reads and transitions remain pure with frozen progress and frozen game state', () => {
  const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const c = context(freeze(fresh()), 'home');
  for (const step of STEPS) {
    const p = freeze(progress(step));
    view(p, c);
    for (const event of [{ type: 'next' }, { type: 'back' }, { type: 'skip-step' }, { type: 'skip' }, { type: 'location', id: 'home' }, { type: 'action', id: 'set.work', ok: false }]) move(p, freeze(event), c);
  }
});

for (const character of G.CHARACTERS) for (const difficulty of Object.keys(G.DIFFICULTIES)) {
  test(`${character.id}/${difficulty}: three actual actions finish the guide without altered game rules`, () => {
    const state = fresh(character.id, difficulty), control = copy(state), c = context(state);
    const completedActions = [];
    let p = move(undefined, { type: 'start' }, c);
    state.tutorial = p;
    const advance = event => {
      p = move(p, event, c); state.tutorial = p;
      assert.deepEqual(withoutTutorial(state), control, 'only explicit game actions change the simulation');
      saved(state);
    };
    const doAction = id => {
      const option = G.getActions(state, id.split('.')[0]).find(action => action.id === id);
      assert.ok(option && !option.disabled, 'actual action is affordable without injected resources: ' + id);
      const actual = G.act(state, id), expected = G.act(control, id);
      assert.equal(actual.ok, true); assert.deepEqual(actual, expected);
      assert.deepEqual(withoutTutorial(state), control, 'guided action has the same cost, result and RNG as ordinary play');
      completedActions.push(id);
      advance({ type: 'action', id, ok: actual.ok });
    };
    for (const step of STEPS) {
      assert.equal(p.status, 'active'); assert.equal(p.step, step);
      switch (step) {
        case 'home': c.selected = 'home'; advance({ type: 'location', id: 'home' }); break;
        case 'film': doAction('home.start_short'); break;
        case 'work':
          assert.equal(view(p, c).target, '[data-location="set"]');
          c.selected = 'set'; advance({ type: 'location', id: 'set' }); assert.equal(p.step, 'work');
          assert.equal(view(p, c).target, '[data-action="set.work"]'); doAction('set.work'); break;
        case 'rest':
          assert.equal(view(p, c).target, '[data-location="home"]');
          c.selected = 'home'; advance({ type: 'location', id: 'home' }); assert.equal(p.step, 'rest');
          assert.equal(view(p, c).target, '[data-action="home.rest"]'); doAction('home.rest'); break;
        case 'people': case 'funding': case 'festivals': {
          const id = { people: 'cafe', funding: 'bank', festivals: 'festival' }[step];
          c.selected = id; advance({ type: 'location', id }); assert.equal(p.step, step);
          assert.equal(view(p, c).actionRequired, false); advance({ type: 'next' }); break;
        }
        default: assert.equal(view(p, c).actionRequired, false); advance({ type: 'next' });
      }
    }
    assert.deepEqual(completedActions, ['home.start_short', 'set.work', 'home.rest']);
    assert.deepEqual(p, progress('cut', 'complete'));
    assert.equal(state.week, 1, 'the cut lesson never advances the period automatically');
    assert.equal(state.project.stage, 'script'); assert.equal(state.films.length, 0);
    assert.equal(state.project.workload.shootDone, 0); assert.equal(state.project.workload.editDone, 0);
    assert.equal(state.status, 'playing');
  });
}

let passed = 0;
const failed = [];
for (const { name, run } of tests) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed.push(name); console.error('FAIL ' + name + '\n' + error.stack); }
}
console.log(`${passed}/${tests.length} tutorial tests passed.`);
if (failed.length) process.exitCode = 1;
