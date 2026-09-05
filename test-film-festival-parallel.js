/* Parallel festival entries: real action/settlement paths over an earned archive.
 * Resource and retirement boundaries are explicit fixture edits, not playthroughs.
 * Run: node test-film-festival-parallel.js
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Game = require('./game-engine.js');
const Industry = require('./film-industry.js');
const copy = value => JSON.parse(JSON.stringify(value));
const tests = [];
const test = (name, run) => tests.push({ name, run });
function state() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'tests/fixtures/v4-lifetime-world.json'), 'utf8'));
  const s = Game.validateSave(raw);
  assert.ok(s, 'the existing earned v4 archive still imports');
  s.cash = 30000; s.hours = s.maxHours; s.energy = 100; s.happiness = 60;
  s.weeklyTotals = { income: 0, expenses: 0 };
  return s;
}
function assertSave(s) { assert.deepEqual(Game.validateSave(s), s, 'parallel entries round trip without migration or probability changes'); }
function row(s, filmId, festivalId) { return Game.getFestivalSubmissions(s).find(o => o.filmId === filmId && o.festivalId === festivalId); }
function submit(s, filmId, festivalId) {
  const option = row(s, filmId, festivalId), before = copy(s);
  assert.ok(option && !option.disabled, option && option.reason);
  assert.equal(Game.act(s, option.actionId).ok, true);
  assert.equal(before.cash - s.cash, option.fee, 'each entry charges its own disclosed fee exactly once');
  assert.equal(before.hours - s.hours, option.cost.time);
  assert.equal(s.festivalCircuit.pending.length, before.festivalCircuit.pending.length + 1);
  assert.equal(s.festivalCircuit.rng, before.festivalCircuit.rng, 'submission stores odds without rolling outcomes');
  assertSave(s);
  return option;
}
function clearEvent(s) {
  if (s.productionAlert) assert.equal(Game.acknowledgeProductionEvent(s).ok, true);
  if (s.event) {
    const index = s.event.options.findIndex(o => !o.disabled && (!o.effects.cash || o.effects.cash >= 0));
    assert.equal(Game.chooseEvent(s, index < 0 ? s.event.options.findIndex(o => !o.disabled) : index).ok, true);
  }
}
function step(s) {
  clearEvent(s);
  if (['won', 'lost'].includes(s.status)) assert.equal(Game.continueCareer(s).ok, true);
  const beforeCash = s.cash, royalties = Game.getLife(s).currentRoyalties;
  const rent = s.assets.reduce((sum, id) => sum + (Game.ASSETS[id].rent || 0), 0);
  const living = Math.round(Game.DIFFICULTIES[s.difficulty].living * Game.getLife(s).city.livingMultiplier);
  assert.equal(Game.endWeek(s).ok, true);
  const payouts = s.weeklySummary.festivalResults.reduce((sum, e) => sum + e.cash, 0);
  assert.equal(s.cash, beforeCash + royalties + rent - living + payouts, 'simultaneous prizes/refunds are all paid exactly once');
  assertSave(s);
}
function sixEntries() {
  const s = state();
  for (const festival of ['first_take', 'audience_choice', 'world_frame']) submit(s, 2, festival);
  for (const festival of ['israeli_screen', 'audience_choice', 'world_frame']) submit(s, 3, festival);
  return s;
}

test('pure planning permits several festivals per film and several films per festival', () => {
  const s = state(), film = s.films.find(f => f.id === 2);
  s.festivalCircuit.pending.push({ id: '2-first_take', filmId: 2, festivalId: 'first_take' });
  film.festivalEntries.push('2-first_take');
  const before = copy(s);
  const options = Industry.getFestivalSubmissionOptions(s.films, Object.assign({}, s, { retirementRounds: 20 }));
  assert.ok(options.find(o => o.id === '2-first_take').disabled);
  assert.equal(options.find(o => o.id === '2-audience_choice').disabled, false);
  assert.equal(options.find(o => o.id === '3-audience_choice').disabled, false);
  assert.equal(options.find(o => o.id === '2-world_frame').disabled, false);
  assert.deepEqual(s, before, 'rendering the catalog neither mutates entries nor consumes RNG');
  for (const option of options) {
    const original = Industry.getFestivalOptions(s.films.find(f => f.id === option.filmId), s).find(f => f.id === option.festivalId);
    for (const key of ['fee', 'dueWeek', 'acceptanceChance', 'awardChance', 'prize']) assert.equal(option[key], original[key]);
  }
});

test('three lifetime entries per film remain distinct from the global twelve-pending cap', () => {
  const s = state(), film = s.films.find(f => f.id === 2);
  film.festivalEntries = ['2-first_take', '2-audience_choice', '2-world_frame'];
  let options = Industry.getFestivalSubmissionOptions(s.films, s);
  assert.ok(options.filter(o => o.filmId === 2).every(o => o.disabled));
  assert.ok(options.find(o => o.id === '2-israeli_screen').reason.includes('שלוש'));
  s.festivalCircuit.pending = Array.from({ length: 12 }, (_, n) => ({ id: (100 + n) + '-world_frame', filmId: 100 + n, festivalId: 'world_frame' }));
  options = Industry.getFestivalSubmissionOptions(s.films, s);
  assert.ok(options.find(o => o.id === '3-audience_choice').reason.includes('12'));
  s.festivalCircuit.pending.pop();
  options = Industry.getFestivalSubmissionOptions(s.films, s);
  assert.equal(options.find(o => o.id === '3-audience_choice').disabled, false);
});

test('release, genre, quality, chapter and retirement eligibility still apply to every entry', () => {
  const s = state();
  const options = input => Industry.getFestivalSubmissionOptions(s.films, Object.assign({}, s, input));
  assert.ok(options({}).find(o => o.id === '1-israeli_screen').disabled, 'documentaries cannot enter the feature contest');
  assert.ok(options({}).find(o => o.id === '1-world_frame').disabled, 'the low-quality documentary misses the international threshold');
  assert.ok(options({ maxWeeks: s.week + 1 }).find(o => o.id === '3-israeli_screen').disabled);
  assert.ok(options({ retirementRounds: 1 }).find(o => o.id === '2-world_frame').disabled);
  const unreleased = Object.assign({}, s.films[1], { stage: 'release' });
  assert.ok(Industry.getFestivalSubmissionOptions([unreleased], s).every(o => o.disabled));
});

test('six actual parallel entries retain immutable odds and reject duplicate pair charging', () => {
  const s = sixEntries(), frozen = copy(s.festivalCircuit.pending);
  assert.equal(s.festivalCircuit.pending.length, 6);
  assert.equal(new Set(s.festivalCircuit.pending.map(e => e.filmId)).size, 2);
  assert.equal(s.festivalCircuit.pending.filter(e => e.festivalId === 'audience_choice').length, 2);
  const before = copy(s);
  assert.equal(Game.act(s, row(s, 2, 'audience_choice').actionId).ok, false);
  assert.deepEqual(s, before, 'a duplicate is rejected atomically');
  s.reputation = 60;
  for (let view = 0; view < 3; view++) Game.getFestivalSubmissions(s);
  assert.deepEqual(s.festivalCircuit.pending, frozen, 'later reputation and previews cannot rewrite submission snapshots');
  assertSave(s);
});

test('one-, two- and three-period results settle each entry independently without losing siblings', () => {
  const s = sixEntries(), startWeek = s.week;
  const snapshots = copy(s.festivalCircuit.pending);
  for (const [wait, count, remaining] of [[1, 3, 3], [2, 1, 2], [3, 2, 0]]) {
    step(s);
    assert.equal(s.week, startWeek + wait);
    assert.equal(s.weeklySummary.festivalResults.length, count);
    assert.equal(s.festivalCircuit.pending.length, remaining);
    assert.ok(s.weeklySummary.festivalResults.every(e => e.dueWeek === s.week && e.resolvedWeek === s.week));
  }
  assert.equal(s.festivalCircuit.history.length, 6);
  for (const original of snapshots) {
    const result = s.festivalCircuit.history.find(e => e.id === original.id);
    for (const key of Object.keys(original)) assert.deepEqual(result[key], original[key], 'the settled record retains ' + key);
  }
  const closed = copy(s.festivalCircuit.history);
  step(s);
  assert.equal(s.weeklySummary.festivalResults.length, 0);
  assert.deepEqual(s.festivalCircuit.history, closed, 'a later period cannot settle or pay an entry twice');
});

test('new submissions stop at twelve pending and reopen as independently due decisions arrive', () => {
  const s = state();
  for (const [film, festivals] of [[1, ['first_take', 'audience_choice']], [2, ['first_take', 'audience_choice', 'world_frame']], [3, ['israeli_screen', 'audience_choice', 'world_frame']], [4, ['israeli_screen', 'audience_choice', 'world_frame']], [5, ['world_frame']]]) {
    for (const festival of festivals) submit(s, film, festival);
  }
  assert.equal(s.festivalCircuit.pending.length, 12);
  const denied = row(s, 6, 'audience_choice'), before = copy(s);
  assert.ok(denied.disabled && denied.reason.includes('12'));
  assert.equal(Game.act(s, denied.actionId).ok, false);
  assert.deepEqual(s, before);
  step(s); clearEvent(s);
  assert.ok(s.festivalCircuit.pending.length < 12);
  submit(s, 6, 'audience_choice');
});

test('the existing single-entry shape still loads, while forged odds and duplicate pair records do not', () => {
  const s = state(); submit(s, 2, 'first_take'); assertSave(s);
  for (const mutate of [
    trial => trial.festivalCircuit.pending.push(copy(trial.festivalCircuit.pending[0])),
    trial => trial.festivalCircuit.pending[0].acceptanceChance++,
    trial => trial.festivalCircuit.pending[0].dueWeek++,
    trial => trial.films.find(f => f.id === 2).festivalEntries.push('2-first_take')
  ]) {
    const corrupt = copy(s); mutate(corrupt);
    assert.equal(Game.validateSave(corrupt), null);
  }
});

test('mandatory retirement resolves due siblings and refunds later siblings once without invented awards', () => {
  const s = sixEntries();
  s.life.quarters = (85 - 23) * 4 - 1;
  s.life.market.quarter = s.life.quarters;
  assertSave(s);
  step(s);
  assert.equal(s.status, 'retired');
  assert.equal(s.festivalCircuit.pending.length, 0);
  const withdrawn = s.festivalCircuit.history.filter(e => e.outcome === 'withdrawn');
  assert.equal(withdrawn.length, 3);
  assert.ok(withdrawn.every(e => e.cash === e.fee && e.reputation === 0 && e.resolvedWeek < e.dueWeek));
  assert.ok(withdrawn.every(e => !s.films.find(f => f.id === e.filmId).awards.some(a => a.entryId === e.id)));
  const before = copy(s);
  assert.equal(Game.retireCareer(s).ok, false);
  assert.deepEqual(s, before, 'retirement cannot refund an entry again');
});

function run() {
  for (const t of tests) { t.run(); console.log('PASS ' + t.name); }
  console.log(tests.length + ' parallel-festival test groups passed.');
}
if (require.main === module) run();
module.exports = { run };
