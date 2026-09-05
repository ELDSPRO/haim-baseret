'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Advice = require('./film-advice.js');
const G = {
  DIFFICULTIES: { normal: { living: 410, interest: 0.04 } },
  getLife: () => ({ city: { livingMultiplier: 1 } }),
  getCareer: () => ({ requirements: [{ label: '32 קשרים', met: false }] }),
  goals: () => [{ id: 'craft', target: 60 }, { id: 'reputation', target: 55 }, { id: 'happiness', target: 68 }]
};
const state = patch => ({ status: 'playing', difficulty: 'normal', cash: 1800, debt: 800, hours: 30, energy: 80, happiness: 65, craft: 40, contacts: 12, reputation: 30, project: null, ...patch });
const action = (id, effects, cost = {}, extra = {}) => ({ id, effects, cost, disabled: false, ...extra });
const rest = action('home.rest', ['+28 אנרגיה', '+4 אושר'], { time: 6 });
const work = action('set.work', ['+800 ₪', '+1 מיומנות'], { time: 8, energy: 19 });
const write = action('home.write', ['+12 איכות', '+4 מיומנות'], { time: 6, energy: 8 });
const test = (name, fn) => { fn(); console.log('✓ ' + name); };

test('Critical energy wins over income and film progress', () => {
  const s = state({ energy: 24, cash: 100, project: { stage: 'script', quality: 40 } });
  assert.equal(Advice.pickAction(s, [write, work, rest], G).id, 'home.rest');
});
test('Cash shortage favors a paid shift, never a loan, overtime or contract', () => {
  const s = state({ cash: 150, project: { stage: 'script', quality: 40 } });
  const excluded = [action('bank.borrow', ['+700 ₪']), action('home.overtime', ['+5 שעות']), action('cafe.network_contract', ['+9,000 ₪'])];
  assert.equal(Advice.pickAction(s, [...excluded, write, work, rest], G).id, 'set.work');
  assert.equal(Advice.pickAction(s, excluded, G), null);
});
test('Disabled, unaffordable and critical-loss actions are never chosen', () => {
  const s = state({ cash: 20, hours: 2, energy: 15 });
  const actions = [rest, { ...rest, disabled: true, cost: {} }, action('cafe.meal', ['+24 אנרגיה'], { time: 1, money: 60 }), action('set.work', ['+800 ₪'], { time: 1, energy: 5 })];
  assert.equal(Advice.pickAction(s, actions, G), null);
});
test('An active script is advanced without starting a different genre', () => {
  const s = state({ project: { stage: 'script', quality: 40 } });
  assert.equal(Advice.pickAction(s, [action('home.start_comedy', ['+2 מיומנות']), rest, write], G).id, 'home.write');
  assert.equal(Advice.pickAction(state(), [action('home.start_short', ['+2 מיומנות']), action('home.start_doc', ['+2 מיומנות'])], G), null);
});
test('A stale stage action is not suggested even if marked enabled', () => {
  assert.equal(Advice.pickAction(state({ project: { stage: 'edit', quality: 40 } }), [write], G), null);
});
test('Matched crew is suggested only before its stage, with enough reserve and no occupied role', () => {
  const s = state({ cash: 2000, project: { stage: 'shoot', quality: 40, crew: [] } });
  const crew = action('set.crew_camera_arbel', ['+9 איכות'], { time: 2, money: 140 }, { crewOffer: true, crewRole: 'camera', fitLabel: 'התמחות מתאימה ל־דרמה קצרה', qualityBonus: 9 });
  const shoot = action('set.shoot_lean', ['+20 איכות'], { time: 12, money: 650, energy: 23 });
  assert.equal(Advice.pickAction(s, [shoot, crew], G).id, crew.id);
  assert.notEqual(Advice.pickAction({ ...s, cash: 1000 }, [shoot, crew], G)?.id, crew.id);
  assert.equal(Advice.pickAction({ ...s, project: { ...s.project, crew: [{ role: 'camera' }] } }, [crew], G), null);
  assert.equal(Advice.pickAction({ ...s, project: { ...s.project, stage: 'edit' } }, [crew], G), null);
});
test('Missing professional contacts take priority over luxury and capped gains', () => {
  const s = state({ craft: 100 });
  const network = action('cafe.network', ['+8 קשרים', '+3 מוניטין'], { time: 4, money: 100 });
  assert.equal(Advice.pickAction(s, [action('gear.buy_camera', ['+8 איכות']), action('school.course', ['+9 מיומנות'], { time: 6, money: 220 }), network], G).id, network.id);
});
test('Only explicit paid network gigs can receive a money recommendation', () => {
  const gig = action('cafe.network_gig_1', ['+700 ₪'], { time: 3 }, { paidGig: true });
  assert.equal(Advice.pickAction(state({ cash: 100 }), [gig], G).id, gig.id);
  assert.equal(Advice.pickAction(state({ cash: 100 }), [{ ...gig, paidGig: false }], G), null);
});
test('An event avoids energy losses when energy is critical', () => {
  const event = { options: [{ effects: { cash: 900, energy: -8 } }, { effects: { energy: 10, happiness: 4 } }, { effects: { cash: 2000 }, disabled: true }] };
  assert.equal(Advice.pickEvent(state({ energy: 15, cash: 80 }), event, G).index, 1);
});
test('Event affordability accounts for film funds, personal costs and time', () => {
  const s = state({ cash: 30, project: { quality: 50, grantBudget: 100, crowdfunding: { balance: 50 } } });
  const event = { options: [{ quality: 8, filmCost: 200, effects: {} }, { quality: 6, filmCost: 180, effects: {} }, { quality: 10, hours: 31, effects: {} }] };
  assert.equal(Advice.pickEvent(s, event, G).index, 1);
  assert.equal(Advice.pickEvent(state({ cash: 10 }), { options: [{ effects: { cash: -20 } }] }, G), null);
});
test('Low happiness rules out a harmful event even if it offers money', () => {
  const event = { options: [{ effects: { cash: 1000, happiness: -3 } }, { effects: { happiness: 8 } }] };
  assert.equal(Advice.pickEvent(state({ happiness: 10, cash: 80 }), event, G).index, 1);
});
test('Inputs are unchanged and hidden RNG/outcomes are never inspected', () => {
  const s = state({ project: { stage: 'script', quality: 40, grantBudget: 100, crowdfunding: { balance: 30 } } });
  const actions = [write, rest, work];
  const event = { options: [{ quality: 6, filmCost: 120, effects: {} }, { effects: { happiness: 5 } }] };
  const before = JSON.stringify({ s, actions, event });
  for (const object of [s, s.project.crowdfunding, event]) {
    for (const key of ['rng', 'roll', 'futureResult']) Object.defineProperty(object, key, { get() { throw new Error('Hidden state was inspected: ' + key); } });
  }
  const freeze = object => { for (const key of Object.keys(object)) if (object[key] && typeof object[key] === 'object') freeze(object[key]); Object.freeze(object); };
  [s, actions, event].forEach(freeze);
  for (let i = 0; i < 3; i++) { Advice.pickAction(s, actions, G); Advice.pickEvent(s, event, G); }
  assert.equal(JSON.stringify({ s, actions, event }), before);
  const random = Math.random;
  Math.random = () => { throw new Error('Randomness was used'); };
  try { Advice.pickAction(s, actions, G); Advice.pickEvent(s, event, G); } finally { Math.random = random; }
});
test('Ended games and pending story decisions do not receive action advice', () => {
  assert.equal(Advice.pickAction(state({ status: 'retired' }), [rest], G), null);
  assert.equal(Advice.pickAction(state({ event: { options: [] } }), [rest], G), null);
  assert.equal(Advice.pickEvent(state({ productionAlert: {} }), { options: [{ effects: { cash: 100 } }] }, G), null);
});
test('The same module exposes FilmAdvice in a browser without CommonJS', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('./film-advice.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.FilmAdvice.pickAction, 'function');
  assert.equal(typeof sandbox.FilmAdvice.pickEvent, 'function');
});
console.log('14 advice checks passed.');
