/* Professional crew and delayed festival decisions.
 * Run: node test-film-industry.js.
 * Focused rule tests label edited boundaries; whole-career reachability remains
 * action-only in the existing regression programs.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Game = require('./game-engine.js');
const Industry = require('./film-industry.js');
const Base = require('./test-film-game.js');
const Expansion = require('./test-film-expansion.js');
const copy = value => JSON.parse(JSON.stringify(value));
const tests = [];
const test = (name, run) => tests.push({ name, run });
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'tests/fixtures', name), 'utf8'));
const TYPES = ['short', 'doc', 'comedy', 'feature', 'blockbuster'];

function assertSave(state) {
  assert.deepEqual(Game.validateSave(copy(state)), state, 'industry state round trips exactly');
}
function resolve(state) { Base.chooseBalancedEvent(state); }
function completeBoundaryStage(state, id) {
  // This helper isolates stage/crew mechanics with the already documented ample
  // resources. It still performs every real day; reachability below never resets.
  const stage = state.project.stage;
  let days = 0;
  while (state.project.stage === stage) {
    assert.ok(days++ < 30, 'a finite production workload completes');
    state.hours = state.maxHours; state.energy = 100;
    const result = Base.perform(state, id);
    if (state.project.stage === stage) {
      assert.equal(result.setback, null, 'an intermediate day cannot reroll a stage invoice');
      assert.equal(result.breakthrough, null, 'an intermediate day cannot farm an early receipt');
      assert.equal(state.event, null, 'the production dilemma waits until the shoot finishes');
      assertSave(state);
    }
  }
}
function scene(stage = 'shoot', seed = 43) {
  const state = Game.createGame({ difficulty: 'calm', seed });
  state.cash = 30000; // Explicit invoice boundary; resource-free playthroughs appear below.
  Base.perform(state, 'home.start_doc');
  if (stage !== 'script') Base.perform(state, 'home.write');
  if (['edit', 'release'].includes(stage)) { completeBoundaryStage(state, 'set.shoot_lean'); resolve(state); }
  if (stage === 'release') { completeBoundaryStage(state, 'studio.edit'); }
  state.hours = 32; state.energy = 80;
  return state;
}
function archiveBoundary(seed = 1) {
  const raw = fixture('v3-career-browser.json');
  raw.rng = Math.imul(seed, 2654435761) >>> 0; // Deterministic independent-circuit boundary sweep.
  raw.reputation = 60; // Leave room to verify the actual reputation award before the 100 cap.
  const state = Game.validateSave(raw);
  assert.ok(state);
  state.cash = 30000; state.hours = 32; state.energy = 80; state.happiness = 45;
  return state;
}
function option(state, festivalId, filmId) {
  return Game.getFestivalSubmissions(state).find(row => row.festivalId === festivalId && (!filmId || row.filmId === filmId));
}
function finishSubmission(state, entryId) {
  let beforeClose;
  for (let wait = 0; wait < 4 && state.festivalCircuit.pending.some(entry => entry.id === entryId); wait++) {
    resolve(state);
    beforeClose = copy(state);
    assert.equal(Game.endWeek(state).ok, true);
    assertSave(state);
  }
  const result = state.festivalCircuit.history.find(entry => entry.id === entryId);
  assert.ok(result, 'the decision arrives within its announced bounded wait');
  return { state, beforeClose, result };
}
const decisions = new Map();
function festivalDecision(festivalId, outcome) {
  const key = festivalId + '/' + outcome;
  if (decisions.has(key)) return copy(decisions.get(key));
  for (let seed = 1; seed <= 160; seed++) {
    const state = archiveBoundary(seed);
    const row = Game.getFestivalSubmissions(state).find(row => row.festivalId === festivalId && !row.disabled);
    assert.ok(row, festivalId + ' has an eligible film in the authentic archive');
    const beforeSubmit = copy(state);
    Base.perform(state, row.actionId);
    const pending = copy(state);
    const completed = finishSubmission(state, row.id);
    if (completed.result.outcome === outcome) {
      const found = { ...completed, pending, beforeSubmit, row, seed };
      decisions.set(key, copy(found)); return found;
    }
  }
  assert.fail(`No actual seeded ${festivalId}/${outcome} result found`);
}

test('crew specialties change their actual quoted quality benefit and large productions cost more', () => {
  const doc = Industry.getCrewOptions({ type: 'doc', stage: 'shoot', crew: [] });
  assert.deepEqual(doc.map(person => person.cost), [120, 150, 110, 130, 90, 130]);
  assert.deepEqual(doc.map(person => person.qualityBonus), [9, 5, 9, 4, 7, 4]);
  assert.equal(new Set(Industry.CREW.map(person => person.id)).size, 6);
  for (const person of Industry.CREW) {
    let matching, general;
    for (const type of TYPES) {
      const project = { type, stage: person.role === 'editor' ? 'edit' : 'shoot', crew: [] };
      const before = copy(project);
      const row = Industry.getCrewOptions(project).find(candidate => candidate.id === person.id);
      assert.equal(row.eligible, true);
      assert.ok(row.cost > 0 && Number.isInteger(row.cost));
      assert.ok(row.qualityBonus >= 3 && row.qualityBonus <= 9);
      assert.ok(row.fitLabel && row.roleLabel);
      assert.equal(row.fits, person.fits.includes(type));
      if (row.fits) matching = row.qualityBonus; else general = row.qualityBonus;
      for (let view = 0; view < 10; view++) assert.deepEqual(Industry.getCrewOptions(project).find(candidate => candidate.id === person.id), row);
      assert.deepEqual(project, before, 'crew previews do not hire, spend or change quality');
    }
    assert.ok(matching > general, person.id + ': appropriate specialty gives a meaningful extra quality benefit');
    const small = Industry.getCrewOptions({ type: 'doc', stage: 'shoot' }).find(row => row.id === person.id);
    const large = Industry.getCrewOptions({ type: 'blockbuster', stage: 'shoot' }).find(row => row.id === person.id);
    assert.ok(large.cost > small.cost * 7, 'senior production fees scale rather than staying at student prices');
  }
});

test('crew eligibility respects production phase and one person per role for ids and saved snapshots', () => {
  assert.ok(Industry.getCrewOptions(null).every(person => !person.eligible && person.reason));
  for (const stage of ['script', 'shoot', 'edit', 'release']) {
    const rows = Industry.getCrewOptions({ type: 'short', stage, crew: [] });
    assert.ok(rows.every(person => person.eligible === person.stages.includes(stage)));
  }
  for (const hired of [['camera_arbel'], [{ id: 'camera_arbel', role: 'camera' }]]) {
    const project = { type: 'doc', stage: 'shoot', crew: hired };
    const before = copy(project);
    const rows = Industry.getCrewOptions(project);
    assert.equal(rows.find(person => person.id === 'camera_arbel').alreadyHired, true);
    assert.ok(rows.filter(person => person.role === 'camera').every(person => person.disabled && person.roleOccupied));
    assert.ok(rows.filter(person => person.role === 'sound').every(person => person.eligible));
    assert.deepEqual(project, before);
  }
});

test('festival suitability, requirements, deadlines and bounded conditional prize probabilities are honest and pure', () => {
  const state = { craft: 50, reputation: 60, week: 2, maxWeeks: 20 };
  const film = { type: 'doc', stage: 'released', quality: 80, crew: [] };
  const before = copy({ state, film });
  const rows = Industry.getFestivalOptions(film, state);
  assert.deepEqual(rows.map(row => [row.id, row.fee, row.waitWeeks, row.prize]), [
    ['first_take', 80, 1, 450], ['israeli_screen', 240, 2, 1600],
    ['audience_choice', 180, 1, 1100], ['world_frame', 420, 3, 4200]
  ]);
  assert.deepEqual(rows.map(row => row.acceptanceChance), [79, 56, 57, 62]);
  assert.deepEqual(rows.map(row => row.awardChance), [25, 18, 21, 21]);
  assert.equal(rows.find(row => row.id === 'israeli_screen').eligible, false);
  assert.ok(rows.every(row => row.awardChanceConditional === true));
  const rowFor = (id, f = film, s = state) => Industry.getFestivalOptions(f, s).find(row => row.id === id);
  assert.equal(rowFor('first_take', { ...film, type: 'feature' }).eligible, false);
  assert.equal(rowFor('israeli_screen', { ...film, type: 'feature', quality: 49 }).eligible, false);
  assert.equal(rowFor('israeli_screen', { ...film, type: 'feature', quality: 50 }, { ...state, reputation: 24 }).eligible, false);
  assert.equal(rowFor('israeli_screen', { ...film, type: 'feature', quality: 50 }, { ...state, reputation: 25 }).eligible, true);
  assert.equal(rowFor('world_frame', { ...film, quality: 71 }).eligible, false);
  assert.equal(rowFor('world_frame', { ...film, quality: 72 }, { ...state, reputation: 54 }).eligible, false);
  assert.equal(rowFor('world_frame', { ...film, quality: 72 }, { ...state, reputation: 55 }).eligible, true);
  assert.equal(rowFor('audience_choice', { ...film, quality: 34 }).eligible, false);
  assert.equal(rowFor('audience_choice', { ...film, quality: 35 }).eligible, true);
  for (const row of rows) {
    assert.equal(rowFor(row.id, film, { ...state, week: state.maxWeeks - row.waitWeeks + 1 }).eligible, false, 'late submission cannot create a decision beyond the season');
    assert.equal(rowFor(row.id, { ...film, stage: 'release' }).eligible, false, 'an unreleased project cannot be submitted');
    assert.equal(rowFor(row.id, { ...film, crew: ['camera_arbel', 'editor_yael', 'sound_samir'] }).acceptanceChance, row.acceptanceChance, 'the same final quality cannot count crew bonuses twice');
  }
  for (const type of TYPES) for (const quality of [0, 35, 50, 72, 100]) {
    const sample = Industry.getFestivalOptions({ ...film, type, quality }, state);
    assert.ok(sample.every(row => row.acceptanceChance >= 5 && row.acceptanceChance <= 92 && row.awardChance >= 3 && row.awardChance <= 40));
  }
  for (let view = 0; view < 20; view++) assert.deepEqual(Industry.getFestivalOptions(film, state), rows);
  assert.deepEqual({ state, film }, before);
});

test('all six crew hires charge shown travel, cash and energy and apply a single recorded quality improvement', () => {
  for (const member of Industry.CREW) {
    const state = scene(member.role === 'editor' ? 'edit' : 'shoot');
    const row = Game.getFilmCrewOptions(state).find(person => person.id === member.id);
    assert.equal(row.disabled, false);
    assert.equal(row.actionCost.time, 3, 'two hours of hiring plus travel from another location');
    assert.equal(row.actionCost.energy, 3);
    const before = copy(state);
    const restored = Game.validateSave(copy(state));
    assert.ok(restored);
    Base.perform(state, row.actionId); Base.perform(restored, row.actionId);
    assert.deepEqual(state, restored, 'restoring before hiring gives the same exact expense and improvement');
    assert.equal(state.cash, before.cash - row.cost);
    assert.equal(state.hours, before.hours - row.actionCost.time);
    assert.equal(state.energy, before.energy - row.actionCost.energy);
    assert.equal(state.project.quality, before.project.quality + row.appliedQuality);
    assert.equal(state.project.budget, before.project.budget + row.crewCost);
    assert.equal(state.weeklyTotals.expenses, before.weeklyTotals.expenses + row.cost);
    assert.equal(state.weeklyTotals.income, before.weeklyTotals.income);
    assert.equal(state.project.stage, before.project.stage);
    assert.equal(state.rng, before.rng, 'hiring is a disclosed fixed improvement, not a surprise draw');
    assert.equal(state.productionAlert, null);
    const hired = state.project.crew.at(-1);
    assert.equal(hired.id, member.id);
    assert.equal(hired.cost, row.crewCost);
    assert.equal(hired.appliedQuality, row.appliedQuality);
    assert.equal(hired.fits, row.fits);
    assert.equal(hired.hiredWeek, state.week);
    for (const colleague of Game.getFilmCrewOptions(state).filter(person => person.role === member.role)) {
      Base.deny(state, () => Game.act(state, colleague.actionId), 'neither the same person nor a second person can fill this role');
    }
    assertSave(state);
  }
});

test('crew specialties improve the finished film and forecast without a second hidden bonus at release', () => {
  const source = scene('shoot', 43);
  const matched = copy(source), general = copy(source);
  Base.perform(matched, 'set.crew_camera_arbel');
  Base.perform(general, 'set.crew_camera_maayan');
  assert.equal(matched.project.quality - general.project.quality, 4);
  for (const state of [matched, general]) {
    Base.perform(state, 'set.crew_sound_samir');
    completeBoundaryStage(state, 'set.shoot_lean'); resolve(state);
    state.hours = 32; state.energy = 80; // Time boundary isolates quality, not career pacing.
    Base.perform(state, 'studio.crew_editor_yael');
    completeBoundaryStage(state, 'studio.edit');
  }
  assert.ok(matched.project.quality > general.project.quality);
  const quality = matched.project.quality;
  assert.ok(Game.getReleaseForecast(matched, false).successRevenue > Game.getReleaseForecast(general, false).successRevenue);
  const preview = Industry.getFestivalOptions({ ...matched.project, stage: 'released' }, matched)[0];
  const generalPreview = Industry.getFestivalOptions({ ...general.project, stage: 'released' }, general)[0];
  assert.ok(preview.acceptanceChance > generalPreview.acceptanceChance);
  const crew = copy(matched.project.crew);
  Base.perform(matched, 'studio.release_commercial');
  assert.equal(matched.films[0].quality, quality, 'release does not reapply crew quality');
  assert.deepEqual(matched.films[0].crew, crew);
  assert.equal(new Set(crew.map(person => person.role)).size, 3);
  assertSave(matched);
});

test('hiring cannot bypass phase, event or resource limits and a full-quality film cannot waste money on an unused bonus', () => {
  const noFilm = Game.createGame({ seed: 7 });
  for (const person of Game.getFilmCrewOptions(noFilm)) Base.deny(noFilm, () => Game.act(noFilm, person.actionId), 'crew needs a project');
  const state = scene('shoot');
  const row = Game.getFilmCrewOptions(state).find(person => person.id === 'camera_arbel');
  for (const [key, value] of [['cash', row.cost - 1], ['hours', row.actionCost.time - 1], ['energy', 2]]) {
    const invalid = copy(state); invalid[key] = value;
    Base.deny(invalid, () => Game.act(invalid, row.actionId), 'crew requires enough ' + key);
  }
  const capped = copy(state); capped.project.quality = 99;
  assert.equal(Game.getFilmCrewOptions(capped).find(person => person.id === row.id).appliedQuality, 1);
  Base.perform(capped, row.actionId);
  assert.equal(capped.project.quality, 100);
  for (const person of Game.getFilmCrewOptions(capped)) assert.equal(person.disabled, true);
  assertSave(capped);
  const waiting = scene('shoot');
  completeBoundaryStage(waiting, 'set.shoot_lean');
  Base.acknowledgeSetback(waiting);
  assert.equal(waiting.event.kind, 'production');
  for (const person of Game.getFilmCrewOptions(waiting)) Base.deny(waiting, () => Game.act(waiting, person.actionId), 'the creative dilemma must resolve before hiring');
  resolve(waiting);
  Base.deny(waiting, () => Game.act(waiting, 'set.crew_camera_arbel'), 'camera hiring is closed after filming');
});

test('real production funding covers full and partial crew invoices and never turns into cash or a duplicate quality award', () => {
  const state = Expansion.findDecision('production', 'approved').state;
  resolve(state);
  state.hours = 32; state.energy = 100;
  assert.equal(state.project.grantBudget, 900);
  const first = Game.getFilmCrewOptions(state).find(person => person.id === 'camera_maayan');
  const before = copy(state);
  assert.equal(first.cost, 0); assert.equal(first.fundingUsed, 150);
  Base.perform(state, first.actionId);
  Base.perform(state, 'set.crew_sound_rotem');
  assert.equal(state.cash, before.cash);
  assert.equal(state.project.grantBudget, 620);
  let shot;
  for (let sample = 1; sample <= 100 && !shot; sample++) {
    const trial = copy(state); trial.rng = Math.imul(sample, 2654435761) >>> 0;
    const result = Game.act(trial, 'set.shoot_lean');
    assert.equal(result.ok, true);
    if (!result.setback) shot = trial;
  }
  assert.ok(shot);
  Base.acknowledgeSetback(shot);
  assert.equal(Game.chooseEvent(shot, 0).ok, true);
  assert.ok(shot.project.grantBudget > 0 && shot.project.grantBudget < 110, 'actual photography and rescue leave a partial editor payment');
  shot.hours = 32; shot.energy = 80;
  const editor = Game.getFilmCrewOptions(shot).find(person => person.id === 'editor_yael');
  const availableGrant = shot.project.grantBudget;
  const previous = copy(shot);
  assert.equal(editor.fundingUsed, availableGrant);
  assert.equal(editor.cost, 110 - availableGrant);
  Base.perform(shot, editor.actionId);
  assert.equal(shot.cash, previous.cash - editor.cost);
  assert.equal(shot.project.grantBudget, 0);
  assert.equal(shot.project.budget, previous.project.budget + 110);
  assert.equal(shot.weeklyTotals.expenses, previous.weeklyTotals.expenses + editor.cost);
  assert.equal(shot.weeklyTotals.income, previous.weeklyTotals.income);
  assert.equal(shot.project.crew.at(-1).cost, 110, 'the credit records the full professional invoice');
  assertSave(shot);
});

test('old saves migrate crew and festival records without creating hires, submissions, awards or resource changes', () => {
  for (const name of ['film-v1-save.json', 'film-v2-active-save.json', 'film-v2-won-save.json', 'v3-career-browser.json']) {
    const raw = fixture(name), original = copy(raw);
    assert.equal(raw.festivalCircuit, undefined);
    const state = Game.validateSave(raw);
    assert.ok(state, name);
    assert.deepEqual(raw, original);
    for (const key of ['cash', 'debt', 'hours', 'energy', 'week', 'rng', 'status']) assert.deepEqual(state[key], key==='hours'?raw.hours+18:raw[key]);
    assert.deepEqual(state.festivalCircuit.pending, []);
    assert.deepEqual(state.festivalCircuit.history, []);
    for (const film of state.films) { assert.deepEqual(film.crew, []); assert.deepEqual(film.festivalEntries, []); assert.deepEqual(film.awards, []); }
    if (state.project) assert.deepEqual(state.project.crew, []);
    assertSave(state);
  }
});

test('submissions charge their stated fee, allow distinct festivals in parallel and freeze each entry odds', () => {
  const state = archiveBoundary(43);
  state.assets = state.assets.filter(asset => asset !== 'bike'); state.location = 'home';
  const row = option(state, 'world_frame', state.films[0].id);
  assert.equal(row.disabled, false);
  assert.equal(row.cost.time, 3); assert.equal(row.cost.energy, 4); assert.equal(row.cost.money, 420);
  const before = copy(state);
  for (let view = 0; view < 20; view++) {
    Game.getFestivalSubmissions(state); Game.getFilmCrewOptions(state); Base.actions(state);
  }
  assert.deepEqual(state, before, 'inspection cannot roll, submit or pay');
  Base.perform(state, row.actionId);
  assert.equal(state.cash, before.cash - row.fee);
  assert.equal(state.hours, before.hours - row.cost.time);
  assert.equal(state.energy, before.energy - row.cost.energy);
  assert.equal(state.weeklyTotals.expenses, before.weeklyTotals.expenses + row.fee);
  assert.equal(state.weeklyTotals.income, before.weeklyTotals.income);
  assert.equal(state.films[0].budget, before.films[0].budget, 'festival fees are an additional personal expense, not a retroactive production cost');
  assert.deepEqual(state.project, before.project, 'an unrelated active production and its grant stay unchanged');
  const entry = copy(state.festivalCircuit.pending[0]);
  assert.equal(entry.acceptanceChance, row.acceptanceChance);
  assert.equal(entry.awardChance, row.awardChance);
  assert.equal(entry.dueWeek, state.week + 3);
  assert.equal(state.festivalCircuit.rng, before.festivalCircuit.rng, 'the decision is not drawn at submission');
  assert.deepEqual(state.films[0].festivalEntries, [entry.id]);
  Base.deny(state, () => Game.act(state, row.actionId), 'the same film/festival pair cannot be submitted twice');
  const parallel = option(state, 'first_take', row.filmId);
  assert.equal(parallel.disabled, false, 'a different festival may evaluate the same film concurrently');
  const beforeParallel = state.cash;
  Base.perform(state, parallel.actionId);
  assert.equal(state.cash, beforeParallel - parallel.fee, 'the parallel entry has its own disclosed fee');
  assert.deepEqual(state.festivalCircuit.pending[0], entry, 'the second entry does not rewrite the first odds or deadline');
  assert.equal(state.festivalCircuit.pending.length, 2);
  const anotherFilm = Game.getFestivalSubmissions(state).find(candidate => candidate.filmId !== row.filmId && !candidate.disabled);
  assert.ok(anotherFilm, 'another released film can still be submitted');
  Base.perform(state, 'cafe.network');
  assert.deepEqual(state.festivalCircuit.pending[0], entry, 'later reputation and contacts cannot rewrite submitted odds');
  const restored = Game.validateSave(copy(state));
  assert.ok(restored);
  for (let wait = 0; wait < 2; wait++) {
    for (const trial of [state, restored]) { resolve(trial); assert.equal(Game.endWeek(trial).ok, true); }
    assert.deepEqual(state, restored);
    assert.deepEqual(state.festivalCircuit.pending[0], entry);
    assert.equal(state.festivalCircuit.history.length, 1, 'only the separate one-week festival has decided');
    assert.equal(state.festivalCircuit.history[0].id, parallel.id);
    assert.equal(state.festivalCircuit.history[0].resolvedWeek, parallel.dueWeek);
    assert.ok(!state.festivalCircuit.history.some(result => result.id === entry.id), 'the three-week festival still waits for its own deadline');
  }
  finishSubmission(state, entry.id); finishSubmission(restored, entry.id);
  assert.deepEqual(state, restored, 'reload resumes the same submitted decision and intervening world state');
});

test('every festival produces genuine rejection, selection and prize outcomes with exactly reconciled finances', () => {
  for (const festival of Industry.FESTIVALS) for (const outcome of ['rejected', 'selected', 'award']) {
    const { state, beforeClose, result, pending, row } = festivalDecision(festival.id, outcome);
    assert.equal(result.outcome, outcome);
    assert.equal(result.resolvedWeek, row.dueWeek);
    assert.equal(result.week, row.dueWeek);
    const prize = outcome === 'award' ? festival.prize : 0;
    assert.equal(result.cash, prize, 'selection alone does not pay the cash prize');
    const rep = outcome === 'award' ? festival.awardReputation : outcome === 'selected' ? festival.acceptanceReputation : 0;
    assert.equal(result.reputation, Math.min(rep, 100 - beforeClose.reputation));
    const royalties = Game.getLife(beforeClose).currentRoyalties;
    const rent = beforeClose.assets.reduce((total, id) => total + (Game.ASSETS[id].rent || 0), 0);
    const living = Game.DIFFICULTIES[state.difficulty].living;
    const interest = Math.ceil(beforeClose.debt * Game.DIFFICULTIES[state.difficulty].interest);
    assert.equal(state.cash, beforeClose.cash + royalties + rent - living + prize);
    assert.equal(state.debt, beforeClose.debt + interest);
    assert.equal(state.weeklySummary.income, beforeClose.weeklyTotals.income + royalties + rent + prize);
    assert.equal(state.weeklySummary.expenses, beforeClose.weeklyTotals.expenses + living + interest);
    assert.equal(state.weeklySummary.net, state.weeklySummary.income - state.weeklySummary.expenses);
    assert.equal(state.weeklyTotals.income, 0, 'the incoming decision is recorded in the just-delivered summary, not counted again next week');
    assert.deepEqual(state.weeklySummary.festivalResults, [result]);
    assert.equal(state.festivalCircuit.pending.length, 0);
    const film = state.films.find(film => film.id === result.filmId);
    assert.equal(film.awards.length, outcome === 'award' ? 1 : 0);
    if (outcome === 'award') { assert.equal(film.awards[0].entryId, result.id); assert.equal(film.awards[0].prize, prize); }
    assert.equal(film.quality, pending.films.find(candidate => candidate.id === film.id).quality);
    assertSave(state);
    const loaded = Game.validateSave(copy(state));
    Base.deny(loaded, () => Game.act(loaded, row.actionId), 'a resolved submission cannot be resubmitted after reload');
    resolve(loaded);
    const nextBefore = copy(loaded);
    assert.equal(Game.endWeek(loaded).ok, true);
    assert.equal(loaded.weeklySummary.income, nextBefore.weeklyTotals.income + Game.getLife(nextBefore).currentRoyalties + rent, 'an award cannot be paid or reported as new income a second week');
    assert.deepEqual(loaded.festivalCircuit.history, state.festivalCircuit.history);
    assert.deepEqual(loaded.films.find(film => film.id === result.filmId).awards, film.awards);
  }
});

test('festival submissions enforce resource, genre, quality, season and duplicate limits atomically', () => {
  const state = archiveBoundary(43);
  const row = option(state, 'world_frame', state.films[0].id);
  for (const [key, value] of [['cash', row.cost.money - 1], ['hours', row.cost.time - 1], ['energy', row.cost.energy - 1]]) {
    const trial = copy(state); trial[key] = value;
    Base.deny(trial, () => Game.act(trial, row.actionId), 'submission needs enough ' + key);
  }
  const poorFilm = copy(state); poorFilm.films[0].quality = 71;
  Base.deny(poorFilm, () => Game.act(poorFilm, row.actionId), 'the international quality threshold cannot be bypassed');
  const tooLate = copy(state); tooLate.maxWeeks = state.week + 2;
  Base.deny(tooLate, () => Game.act(tooLate, row.actionId), 'a result beyond this season cannot be purchased');
  const first = state.films[0].id;
  Base.deny(state, () => Game.act(state, option(state, 'israeli_screen', first).actionId), 'a documentary cannot enter the feature-only competition');
  const fresh = scene('release');
  assert.deepEqual(Game.getFestivalSubmissions(fresh), [], 'a ready but unreleased project has no submission action');
  for (const festivalId of ['first_take', 'audience_choice', 'world_frame']) {
    resolve(state);
    const candidate = option(state, festivalId, first);
    assert.equal(candidate.disabled, false);
    Base.perform(state, candidate.actionId);
    finishSubmission(state, candidate.id);
  }
  resolve(state);
  assert.equal(state.films[0].festivalEntries.length, 3);
  assert.ok(Game.getFestivalSubmissions(state).filter(candidate => candidate.filmId === first).every(candidate => candidate.disabled));
  assert.ok(option(state, 'israeli_screen', first).reason.includes('שלוש'), 'the archive enforces its explicit lifetime submission cap');
  assertSave(state);
});

test('festival randomness is independent of player draws and a due prize survives both ways of winning a season', () => {
  const pending = festivalDecision('first_take', 'award').pending;
  const a = copy(pending), b = copy(pending);
  Base.perform(a, 'studio.release_commercial'); // The large-film forecast consumes player randomness.
  Base.perform(b, 'home.rest');
  assert.notEqual(a.rng, b.rng);
  assert.equal(Game.endWeek(a).ok, true); assert.equal(Game.endWeek(b).ok, true);
  const actual = state => state.festivalCircuit.history.map(entry => ({ id: entry.id, outcome: entry.outcome, cash: entry.cash }));
  assert.deepEqual(actual(a), actual(b), 'different player draws cannot reroll a submitted festival decision');
  assert.equal(a.festivalCircuit.rng, b.festivalCircuit.rng);

  const beforeWin = copy(pending);
  const targets = Object.fromEntries(Game.goals(beforeWin).map(goal => [goal.id, goal.target]));
  beforeWin.cash = targets.wealth + beforeWin.debt + 1000;
  beforeWin.reputation = beforeWin.craft = beforeWin.happiness = 100; // Explicit victory boundary.
  Base.perform(beforeWin, 'home.rest');
  assert.equal(beforeWin.status, 'won');
  assert.equal(beforeWin.festivalCircuit.pending.length, 1, 'an action-based win preserves its paid pending submission');
  assertSave(beforeWin);
  const circuit = copy(beforeWin.festivalCircuit);
  assert.equal(Game.continueCareer(beforeWin).ok, true);
  assert.deepEqual(beforeWin.festivalCircuit, circuit, 'same-week continuation neither withdraws nor resolves early');
  assert.equal(Game.endWeek(beforeWin).ok, true);
  assert.equal(beforeWin.festivalCircuit.history[0].outcome, 'award');
  assertSave(beforeWin);

  const onDecision = copy(pending);
  onDecision.reputation = onDecision.craft = onDecision.happiness = 100;
  const config = Game.DIFFICULTIES[onDecision.difficulty];
  const royalties = onDecision.films.reduce((sum, film) => sum + film.royalty, 0);
  const prize = onDecision.festivalCircuit.pending[0].prize;
  onDecision.cash = targets.wealth + onDecision.debt + Math.ceil(onDecision.debt * config.interest) - royalties + config.living - Math.floor(prize / 2);
  assert.equal(Game.endWeek(onDecision).ok, true);
  assert.equal(onDecision.status, 'won', 'a prize delivered on this transition can complete the wealth target');
  assert.equal(onDecision.festivalCircuit.pending.length, 0);
  assert.equal(onDecision.festivalCircuit.history[0].cash, prize);
  assertSave(onDecision);
  const afterWin = copy(onDecision.festivalCircuit);
  const cash = onDecision.cash;
  assert.equal(Game.continueCareer(onDecision).ok, true);
  assert.equal(onDecision.cash, cash);
  assert.deepEqual(onDecision.festivalCircuit, afterWin, 'continuing after the prize-based win cannot deliver it twice');
  assertSave(onDecision);
});

test('forged crew, festival odds, duplicate histories and invented prizes are rejected as malformed saves', () => {
  const crew = scene('shoot'); Base.perform(crew, 'set.crew_camera_arbel');
  const pending = festivalDecision('world_frame', 'selected').pending;
  const awarded = festivalDecision('first_take', 'award').state;
  const cases = [];
  const corrupt = (source, edit) => { const state = copy(source); edit(state); cases.push(state); };
  corrupt(crew, state => { state.project.crew[0].qualityBonus++; });
  corrupt(crew, state => { state.project.crew[0].cost++; });
  corrupt(crew, state => { state.project.crew.push(copy(state.project.crew[0])); });
  corrupt(crew, state => { delete state.project.crew; });
  corrupt(pending, state => { state.festivalCircuit.pending[0].acceptanceChance++; });
  corrupt(pending, state => { state.festivalCircuit.pending[0].awardChance++; });
  corrupt(pending, state => { state.festivalCircuit.pending[0].dueWeek++; });
  corrupt(pending, state => { state.festivalCircuit.pending[0].prize++; });
  corrupt(pending, state => { state.festivalCircuit.pending.push(copy(state.festivalCircuit.pending[0])); });
  corrupt(pending, state => { state.festivalCircuit.rng = 0; });
  corrupt(awarded, state => { state.festivalCircuit.history[0].cash++; });
  corrupt(awarded, state => { const film = state.films.find(film => film.awards.length); film.awards.push(copy(film.awards[0])); });
  corrupt(awarded, state => { const film = state.films.find(film => film.awards.length); film.awards[0].prize++; });
  corrupt(awarded, state => { delete state.festivalCircuit; });
  for (const state of cases) assert.equal(Game.validateSave(state), null, 'partial modern corruption must not trigger the old-save migration');
});

function runWithIndustry(difficulty, seed) {
  const state = Game.createGame({ difficulty, seed });
  const trace = [];
  for (let turn = 0; turn < 800 && state.status === 'playing'; turn++) {
    resolve(state);
    if (state.status !== 'playing') break;
    const menu = Base.actions(state), can = id => menu.some(row => row.id === id && !row.disabled);
    let id = Base.chooseBalancedAction(state);
    const filmAction = ['set.shoot_lean', 'set.shoot_full', 'studio.edit', 'studio.edit_polish'].includes(id);
    if (filmAction && state.project.quality < 100) {
      const person = Game.getFilmCrewOptions(state).find(person => person.fits && person.stages.includes(state.project.stage) && !person.alreadyHired && !person.roleOccupied);
      if (person) {
        const stageCost = menu.find(row => row.id === id).cost.money;
        const reserve = person.cost + stageCost + Game.DIFFICULTIES[difficulty].living;
        if (!person.disabled && state.cash >= reserve) id = person.actionId;
        else if (state.cash < reserve && can('set.work')) id = 'set.work';
        else if (state.energy < person.actionCost.energy && can('home.rest')) id = 'home.rest';
        else id = undefined;
      }
    }
    if (!state.festivalCircuit.pending.length && !state.festivalCircuit.history.length && state.films.length) {
      const festival = Game.getFestivalSubmissions(state).find(row => row.festivalId === 'first_take' && !row.disabled);
      if (festival && state.cash >= festival.fee + Game.DIFFICULTIES[difficulty].living) id = festival.actionId;
    }
    if (id) { trace.push({ week: state.week, id }); Base.perform(state, id); }
    else { trace.push({ week: state.week, id: 'endWeek' }); assert.equal(Game.endWeek(state).ok, true); }
    assertSave(state);
  }
  return { state, trace };
}

test('real-action play can hire a complete suitable crew, receive a festival decision and still win every mode', () => {
  const rows = [];
  for (const difficulty of ['calm', 'normal', 'hard']) for (const seed of [7, 43, 263]) {
    const { state, trace } = runWithIndustry(difficulty, seed);
    const crew = state.films[0]?.crew || [];
    rows.push({ difficulty, seed, status: state.status, week: state.week, crew: crew.length, result: state.festivalCircuit.history[0]?.outcome || 'pending' });
    assert.equal(state.status, 'won', `${difficulty}/${seed}: last actions ${JSON.stringify(trace.slice(-12))}`);
    assert.equal(new Set(crew.map(person => person.role)).size, 3);
    assert.ok(crew.every(person => person.fits));
    assert.equal(state.festivalCircuit.history.length, 1);
  }
  console.table(rows);
});

function runTests() {
  let failures = 0;
  for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failures++; console.error(`✗ ${name}\n  ${error.stack}`); }
  }
  console.log(`\n${tests.length - failures}/${tests.length} industry checks passed.`);
  if (failures) process.exitCode = 1;
}
if (require.main === module) runTests();
module.exports = { runWithIndustry };
