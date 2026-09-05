/* Rotating cafe and equipment opportunities. Run: node test-film-locations.js.
 * Accounting boundaries are explicitly isolated from the real-action career
 * and character reachability matrices in the existing four test programs.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Game = require('./game-engine.js');
const Base = require('./test-film-game.js');
const Expansion = require('./test-film-expansion.js');
const copy = value => JSON.parse(JSON.stringify(value));
const tests = [];
const test = (name, run) => tests.push({ name, run });
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'tests/fixtures', name), 'utf8'));

function boundary(seed) {
  // The archive was earned by actual play. Fresh liquidity/time isolate offer
  // accounting; they are not used to claim that the career is reachable.
  const raw = fixture('v3-career-browser.json');
  // Sweeping this original, saved player RNG samples deterministic migration
  // seeds for board rule tests; no resulting offer or reward is manufactured.
  if (seed != null) raw.rng = Math.imul(seed, 2654435761) >>> 0;
  const state = Game.validateSave(raw);
  assert.ok(state);
  assert.equal(Game.getCareer(state).tier, 4);
  state.cash = 30000; state.hours = 32; state.energy = 80; state.happiness = 45;
  state.location = 'home';
  for (const id of Object.keys(state.used)) state.used[id] = 0;
  return state;
}

function checkSave(state) {
  assert.deepEqual(Game.validateSave(copy(state)), state, 'the complete offer state round trips exactly');
}

const offers = (state, location) => Game.getActions(state, location).filter(action => action.weeklyOffer);
function findBoard(location, condition, prepare = () => {}) {
  for (let seed = 1; seed <= 160; seed++) {
    const state = boundary(seed);
    prepare(state);
    if (condition(offers(state, location), state)) return state;
  }
  assert.fail(`No ${location} board matched the specified deterministic boundary`);
}
const PROJECT_PHASES = { table_read: 'shoot', rough_cut: 'release', last_battery: 'edit', color_slot: 'release' };
function prepareOffer(state, id) {
  const phase = PROJECT_PHASES[id];
  if (phase) {
    state.project.stage = phase; state.project.quality = 40;
    if (phase === 'shoot') state.project.twist = null;
  }
}
function findCard(location, id) {
  const state = findBoard(location, cards => cards.some(card => card.id === `${location}.offer_${id}`), trial => prepareOffer(trial, id));
  return { state, card: offers(state, location).find(card => card.id === `${location}.offer_${id}`) };
}

test('each location has a saved weekly board and reading it cannot spend resources or reroll offers', () => {
  const state = Game.createGame({ difficulty: 'normal', characterId: 'amir', seed: 43 });
  const twin = Game.createGame({ difficulty: 'normal', characterId: 'amir', seed: 43 });
  assert.deepEqual(state.locationBoards, twin.locationBoards);
  const before = copy(state);
  assert.equal(state.locationBoards.week, state.week);
  assert.ok(Number.isInteger(state.locationBoards.rng));
  for (const location of ['cafe', 'gear']) {
    const board = Game.getLocationBoard(state, location);
    assert.equal(board.week, state.week);
    assert.equal(board.offerEndsWeek, state.week);
    assert.equal(board.limit, 2);
    assert.equal(board.remaining, 2);
    const cards = offers(state, location);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map(card => card.id)).size, 3);
    assert.deepEqual(state.locationBoards[location].usedIds, []);
    for (const card of cards) {
      assert.ok(card.id.startsWith(location + '.offer_'));
      assert.equal(card.offerEndsWeek, state.week);
      assert.equal(card.weeklyOffer, true);
      assert.ok(card.title && card.description && Array.isArray(card.effects));
      for (const resource of ['money', 'time', 'energy']) assert.ok(Number.isFinite(card.cost[resource]) && card.cost[resource] >= 0);
    }
    for (let view = 0; view < 30; view++) {
      assert.deepEqual(Game.getLocationBoard(state, location), board);
      assert.deepEqual(offers(state, location), cards);
      Base.actions(state);
    }
  }
  assert.deepEqual(state, before);
  checkSave(state);
});

test('authentic older saves gain stable boards without resetting resources, projects, funding or victory', () => {
  for (const name of ['film-v1-save.json', 'film-v2-active-save.json', 'film-v2-won-save.json', 'v3-career-browser.json']) {
    const raw = fixture(name);
    assert.equal(raw.locationBoards, undefined, 'the fixture predates rotating location offers');
    const original = copy(raw);
    const state = Game.validateSave(raw);
    assert.ok(state, name);
    assert.deepEqual(raw, original, 'migration does not modify the supplied save');
    assert.ok(state.locationBoards);
    assert.equal(state.locationBoards.week, state.week);
    for (const key of ['name', 'cash', 'debt', 'hours', 'energy', 'week', 'status', 'rng']) assert.deepEqual(state[key], key==='hours'?raw.hours+18:raw[key], `${name}: ${key} persists`);
    if (raw.funding) assert.deepEqual(state.funding, raw.funding);
    for (const [key, value] of Object.entries(raw.project || {})) assert.deepEqual(state.project[key], value, `${name}: project.${key} persists`);
    assert.deepEqual(Game.validateSave(copy(original)), state, 'initializing an old board is deterministic');
    checkSave(state);
  }
});

test('malformed present boards are rejected rather than silently refreshing rewards', () => {
  const state = Game.createGame({ seed: 43 });
  const cases = [];
  const broken = edit => { const trial = copy(state); edit(trial.locationBoards); cases.push(trial); };
  cases.push({ ...copy(state), locationBoards: null });
  broken(board => { delete board.rng; });
  broken(board => { board.rng = -1; });
  broken(board => { board.week++; });
  broken(board => { board.cafe.offerIds[0] = 'unknown'; });
  broken(board => { board.gear.offerIds[1] = board.gear.offerIds[0]; });
  broken(board => { board.cafe.usedIds = ['unknown']; });
  broken(board => { board.gear.usedIds = [board.gear.offerIds[0], board.gear.offerIds[0]]; });
  broken(board => { board.cafe.usedIds = board.cafe.offerIds.slice(); });
  for (const invalid of cases) assert.equal(Game.validateSave(invalid), null, 'an invalid board must not create a new opportunity');
});

test('real week advances rotate opportunities deterministically and preserve independent player randomness', () => {
  const state = Game.createGame({ difficulty: 'calm', seed: 43 });
  const twin = copy(state);
  // A title draw changes only player RNG. Clearing that project here is an
  // explicit pool-selection boundary, so both weekly pools have equal inputs.
  Base.perform(twin, 'home.start_doc');
  twin.project = null; twin.nextProjectId = 1;
  assert.notEqual(state.rng, twin.rng);
  assert.deepEqual(state.locationBoards, twin.locationBoards, 'starting a film cannot silently refresh the board');
  for (let week = 0; week < 4; week++) {
    const old = copy(state.locationBoards);
    const restored = Game.validateSave(copy(state));
    assert.ok(restored);
    for (const trial of [state, twin, restored]) assert.equal(Game.endWeek(trial).ok, true);
    assert.deepEqual(restored, state, 'saved board RNG gives the same actual next-week rotation');
    assert.deepEqual(state.locationBoards, twin.locationBoards, 'different player randomness does not control the weekly catalog');
    assert.equal(state.locationBoards.week, state.week);
    for (const location of ['cafe', 'gear']) {
      assert.ok(state.locationBoards[location].offerIds.some(id => !old[location].offerIds.includes(id)), `${location} offers at least one new card when its eligible pool permits`);
      assert.deepEqual(state.locationBoards[location].usedIds, []);
    }
    Base.settleEvent(state); Base.settleEvent(twin);
    checkSave(state);
  }
});

test('each offer pays once and each location allows only two offers before a real week advance', () => {
  for (const location of ['cafe', 'gear']) {
    const state = findBoard(location, cards => cards.every(card => !card.disabled), trial => { trial.assets = []; });
    const ids = offers(state, location).map(card => card.id);
    for (const id of ids.slice(0, 2)) {
      Base.perform(state, id);
      assert.equal(offers(state, location).find(card => card.id === id).offerUsed, true);
      Base.deny(state, () => Game.act(state, id), 'the same weekly card cannot be consumed twice');
      checkSave(state);
      const loaded = Game.validateSave(copy(state));
      Base.deny(loaded, () => Game.act(loaded, id), 'reloading cannot reopen a consumed card');
    }
    assert.equal(state.locationBoards[location].usedIds.length, 2);
    assert.equal(Game.getLocationBoard(state, location).remaining, 0);
    Base.deny(state, () => Game.act(state, ids[2]), 'the third card exceeds the local weekly limit');
    const loaded = Game.validateSave(copy(state));
    Base.deny(loaded, () => Game.act(loaded, ids[2]), 'reload cannot reset the location limit');
    assert.equal(Game.endWeek(state).ok, true);
    Base.settleEvent(state);
    assert.equal(state.locationBoards[location].usedIds.length, 0);
    assert.equal(Game.getLocationBoard(state, location).remaining, 2);
    checkSave(state);
  }
});

test('continuing a won season within its current week does not generate a new weekly board', () => {
  const state = Game.validateSave(fixture('film-v2-won-save.json'));
  const week = state.week;
  const board = copy(state.locationBoards);
  assert.equal(Game.continueCareer(state).ok, true);
  assert.equal(state.week, week, 'the authentic V2 win occurred during an action');
  assert.deepEqual(state.locationBoards, board, 'a season transition is not a second week of rewards');
  checkSave(state);
});

test('all twenty non-purchase offers charge their displayed resources and deliver only their shown benefits', () => {
  const catalog = {
    cafe: ['table_read', 'editor_coffee', 'producer_cancelled', 'alumni_table', 'open_mic', 'last_minute_clip', 'rough_cut', 'old_client', 'roof_escape', 'festival_guest', 'talk_followup', 'film_quiz'],
    gear: ['sound_workshop', 'light_demo', 'gear_shift', 'crew_cleanup', 'last_battery', 'color_slot', 'manufacturer_demo', 'sponsor_demo']
  };
  const labels = { 'אנרגיה': 'energy', 'אושר': 'happiness', 'מיומנות': 'craft', 'מוניטין': 'reputation', 'קשרים': 'contacts' };
  for (const [location, ids] of Object.entries(catalog)) for (const id of ids) {
    const { state } = findCard(location, id);
    state.assets = state.assets.filter(asset => asset !== 'bike');
    const card = offers(state, location).find(card => card.id.endsWith('offer_' + id));
    assert.equal(card.disabled, false, id);
    assert.equal(card.commute, 1);
    const before = copy(state);
    const expectedStats = {};
    let income = 0, quality = 0;
    for (const effect of card.effects) {
      let match = effect.match(/^([+\-−]?\d+) (אנרגיה|אושר|מיומנות|מוניטין|קשרים)$/);
      if (match) expectedStats[labels[match[2]]] = Number(match[1].replace('−', '-'));
      match = effect.match(/^\+([\d,]+) ₪$/);
      if (match) income += Number(match[1].replaceAll(',', ''));
      match = effect.match(/^\+(\d+) איכות לסרט$/);
      if (match) quality = Number(match[1]);
    }
    Base.perform(state, card.id);
    assert.equal(state.cash, before.cash - card.cost.money + income, id + ': actual personal cash');
    assert.equal(state.hours, before.hours - card.cost.time, id + ': travel-inclusive time');
    assert.equal(state.weeklyTotals.income, before.weeklyTotals.income + income);
    assert.equal(state.weeklyTotals.expenses, before.weeklyTotals.expenses + card.cost.money);
    for (const stat of Object.values(labels)) {
      const baseline = before[stat] - (stat === 'energy' ? card.cost.energy : 0);
      assert.equal(state[stat], Math.max(0, Math.min(100, baseline + (expectedStats[stat] || 0))), id + ': shown ' + stat);
    }
    assert.equal(state.project.quality, Math.min(100, before.project.quality + quality));
    assert.equal(state.project.budget, before.project.budget + (quality ? card.cost.money + card.fundingUsed : 0));
    assert.equal(state.project.stage, before.project.stage, 'a quality consultation is not another production transition');
    assert.equal(state.productionAlert, null);
    assert.equal(state.rng, before.rng, 'a fixed offer never triggers a hidden random reward');
    assert.equal(state.locationBoards.rng, before.locationBoards.rng);
    checkSave(state);
  }
});

test('all four discounted assets retain their benefits and neither purchase route permits a duplicate', () => {
  const prices = { bike: 525, desk: 450, laptop: 1200, camera: 1500 };
  for (const [asset, price] of Object.entries(prices)) {
    let source;
    for (let seed = 1; seed <= 100 && !source; seed++) {
      const state = Game.createGame({ difficulty: 'calm', seed });
      state.cash = 30000; state.hours = 32;
      if (offers(state, 'gear').some(card => card.id === `gear.offer_${asset}_bargain`)) source = state;
    }
    assert.ok(source, asset + ': an actual generated bargain');
    const discounted = copy(source), ordinary = copy(source);
    const id = `gear.offer_${asset}_bargain`;
    const card = offers(discounted, 'gear').find(card => card.id === id);
    assert.equal(card.cost.money, price);
    assert.ok(price < Game.ASSETS[asset].price);
    Base.perform(discounted, id);
    Base.perform(ordinary, `gear.buy_${asset}`);
    assert.equal(discounted.cash, source.cash - price);
    assert.equal(discounted.assets.filter(item => item === asset).length, 1);
    assert.equal(Game.netWorth(discounted), Game.netWorth(source) - price, 'discounted gear cannot create cash or property equity');
    for (const state of [discounted, ordinary]) {
      Base.deny(state, () => Game.act(state, id), 'bargain duplicate after either purchase route');
      Base.deny(state, () => Game.act(state, `gear.buy_${asset}`), 'normal duplicate after either purchase route');
      checkSave(state);
    }
    const benefitIds = { bike: ['cafe.network'], desk: ['studio.practice'], laptop: ['studio.edit', 'studio.edit_polish'], camera: ['set.shoot_lean', 'set.shoot_full'] }[asset];
    for (const benefitId of benefitIds) {
      const a = Base.actions(discounted).find(action => action.id === benefitId);
      const b = Base.actions(ordinary).find(action => action.id === benefitId);
      assert.deepEqual(a.cost, b.cost, 'the discounted item provides the same permanent resource benefit');
      assert.deepEqual(a.effects, b.effects);
    }
  }
});

test('insufficient money, time, energy and pending events deny offers without spending either random stream', () => {
  const { state: source, card } = findCard('cafe', 'editor_coffee');
  for (const [field, amount] of [['cash', card.cost.money - 1], ['hours', card.cost.time - 1], ['energy', card.cost.energy - 1]]) {
    const state = copy(source); state[field] = amount;
    Base.deny(state, () => Game.act(state, card.id), 'insufficient ' + field);
  }
  const pending = Game.validateSave(fixture('film-v1-save.json'));
  for (const location of ['cafe', 'gear']) for (const option of offers(pending, location)) Base.deny(pending, () => Game.act(pending, option.id), 'open weekly event blocks ' + option.id);
  const known = new Set(source.locationBoards.cafe.offerIds);
  const missing = ['editor_coffee', 'alumni_table', 'open_mic', 'old_client', 'roof_escape'].find(id => !known.has(id));
  Base.deny(source, () => Game.act(source, 'cafe.offer_' + missing), 'a catalog item absent from this week cannot be invoked directly');
});

test('weekly pools respect career and project gates while obsolete cards stay visible and blocked', () => {
  const projectIds = new Set(Object.keys(PROJECT_PHASES));
  for (let seed = 1; seed <= 40; seed++) {
    const state = Game.createGame({ seed });
    for (const location of ['cafe', 'gear']) for (const card of offers(state, location)) {
      assert.equal(card.careerTier, 0);
      assert.equal(projectIds.has(card.id.split('offer_')[1]), false, 'no project-only card is dealt without a film');
    }
    const late = boundary(seed);
    for (const location of ['cafe', 'gear']) assert.ok(offers(late, location).filter(card => projectIds.has(card.id.split('offer_')[1])).length <= 1);
  }
  const { state: earlyPhase, card: reading } = findCard('cafe', 'table_read');
  const board = copy(earlyPhase.locationBoards);
  earlyPhase.project.stage = 'edit';
  Base.deny(earlyPhase, () => Game.act(earlyPhase, reading.id), 'a table reading is no longer available after filming');
  assert.deepEqual(earlyPhase.locationBoards, board, 'a stage change cannot refresh a stale card');
  const { state, card } = findCard('cafe', 'rough_cut');
  const originalIds = copy(state.locationBoards);
  Base.perform(state, 'studio.release_commercial');
  assert.equal(state.project, null);
  assert.equal(offers(state, 'cafe').find(option => option.id === card.id).disabled, true);
  Base.deny(state, () => Game.act(state, card.id), 'a completed film cannot receive another project consultation');
  assert.deepEqual(state.locationBoards, originalIds);
  checkSave(state);
  const { state: career, card: sponsor } = findCard('gear', 'sponsor_demo');
  career.films = []; // Explicit gate boundary: remove achievements, not a real playthrough.
  Base.deny(career, () => Game.act(career, sponsor.id), 'high raw skills cannot replace the required released-film career');
});

test('project offers use real restricted support first and charge their full budget without creating a new phase reward', () => {
  const funded = Expansion.findDecision('development', 'approved').state;
  Expansion.freeChoice(funded);
  assert.equal(funded.project.grantBudget, 400);
  let state;
  for (let seed = 1; seed <= 120 && !state; seed++) {
    const raw = copy(funded);
    // An old-board migration/RNG boundary selects a genuine project offer;
    // the support itself was awarded through an actual application/decision.
    delete raw.locationBoards; raw.rng = Math.imul(seed, 2654435761) >>> 0;
    const candidate = Game.validateSave(raw);
    if (offers(candidate, 'cafe').some(card => card.id === 'cafe.offer_table_read')) state = candidate;
  }
  assert.ok(state);
  state.hours = 32; state.energy = 80;
  const card = offers(state, 'cafe').find(card => card.id === 'cafe.offer_table_read');
  const before = copy(state);
  assert.equal(card.cost.money, 0);
  assert.equal(card.fundingUsed, 90);
  Base.perform(state, card.id);
  assert.equal(state.cash, before.cash);
  assert.equal(state.project.grantBudget, before.project.grantBudget - 90);
  assert.equal(state.project.budget, before.project.budget + 90);
  assert.equal(state.project.quality, before.project.quality + 6);
  assert.equal(state.weeklyTotals.income, before.weeklyTotals.income);
  assert.equal(state.weeklyTotals.expenses, before.weeklyTotals.expenses);
  assert.equal(state.project.stage, before.project.stage);
  assert.equal(state.productionAlert, null);
  assert.deepEqual(state.project.setbacks, before.project.setbacks);
  assert.deepEqual(state.project.breakthroughs, before.project.breakthroughs);
  checkSave(state);
});

function runTests() {
  let failures = 0;
  for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failures++; console.error(`✗ ${name}\n  ${error.stack}`); }
  }
  console.log(`\n${tests.length - failures}/${tests.length} location checks passed.`);
  if (failures) process.exitCode = 1;
}
if (require.main === module) runTests();
