'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.env.FILM_GAME_ROOT || __dirname;
const Network = require(path.join(ROOT, 'film-network.js'));
const clone = value => JSON.parse(JSON.stringify(value));
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('✓ ' + name); }
  catch (error) { failed++; console.error('✗ ' + name + '\n  ' + error.stack); }
}
function simple(city = 'tel_aviv', week = 1) {
  return { week, life: { cityId: city, retired: false }, debt: 0, project: null, network: Network.empty ? Network.empty() : { contacts: {}, agent: null, gigLastWeek: 0, lastContractWeek: 0, bankLastWeek: 0, festivalMeetings: [] }, festivalCircuit: { history: [] } };
}

test('Network contacts have distinct identities in all five cities', () => {
  assert.equal(Network.PEOPLE.length, 15);
  assert.equal(new Set(Network.PEOPLE.map(p => p.id)).size, 15);
  assert.equal(new Set(Network.PEOPLE.map(p => p.name)).size, 15);
  for (const city of Network.CITIES) {
    assert.deepEqual(Network.PEOPLE.filter(p => p.city === city).map(p => p.role).sort(), ['agent', 'copro', 'producer']);
    for (const week of [1, 3, 5]) assert.ok(Network.visitors(simple(city, week)).every(p => p.city === city));
  }
});
test('Visitor rotation retains a matured contact and keeps city histories independent', () => {
  const s = simple();
  Network.meet(s, 'agent_tel_aviv');
  assert.equal(s.network.contacts.agent_tel_aviv.meetings, 1);
  s.week = 3;
  assert.ok(Network.visitors(s).some(p => p.id === 'agent_tel_aviv'));
  Network.meet(s, 'agent_tel_aviv');
  assert.deepEqual(s.network.contacts.agent_tel_aviv, { firstWeek: 1, lastWeek: 3, meetings: 2 });
  s.life.cityId = 'athens';
  assert.ok(Network.visitors(s).every(p => p.city === 'athens'));
  assert.equal(s.network.contacts.agent_tel_aviv.meetings, 2);
});
test('Offer previews do not mutate state or inspect hidden randomness', () => {
  const s = simple('athens', 5), before = clone(s);
  Object.defineProperty(s, 'rng', { get() { throw new Error('Preview read a hidden roll'); } });
  Object.freeze(s.network.contacts); Object.freeze(s.network); Object.freeze(s.life); Object.freeze(s);
  const p = Network.person('copro_athens');
  const a = Network.offer(s, p, 2), b = Network.offer(s, p, 2);
  assert.deepEqual(a, b); assert.equal(a.productionCity, 'berlin');
  Network.visitors(s); assert.deepEqual(clone(s), before);
});
test('Contract reserve is restricted, conserved and closed only once', () => {
  const s = simple('tel_aviv', 3), person = Network.person('producer_tel_aviv');
  s.week = 1; Network.meet(s, person.id); s.week = 3; Network.meet(s, person.id);
  const offer = Network.offer(s, person, 1);
  const project = { id: 1, type: offer.type, startedWeek: s.week, stage: 'script', budget: 160 };
  project.contract = Network.contract(s, project, offer, project.budget);
  assert.equal(project.contract.awarded, 2200);
  assert.equal(project.contract.balance, 2040);
  assert.ok(Network.validContract(project, s));
  project.contract.balance -= 90; project.contract.spent += 90; project.budget += 90;
  s.life.retired = true; Network.close(project, 3);
  assert.equal(project.contract.balance, 0); assert.equal(project.contract.expired, 1950);
  assert.ok(Network.validContract(project, s));
  const closed = clone(project); Network.close(project, 3); assert.deepEqual(project, closed);
});
test('Contract validation rejects forged money, shares, cities and director payments', () => {
  const s = simple('athens', 5), p = { id: 1, type: 'short', startedWeek: 5, stage: 'script', budget: 90 };
  s.week = 3; Network.meet(s, 'copro_athens'); s.week = 5; Network.meet(s, 'copro_athens');
  p.contract = Network.contract(s, p, Network.offer(s, Network.person('copro_athens'), 1), 0);
  assert.ok(Network.validContract(p, s));
  for (const mutate of [c => c.balance++, c => c.share = 0, c => c.productionCity = 'athens', c => c.feePaid = 50, c => c.personId = 'nobody']) {
    const bad = clone(p); mutate(bad.contract); assert.equal(Network.validContract(bad, s), false);
  }
  const bad = clone(s); bad.network.festivalMeetings = ['not-a-festival-result']; assert.equal(Network.valid(bad), false);
});

if (!process.argv.includes('--module-only')) {
  const G = require(path.join(ROOT, 'game-engine.js'));
  function valid(s) {
    const restored = G.validateSave(s);
    assert.ok(restored, 'legal state must survive validateSave at week ' + s.week + ' / ' + s.project?.stage);
    assert.deepEqual(restored, s, 'save/load must not reroll or change payments');
  }
  function resources(s) { s.hours = 50; s.maxHours = 50; s.used.overtime = 0; s.energy = 100; s.happiness = 50; }
  function fixture(indie = false) {
    const file = indie ? 'film-v2-won-save.json' : 'v4-lifetime-world.json';
    const s = G.validateSave(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures', file), 'utf8')));
    assert.ok(s, 'fixture loads');
    if (s.status !== 'playing') assert.ok(G.continueCareer(s).ok);
    // Existing legal career history; only resources/stats are boosted for isolated route checks.
    resources(s); s.cash = 50000; s.debt = 0; s.craft = 100; s.reputation = 100; s.contacts = 80;
    valid(s); return s;
  }
  function find(s, id) { return G.getActions(s, id.split('.')[0]).find(a => a.id === id); }
  function act(s, id) {
    const a = find(s, id); assert.ok(a && !a.disabled, id + ': ' + a?.reason);
    const result = G.act(s, id); assert.ok(result.ok, result.message); valid(s); return { a, result };
  }
  function deny(s, id) { const before = clone(s); assert.equal(G.act(s, id).ok, false, id + ' must be blocked'); assert.deepEqual(s, before); }
  function clear(s) {
    if (s.productionAlert) assert.ok(G.acknowledgeSetback(s).ok);
    if (s.event) {
      const index = s.event.options.findIndex(o => !o.disabled && s.cash + (o.effects.cash || 0) >= 0);
      assert.ok(index >= 0); assert.ok(G.chooseEvent(s, index).ok);
    }
    valid(s);
  }
  function next(s) {
    clear(s); resources(s); assert.ok(G.endWeek(s).ok); valid(s); clear(s);
    if (s.status !== 'playing') { assert.ok(G.continueCareer(s).ok, 'test route can continue its chapter'); valid(s); }
    resources(s);
  }
  function waitFor(s, id) {
    for (let i = 0; i < 14; i++) { const a = find(s, id); if (a && !a.disabled) return a; next(s); }
    assert.fail('Action never became available: ' + id);
  }
  function acquainted(s, role) {
    const id = role + '_' + s.life.cityId, actionId = 'cafe.network_meet_' + id;
    while ((Network.state(s).contacts[id]?.meetings || 0) < 2) { waitFor(s, actionId); act(s, actionId); }
    return id;
  }
  function represented(s) {
    const id = acquainted(s, 'agent'), sign = 'cafe.network_sign_' + id;
    waitFor(s, sign); act(s, sign); return id;
  }
  function financed(s, kind) {
    const id = acquainted(s, kind);
    if (kind === 'copro' && !s.project) act(s, 'home.start_short');
    const actionId = 'cafe.network_contract_' + id;
    waitFor(s, actionId); resources(s);
    const before = s.cash; act(s, actionId);
    assert.equal(s.cash, before, 'production reserve is not a personal cash grant');
    assert.ok(s.project.contract); return s.project.contract;
  }
  function stage(s, current, actionId) {
    for (let i = 0; s.project?.stage === current && i < 24; i++) {
      clear(s); resources(s); const paidBefore = s.project?.contract?.feePaid;
      act(s, actionId); clear(s);
      if (current === 'shoot' && s.project?.stage === 'shoot' && paidBefore !== undefined) assert.equal(s.project.contract.feePaid, paidBefore, 'no director fee before the final shooting day');
    }
    assert.notEqual(s.project?.stage, current, 'finite workload finishes ' + current);
  }
  function filmToRelease(s) { stage(s, 'script', 'home.write'); stage(s, 'shoot', 'set.shoot_lean'); stage(s, 'edit', 'studio.edit'); }
  function rejected(s, mutate, reason) { const bad = clone(s); mutate(bad); assert.ok(G.validateSave(bad) === null, reason); }

  test('First and follow-up meetings charge once, respect cooldown and retain city-specific history', () => {
    const s = fixture(), first = G.getActions(s, 'cafe').find(a => a.networkKind === 'meet');
    assert.ok(first); const before = clone(s); act(s, first.id);
    assert.equal(s.cash, before.cash - 70); assert.equal(s.contacts, Math.min(100, before.contacts + 5));
    assert.equal(s.network.contacts[first.personId].meetings, 1); deny(s, first.id);
    next(s); deny(s, first.id); next(s); waitFor(s, first.id); act(s, first.id);
    assert.equal(s.network.contacts[first.personId].meetings, 2);
    const contact = clone(s.network.contacts[first.personId]);
    act(s, 'bank.city_athens');
    assert.deepEqual(s.network.contacts[first.personId], contact);
    assert.ok(G.getActions(s, 'cafe').filter(a => a.networkKind === 'meet').every(a => Network.person(a.personId).city === 'athens'));
    deny(s, first.id); valid(s);
  });
  test('Agent commissions apply to arranged gigs, not ordinary wages; gig cooldown survives ending representation', () => {
    const s = fixture(true); represented(s); resources(s);
    const a = find(s, 'set.work'), before = s.cash;
    const wage = Math.round(G.JOBS[s.job].wage * G.getLife(s).city.workMultiplier * (s.characterId === 'tamar' ? 1.15 : 1));
    act(s, a.id); assert.equal(s.cash - before, wage);
    resources(s); const cash = s.cash, income = s.weeklyTotals.income, expenses = s.weeklyTotals.expenses;
    const gross = Math.round((900 + Math.max(0, G.getCareer(s).tier - 1) * 400) * G.getLife(s).city.workMultiplier);
    act(s, 'cafe.network_gig');
    assert.equal(s.cash - cash, gross - Math.round(gross * .1));
    assert.equal(s.weeklyTotals.income - income, gross); assert.equal(s.weeklyTotals.expenses - expenses, Math.round(gross * .1));
    const paidWeek = s.network.gigLastWeek; deny(s, 'cafe.network_gig');
    act(s, 'cafe.network_end_agent'); assert.equal(s.network.gigLastWeek, paidWeek); deny(s, 'cafe.network_gig');
    valid(s);
  });
  test('Producer financing pays film expenses, never a meal, and permits only a commercial premiere', () => {
    const s = fixture(true); const c = financed(s, 'producer');
    assert.equal(s.project.type, 'comedy'); assert.equal(c.spent, G.FILM_TYPES.comedy.initialCost);
    const balance = c.balance, cash = s.cash; act(s, 'cafe.meal');
    assert.equal(c.balance, balance); assert.equal(s.cash, cash - 60);
    stage(s, 'script', 'home.write'); resources(s);
    const crew = G.getFilmCrewOptions(s).find(a => a.id === 'camera_maayan');
    const priorBalance = c.balance, priorBudget = s.project.budget, priorCash = s.cash;
    const { a } = act(s, crew.actionId);
    assert.equal(a.contractUsed, crew.crewCost); assert.equal(a.cost.money, 0);
    assert.equal(c.balance, priorBalance - crew.crewCost); assert.equal(s.project.budget, priorBudget + crew.crewCost); assert.equal(s.cash, priorCash);
    stage(s, 'shoot', 'set.shoot_lean'); assert.equal(c.feePaid, c.directorFee / 2);
    const afterShoot = clone(c); G.getActions(s, 'home'); G.getActions(s, 'set'); valid(s); assert.deepEqual(c, afterShoot);
    deny(s, 'set.shoot_lean'); stage(s, 'edit', 'studio.edit');
    deny(s, 'festival.release_festival'); assert.match(find(s, 'festival.release_festival').reason, /מסחרית/);
    resources(s); const release = find(s, 'studio.release_commercial'), before = s.cash;
    act(s, release.id); const film = s.films.at(-1), contract = film.contract;
    assert.equal(contract.status, 'released'); assert.equal(contract.feePaid, contract.directorFee);
    assert.equal(contract.producerPaid, Math.round(film.revenue * .4)); assert.equal(film.netRevenue, film.revenue - contract.producerPaid);
    assert.equal(s.cash - before, film.netRevenue + contract.directorFee / 2 - release.cost.money);
    assert.equal(contract.balance, 0); assert.equal(contract.spent + contract.expired, contract.awarded);
    deny(s, release.id); valid(s);
    rejected(s, bad => bad.films.at(-1).contract.producerPaid++, 'forged distribution rejected');
    rejected(s, bad => bad.films.at(-1).contract.feePaid++, 'duplicate director payment rejected');
  });
  test('A signed agent rate remains attached to director milestones after representation ends', () => {
    const s = fixture(true); represented(s); const c = financed(s, 'producer'); assert.equal(c.agentRate, 10);
    act(s, 'cafe.network_end_agent'); assert.equal(c.agentRate, 10); filmToRelease(s);
    assert.equal(c.feePaid, c.directorFee / 2); assert.equal(c.feeCommission, Math.round(c.feePaid * .1));
    resources(s); const before = s.cash, release = find(s, 'studio.release_commercial'); act(s, release.id);
    const film = s.films.at(-1);
    assert.equal(film.contract.feeCommission, Math.round(film.contract.directorFee * .1));
    assert.equal(s.cash - before, film.netRevenue + c.directorFee / 2 - Math.round(c.directorFee / 2 * .1) - release.cost.money);
  });
  test('Coproduction preserves residence and records a completed foreign shoot before paying its first milestone', () => {
    const s = fixture(), residence = s.life.cityId, c = financed(s, 'copro');
    assert.notEqual(c.productionCity, residence); assert.equal(c.shotAbroad, false);
    const balance = c.balance; assert.ok(balance > 0); stage(s, 'script', 'home.write');
    assert.equal(c.feePaid, 0); assert.equal(s.life.cityId, residence);
    if (s.project.workload) {
      resources(s); const foreign = find(s, 'set.shoot_lean'), domesticState = clone(s); delete domesticState.project.contract;
      const domestic = find(domesticState, 'set.shoot_lean');
      assert.ok(foreign.description.includes(G.getLife(s).cities.find(city => city.id === c.productionCity).title), 'shooting description names the production country');
      assert.equal(foreign.cost.time, domestic.cost.time + 3, 'first foreign shooting day includes travel time');
      act(s, foreign.id); clear(s); assert.equal(c.shotAbroad, false); assert.equal(c.feePaid, 0);
      resources(s); assert.equal(find(s, foreign.id).cost.time, domestic.cost.time, 'travel time is not charged on every shooting day');
    }
    stage(s, 'shoot', 'set.shoot_lean'); assert.equal(c.shotAbroad, true); assert.equal(c.feePaid, c.directorFee / 2); assert.equal(s.life.cityId, residence);
    rejected(s, bad => bad.project.contract.shotAbroad = false, 'missing foreign shoot rejected');
    stage(s, 'edit', 'studio.edit'); resources(s); act(s, 'festival.release_festival');
    assert.equal(s.films.at(-1).route, 'festival'); assert.equal(s.films.at(-1).contract.status, 'released'); valid(s);
  });
  test('Banker loan charges its stated fee and shares the ordinary borrowing quota', () => {
    for (const first of ['bank.network_loan', 'bank.borrow']) {
      const s = fixture(); while (s.week % 4) next(s);
      const before = { cash: s.cash, debt: s.debt, income: s.weeklyTotals.income, expenses: s.weeklyTotals.expenses };
      act(s, first);
      assert.equal(s.cash - before.cash, first === 'bank.borrow' ? 700 : 1330);
      assert.equal(s.debt - before.debt, first === 'bank.borrow' ? 700 : 1400);
      assert.equal(s.weeklyTotals.income, before.income, 'borrowed principal is not earned income');
      assert.equal(s.weeklyTotals.expenses - before.expenses, first === 'bank.borrow' ? 0 : 70);
      assert.equal(s.used.borrow, 1); deny(s, first === 'bank.borrow' ? 'bank.network_loan' : 'bank.borrow');
      const debt = s.debt; next(s); assert.equal(s.debt, debt + Math.ceil(debt * G.DIFFICULTIES[s.difficulty].interest)); valid(s);
    }
  });
  test('Save validator rejects forged identities, balances, contact counts and future timestamps', () => {
    const s = fixture(true); represented(s); financed(s, 'producer');
    rejected(s, bad => bad.project.contract.balance++, 'forged financing rejected');
    rejected(s, bad => bad.network.agent.personId = 'producer_tel_aviv', 'producer cannot be an agent');
    rejected(s, bad => Object.values(bad.network.contacts)[0].meetings = 3, 'excess meetings rejected');
    rejected(s, bad => bad.network.gigLastWeek = bad.week + 1, 'future gig rejected');
    rejected(s, bad => bad.network.festivalMeetings.push('invented'), 'invented festival meeting rejected');
  });
  test('Missing the delivery deadline withholds the second director fee, without paying it again on reload', () => {
    const s = fixture(true), c = financed(s, 'producer');
    filmToRelease(s); const firstFee = c.feePaid;
    while (s.week <= c.dueWeek) next(s);
    resources(s); const before = s.cash, release = find(s, 'studio.release_commercial'); act(s, release.id);
    const film = s.films.at(-1);
    assert.equal(film.contract.feePaid, firstFee); assert.equal(film.contract.releasePaidWeek, null);
    assert.equal(s.cash - before, film.netRevenue - release.cost.money); valid(s);
    const restored = G.validateSave(s); deny(restored, 'studio.release_commercial');
  });
  test('A real festival selection opens one paid contact meeting and cannot be claimed twice', () => {
    const s = fixture();
    for (let i = 0; i < 8 && !G.getActions(s, 'festival').some(a => a.networkKind === 'festival'); i++) {
      const offer = G.getFestivalSubmissions(s).find(a => !a.disabled && a.waitWeeks === 1);
      assert.ok(offer, 'an eligible film remains for a one-period festival'); resources(s); act(s, offer.actionId); next(s);
    }
    const meeting = G.getActions(s, 'festival').find(a => a.networkKind === 'festival'); assert.ok(meeting, 'deterministic fixture produces a selection');
    resources(s); const cash = s.cash, contacts = s.contacts; act(s, meeting.id);
    assert.equal(s.cash, cash - 90); assert.equal(s.contacts, Math.min(100, contacts + 6));
    assert.ok(s.network.festivalMeetings.includes(meeting.id.slice('festival.network_festival_'.length)));
    assert.ok(s.network.contacts[meeting.personId]); deny(s, meeting.id); valid(s);
  });
  test('Validator rejects signing an agent through save tampering after only one meeting', () => {
    const s = fixture(true), id = 'agent_' + s.life.cityId;
    waitFor(s, 'cafe.network_meet_' + id); act(s, 'cafe.network_meet_' + id);
    assert.equal(s.network.contacts[id].meetings, 1); deny(s, 'cafe.network_sign_' + id);
    rejected(s, bad => bad.network.agent = { personId: id, signedWeek: bad.week }, 'one meeting is insufficient for a representation contract');
  });
  test('Validator rejects changing a producer-financed commercial release into a festival premiere', () => {
    const s = fixture(true); financed(s, 'producer'); filmToRelease(s); resources(s); act(s, 'studio.release_commercial');
    rejected(s, bad => bad.films.at(-1).route = 'festival', 'producer commercial-release condition survives save/load');
  });
}
console.log(passed + ' passed, ' + failed + ' failed.');
if (failed) process.exitCode = 1;
