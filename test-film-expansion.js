/* V2 expansion tests. Run: node test-film-expansion.js
 * Funding boundary fixtures deliberately set ample resources / a named boundary;
 * the character reachability matrix uses only actual engine actions from createGame.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Game = require('./game-engine.js');
const Base = require('./test-film-game.js');
const copy = value => JSON.parse(JSON.stringify(value));
const tests = [];
const test = (name, run) => tests.push({ name, run });
const CHARACTERS = ['kobi', 'noa', 'amir', 'tamar'];
const MODES = ['calm', 'normal', 'hard'];
const matrix = [];

function get(state, id) {
  return Base.actions(state).find(action => action.id === id);
}
function freeChoice(state) {
  Base.acknowledgeSetback(state);
  if (!state.event) return;
  const index = state.event.options.findIndex(option => !option.disabled && !(option.filmCost > 0) && !(option.effects?.cash < 0));
  assert.ok(index >= 0, 'an event always has an affordable choice without a money cost');
  assert.equal(Game.chooseEvent(state, index).ok, true);
}
function closeWeek(state, resolve = true) {
  freeChoice(state);
  assert.equal(Game.endWeek(state).ok, true);
  if (resolve) freeChoice(state);
}
function boundary(options = {}) {
  const state = Game.createGame({ difficulty: 'calm', seed: 7, ...options });
  // Explicit test fixture: isolate production/funding boundaries from solvency.
  state.cash = 20000;
  state.craft = 60;
  state.reputation = 45;
  state.contacts = 40;
  return state;
}
function projectAt(stage, options = {}) {
  const state = boundary(options);
  Base.perform(state, 'home.start_doc');
  // These funding/calendar fixtures intentionally retain the supported old-save
  // one-action workload so their full-invoice snapshots stay exact. The real
  // character-policy matrix below starts native multi-day projects unchanged.
  delete state.project.workload;
  if (stage === 'script') return state;
  Base.perform(state, 'home.write');
  if (stage === 'shoot') return state;
  Base.perform(state, 'set.shoot_lean');
  freeChoice(state);
  if (stage === 'edit') return state;
  Base.perform(state, 'studio.edit');
  if (stage === 'release') return state;
  Base.perform(state, 'studio.release_commercial');
  return state;
}
const fundOption = (state, track) => Game.getFundingOptions(state).find(option => option.id === track);
function prepareApplication(track, seed = 1) {
  const state = projectAt({ development: 'script', production: 'shoot', completion: 'edit' }[track], { difficulty: 'normal', seed });
  for (let step = 0; fundOption(state, track).disabled && step < 4; step++) closeWeek(state);
  assert.equal(fundOption(state, track).disabled, false, `${track} finds an eligible opening`);
  Base.perform(state, 'bank.submit_' + track);
  return state;
}
function waitForDecision(state) {
  let count = 0;
  while (state.funding.application && count++ < 4) {
    freeChoice(state);
    const before = copy(state);
    assert.equal(Game.endWeek(state).ok, true);
    const royalty = before.films.reduce((sum, film) => sum + film.royalty, 0);
    const living = Game.DIFFICULTIES[state.difficulty].living;
    const interest = Math.ceil(before.debt * Game.DIFFICULTIES[state.difficulty].interest);
    assert.equal(state.cash - state.debt, before.cash - before.debt + royalty - living - interest, 'grant decisions cannot inflate personal net worth');
    assert.equal(state.weeklySummary.income, before.weeklyTotals.income + royalty, 'grants are excluded from weekly personal income');
  }
  assert.equal(state.funding.application, null, 'a scheduled funding decision eventually resolves');
  return state.funding.history[state.funding.history.length - 1];
}
const decisionCache = new Map();
function findDecision(track, outcome) {
  const key = track + ':' + outcome;
  if (decisionCache.has(key)) return copy(decisionCache.get(key));
  for (let seed = 1; seed <= 100; seed++) {
    const pending = prepareApplication(track, seed);
    const state = copy(pending);
    const result = waitForDecision(state);
    if (result.outcome === outcome) {
      const found = { seed, pending, state, result };
      decisionCache.set(key, copy(found));
      return found;
    }
  }
  assert.fail(`${track} ${outcome} was not observed in 100 seeded decisions`);
}

test('funding menus expose real submission costs, eligibility, cycles and the last-week cutoff', () => {
  const stages = { development: 'script', production: 'shoot', completion: 'edit' };
  const schedules = {
    development: { amount: 400, wait: 1, opens: [1, 2, 5, 6] },
    production: { amount: 900, wait: 2, opens: [2, 3, 6, 7] },
    completion: { amount: 500, wait: 1, opens: [1, 2, 4, 5, 7, 8] }
  };
  assert.equal(Game.getFundingOptions(Game.createGame({ seed: 1 })).every(o => o.disabled), true);
  for (const track of Object.keys(stages)) {
    const state = projectAt(stages[track], { difficulty: 'normal' });
    state.hours = 32; state.energy = 80; // Eligibility boundary, not a playthrough.
    const before = copy(state);
    const options = Game.getFundingOptions(state);
    assert.deepEqual(state, before, 'funding display is read-only, including RNG');
    assert.deepEqual(options.map(o => o.id), ['development', 'production', 'completion']);
    const detail = options.find(o => o.id === track);
    assert.equal(detail.amount, schedules[track].amount);
    assert.equal(detail.waitWeeks, schedules[track].wait);
    assert.deepEqual(detail.cost, get(state, detail.actionId).cost, 'funding cards and actions share the exact cost');
    assert.ok(detail.chance >= 25 && detail.chance <= 85);
    for (let week = 1; week <= 8; week++) {
      state.week = week;
      assert.equal(!fundOption(state, track).disabled, schedules[track].opens.includes(week), `${track} application window in week ${week}`);
    }
    state.week = state.maxWeeks;
    assert.equal(fundOption(state, track).disabled, true, 'no applications whose answer would come after the ending');
    Base.deny(state, () => Game.act(state, detail.actionId), 'last-week submission');
  }
  const production = projectAt('shoot', { difficulty: 'normal' });
  production.week = 2; production.craft = 17;
  assert.equal(fundOption(production, 'production').disabled, true);
  production.craft = 18;
  assert.equal(fundOption(production, 'production').disabled, false);
  const completion = projectAt('edit', { difficulty: 'normal' });
  completion.project.quality = 34;
  assert.equal(fundOption(completion, 'completion').disabled, true);
  completion.project.quality = 35;
  assert.equal(fundOption(completion, 'completion').disabled, false);
});

test('funding decisions wait, keep a frozen application and resume deterministically after reload', () => {
  const state = prepareApplication('production', 43);
  const application = copy(state.funding.application);
  assert.equal(application.dueWeek, state.week + 2);
  assert.equal(state.project.grantBudget, 0, 'submission never pays immediately');
  assert.equal(state.funding.history.length, 0);
  assert.ok(Game.validateSave(copy(state)), 'pending application is loadable');
  for (const track of ['development', 'production', 'completion']) Base.deny(state, () => Game.act(state, 'bank.submit_' + track), 'another application while waiting');
  Base.perform(state, 'school.course');
  assert.deepEqual(state.funding.application, application, 'later training cannot silently change the submitted probability or snapshot');
  assert.equal(Game.endWeek(state).ok, true);
  assert.equal(state.week, application.dueWeek - 1);
  assert.equal(state.project.grantBudget, 0);
  assert.equal(state.funding.history.length, 0, 'no early funding result');
  freeChoice(state);
  const resumed = Game.validateSave(copy(state));
  assert.ok(resumed);
  const result = waitForDecision(state);
  waitForDecision(resumed);
  assert.deepEqual(resumed, state, 'save/reload preserves the delayed decision and the next random event');
  assert.equal(result.resolvedWeek, application.dueWeek);
  for (const [key, value] of Object.entries(application)) assert.deepEqual(result[key], value, `result preserves application.${key}`);
  assert.ok(['approved', 'rejected'].includes(result.outcome));
  assert.ok(result.reason);
  assert.deepEqual(state.weeklySummary.fundingResults, [result]);
  const settledCount = state.funding.history.length;
  closeWeek(state);
  assert.equal(state.funding.history.length, settledCount, 'later weeks never resolve the same application again');
});

test('approved grants cover full and partial planned invoices when no production surprise occurs', () => {
  // Isolate the planned-invoice contract from the separately tested random cost
  // mechanic, by selecting a real seeded run with no setback in these stages.
  let state;
  for (let seed = 1; seed <= 100 && !state; seed++) {
    const candidate = prepareApplication('development', seed);
    if (waitForDecision(candidate).outcome !== 'approved') continue;
    const probe = copy(candidate);
    freeChoice(probe);
    Base.perform(probe, 'home.write'); Base.perform(probe, 'set.shoot_lean');
    freeChoice(probe); Base.perform(probe, 'studio.edit');
    if (!probe.project.setbacks.length && !(probe.project.breakthroughs || []).length) state = candidate;
  }
  assert.ok(state, 'an approved no-setback fixture exists without editing its resources or RNG');
  assert.equal(state.event.kind, 'weekly', 'the approval can coexist with a still-unanswered weekly event');
  assert.deepEqual(Game.validateSave(copy(state)), state, 'approved result and pending weekly event survive together');
  freeChoice(state);
  assert.equal(state.project.grantBudget, 400);
  assert.equal(state.project.grantAwarded, 400);
  assert.ok(Game.validateSave(copy(state)), 'approved budget and funding history agree in saves');
  const cashless = copy(state);
  cashless.cash = 0;
  assert.equal(get(cashless, 'cafe.network').disabled, true, 'restricted film money cannot buy personal networking');
  assert.equal(get(cashless, 'gear.buy_bike').disabled, true, 'restricted film money cannot buy permanent personal equipment');
  Base.perform(state, 'home.write');
  const shot = get(state, 'set.shoot_lean');
  assert.ok(shot.fundingUsed > 0);
  assert.equal(shot.cost.money, 0, 'a 400 grant can fully cover a lean Kobi documentary shoot');
  const beforeShot = copy(state);
  Base.perform(state, shot.id);
  assert.equal(state.cash, beforeShot.cash - shot.cost.money);
  assert.equal(state.project.grantBudget, beforeShot.project.grantBudget - shot.fundingUsed);
  const event = copy(state.event);
  assert.equal(event.kind, 'production');
  assert.deepEqual(Game.validateSave(copy(state)), state, 'funded production descriptions and restricted coverage survive reload exactly');
  for (let index = 0; index < event.options.length; index++) {
    const trial = copy(state);
    const option = event.options[index];
    assert.equal(option.disabled, false, 'ample boundary resources make every tradeoff inspectable');
    const credit = Math.min(option.filmCost, trial.project.grantBudget);
    const personal = option.filmCost - credit;
    assert.ok(option.description.includes((personal || 0) ? personal.toLocaleString('he-IL') : 'ללא עלות במזומן'), 'dilemma states its actual cash contribution');
    assert.equal(Game.chooseEvent(trial, index).ok, true);
    assert.equal(trial.cash, state.cash - personal);
    assert.equal(trial.project.grantBudget, state.project.grantBudget - credit);
    assert.equal(trial.hours, state.hours - option.hours);
    assert.equal(trial.project.quality, Math.max(0, Math.min(100, state.project.quality + option.quality)));
    for (const stat of ['energy', 'happiness']) assert.equal(trial[stat], Math.max(0, Math.min(100, state[stat] + (option.effects[stat] || 0))));
    assert.equal(trial.weeklyTotals.expenses, state.weeklyTotals.expenses + personal);
    assert.ok(Game.validateSave(copy(trial)), 'every actual production choice remains valid');
  }
  freeChoice(state);
  const editing = get(state, 'studio.edit');
  assert.ok(editing.fundingUsed > 0 && editing.cost.money > 0, 'the remaining grant only partially covers editing');
  const beforeEdit = copy(state);
  Base.perform(state, editing.id);
  assert.equal(state.cash, beforeEdit.cash - editing.cost.money);
  assert.equal(state.project.grantBudget, 0);
  assert.equal(state.weeklyTotals.expenses, beforeEdit.weeklyTotals.expenses + editing.cost.money, 'operating expense is the personal contribution only');
});

test('unused restricted support expires at release and one film cannot collect another award', () => {
  const { state } = findDecision('production', 'approved');
  freeChoice(state);
  assert.equal(state.project.grantBudget, 900);
  for (const track of ['development', 'production', 'completion']) Base.deny(state, () => Game.act(state, 'bank.submit_' + track), 'a second award on the same project');
  Base.perform(state, 'set.shoot_lean'); freeChoice(state);
  Base.perform(state, 'studio.edit');
  const preview = get(state, 'studio.release_commercial');
  const before = copy(state);
  const expectedExpiry = before.project.grantBudget - preview.fundingUsed;
  assert.ok(expectedExpiry > 0, 'fixture reaches release with genuinely unused support');
  Base.perform(state, preview.id);
  const film = state.films[0];
  assert.equal(film.grantBudget, 0);
  assert.equal(film.grantExpired, expectedExpiry);
  assert.equal(state.cash, before.cash - preview.cost.money + film.revenue, 'unused grant is never paid out with premiere revenue');
  assert.equal(state.funding.history.filter(a => a.outcome === 'approved').length, 1);
  assert.ok(Game.validateSave(copy(state)), 'released supported film can be restored');
});

test('release withdraws an unresolved application with no late payout or transfer to the next film', () => {
  const { pending: state } = findDecision('production', 'approved');
  const submitted = copy(state.funding.application);
  Base.perform(state, 'set.shoot_lean'); freeChoice(state);
  Base.perform(state, 'studio.edit');
  Base.perform(state, 'studio.release_commercial');
  assert.equal(state.funding.application, null);
  assert.equal(state.funding.history[0].outcome, 'withdrawn');
  assert.equal(state.funding.history[0].resolvedWeek, state.week);
  assert.equal(state.films[0].grantAwarded, 0);
  assert.ok(Game.validateSave(copy(state)), 'withdrawal before due date is a valid saved state');
  closeWeek(state);
  Base.perform(state, 'home.start_doc');
  assert.notEqual(state.project.id, submitted.projectId);
  while (state.week <= submitted.dueWeek) closeWeek(state);
  assert.equal(state.project.grantBudget, 0);
  assert.equal(state.project.grantAwarded, 0);
  assert.equal(state.funding.history.length, 1, 'a withdrawn application does not return as a delayed second result');
});

test('rejection requires improvement and enforces one revision and two submissions per film', () => {
  const { state, result: rejection } = findDecision('development', 'rejected');
  freeChoice(state);
  assert.equal(state.project.grantBudget, 0);
  Base.deny(state, () => Game.act(state, 'bank.submit_development'), 'resubmission without improving the file');
  Base.perform(state, 'bank.revise_application');
  assert.equal(state.project.dossier, 1);
  Base.deny(state, () => Game.act(state, 'bank.revise_application'), 'a second dossier revision');
  for (let i = 0; fundOption(state, 'development').disabled && i < 4; i++) closeWeek(state);
  const revised = fundOption(state, 'development');
  assert.equal(revised.disabled, false);
  assert.ok(revised.chance >= rejection.chance, 'a stronger application never lowers its approval probability');
  Base.perform(state, revised.actionId);
  assert.equal(state.funding.application.attempt, 2);
  assert.equal(state.funding.application.dossier, 1);
  assert.ok(Game.validateSave(copy(state)), 'the second pending attempt preserves revision history');
  waitForDecision(state); freeChoice(state);
  assert.equal(state.funding.history.length, 2);
  for (const track of ['development', 'production', 'completion']) Base.deny(state, () => Game.act(state, 'bank.submit_' + track), 'third submission across any track');
  Base.deny(state, () => Game.act(state, 'bank.revise_application'), 'revision after both attempts are spent');
  assert.ok(Game.validateSave(copy(state)), 'the final funding result remains loadable');
});

test('all three funds can approve and honest improvement thresholds unlock a retry', () => {
  for (const [track, amount] of [['development', 400], ['production', 900], ['completion', 500]]) {
    const { state, result } = findDecision(track, 'approved');
    assert.equal(result.amount, amount);
    assert.equal(state.project.grantBudget, amount);
    assert.equal(state.project.grantAwarded, amount);
    assert.ok(Game.validateSave(copy(state)), `${track} approval is a valid saved result`);
  }
  const { state, result } = findDecision('development', 'rejected');
  freeChoice(state);
  // Boundary fixtures hold all other improvement routes at their submitted values.
  for (const [field, threshold] of [['quality', 8], ['craft', 6]]) {
    const retry = copy(state);
    retry.project.dossier = result.dossier;
    retry.project.quality = result.quality;
    retry.craft = result.craft;
    if (field === 'quality') retry.project.quality += threshold - 1;
    else retry.craft += threshold - 1;
    assert.equal(fundOption(retry, 'development').disabled, true, `${field} just below the promised threshold is insufficient`);
    if (field === 'quality') retry.project.quality += 1;
    else retry.craft += 1;
    assert.equal(fundOption(retry, 'development').disabled, false, `${field} at the promised threshold unlocks the open cycle`);
    Base.perform(retry, 'bank.submit_development');
    assert.equal(retry.funding.application.attempt, 2);
    assert.ok(Game.validateSave(copy(retry)), 'alternative improvement route creates a valid application snapshot');
  }
});

test('four distinct characters preserve selection and all perks match actual costs', () => {
  assert.deepEqual(Game.CHARACTERS.map(c => c.id), CHARACTERS);
  for (const characterId of CHARACTERS) {
    const state = Game.createGame({ characterId, difficulty: 'normal', seed: 7 });
    assert.equal(state.characterId, characterId);
    assert.equal(Game.validateSave(copy(state)).characterId, characterId);
    const character = Game.CHARACTERS.find(c => c.id === characterId);
    assert.ok(character.name && character.advantage && character.drawback, 'each character exposes both sides of its tradeoff');
  }
  assert.equal(Game.createGame({ characterId: 'unknown' }).characterId, 'kobi');
  assert.equal(Game.createGame({ characterId: 'amir' }).craft, 8);
  assert.equal(Game.createGame({ characterId: 'kobi' }).craft, 12);

  const kobi = projectAt('shoot', { characterId: 'kobi' });
  const noa = projectAt('shoot', { characterId: 'noa' });
  const normalShot = get(noa, 'set.shoot_lean').cost.money;
  assert.equal(get(kobi, 'set.shoot_lean').cost.money, Math.round(normalShot * 0.85), 'Kobi lean photography is 15% cheaper');
  assert.equal(get(kobi, 'set.shoot_full').cost.money, get(noa, 'set.shoot_full').cost.money, 'the discount does not leak into a full crew');

  const editNoa = projectAt('edit', { characterId: 'noa' });
  const editKobi = projectAt('edit', { characterId: 'kobi' });
  // The Kobi shoot variance is a different perk: normalize only the edit inputs.
  editNoa.project.quality = editKobi.project.quality = 35;
  editNoa.craft = editKobi.craft = 45;
  assert.equal(get(editNoa, 'studio.edit').cost.time, get(editKobi, 'studio.edit').cost.time + 1);
  Base.perform(editNoa, 'studio.edit');
  Base.perform(editKobi, 'studio.edit');
  assert.equal(editNoa.project.quality, editKobi.project.quality + 8, 'Noa trades one hour for eight quality');

  for (const characterId of ['kobi', 'amir']) {
    const state = Game.createGame({ characterId, seed: 7 });
    const old = state.contacts;
    Base.perform(state, 'cafe.network');
    assert.equal(state.contacts - old, characterId === 'amir' ? 11 : 8);
  }
  const tamar = Game.createGame({ characterId: 'tamar', seed: 7 });
  const initial = copy(tamar);
  Base.perform(tamar, 'set.work');
  assert.equal(tamar.cash - initial.cash, Math.round(Game.JOBS[0].wage * 1.15));
  assert.equal(tamar.happiness, initial.happiness - 2);
});

test('Kobi improvisation stays within its advertised range and varies across deterministic seeds', () => {
  const observed = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const state = projectAt('shoot', { characterId: 'kobi', difficulty: 'normal', seed });
    const initialQuality = state.project.quality;
    const baseGain = 13 + Math.floor(state.craft * 0.12);
    const preview = get(state, 'set.shoot_lean');
    assert.ok(preview.effects.some(text => text.includes('אקראי') && text.includes('3')), 'the quality uncertainty is disclosed before acting');
    Base.perform(state, preview.id);
    const variance = state.project.quality - initialQuality - baseGain;
    assert.ok(variance >= -3 && variance <= 3, 'improvisation cannot exceed the shown quality range');
    observed.add(variance);
  }
  assert.ok(observed.size >= 3, 'the advertised tradeoff is not a cosmetic constant');
});

test('authentic v1 save migrates without losing resources, project or its pending event', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'tests/fixtures/film-v1-save.json'), 'utf8'));
  assert.equal(raw.version, 1, 'fixture was captured before the v2 engine replaced v1');
  const original = copy(raw);
  const migrated = Game.validateSave(raw);
  assert.ok(migrated, 'authentic legacy save loads');
  assert.equal(Game.VERSION, 5);
  assert.equal(migrated.version, 5);
  assert.equal(migrated.characterId, 'kobi');
  for (const key of ['name', 'difficulty', 'week', 'maxWeeks', 'hours', 'maxHours', 'cash', 'debt', 'energy', 'happiness', 'craft', 'reputation', 'contacts', 'job', 'location', 'rng', 'status']) {
    assert.deepEqual(migrated[key], key==='hours'?original.hours+18:key==='maxHours'?50:original[key], `migration preserves ${key}`);
  }
  for (const [key, value] of Object.entries(original.project)) assert.deepEqual(migrated.project[key], value, `migration preserves project.${key}`);
  assert.ok(Number.isInteger(migrated.project.id));
  assert.equal(migrated.project.grantBudget, 0);
  assert.deepEqual(migrated.event.options.map(o => o.effects), original.event.options.map(o => o.effects));
  assert.equal(migrated.event.title, original.event.title);
  assert.equal(migrated.event.body, original.event.body);
  assert.deepEqual(raw, original, 'migration does not modify its caller input');
  assert.deepEqual(Game.validateSave(copy(migrated)), migrated, 'migrated game can be saved in the current version');
  const twin = Game.validateSave(original);
  freeChoice(migrated); freeChoice(twin);
  Base.perform(migrated, 'set.shoot_lean'); Base.perform(twin, 'set.shoot_lean');
  assert.deepEqual(migrated, twin, 'legacy RNG resumes identically through new mechanics');
  for (const patch of [{ cash: -1 }, { project: { ...original.project, stage: 'television' } }]) {
    assert.equal(Game.validateSave({ ...copy(original), ...patch }), null, 'corrupt v1 input is not silently reset to a fresh game');
  }
});

test('each film gets exactly one production dilemma and choices survive reload atomically', () => {
  const state = projectAt('shoot', { seed: 43 });
  Base.perform(state, 'set.shoot_lean');
  assert.equal(state.event.kind, 'production');
  assert.equal(state.event.projectId, state.project.id);
  assert.ok(state.event.twistId);
  const restored = Game.validateSave(copy(state));
  assert.ok(restored, 'save with an unresolved production dilemma is valid');
  assert.deepEqual(restored, state);
  Base.deny(state, () => Game.act(state, 'studio.edit'), 'editing around a production decision');
  Base.deny(state, () => Game.endWeek(state), 'advancing around a production decision');
  Base.deny(state, () => Game.chooseEvent(state, -1), 'invalid production choice');
  const index = state.event.options.findIndex(o => !o.disabled && !(o.filmCost > 0));
  const event = copy(state.event);
  assert.equal(Game.chooseEvent(state, index).ok, true);
  assert.equal(Game.chooseEvent(restored, index).ok, true);
  assert.deepEqual(restored, state, 'a saved production choice preserves deterministic outcome');
  assert.equal(state.event, null);
  assert.equal(state.project.twist.id, event.twistId);
  assert.ok(state.project.twist.text);
  Base.deny(state, () => Game.chooseEvent(state, index), 'duplicate production choice');
  const twist = copy(state.project.twist);
  Base.perform(state, 'studio.edit');
  assert.equal(state.event, null, 'editing does not create a second production dilemma');
  Base.perform(state, 'studio.release_commercial');
  assert.deepEqual(state.films[0].twist, twist, 'released film preserves the decision');
  assert.ok(Game.validateSave(copy(state)), 'film archive with its dilemma remains loadable');
});

test('v2 saves reject foreign characters, malformed funding and mismatched production projects', () => {
  const clean = Game.createGame({ seed: 7 });
  const pending = projectAt('shoot');
  Base.perform(pending, 'set.shoot_lean');
  const corrupt = [
    { ...copy(clean), characterId: 'unknown' },
    { ...copy(clean), funding: null },
    { ...copy(clean), funding: { application: [], history: [] } },
    { ...copy(clean), nextProjectId: 0 },
    { ...copy(pending), project: { ...pending.project, grantBudget: -1 } },
    { ...copy(pending), project: { ...pending.project, dossier: 9 } },
    { ...copy(pending), project: { ...pending.project, id: -1 } },
    { ...copy(pending), event: { ...pending.event, projectId: pending.project.id + 1 } }
  ];
  for (const raw of corrupt) assert.equal(Game.validateSave(raw), null, 'corruption is rejected without a silent reset');
});

test('a production dilemma always offers a valid exit even after spending the last resources', () => {
  const state = projectAt('shoot', { difficulty: 'normal' });
  const shot = get(state, 'set.shoot_lean');
  // Boundary fixture: use precisely the resources needed to trigger the dilemma.
  state.cash = shot.cost.money;
  state.energy = shot.cost.energy;
  state.hours = shot.cost.time;
  Base.perform(state, shot.id);
  assert.equal(state.cash, 0);
  assert.equal(state.energy, 0);
  assert.equal(state.hours, 0);
  assert.equal(state.event.options[0].disabled, true, 'paid rescue cannot spend missing money');
  assert.equal(state.event.options[1].disabled, true, 'self-repair cannot spend missing energy');
  assert.equal(state.event.options[2].disabled, false, 'the rewrite choice remains possible');
  assert.ok(Game.validateSave(copy(state)), 'a constrained pending dilemma survives reload');
  Base.deny(state, () => Game.chooseEvent(state, 0), 'unaffordable paid rescue');
  Base.deny(state, () => Game.chooseEvent(state, 1), 'unaffordable energy rescue');
  assert.equal(Game.chooseEvent(state, 2).ok, true);
  assert.equal(Game.endWeek(state).ok, true, 'the player can continue after the free decision');
});

test('funding saves reject invented awards, altered frozen odds and duplicate application histories', () => {
  const { state: awarded, pending } = findDecision('development', 'approved');
  const result = awarded.funding.history[0];
  const invented = projectAt('script');
  invented.project.grantAwarded = invented.project.grantBudget = 400;
  const corrupt = [
    invented,
    { ...copy(pending), funding: { ...copy(pending.funding), application: { ...pending.funding.application, chance: 100 } } },
    { ...copy(pending), funding: { ...copy(pending.funding), application: { ...pending.funding.application, contacts: pending.funding.application.contacts + 20 } } },
    { ...copy(pending), funding: { ...copy(pending.funding), application: { ...pending.funding.application, dueWeek: pending.funding.application.dueWeek + 1 } } },
    { ...copy(awarded), funding: { application: null, history: [copy(result), copy(result)] } },
    { ...copy(awarded), project: { ...awarded.project, grantBudget: awarded.project.grantAwarded + 1 } },
    { ...copy(awarded), funding: { application: null, history: [{ ...result, amount: result.amount + 1 }] } }
  ];
  for (const raw of corrupt) assert.equal(Game.validateSave(raw), null, 'funding integrity violation is rejected');
});

test('victory resolves pending-funding cleanup and cannot erase an unanswered production dilemma', () => {
  const funding = projectAt('released', { difficulty: 'normal' });
  assert.equal(funding.status, 'playing');
  closeWeek(funding);
  Base.perform(funding, 'home.start_doc');
  Base.perform(funding, 'bank.submit_development');
  assert.ok(funding.funding.application);
  // Victory boundary: work supplies the one missing craft point.
  const target = Game.DIFFICULTIES.normal.goals;
  funding.cash = target.wealth + funding.debt;
  funding.craft = target.craft - 1;
  funding.reputation = target.reputation;
  funding.happiness = target.happiness;
  Base.perform(funding, 'set.work');
  assert.equal(funding.status, 'won');
  assert.equal(funding.funding.application, null);
  assert.equal(funding.funding.history.at(-1).outcome, 'withdrawn');
  assert.ok(Game.validateSave(copy(funding)), 'winning with a pending application produces a valid final save');

  const dilemma = projectAt('released', { difficulty: 'normal' });
  closeWeek(dilemma);
  Base.perform(dilemma, 'home.start_doc');
  Base.perform(dilemma, 'home.write');
  // The victory boundary must be the final real shoot day: earlier days now
  // legitimately award craft without opening the end-of-shoot dilemma.
  while (dilemma.project.workload.shootDone < Game.PRODUCTION_DAYS.doc.shoot - 1) {
    dilemma.hours = dilemma.maxHours; dilemma.energy = 100;
    Base.perform(dilemma, 'set.shoot_lean');
    assert.equal(dilemma.event, null, 'intermediate shoot days do not open the final dilemma');
  }
  dilemma.hours = dilemma.maxHours; dilemma.energy = 100;
  dilemma.cash = target.wealth + dilemma.debt + get(dilemma, 'set.shoot_lean').cost.money;
  dilemma.craft = target.craft - 1;
  dilemma.reputation = target.reputation;
  dilemma.happiness = target.happiness;
  Base.perform(dilemma, 'set.shoot_lean');
  assert.ok(Game.goals(dilemma).every(goal => goal.complete));
  assert.equal(dilemma.status, 'playing', 'an unresolved production decision precedes victory');
  assert.equal(dilemma.event.kind, 'production');
  assert.ok(Game.validateSave(copy(dilemma)));
  assert.equal(Game.chooseEvent(dilemma, 2).ok, true);
  assert.equal(dilemma.status, 'won');
  assert.ok(dilemma.project.twist, 'winning preserves the film decision');
  assert.ok(Game.validateSave(copy(dilemma)));
});

test('the same real-action policy reaches victory for four characters across three modes', () => {
  for (const characterId of CHARACTERS) {
    for (const difficulty of MODES) {
      const results = [7, 43, 263].map(seed => Base.runBalanced(difficulty, seed, { characterId }));
      const winners = results.filter(({ state }) => state.status === 'won');
      matrix.push({ characterId, difficulty, wins: `${winners.length}/${results.length}`, earliest: Math.min(...results.map(r => r.state.week)), latest: Math.max(...results.map(r => r.state.week)) });
      assert.equal(winners.length, results.length, `${characterId}/${difficulty}: fixed competent-policy seeds should remain reachable`);
      for (const { state } of results) assert.equal(Game.validateSave(copy(state)).characterId, characterId);
    }
  }
  console.table(matrix);
});

function runTests() {
  let failures = 0;
  for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failures++; console.error(`✗ ${name}\n  ${error.stack}`); }
  }
  console.log(`\n${tests.length - failures}/${tests.length} expansion checks passed.`);
  if (failures) process.exitCode = 1;
}
if (require.main === module) runTests();
module.exports = { boundary, projectAt, freeChoice, closeWeek, matrix, findDecision };
