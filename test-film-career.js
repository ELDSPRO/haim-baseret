/* V3 career, rival, property and continuation regressions.
 * Run: node test-film-career.js
 * Complete career playthroughs must start with createGame and use real actions;
 * deliberately edited fixtures are explicitly labeled boundary fixtures.
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
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'tests/fixtures', name), 'utf8'));

function resolveEvent(state) {
  Base.chooseBalancedEvent(state);
}
function nextWeek(state) {
  resolveEvent(state);
  assert.equal(Game.endWeek(state).ok, true);
  resolveEvent(state);
}
function nextCareerFilm(state) {
  if (!state.films.some(film => film.route === 'festival' && film.quality >= 65)) return { type: 'short', festival: true };
  if (!state.films.some(film => film.type === 'feature' && film.route === 'commercial' && film.quality >= 72 && film.revenue + (film.productionIncome || 0) >= film.budget)) return { type: 'feature', festival: false };
  if (!state.films.some(film => film.type === 'feature' && film.route === 'festival' && film.quality >= 85)) return { type: 'feature', festival: true };
  if (!state.films.some(film => film.type === 'blockbuster')) return { type: 'blockbuster', festival: false };
  return null;
}

function runFullCareer(difficulty, seed, characterId = 'kobi') {
  const firstSeason = Base.runBalanced(difficulty, seed, { characterId });
  const state = firstSeason.state;
  const trace = firstSeason.trace.slice();
  const extraWork = new Set();
  let continuations = 0;
  let turns = 0;
  let browserFixture = null;
  let browserTrace = [];
  while (turns++ < 2200) {
    if (state.status === 'playing' && state.project?.stage === 'release' && Game.getCareer(state).tier >= 3
      && state.cash >= Game.ASSETS.apartment.price && !state.assets.includes('apartment')
      && (!browserFixture || Game.getCareer(state).tier >= Game.getCareer(browserFixture).tier)) {
      browserFixture = copy(state);
      browserTrace = trace.slice();
    }
    const completed = Game.getCareer(state).tier === 4 && !nextCareerFilm(state)
      && state.assets.includes('apartment') && state.assets.includes('studio_property');
    if (completed) return { state, trace, extraWork, continuations, browserFixture, browserTrace };
    if (state.status === 'lost' && !Game.getLife(state).chapter.canContinue) break;
    if (state.status === 'won' || state.status === 'lost') {
      const result = Game.continueCareer(state);
      assert.equal(result.ok, true, 'a won first/second season can continue toward the full career');
      continuations++;
      trace.push({ week: state.week, id: 'continueCareer' });
    }
    resolveEvent(state);
    if (state.status !== 'playing') continue;
    const menu = Base.actions(state);
    const can = id => menu.some(action => action.id === id && !action.disabled);
    const first = ids => ids.find(can);
    const matching = suffix => menu.find(action => action.id.endsWith('.' + suffix) && !action.disabled)?.id;
    const revenue = () => ['ad', 'teach_masterclass', 'lecture', 'jury', 'wedding'].map(matching).find(Boolean) || first(['set.work']);
    const recovery = () => first(['home.family', 'cafe.meal', 'home.rest']);
    const plan = nextCareerFilm(state);
    const filming = state.project && { script: 'home.write', shoot: 'set.shoot_full', edit: 'studio.edit_polish', release: plan?.festival ? 'festival.release_festival' : 'studio.release_commercial' }[state.project.stage];
    const filmPrice = plan ? Game.FILM_TYPES[plan.type].shootCost + 1500 : 2000;
    const reserve = Game.DIFFICULTIES[difficulty].living * 2 + filmPrice;
    let id;
    if (can('set.promote')) id = 'set.promote';
    if (!id && state.energy < 28) id = recovery();
    if (!id && state.happiness < 55) id = first(['home.family', 'cafe.fun']);
    if (!id && state.cash < reserve) id = revenue();
    if (!id && filming && can(filming)) id = filming;
    if (!id && !state.assets.includes('camera') && state.cash >= reserve + Game.ASSETS.camera.price && can('gear.buy_camera')) id = 'gear.buy_camera';
    if (!id && !state.assets.includes('laptop') && state.cash >= reserve + Game.ASSETS.laptop.price && can('gear.buy_laptop')) id = 'gear.buy_laptop';
    if (!id && state.craft < 90) id = first(['school.masterclass', 'school.course', 'studio.practice']);
    if (!id && state.contacts < 65) id = first(['cafe.network', 'festival.mingle']);
    if (!id && state.reputation < 90) id = first(['cafe.pitch', 'festival.mingle']);
    if (!id && !state.project && plan && state.cash >= reserve && can('home.start_' + plan.type)) id = 'home.start_' + plan.type;
    if (!id) {
      for (const work of ['wedding', 'ad', 'lecture', 'teach_masterclass', 'jury']) {
        if (!extraWork.has(work) && matching(work)) { id = matching(work); break; }
      }
    }
    if (!id && !state.assets.includes('apartment') && state.cash >= reserve + Game.ASSETS.apartment.price && can('bank.buy_apartment')) id = 'bank.buy_apartment';
    if (!id && !state.assets.includes('studio_property') && state.cash >= reserve + Game.ASSETS.studio_property.price && can('bank.buy_studio_property')) id = 'bank.buy_studio_property';
    if (!id && state.happiness < Math.min(100, Game.goals(state).find(goal => goal.id === 'happiness').target + 12)) id = first(['home.family', 'cafe.fun']);
    if (!id && state.debt > 0 && state.cash >= reserve + state.debt && can('bank.repay_all')) id = 'bank.repay_all';
    if (!id && state.energy < 75) id = recovery();
    if (!id) id = revenue();
    if (id) {
      trace.push({ week: state.week, id });
      Base.perform(state, id);
      const suffix = id.split('.')[1];
      if (['wedding', 'ad', 'lecture', 'teach_masterclass', 'jury'].includes(suffix)) extraWork.add(suffix);
    } else {
      trace.push({ week: state.week, id: 'endWeek' });
      assert.equal(Game.endWeek(state).ok, true);
    }
    assert.ok(Game.validateSave(copy(state)), 'every full-career action leaves a valid save');
  }
  return { state, trace, extraWork, continuations, browserFixture, browserTrace };
}

test('authentic V2 active funding save migrates with all personal and project resources intact', () => {
  const raw = fixture('film-v2-active-save.json');
  const original = copy(raw);
  assert.equal(raw.version, 2);
  const state = Game.validateSave(raw);
  assert.ok(state, 'the authentic V2 pending application is accepted');
  assert.equal(Game.VERSION, 5);
  assert.equal(state.version, 5);
  for (const key of ['name', 'characterId', 'difficulty', 'week', 'maxWeeks', 'hours', 'maxHours', 'cash', 'debt', 'energy', 'happiness', 'craft', 'reputation', 'contacts', 'job', 'location', 'rng', 'status']) {
    assert.deepEqual(state[key], key==='hours'?original.hours+18:key==='maxHours'?50:original[key], `migration preserves ${key}`);
  }
  for (const [key, value] of Object.entries(original.project)) assert.deepEqual(state.project[key], value, `migration preserves project.${key}`);
  assert.deepEqual(state.funding, original.funding, 'pending due date, submitted odds and the whole funding snapshot are preserved');
  assert.deepEqual(raw, original, 'migration is a pure read of the supplied save');
  assert.deepEqual(Game.validateSave(copy(state)), state, 'the migrated V3 state round trips exactly');
  const twin = Game.validateSave(original);
  Base.perform(state, 'set.work'); Base.perform(twin, 'set.work');
  assert.equal(Game.endWeek(state).ok, true);
  assert.equal(Game.endWeek(twin).ok, true);
  assert.deepEqual(state, twin, 'V2 pending decision resumes deterministically under V3');
  assert.equal(state.funding.application, null, 'the original development application resolves on its original due date');
  assert.equal(state.funding.history[0].resolvedWeek, original.funding.application.dueWeek);
});

test('authentic V2 victory remains a victory and retains its finished films after migration', () => {
  const raw = fixture('film-v2-won-save.json');
  assert.equal(raw.version, 2);
  assert.equal(raw.status, 'won');
  const state = Game.validateSave(raw);
  assert.ok(state);
  assert.equal(state.status, 'won', 'migration never silently resumes or resets a finished game');
  for (const key of ['cash', 'debt', 'week', 'craft', 'reputation', 'happiness', 'energy', 'contacts', 'characterId']) assert.deepEqual(state[key], raw[key], `${key} persists`);
  assert.equal(state.films.length, raw.films.length);
  for (let i = 0; i < raw.films.length; i++) {
    for (const [key, value] of Object.entries(raw.films[i])) assert.deepEqual(state.films[i][key], value, `finished film keeps ${key}`);
  }
  assert.deepEqual(Game.validateSave(copy(state)), state);
  Base.deny(state, () => Game.act(state, 'set.work'), 'ordinary work before explicitly continuing a won season');
});

test('career menus and repeated map reads are pure and cannot reroll saved randomness', () => {
  const state = Game.createGame({ characterId: 'kobi', difficulty: 'normal', seed: 43 });
  const before = copy(state);
  const career = Game.getCareer(state);
  assert.ok(career && typeof career === 'object', 'the career ladder has a public read API');
  for (let i = 0; i < 40; i++) {
    Base.actions(state);
    assert.deepEqual(Game.getCareer(state), career);
    Game.getFundingOptions(state);
    Game.goals(state);
    Game.getRivalComparison(state);
  }
  assert.deepEqual(state, before, 'UI renders cannot modify either random stream, the rival, or progression');
  assert.deepEqual(Game.validateSave(copy(state)), state, 'save/load cannot reroll the rival plan');
});

test('the rival has an independent random stream and executes its saved weekly plan', () => {
  const a = Game.createGame({ difficulty: 'normal', seed: 43 });
  const b = Game.createGame({ difficulty: 'normal', seed: 43 });
  Base.perform(a, 'home.start_doc'); // Consumes the player's film-title RNG.
  Base.perform(b, 'home.rest');      // Does not consume the player's RNG.
  assert.notEqual(a.rng, b.rng);
  const independent = rival => {
    const result = copy(rival);
    // The actual player/AI gap should differ when the player makes different
    // decisions; exclude only these comparison fields from AI-state equivalence.
    for (const report of result.history) {
      delete report.gapBefore; delete report.gapAfter; delete report.gapChange;
    }
    delete result.weekStartGap;
    return result;
  };
  const actionKinds = new Set();
  for (let week = 0; week < 6; week++) {
    resolveEvent(a); resolveEvent(b);
    const before = copy(a.rival);
    const plan = copy(a.rival.plan);
    assert.equal(plan.week, a.week);
    assert.ok(plan.actions.length >= 2 && plan.actions.length <= 3);
    const restored = Game.validateSave(copy(a));
    assert.ok(restored);
    assert.equal(Game.endWeek(a).ok, true);
    assert.equal(Game.endWeek(b).ok, true);
    assert.equal(Game.endWeek(restored).ok, true);
    assert.deepEqual(restored, a, 'restoring the same precommitted week does not reroll its execution');
    const report = a.weeklySummary.rivalReport;
    assert.ok(report && report.actions.length >= 2, 'the weekly comparison contains executed actions');
    assert.deepEqual(report.actions.map(action => action.id), plan.actions.map(action => action.id));
    assert.equal(report.delta.cash, a.rival.cash - before.cash);
    assert.equal(report.delta.wealth, (a.rival.cash - a.rival.debt) - (before.cash - before.debt));
    assert.equal(report.delta.wealth, report.delta.income - report.delta.expenses, 'AI income, production spending, bills and interest reconcile');
    for (const stat of ['craft', 'reputation', 'contacts', 'happiness']) assert.equal(report.delta[stat], a.rival[stat] - before[stat]);
    assert.equal(report.delta.films, a.rival.films.length - before.films.length);
    assert.equal(a.rival.history.length, week + 1);
    assert.deepEqual(a.rival.history.at(-1), report);
    assert.equal(a.rival.progress, Game.getRivalComparison(a).rival.score);
    assert.deepEqual(independent(a.rival), independent(b.rival), 'different player RNG consumption never changes AI actions or finances');
    report.actions.forEach(action => {
      actionKinds.add(action.id);
      assert.ok(action.text && Number.isFinite(action.cashDelta), 'every narrative action reports its actual numeric impact');
    });
  }
  assert.ok(actionKinds.size >= 5, 'six weeks contain a real mix of paid work, production and career actions');
  assert.ok(a.rival.films.length > 0, 'the rival completes a film rather than only moving around the map');
});

test('the rival can finish a real career before the clock, while rounded scores cannot fake completion', () => {
  const rows = [];
  for (const difficulty of ['calm', 'normal', 'hard']) {
    const states = Base.SEEDS.map(seed => Base.runSimple(difficulty, seed, 'idle'));
    const early = states.filter(state => state.week < state.maxWeeks && state.ending.startsWith('איתי השלים'));
    for (const state of early) {
      const target = Game.DIFFICULTIES[difficulty].goals;
      assert.ok(state.rival.cash - state.rival.debt >= target.wealth);
      assert.ok(state.rival.craft >= target.craft && state.rival.reputation >= target.reputation && state.rival.happiness >= target.happiness);
      assert.ok(state.rival.films.length > 0, 'a pre-deadline rival win includes its own released film');
      assert.equal(Game.getRivalComparison(state).rival.score, 100);
    }
    rows.push({ difficulty, rivalWinsBeforeDeadline: `${early.length}/${states.length}`, earliest: early.length ? Math.min(...early.map(state => state.week)) : '—', latest: early.length ? Math.max(...early.map(state => state.week)) : '—' });
    if (difficulty === 'calm') assert.ok(early.length > 0, 'the rival can actually win instead of serving as a decorative timer');
  }
  console.table(rows);
  const edge = Game.createGame({ difficulty: 'calm', seed: 43 });
  const source = Base.runSimple('calm', 43, 'idle');
  edge.rival.films = copy(source.rival.films);
  const target = Game.DIFFICULTIES.calm.goals;
  // Explicit score boundary: an otherwise completed career lacks one rep point.
  Object.assign(edge.rival, { cash: target.wealth + edge.rival.debt, craft: target.craft, reputation: target.reputation - 1, happiness: target.happiness });
  assert.equal(Game.getRivalComparison(edge).rival.score, 99, 'rounding a near-complete average never displays a false 100');
  edge.rival.reputation = target.reputation;
  assert.equal(Game.getRivalComparison(edge).rival.score, 100);
});

test('rival save validation rejects altered random state, plans and contradictory financial reports', () => {
  const state = Game.createGame({ seed: 43, difficulty: 'normal' });
  nextWeek(state);
  const badRng = copy(state); badRng.rival.rng = 0;
  const badPlan = copy(state); badPlan.rival.plan.actions[0].id = 'print_money';
  const badReport = copy(state); badReport.rival.history[0].delta.wealth++;
  const badBalance = copy(state); badBalance.rival.cash++;
  const missingBaseline = copy(state); delete missingBaseline.rival.weekStartGap;
  for (const raw of [badRng, badPlan, badReport, badBalance, missingBaseline]) assert.equal(Game.validateSave(raw), null, 'modern rival data cannot silently bypass its saved ledger');
});

test('continuation preserves earned resources, changes seasonal goals and cannot be repeated for free', () => {
  const won = Game.validateSave(fixture('film-v2-won-save.json'));
  const before = copy(won);
  const firstTargets = Game.goals(won);
  assert.equal(Game.continueCareer(won).ok, true);
  assert.equal(won.status, 'playing');
  assert.equal(won.season, before.season + 1);
  assert.equal(won.maxWeeks, before.maxWeeks + Game.DIFFICULTIES[won.difficulty].maxWeeks);
  for (const key of ['hours', 'week', 'cash', 'debt', 'energy', 'happiness', 'craft', 'reputation', 'contacts', 'films', 'assets', 'characterId', 'rng']) assert.deepEqual(won[key], before[key], `${key} is earned, not reset or rewarded by continuation`);
  assert.ok(Game.goals(won).find(goal => goal.id === 'wealth').target > firstTargets.find(goal => goal.id === 'wealth').target);
  assert.equal(Game.getCareer(won).seasonGoal.met, false, 'the old short film cannot satisfy the feature season');
  assert.ok(Game.validateSave(copy(won)), 'an extended season remains saveable');
  Base.deny(won, () => Game.continueCareer(won), 'continuing an unfinished new season');
  const fresh = Game.createGame({ seed: 43 });
  Base.deny(fresh, () => Game.continueCareer(fresh), 'continuation without winning');
});

const careerCache = new Map();
function completedCareer(difficulty = 'normal', seed = 43) {
  const key = difficulty + ':' + seed;
  if (!careerCache.has(key)) careerCache.set(key, runFullCareer(difficulty, seed));
  return careerCache.get(key);
}

test('full career is reachable through actual work, completed films and continued seasons', () => {
  const rows = [];
  for (const difficulty of ['calm', 'normal', 'hard']) {
    for (const seed of [7, 43, 263]) {
      const run = completedCareer(difficulty, seed);
      const { state } = run;
      rows.push({ difficulty, seed, status: state.status, season: state.season, week: state.week, career: Game.getCareer(state).tier, films: state.films.length, continuations: run.continuations });
      assert.equal(Game.getCareer(state).tier, 4, `${difficulty}/${seed}: full career; last actions ${JSON.stringify(run.trace.slice(-12))}`);
      assert.ok(state.films.some(film => film.type === 'blockbuster'), 'an actual blockbuster is released');
      assert.ok(state.films.some(film => film.type === 'feature' && film.route === 'festival' && film.quality >= 85));
      assert.ok(state.assets.includes('apartment') && state.assets.includes('studio_property'), 'both gated properties are affordable through earned money');
      assert.deepEqual([...run.extraWork].sort(), ['ad', 'jury', 'lecture', 'teach_masterclass', 'wedding'], 'every career income option is unlocked and used');
      assert.ok(run.continuations >= 1);
      assert.ok(Game.validateSave(copy(state)));
    }
  }
  console.table(rows);
});

function lateBoundary() {
  const state = copy(completedCareer().state);
  assert.equal(Game.getCareer(state).tier, 4, 'the boundary fixture is based on an actual completed career');
  if (['won','lost'].includes(state.status)) assert.equal(Game.continueCareer(state).ok, true);
  assert.equal(state.status, 'playing');
  state.cash = 100000; state.hours = 32; state.energy = 100; state.happiness = 50;
  for (const key of Object.keys(state.used)) state.used[key] = 0;
  state.assets = state.assets.filter(id => !['apartment', 'studio_property'].includes(id));
  return state;
}

test('career gates require released-film achievements, not just maximum numeric skills', () => {
  const state = lateBoundary();
  const archive = copy(state.films);
  state.craft = state.reputation = state.contacts = 100;
  const action = id => Base.actions(state).find(item => item.id === id);
  state.films = [];
  assert.equal(Game.getCareer(state).tier, 0);
  for (const id of ['home.start_feature', 'home.start_blockbuster', 'bank.buy_apartment', 'bank.buy_studio_property', 'festival.jury']) assert.equal(action(id).disabled, true, `${id} stays locked without film achievements`);
  state.films = archive.slice(0, 1);
  assert.equal(Game.getCareer(state).tier, 1);
  assert.equal(action('set.ad').disabled, false);
  assert.equal(action('school.lecture').disabled, false);
  assert.equal(action('home.start_feature').disabled, true);
  state.films = archive.slice(0, 2);
  assert.equal(Game.getCareer(state).tier, 2);
  assert.equal(action('home.start_feature').disabled, false);
  assert.equal(action('school.teach_masterclass').disabled, false);
  assert.equal(action('home.start_blockbuster').disabled, true);
  state.films = archive;
  assert.equal(Game.getCareer(state).tier, 4);
  assert.equal(action('festival.jury').disabled, false);
  assert.equal(Game.getCareerPath(state).every(row => row.reached), true);
});

test('property trades liquidity for equal-valued equity and rent is credited exactly once per week', () => {
  const state = lateBoundary();
  const initialWealth = Game.netWorth(state);
  const initialCash = state.cash;
  const initialTotals = copy(state.weeklyTotals);
  for (const key of ['apartment', 'studio_property']) {
    const id = 'bank.buy_' + key;
    const preview = Base.actions(state).find(action => action.id === id);
    assert.equal(preview.cost.money, Game.ASSETS[key].price);
    const oldCash = state.cash;
    Base.perform(state, id);
    assert.equal(state.cash, oldCash - Game.ASSETS[key].price);
    assert.equal(Game.netWorth(state), initialWealth, 'buying property cannot create net worth from nothing');
    Base.deny(state, () => Game.act(state, id), 'duplicate property purchase');
  }
  assert.equal(state.cash, initialCash - Game.ASSETS.apartment.price - Game.ASSETS.studio_property.price);
  assert.deepEqual(state.weeklyTotals, initialTotals, 'buying principal is neither operating income nor an operating expense');
  assert.equal(Base.actions(state).some(action => /(sell|resell).*(apartment|studio_property)/.test(action.id)), false, 'there is no profitable resale loop');
  const before = copy(state);
  const rental = Game.ASSETS.apartment.rent + Game.ASSETS.studio_property.rent;
  const royalties = Game.getLife(state).currentRoyalties;
  const living = Game.DIFFICULTIES[state.difficulty].living;
  const interest = Math.ceil(state.debt * Game.DIFFICULTIES[state.difficulty].interest);
  assert.equal(Game.endWeek(state).ok, true);
  assert.equal(state.cash, before.cash + rental + royalties - living);
  assert.equal(Game.netWorth(state) - Game.netWorth(before), rental + royalties - living - interest);
  assert.equal(state.weeklySummary.income, before.weeklyTotals.income + rental + royalties);
  const after = copy(state);
  for (let i = 0; i < 20; i++) Base.actions(state);
  assert.deepEqual(state, after, 'rendering cannot collect another rent payment');
  assert.deepEqual(Game.validateSave(copy(state)), state, 'property and accrued income persist exactly');
});

function advanceFilm(state, targetStage, festival = false) {
  let steps = 0;
  while (state.project && state.project.stage !== targetStage && steps++ < 120) {
    resolveEvent(state);
    state.hours=state.maxHours;state.energy=100;
    const id = { script: 'home.write', shoot: 'set.shoot_full', edit: 'studio.edit_polish', release: festival ? 'festival.release_festival' : 'studio.release_commercial' }[state.project.stage];
    if (Base.available(state, id)) Base.perform(state, id);
    else nextWeek(state);
  }
  assert.equal(state.project?.stage, targetStage);
  resolveEvent(state);
  return state;
}

test('property discounts affect actual film invoices without adding cash or changing quality rewards', () => {
  const state = lateBoundary();
  Base.perform(state, 'home.start_doc');
  Base.perform(state, 'home.write');
  const plain = Base.actions(state).find(action => action.id === 'set.shoot_full');
  Base.perform(state, 'bank.buy_studio_property');
  const owned = Base.actions(state).find(action => action.id === 'set.shoot_full');
  assert.equal(owned.cost.money, Math.round(Math.round((Game.FILM_TYPES.doc.shootCost + 450) * (state.assets.includes('camera') ? 0.65 : 1) * 0.85)/Game.PRODUCTION_DAYS.doc.shoot));
  assert.ok(owned.cost.money < plain.cost.money);
  assert.equal(owned.cost.time, plain.cost.time);
  assert.equal(owned.cost.energy, plain.cost.energy);
  const beforeCash = state.cash;
  const shot = Base.perform(state, 'set.shoot_full');
  assert.equal(state.cash, beforeCash - owned.cost.money - (shot.setback?.cashPaid||0) + (shot.breakthrough?.rewardCash||0), 'quoted invoice plus separately recorded production surprise');
  resolveEvent(state);
  const editing = Base.actions(state).find(action => action.id === 'studio.edit_polish');
  assert.equal(editing.cost.money, Math.round(Math.round((480 - (state.assets.includes('laptop') ? 150 : 0)) * 0.85)/Game.PRODUCTION_DAYS.doc.edit));
});

test('all career income opportunities charge shown resources, pay once and reset weekly', () => {
  for (const characterId of ['kobi', 'tamar']) {
    const state = lateBoundary();
    state.characterId = characterId; // Explicit payout boundary for the character tradeoff.
    const rows = [
      ['set.wedding', 720, true], ['set.ad', 1650, true], ['school.lecture', 720, false],
      ['school.teach_masterclass', 1250, false], ['festival.jury', 1900, false]
    ];
    for (const [id, base, tamarBonus] of rows) {
      const preview = Base.actions(state).find(action => action.id === id);
      assert.equal(preview.disabled, false);
      const before = copy(state);
      const wage = Math.round(base * (characterId === 'tamar' && tamarBonus ? 1.15 : 1));
      Base.perform(state, id);
      assert.equal(state.cash - before.cash, wage);
      assert.equal(state.weeklyTotals.income - before.weeklyTotals.income, wage);
      assert.equal(before.hours - state.hours, preview.cost.time);
      assert.equal(before.energy - state.energy, preview.cost.energy);
      Base.deny(state, () => Game.act(state, id), 'duplicate weekly ' + id);
    }
    assert.equal(Game.endWeek(state).ok, true);
    resolveEvent(state);
    for (const [id] of rows) assert.equal(state.used[id.split('.')[1]], 0);
    assert.ok(Base.available(state, 'school.lecture'), 'a new week reopens a paid opportunity');
    assert.ok(Game.validateSave(copy(state)));
  }
});

test('advanced commercial forecasts disclose real success and flop payouts and reload cannot reroll them', () => {
  for (const type of ['feature', 'blockbuster']) {
    const state = lateBoundary();
    Base.perform(state, 'home.start_' + type);
    advanceFilm(state, 'release');
    if (!Base.available(state, 'studio.release_commercial')) nextWeek(state);
    const before = copy(state);
    const forecast = Game.getReleaseForecast(state, false);
    assert.ok(forecast.riskChance > 0 && forecast.riskChance < 100);
    assert.ok(forecast.flopRevenue < forecast.successRevenue);
    assert.equal(forecast.revenueMin, forecast.flopRevenue);
    assert.equal(forecast.revenueMax, forecast.successRevenue);
    assert.equal(forecast.expectedRevenue, Math.round(forecast.successRevenue * (1 - forecast.riskChance / 100) + forecast.flopRevenue * forecast.riskChance / 100));
    const menu = Base.actions(state).find(action => action.id === 'studio.release_commercial');
    assert.ok(menu.effects.some(text => text.includes(forecast.riskChance + '%')));
    for (let i = 0; i < 20; i++) {
      assert.deepEqual(Game.getReleaseForecast(state, false), forecast);
      Game.getReleaseForecast(state, true);
      Base.actions(state);
    }
    assert.deepEqual(state, before, 'forecast inspection consumes no RNG or resources');
    const twin = Game.validateSave(copy(state));
    Base.perform(state, 'studio.release_commercial');
    Base.perform(twin, 'studio.release_commercial');
    assert.deepEqual(twin, state, 'reloading the exact ready-to-release film preserves its box-office outcome');
    const outcomes = new Set();
    for (let sample = 1; sample <= 32; sample++) {
      const trial = copy(before);
      // RNG boundary sweep verifies both advertised branches; this is not a
      // career reachability run, and no production costs or results are edited.
      trial.rng = Math.imul(sample, 2654435761) >>> 0;
      const cash = trial.cash;
      Base.perform(trial, 'studio.release_commercial');
      const film = trial.films.at(-1);
      outcomes.add(film.boxOfficeSuccess);
      assert.equal(film.revenue, film.boxOfficeSuccess ? forecast.successRevenue : forecast.flopRevenue);
      assert.equal(trial.cash, cash - forecast.fee + film.revenue);
      assert.deepEqual(film.forecast, forecast);
      assert.ok(Game.validateSave(copy(trial)), 'both commercial outcomes are valid saved films');
    }
    assert.deepEqual([...outcomes].sort(), [false, true], 'both genuine success and failure are reachable within the shown forecast');
  }
});

function runTests() {
  let failures = 0;
  for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failures++; console.error(`✗ ${name}\n  ${error.stack}`); }
  }
  console.log(`\n${tests.length - failures}/${tests.length} career checks passed.`);
  if (failures) process.exitCode = 1;
}
if (require.main === module) runTests();
module.exports = { runFullCareer };
