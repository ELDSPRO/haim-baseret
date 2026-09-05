/* Unexpected production expense and income regressions. Run: node test-film-setbacks.js.
 * Explicit liquidity/RNG boundary fixtures isolate the accounting rules; full
 * unmodified-resource playthroughs remain in the other three test programs.
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
const RISKS = { short: [20, 40, 120], doc: [20, 40, 120], comedy: [25, 100, 260], feature: [28, 300, 900], blockbuster: [30, 700, 1800] };
const REWARDS = { short: [15, 80, 200], doc: [15, 80, 200], comedy: [16, 150, 400], feature: [16, 400, 1200], blockbuster: [18, 900, 2400] };

function finishNotices(state) {
  Base.acknowledgeSetback(state);
  if (state.event) {
    const index = state.event.kind === 'production' ? 2 : state.event.options.findIndex(option => !option.disabled);
    assert.equal(Game.chooseEvent(state, index).ok, true);
  }
}
function scene(type, seed = 1) {
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'tests/fixtures/v3-career-browser.json'), 'utf8'));
  const state = Game.validateSave(old);
  assert.ok(state, 'the actual V3 career fixture migrates to cost-report support');
  // Controlled production boundary: retain the genuinely earned career films,
  // but isolate a fresh production with ample time and money for each rule test.
  state.project = null; state.productionAlert = null; state.event = null;
  state.nextProjectId = state.films.length + 1;
  state.cash = 50000; state.energy = 100; state.hours = 32; state.happiness = 50;
  state.rng = Math.imul(seed, 2654435761) >>> 0;
  Base.perform(state, 'home.start_' + type);
  return state;
}
function rawStage(state, id) {
  // Time/energy remain explicit boundary inputs. Execute all actual production
  // days, then return the final day's snapshot for exact invoice/replay checks.
  const stage = state.project.stage;
  let days = 0, trial;
  do {
    assert.ok(days++ < 30, 'the real workload has a finite number of days');
    state.hours = state.maxHours; state.energy = 100;
    const before = copy(state);
    const preview = Base.actions(state).find(action => action.id === id);
    assert.equal(preview.disabled, false, id);
    const result = Game.act(state, id);
    assert.equal(result.ok, true);
    trial = { state, before, preview, result, report: result.setback };
    if (state.project.stage === stage) {
      assert.equal(result.setback, null, 'partial progress cannot trigger another stage invoice');
      assert.equal(result.breakthrough, null, 'partial progress cannot farm surprise income');
      assert.equal(state.event, null, 'the creative dilemma waits for the completed shoot');
      assert.ok(Game.validateSave(copy(state)), 'partial workload progress remains saveable');
    }
  } while (state.project.stage === stage);
  return trial;
}

function findTrigger(type, stage = 'shoot') {
  for (let seed = 1; seed <= 100; seed++) {
    const state = scene(type, seed);
    if (stage !== 'script') { rawStage(state, 'home.write'); finishNotices(state); }
    if (stage === 'edit') { rawStage(state, 'set.shoot_full'); finishNotices(state); }
    const trial = rawStage(state, { script: 'home.write', shoot: 'set.shoot_full', edit: 'studio.edit_polish' }[stage]);
    if (trial.report) return trial;
  }
  assert.fail(`No seeded ${type}/${stage} setback observed`);
}
function findBreakthrough(type, stage = 'shoot', minimum = 0) {
  for (let seed = 1; seed <= 200; seed++) {
    const state = scene(type, seed);
    if (stage !== 'script') { rawStage(state, 'home.write'); finishNotices(state); }
    if (stage === 'edit') { rawStage(state, 'set.shoot_full'); finishNotices(state); }
    const trial = rawStage(state, { script: 'home.write', shoot: 'set.shoot_full', edit: 'studio.edit_polish' }[stage]);
    if (trial.result.breakthrough?.amount >= minimum) return trial;
  }
  assert.fail(`No seeded ${type}/${stage} breakthrough observed`);
}

test('production risk grows with film scale and every charged stage stays in its advertised range', () => {
  for (const [type, [chance, minAmount, maxAmount]] of Object.entries(RISKS)) {
    const state = scene(type);
    const before = copy(state);
    const risk = Game.getProductionRisk(state);
    assert.equal(risk.chance, chance);
    assert.equal(risk.minAmount, minAmount);
    assert.equal(risk.maxAmount, maxAmount);
    assert.equal(risk.maxSetbacks, 2);
    assert.equal(risk.remainingSetbacks, 2);
    assert.deepEqual(state, before, 'inspecting risk never rerolls the next charge');
    for (const stage of ['script', 'shoot', 'edit']) {
      const { state: charged, before: old, preview, report } = findTrigger(type, stage);
      assert.equal(report.stage, stage, 'the notice identifies the phase that generated the invoice');
      assert.ok(report.amount >= minAmount && report.amount <= maxAmount);
      assert.equal(report.projectId, charged.project.id);
      assert.equal(report.amount, report.grantUsed + report.cashPaid + report.debtAdded);
      assert.equal(charged.cash, old.cash - preview.cost.money - report.cashPaid);
      assert.equal(charged.debt, old.debt + report.debtAdded);
      assert.equal(charged.project.grantBudget, old.project.grantBudget - preview.fundingUsed - report.grantUsed);
      assert.equal(charged.project.budget, old.project.budget + preview.cost.money + preview.fundingUsed + report.amount);
      assert.equal(charged.weeklyTotals.expenses, old.weeklyTotals.expenses + preview.cost.money + report.cashPaid + report.debtAdded);
      assert.deepEqual(charged.productionAlert, report);
      assert.deepEqual(charged.project.setbacks.at(-1), report);
      assert.ok(Game.validateSave(copy(charged)), 'pending stage report is a complete saveable state');
    }
  }
});

test('an expense notice persists, blocks bypasses and acknowledgment cannot charge or reroll again', () => {
  const { state, before, report } = findTrigger('feature', 'shoot');
  assert.equal(state.event.kind, 'production', 'the cost notice and creative dilemma can coexist');
  const loaded = Game.validateSave(copy(state));
  assert.ok(loaded, 'the pending expense plus creative dilemma is accepted by save validation');
  assert.deepEqual(loaded, state);
  Base.deny(state, () => Game.act(state, 'studio.edit'), 'ordinary action before cost acknowledgment');
  Base.deny(state, () => Game.endWeek(state), 'week advance before cost acknowledgment');
  Base.deny(state, () => Game.chooseEvent(state, 2), 'creative choice before cost acknowledgment');
  const ledger = copy(state);
  assert.equal(Game.acknowledgeSetback(state).ok, true);
  assert.equal(Game.acknowledgeSetback(loaded).ok, true);
  assert.deepEqual(loaded, state, 'reloading preserves acknowledgment and the remaining dilemma');
  for (const key of ['cash', 'debt', 'rng', 'hours', 'energy', 'project', 'event', 'weeklyTotals']) assert.deepEqual(state[key], ledger[key], `acknowledgment leaves ${key} unchanged`);
  Base.deny(state, () => Game.acknowledgeSetback(state), 'double acknowledgment');
  assert.equal(Game.chooseEvent(state, 2).ok, true);
  assert.ok(state.project.twist);
  assert.equal(state.project.setbacks.at(-1).amount, report.amount);
  const repeated = copy(before);
  const reproduced = Game.act(repeated, 'set.shoot_full');
  assert.deepEqual(reproduced.setback, report, 'same saved pre-stage RNG yields the same invoice, not a fresh amount');
});

test('restricted grant pays first, then available cash, and only the unpaid remainder becomes debt', () => {
  const funded = Expansion.findDecision('production', 'approved').state;
  Expansion.freeChoice(funded);
  assert.equal(funded.project.grantBudget, 900);
  // A full documentary shoot costs 880, leaving 20 of the genuine grant.
  // Controlled liquidity makes a later invoice use all three payment sources.
  let found;
  for (let sample = 1; sample <= 100 && !found; sample++) {
    const state = copy(funded);
    state.cash = 25; state.hours = 32; state.energy = 100;
    state.rng = Math.imul(sample, 2654435761) >>> 0;
    const trial = rawStage(state, 'set.shoot_full');
    if (trial.report && trial.report.amount > 45) found = trial;
  }
  assert.ok(found, 'a seeded genuine invoice exercises grant, cash and debt');
  const { state, before, report } = found;
  assert.equal(report.grantUsed, 20);
  assert.equal(report.cashPaid, 25);
  assert.equal(report.debtAdded, report.amount - 45);
  assert.equal(state.cash, 0, 'cash never becomes negative');
  assert.equal(state.project.grantBudget, 0);
  assert.equal(state.debt, before.debt + report.debtAdded);
  assert.equal(state.funding.history[0].projectId, report.projectId, 'only the active film uses its own approved support');
  assert.equal(state.event.options[0].disabled, true, 'creative paid-rescue availability uses the post-invoice cash and grant');
  assert.ok(state.event.options[0].description.includes('180'), 'the refreshed rescue description shows the full unfunded price');
  assert.deepEqual(Game.validateSave(copy(state)), state, 'partial funding and a refreshed creative dilemma reload exactly');
  finishNotices(state);
  assert.ok(state.project.twist);
});

test('at most two invoices survive acknowledgment and the third stage cannot add a hidden charge', () => {
  let capped = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const state = scene('short', seed);
    for (const id of ['home.write', 'set.shoot_full', 'studio.edit_polish']) {
      const previousCount = state.project.setbacks.length;
      const { report } = rawStage(state, id);
      if (previousCount === 2) {
        assert.equal(report, null);
      }
      assert.ok(state.project.setbacks.length <= 2);
      finishNotices(state);
    }
    if (state.project.setbacks.length === 2) {
      capped++;
      assert.equal(Game.getProductionRisk(state).chance, 0);
      assert.equal(Game.getProductionRisk(state).remainingSetbacks, 0);
    }
    assert.equal(new Set(state.project.setbacks.map(report => report.stage)).size, state.project.setbacks.length);
    assert.ok(state.project.setbacks.reduce((sum, report) => sum + report.amount, 0) <= 240, 'small films cannot receive blockbuster-sized aggregate surprises');
    assert.ok(Game.validateSave(copy(state)));
  }
  assert.ok(capped > 0, 'the two-setback limit is actually reached in the sample');
});

test('a large unfunded surprise can cause insolvency and corrupted cost ledgers are rejected', () => {
  const source = findTrigger('blockbuster', 'shoot');
  const state = copy(source.before);
  state.cash = source.preview.cost.money;
  state.debt = 6490; // Explicit near-bankruptcy boundary, not a reachability run.
  const result = Game.act(state, 'set.shoot_full');
  assert.ok(result.setback);
  assert.equal(state.cash, 0);
  assert.ok(state.debt > 6500);
  finishNotices(state);
  assert.equal(Game.endWeek(state).ok, true);
  assert.equal(state.status, 'lost', 'unpaid production invoices participate in the real bankruptcy rule');

  const original = source.state;
  const wrongAmount = copy(original);
  wrongAmount.project.setbacks.at(-1).amount++;
  wrongAmount.productionAlert.amount++;
  const wrongProject = copy(original);
  wrongProject.productionAlert.projectId++;
  const duplicate = copy(original);
  duplicate.project.setbacks.push(copy(duplicate.project.setbacks.at(-1)));
  for (const bad of [wrongAmount, wrongProject, duplicate]) assert.equal(Game.validateSave(bad), null, 'inconsistent invoice history does not load');
});

test('good surprises scale with production and credit actual cash income once without reducing the film budget', () => {
  for (const [type, [chance, minimum, maximum]] of Object.entries(REWARDS)) {
    const risk = Game.getProductionRisk(scene(type));
    assert.equal(risk.positiveChance, chance);
    assert.equal(risk.minReward, minimum);
    assert.equal(risk.maxReward, maximum);
    assert.equal(risk.maxBreakthroughs, 1);
    for (const stage of ['script', 'shoot', 'edit']) {
      const { state, before, preview, result } = findBreakthrough(type, stage);
      const report = result.breakthrough;
      assert.equal(report.kind, 'breakthrough');
      assert.equal(report.stage, stage);
      assert.equal(report.projectId, state.project.id);
      assert.ok(report.amount >= minimum && report.amount <= maximum);
      assert.equal(report.amount, report.rewardCash);
      assert.equal(result.setback, null, 'a positive and negative surprise cannot share one transition');
      assert.equal(state.cash, before.cash - preview.cost.money + report.amount);
      assert.equal(state.debt, before.debt);
      assert.equal(state.weeklyTotals.income, before.weeklyTotals.income + report.amount);
      assert.equal(state.weeklyTotals.expenses, before.weeklyTotals.expenses + preview.cost.money);
      assert.equal(state.project.budget, before.project.budget + preview.cost.money + preview.fundingUsed);
      assert.equal(state.project.grantBudget, before.project.grantBudget - preview.fundingUsed, 'early receipts are cash, never restricted funding');
      assert.equal(state.project.productionIncome, report.amount);
      assert.deepEqual(state.project.breakthroughs, [report]);
      assert.deepEqual(state.productionAlert, report);
      assert.deepEqual(Game.validateSave(copy(state)), state);
    }
  }
});

test('a good surprise persists through reload, cannot pay twice and refreshes a cash-starved creative dilemma', () => {
  const source = findBreakthrough('doc', 'shoot', 180);
  const state = copy(source.before);
  state.cash = source.preview.cost.money; // Boundary: the planned shoot uses every shekel.
  const result = Game.act(state, 'set.shoot_full');
  assert.ok(result.breakthrough);
  assert.equal(state.cash, result.breakthrough.amount);
  assert.equal(state.event.kind, 'production');
  assert.equal(state.event.options[0].disabled, false, 'an actual new receipt makes the 180-shekel rescue affordable');
  assert.ok(state.event.options[0].description.includes('180'));
  const restored = Game.validateSave(copy(state));
  assert.deepEqual(restored, state, 'the credited amount and refreshed choice survive save/load together');
  for (const trial of [state, restored]) {
    Base.deny(trial, () => Game.act(trial, 'studio.edit'), 'action before acknowledging income');
    Base.deny(trial, () => Game.endWeek(trial), 'week advance before acknowledging income');
    Base.deny(trial, () => Game.chooseEvent(trial, 0), 'creative choice before acknowledging income');
    const beforeAck = copy(trial);
    assert.equal(Game.acknowledgeProductionEvent(trial).ok, true);
    for (const key of ['cash', 'debt', 'rng', 'hours', 'energy', 'project', 'event', 'weeklyTotals']) assert.deepEqual(trial[key], beforeAck[key], `acknowledgment does not change ${key}`);
    Base.deny(trial, () => Game.acknowledgeProductionEvent(trial), 'the same income cannot be acknowledged twice');
    assert.equal(Game.chooseEvent(trial, 0).ok, true);
    assert.equal(trial.cash, result.breakthrough.amount - 180);
    assert.ok(Game.validateSave(copy(trial)));
  }
  assert.deepEqual(restored, state);
  const replay = copy(source.before);
  replay.cash = source.preview.cost.money;
  assert.deepEqual(Game.act(replay, 'set.shoot_full').breakthrough, result.breakthrough, 'reloading before the phase reproduces the exact receipt');
});

test('each film can earn only one surprise and only a real production transition can generate it', () => {
  let goodFilms = 0, mixedFilms = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const state = scene('short', seed);
    assert.equal(state.productionAlert, null, 'buying an idea does not generate a free receipt');
    assert.equal(state.project.productionIncome, 0);
    for (const id of ['home.write', 'set.shoot_full', 'studio.edit_polish']) {
      const previousGood = state.project.breakthroughs.length;
      const { result } = rawStage(state, id);
      assert.ok(!(result.breakthrough && result.setback));
      if (previousGood) assert.equal(result.breakthrough, null);
      finishNotices(state);
      Base.deny(state, () => Game.act(state, id), 'repeating a finished production phase never rerolls a reward');
      assert.ok(state.project.breakthroughs.length <= 1);
      assert.ok(!state.project.breakthroughs.some(good => state.project.setbacks.some(bad => bad.stage === good.stage)));
      if (state.project.breakthroughs.length) {
        const risk = Game.getProductionRisk(state);
        assert.equal(risk.positiveChance, 0);
        assert.equal(risk.remainingBreakthroughs, 0);
      }
    }
    if (state.project.breakthroughs.length) goodFilms++;
    if (state.project.breakthroughs.length && state.project.setbacks.length) mixedFilms++;
    assert.equal(state.project.productionIncome, state.project.breakthroughs.reduce((sum, good) => sum + good.amount, 0));
    const beforeRest = copy(state);
    state.hours = 32; state.energy = 60;
    Base.perform(state, 'home.rest');
    assert.equal(state.productionAlert, null);
    assert.equal(state.cash, beforeRest.cash);
    assert.deepEqual(state.project, beforeRest.project, 'ordinary recovery cannot farm surprise income from a finished phase');
    assert.ok(Game.validateSave(copy(state)));
  }
  assert.ok(goodFilms > 0 && mixedFilms > 0, 'the sample exercises both good-only and mixed financial production histories');
});

test('early film income remains in its archive while the premiere pays only its newly disclosed receipt', () => {
  for (const type of ['doc', 'feature', 'blockbuster']) {
    const { state, result } = findBreakthrough(type, 'edit');
    finishNotices(state);
    state.hours = 32; state.energy = 100;
    const before = copy(state);
    const preview = Base.actions(state).find(action => action.id === 'studio.release_commercial');
    const forecast = Game.getReleaseForecast(state, false);
    assert.equal(Game.act(state, preview.id).ok, true);
    const film = state.films.at(-1);
    assert.equal(film.productionIncome, result.breakthrough.amount);
    assert.deepEqual(film.breakthroughs, before.project.breakthroughs);
    assert.ok([forecast.successRevenue, forecast.flopRevenue].includes(film.revenue));
    assert.equal(state.cash, before.cash - preview.cost.money + film.revenue, 'premiere never pays the early receipt for a second time');
    assert.equal(state.weeklyTotals.income, before.weeklyTotals.income + film.revenue);
    assert.equal(state.productionAlert, null, 'release cannot generate a fourth production surprise');
    assert.deepEqual(Game.validateSave(copy(state)), state);
    Base.deny(state, () => Game.act(state, preview.id), 'duplicate premiere');
    const badIncome = copy(state); badIncome.films.at(-1).productionIncome++;
    const badAmount = copy(state); badAmount.films.at(-1).breakthroughs[0].rewardCash++;
    const duplicate = copy(state); duplicate.films.at(-1).breakthroughs.push(copy(film.breakthroughs[0]));
    const wrongProject = copy(state); wrongProject.films.at(-1).breakthroughs[0].projectId++;
    for (const bad of [badIncome, badAmount, duplicate, wrongProject]) assert.equal(Game.validateSave(bad), null, 'invented or duplicated early revenue cannot load');
  }
});

let failures = 0;
if (require.main === module) {
  for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failures++; console.error(`✗ ${name}\n  ${error.stack}`); }
  }
  console.log(`\n${tests.length - failures}/${tests.length} production surprise checks passed.`);
  if (failures) process.exitCode = 1;
}
