/* Real-action regression and balance checks for the FilmGame engine.
 * Run: node test-film-game.js
 * Boundary fixtures edit state deliberately; complete playthroughs never do.
 */
"use strict";

const assert = require("node:assert/strict");
const Game = require("./game-engine.js");
const LOCATIONS = ["home", "set", "school", "cafe", "studio", "festival", "gear", "bank"];
const clone = value => JSON.parse(JSON.stringify(value));
const SEEDS = [7, 19, 43, 101, 263, 991];
const tests = [];
const test = (name, run) => tests.push({ name, run });

function invariant(state) {
  for (const key of ["hours", "cash", "debt", "energy", "happiness", "craft", "reputation", "contacts", "week"]) {
    assert.equal(typeof state[key], "number", `${key} is numeric`);
    assert.ok(Number.isFinite(state[key]), `${key} is finite`);
    assert.ok(state[key] >= 0, `${key} underflow: ${state[key]}`);
  }
  assert.ok(["playing", "won", "lost", "retired"].includes(state.status), `valid status: ${state.status}`);
  assert.ok(LOCATIONS.includes(state.location), `valid location: ${state.location}`);
  assert.ok(Array.isArray(state.films), "film archive is an array");
  for (const film of state.films) assert.equal(film.stage, "released", "archive contains released films only");
}

function actions(state) {
  const before = clone(state);
  const result = LOCATIONS.flatMap(location => Game.getActions(state, location));
  assert.deepEqual(state, before, "rendering action menus does not mutate state or RNG");
  return result;
}

function available(state, id) {
  return actions(state).find(action => action.id === id && !action.disabled);
}

function deny(state, invoke, label) {
  const before = clone(state);
  const result = invoke();
  assert.equal(result.ok, false, `${label} is denied`);
  assert.deepEqual(state, before, `${label} is atomic`);
}

function perform(state, id) {
  const option = available(state, id);
  assert.ok(option, `${id} is available in week ${state.week}`);
  const result = Game.act(state, id);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  invariant(state);
  // Acknowledging a persisted cost notice is a UI step, not another gameplay
  // decision. Focused setback tests call Game.act directly to inspect the notice.
  acknowledgeSetback(state);
  return result;
}

function acknowledgeSetback(state) {
  if (!state.productionAlert) return;
  assert.equal(Game.acknowledgeSetback(state).ok, true, 'acknowledge the already-charged production expense');
}

function settleEvent(state) {
  acknowledgeSetback(state);
  if (!state.event) return;
  const choices = state.event.options;
  assert.ok(Array.isArray(choices) && choices.length > 0, "pending event has choices");
  const index = choices.findIndex(option => !option.disabled);
  const result = Game.chooseEvent(state, index);
  assert.equal(result.ok, true, `resolve event: ${result.message}`);
  invariant(state);
}

function nextWeek(state) {
  settleEvent(state);
  if (state.status !== "playing") return;
  const result = Game.endWeek(state);
  assert.equal(result.ok, true, `week advances: ${result.message}`);
  invariant(state);
  settleEvent(state);
}

test("new games have consistent defaults and serializable state", () => {
  for (const difficulty of ["calm", "normal", "hard"]) {
    const state = Game.createGame({ name: "בודק הסרטים", difficulty, seed: 19 });
    invariant(state);
    assert.equal(state.status, "playing");
    assert.equal(state.difficulty, difficulty);
    assert.deepEqual(Game.validateSave(clone(state)), state, "save round trip preserves game");
    assert.deepEqual(Game.validateSave(JSON.stringify(state)), state, "localStorage JSON can be loaded directly");
    const menu = actions(state);
    assert.ok(menu.length >= 20, "meaningful actions exist across the town");
    assert.equal(new Set(menu.map(a => a.id)).size, menu.length, "action IDs are unique");
    for (const action of menu) {
      assert.equal(typeof action.title, "string");
      assert.equal(typeof action.description, "string");
      assert.ok(Array.isArray(action.effects));
      for (const key of ["time", "money", "energy"]) {
        assert.ok(Number.isFinite(action.cost[key]), `${action.id} has finite ${key} cost`);
        assert.ok(action.cost[key] >= 0, `${action.id} has nonnegative ${key} cost`);
      }
    }
  }
});

test("invalid action and every unavailable initial action leave state unchanged", () => {
  const state = Game.createGame({ difficulty: "normal", seed: 7 });
  deny(state, () => Game.act(state, "missing.action"), "unknown action");
  for (const action of actions(state).filter(a => a.disabled)) {
    deny(state, () => Game.act(state, action.id), action.id);
  }
});

test("save validation rejects corrupted and foreign data", () => {
  const valid = Game.createGame({ difficulty: "normal", seed: 7 });
  const corruptions = [null, [], {}, "not JSON", { ...valid, version: -1 },
    { ...valid, hours: -1 }, { ...valid, cash: Infinity }, { ...valid, energy: NaN },
    { ...valid, difficulty: "impossible" }, { ...valid, status: "victory" },
    { ...valid, films: {} }, { ...valid, project: { stage: "unknown" } },
    { ...valid, location: "airport" }, { ...valid, event: { id: "unknown", choices: [] } }];
  for (const bad of corruptions) assert.equal(Game.validateSave(bad), null, `reject ${JSON.stringify(bad).slice(0, 110)}`);
  const loaded = Game.validateSave(clone(valid));
  assert.notEqual(loaded, valid, "load returns an independent state");
});

test("fixed seeds reproduce actions, weekly events and saved continuation", () => {
  const a = Game.createGame({ name: "בדיקת שחזור", difficulty: "normal", seed: 43 });
  const b = Game.createGame({ name: "בדיקת שחזור", difficulty: "normal", seed: 43 });
  for (let week = 0; week < 4; week++) {
    for (const id of ["set.work", "school.course", "cafe.network", "home.rest", "set.work"]) {
      if (available(a, id)) {
        perform(a, id);
        perform(b, id);
      }
    }
    nextWeek(a);
    nextWeek(b);
    assert.deepEqual(a, b, "same seed and decisions have identical outcome");
  }
  const resumed = Game.validateSave(clone(a));
  assert.ok(resumed, "midgame state can be restored");
  nextWeek(a);
  nextWeek(resumed);
  assert.deepEqual(a, resumed, "saved RNG continues deterministically");
});

test("action spending includes travel and rejects insufficient time or energy atomically", () => {
  const state = Game.createGame({ difficulty: "normal", seed: 7 });
  const work = available(state, "set.work");
  assert.ok(work);
  const before = clone(state);
  perform(state, work.id);
  assert.equal(state.hours, before.hours - work.cost.time, "displayed time includes travel");
  assert.equal(state.energy, before.energy - work.cost.energy, "displayed energy equals consumption");
  assert.equal(state.location, "set", "working moves to the set");

  const noTime = Game.createGame({ difficulty: "normal", seed: 7 });
  noTime.hours = 0;
  deny(noTime, () => Game.act(noTime, "set.work"), "work without time");
  const noEnergy = Game.createGame({ difficulty: "normal", seed: 7 });
  noEnergy.energy = 0;
  deny(noEnergy, () => Game.act(noEnergy, "set.work"), "work without energy");
});

test("events block ordinary actions and week advances, and resolve exactly once", () => {
  const state = Game.createGame({ difficulty: "calm", seed: 19 });
  for (let week = 0; !state.event && state.status === "playing" && week < 12; week++) {
    const result = Game.endWeek(state);
    assert.equal(result.ok, true);
  }
  assert.ok(state.event, "a fixed-seed event appears");
  deny(state, () => Game.act(state, "home.rest"), "action during event");
  deny(state, () => Game.endWeek(state), "advance during event");
  deny(state, () => Game.chooseEvent(state, "missing-choice"), "unknown event choice");
  const index = state.event.options.findIndex(c => !c.disabled);
  assert.equal(Game.chooseEvent(state, index).ok, true);
  assert.equal(state.event, null, "chosen event clears");
  deny(state, () => Game.chooseEvent(state, index), "duplicate event resolution");
  invariant(state);
});

test("rest spends time and weekly loans cannot be repeated", () => {
  const resting = Game.createGame({ difficulty: "normal", seed: 7 });
  resting.energy = 1; // Boundary fixture only; the playthrough bot does not edit state.
  let restCount = 0;
  while (available(resting, "home.rest")) {
    const before = resting.hours;
    perform(resting, "home.rest");
    assert.ok(resting.hours < before, "each rest spends a finite weekly resource");
    assert.ok(resting.energy <= 100, "rest cannot accumulate unbounded energy");
    assert.ok(++restCount < 30, "rest loop terminates");
  }
  const borrowing = Game.createGame({ difficulty: "normal", seed: 7 });
  perform(borrowing, "bank.borrow");
  deny(borrowing, () => Game.act(borrowing, "bank.borrow"), "second loan this week");
});

test("permanent purchases cannot be duplicated and bicycle travel savings are real", () => {
  const state = Game.createGame({ difficulty: "normal", seed: 7 });
  assert.equal(available(state, "set.work").cost.time, Game.JOBS[0].hours + 1);
  perform(state, "gear.buy_bike");
  assert.equal(available(state, "set.work").cost.time, Game.JOBS[0].hours, "bicycle removes inter-location travel hours");
  deny(state, () => Game.act(state, "gear.buy_bike"), "duplicate permanent purchase");
  assert.deepEqual(state.assets, ["bike"]);
  assert.equal(Game.validateSave({ ...clone(state), assets: ["bike", "bike"] }), null, "duplicate assets cannot enter through a save");
});

test("ignoring work and wellbeing produces a genuine hard-mode loss", () => {
  const state = Game.createGame({ difficulty: "hard", seed: 101 });
  let weeks = 0;
  while (state.status === "playing" && weeks++ <= state.maxWeeks + 1) nextWeek(state);
  assert.equal(state.status, "lost", "passive hard play loses through engine rules");
  assert.ok(state.week <= state.maxWeeks + 1, "loss happens within the game deadline");
  const before = clone(state);
  deny(state, () => Game.act(state, "set.work"), "action after loss");
  deny(state, () => Game.endWeek(state), "advance after loss");
  assert.deepEqual(state, before);
});

test("financing equipment without income triggers bankruptcy before the hard deadline", () => {
  const state = Game.createGame({ difficulty: "hard", seed: 101 });
  while (state.status === "playing") {
    settleEvent(state);
    if (state.status !== "playing") break;
    for (const id of ["bank.borrow", "gear.buy_camera", "gear.buy_laptop", "gear.buy_bike", "gear.buy_desk"]) {
      if (available(state, id)) perform(state, id);
    }
    assert.equal(Game.endWeek(state).ok, true);
    invariant(state);
  }
  assert.equal(state.status, "lost");
  assert.ok(state.debt > 6500, "loss comes from the actual bankruptcy threshold");
  assert.ok(state.week < state.maxWeeks, "bankruptcy happens before timeout");
});

test("mixed affordable actions stay valid across complete seeded games", () => {
  for (const seed of [7, 43, 991]) {
    const state = Game.createGame({ name: "סייר פעולות", difficulty: "normal", seed });
    let rng = seed;
    let count = 0;
    while (state.status === "playing" && count++ < 1800) {
      settleEvent(state);
      if (state.status !== "playing") break;
      const menu = actions(state).filter(action => !action.disabled);
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      if (!menu.length || (rng % 11 === 0 && state.hours < 15)) nextWeek(state);
      else perform(state, menu[rng % menu.length].id);
    }
    assert.notEqual(state.status, "playing", `seed ${seed} reaches an ending without an unlimited action loop`);
    invariant(state);
  }
});

function chooseBalancedEvent(state) {
  acknowledgeSetback(state);
  if (!state.event) return;
  const target = Game.DIFFICULTIES[state.difficulty].goals;
  const score = (effects = {}, option = {}) => {
    let value = (effects.cash || 0) / (state.cash < 1000 ? 45 : 140);
    value += (effects.happiness || 0) * (state.happiness < target.happiness ? 0.6 : 0.1);
    value += (effects.energy || 0) * (state.energy < 50 ? 0.4 : 0.05);
    value += (effects.craft || 0) * (state.craft < target.craft ? 1.1 : 0.01);
    value += (effects.reputation || 0) * (state.reputation < target.reputation ? 1.1 : 0.01);
    value += (effects.contacts || 0) * (state.contacts < 40 ? 0.8 : 0.05);
    // Production dilemmas introduce explicit film quality, restricted production
    // costs and time. The policy sees only their displayed current effects.
    value += (option.quality || 0) * 0.35;
    value -= Math.max(0, (option.filmCost || 0) - (state.project?.grantBudget || 0)) / (state.cash < 1000 ? 45 : 140);
    value -= (option.hours || 0) * 0.5;
    return value;
  };
  const ranked = state.event.options.map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled)
    .sort((a, b) => score(b.option.effects, b.option) - score(a.option.effects, a.option));
  assert.ok(ranked.length);
  assert.equal(Game.chooseEvent(state, ranked[0].index).ok, true);
  invariant(state);
}

function chooseBalancedAction(state, options = {}) {
  const menu = actions(state);
  const can = id => menu.some(action => action.id === id && !action.disabled);
  const first = ids => ids.find(can);
  const goal = Game.DIFFICULTIES[state.difficulty].goals;
  const living = Game.DIFFICULTIES[state.difficulty].living;
  const nextJob = Game.JOBS[state.job + 1];
  const cashFloor = living + (state.project?.stage === "shoot" ? 650 : state.project?.stage === "edit" ? 400 : 250);
  const recover = () => first(["cafe.meal", "home.rest"]);
  if (can("set.promote")) return "set.promote";
  if (state.happiness < 45) {
    const social = first(["home.family", "cafe.fun"]);
    if (social) return social;
  }
  if (state.cash < cashFloor && can("set.work")) return "set.work";
  if (state.energy < 22) {
    const recovery = recover();
    if (recovery) return recovery;
  }
  if (!state.assets.includes("bike") && state.cash >= 1100 && can("gear.buy_bike")) return "gear.buy_bike";
  if (state.project) {
    const id = { script: "home.write", shoot: options.fullCrew ? "set.shoot_full" : "set.shoot_lean", edit: options.polish ? "studio.edit_polish" : "studio.edit", release: options.festival ? "festival.release_festival" : "studio.release_commercial" }[state.project.stage];
    if (can(id)) return id;
  }
  if (state.craft < (nextJob ? Math.max(nextJob.craft, 35) : goal.craft) && state.cash > living + 220) {
    const study = first(["school.course", "studio.practice"]);
    if (study) return study;
  }
  if (state.contacts < (nextJob ? nextJob.contacts : 40) && state.cash > living + 100 && can("cafe.network")) return "cafe.network";
  if (state.reputation < (nextJob?.reputation || goal.reputation)) {
    const reputation = first(["cafe.pitch", "festival.mingle"]);
    if (reputation && (reputation === "cafe.pitch" || state.cash > living + 90)) return reputation;
  }
  const startFilm = "home.start_" + (options.filmType || "doc");
  if (!state.project && !state.films.length && state.craft >= 30 && state.cash >= 1000 && can(startFilm)) return startFilm;
  if (state.cash - state.debt < goal.wealth && state.used.work < (options.workaholic ? 3 : 2) && can("set.work")) return "set.work";
  if (!state.assets.includes("desk") && state.cash > 2200 && state.week < 16 && can("gear.buy_desk")) return "gear.buy_desk";
  if (state.debt > 0 && state.cash >= state.debt + 1400 && can("bank.repay_all")) return "bank.repay_all";
  if (state.craft < goal.craft && state.cash > living + 220) {
    const study = first(["school.course", "studio.practice"]);
    if (study) return study;
  }
  if (state.reputation < goal.reputation) {
    const reputation = first(["cafe.pitch", "festival.mingle"]);
    if (reputation) return reputation;
  }
  if (state.happiness < Math.min(100, goal.happiness + 12)) {
    const social = first(["home.family", "cafe.fun"]);
    if (social) return social;
  }
  if (state.energy < 72) {
    const recovery = first(["home.family", "cafe.meal", "home.rest"]);
    if (recovery) return recovery;
  }
  if (state.cash - state.debt < goal.wealth && can("set.work")) return "set.work";
  return null;
}

function runBalanced(difficulty, seed, options = {}) {
  const state = Game.createGame({ name: "הבוט עם היומן", difficulty, seed, characterId: options.characterId });
  const trace = [];
  const stages = new Set();
  let firstFilmState;
  let turns = 0;
  while (state.status === "playing" && turns++ < 1400) {
    chooseBalancedEvent(state);
    if (state.status !== "playing") break;
    const id = chooseBalancedAction(state, options);
    if (id) {
      trace.push({ week: state.week, id });
      perform(state, id);
      if (state.project) stages.add(state.project.stage);
      if (state.films.length && !firstFilmState) firstFilmState = clone(state);
    } else {
      assert.equal(Game.endWeek(state).ok, true);
      invariant(state);
    }
  }
  assert.notEqual(state.status, "playing", "balanced policy reaches an ending");
  return { state, trace, stages, firstFilmState };
}

function runSimple(difficulty, seed, policy = "film-only") {
  const state = Game.createGame({ name: "בוט עם רעיון אחד", difficulty, seed });
  let turns = 0;
  while (state.status === "playing" && turns++ < 1400) {
    settleEvent(state); // First affordable event choice; no strategic event optimization.
    if (state.status !== "playing") break;
    let choices = [];
    if (policy === "work-only") choices = ["set.work"];
    if (policy === "film-only") choices = [state.project ? {
      script: "home.write", shoot: "set.shoot_lean", edit: "studio.edit", release: "studio.release_commercial"
    }[state.project.stage] : "home.start_doc"];
    if (policy !== "idle" && state.energy < 65) choices.push("cafe.meal", "home.rest");
    const id = choices.find(action => available(state, action));
    if (id) perform(state, id);
    else {
      assert.equal(Game.endWeek(state).ok, true);
      invariant(state);
    }
  }
  assert.notEqual(state.status, "playing", `${policy} reaches an ending`);
  return state;
}

test("all film genres complete the real lifecycle, including festival and commercial routes", () => {
  for (const [filmType, festival, fullCrew, polish] of [
    ["short", true, true, true], ["doc", false, false, false], ["comedy", true, false, true]
  ]) {
    const { firstFilmState: state, stages } = runBalanced("normal", 43, { filmType, festival, fullCrew, polish });
    assert.ok(state, `${filmType} reaches a premiere through real actions`);
    assert.deepEqual([...stages], ["script", "shoot", "edit", "release"]);
    assert.equal(state.films.length, 1);
    assert.equal(state.films[0].type, filmType);
    assert.equal(state.films[0].route, festival ? "festival" : "commercial");
    assert.equal(state.project, null, "release consumes the active project");
    assert.ok(state.films[0].royalty > 0, "release establishes weekly royalties");
    assert.deepEqual(Game.validateSave(clone(state)), state, "released-film save survives a round trip");
    deny(state, () => Game.act(state, "festival.release_festival"), "duplicate festival release");
    deny(state, () => Game.act(state, "studio.release_commercial"), "duplicate commercial release");
    deny(state, () => Game.act(state, "set.shoot_lean"), "reshooting a consumed project");
  }
});

test("wages, bills, interest and royalties reconcile with changes in net worth", () => {
  const state = Game.createGame({ difficulty: "normal", seed: 7 });
  const initialNet = state.cash - state.debt;
  perform(state, "set.work");
  const salary = Game.JOBS[0].wage;
  assert.equal(state.weeklyTotals.income, salary, "wage is credited once");
  const interest = Math.ceil(state.debt * Game.DIFFICULTIES.normal.interest);
  assert.equal(Game.endWeek(state).ok, true);
  assert.equal(state.weeklySummary.income, salary);
  assert.equal(state.weeklySummary.expenses, Game.DIFFICULTIES.normal.living + interest);
  assert.equal(state.weeklySummary.net, state.cash - state.debt - initialNet);

  const debt = Game.createGame({ difficulty: "normal", seed: 19 });
  const beforeBorrow = debt.cash - debt.debt;
  perform(debt, "bank.borrow");
  perform(debt, "bank.repay");
  assert.equal(debt.cash - debt.debt, beforeBorrow, "borrowing and principal repayments do not create wealth");
  assert.deepEqual(debt.weeklyTotals, { income: 0, expenses: 0 }, "loan principal is excluded from operating totals");

  const { firstFilmState: filmState } = runBalanced("normal", 43);
  const beforeClose = clone(filmState);
  const royalties = beforeClose.films.reduce((sum, film) => sum + film.royalty, 0);
  assert.equal(Game.endWeek(filmState).ok, true);
  assert.equal(filmState.weeklySummary.income, beforeClose.weeklyTotals.income + royalties, "royalties are credited once on weekly close");
  const bills = Game.DIFFICULTIES.normal.living;
  assert.equal(filmState.cash, beforeClose.cash + royalties - bills);
});

test("balanced play can win every difficulty across a small fixed-seed matrix", () => {
  const rows = [];
  for (const difficulty of ["calm", "normal", "hard"]) {
    const runs = SEEDS.map(seed => runBalanced(difficulty, seed));
    const winners = runs.filter(({ state }) => state.status === "won");
    assert.equal(winners.length, runs.length, `${difficulty}: competent policy wins the fixed regression seeds`);
    for (const { state } of winners) {
      assert.ok(state.films.length > 0);
      assert.ok(Game.goals(state).every(goal => goal.complete));
      assert.ok(Game.validateSave(clone(state)), "won save is valid");
      deny(state, () => Game.act(state, "set.work"), "action after victory");
    }
    rows.push({ difficulty, wins: `${winners.length}/${runs.length}`, earliest: Math.min(...winners.map(r => r.state.week)), latest: Math.max(...winners.map(r => r.state.week)) });
  }
  console.table(rows);
});

test("longer productions require planning: film-only and financial neglect cannot bypass the career challenge", () => {
  const rows = [];
  for (const difficulty of ["calm", "normal", "hard"]) {
    for (const policy of ["film-only", "idle", "work-only"]) {
      const states = SEEDS.map(seed => runSimple(difficulty, seed, policy));
      const wins = states.filter(state => state.status === "won").length;
      if (policy !== "film-only" || difficulty === "hard") assert.equal(wins, 0, `${difficulty} ${policy} must not bypass the career challenge`);
      else assert.equal(wins, 0, `${difficulty}: filmmaking alone needs a cash and life plan with the longer production schedule`);
      rows.push({ difficulty, policy, wins: `${wins}/${states.length}`, earliest: Math.min(...states.map(s => s.week)), latest: Math.max(...states.map(s => s.week)) });
    }
  }
  console.table(rows);
});

function runTests() {
  let failed = 0;
  for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failed++; console.error(`✗ ${name}\n  ${error.stack}`); }
  }
  console.log(`\n${tests.length - failed}/${tests.length} regression checks passed.`);
  if (failed) process.exitCode = 1;
}

if (require.main === module) runTests();
module.exports = { invariant, actions, available, perform, settleEvent, nextWeek, SEEDS, runBalanced, runSimple, chooseBalancedEvent, chooseBalancedAction, deny, acknowledgeSetback };
