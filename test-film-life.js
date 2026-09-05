/* Focused V4 draft tests. Boundary fixtures are labeled; integration fixtures are
 * generated exclusively by the existing public real-action playthrough policy. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const G = require('./game-engine');
const L = require('./film-life');
const Base = require('./test-film-game');
const Career = require('./test-film-career');
const clone = value => JSON.parse(JSON.stringify(value));
const tests = [], test = (name, run) => tests.push([name, run]);
const fresh = () => G.createGame({ difficulty: 'calm', seed: 7 });
const full = Career.runFullCareer('calm', 7, 'kobi').state;
const ready = () => { const s=clone(full); Base.chooseBalancedEvent(s); s.hours=s.maxHours;s.energy=100;return s; };
const menu = (s,id) => G.getActions(s,id.split('.')[0]).find(a=>a.id===id);
const perform = (s,id) => { const a=menu(s,id); assert.ok(a && !a.disabled, id+': '+a?.reason); assert.equal(G.act(s,id).ok,true); if(s.productionAlert)G.acknowledgeProductionEvent(s); return a; };
const deny = (s,id) => { const before=clone(s); assert.equal(G.act(s,id).ok,false,id); assert.deepEqual(s,before); };
const save = s => { const copy=G.validateSave(s); assert.ok(copy,'save validates'); assert.deepEqual(copy,s,'round trip is stable'); return copy; };
const round = s => { Base.chooseBalancedEvent(s); if(s.status==='won'||s.status==='lost') assert.equal(G.continueCareer(s).ok,true); assert.equal(G.endWeek(s).ok,true); };

test('old v1/v2/v3 saves preserve cash, movies, project and open event without a retroactive bill',()=>{
  for(const name of ['film-v1-save.json','film-v2-active-save.json','film-v2-won-save.json','v3-career-browser.json']) {
    const old=JSON.parse(fs.readFileSync('tests/fixtures/'+name)); const s=G.validateSave(old);assert.ok(s,name);assert.equal(s.version,5); assert.equal(s.cash,old.cash);assert.equal(s.debt,old.debt);assert.equal(s.hours,old.hours+18);
    assert.equal(s.films.length,old.films.length); assert.equal(s.project?.title,old.project?.title);assert.equal(s.event?.title,old.event?.title);
    if(old.version===3){for(let i=0;i<old.films.length;i++)for(const key of Object.keys(old.films[i]))assert.deepEqual(s.films[i][key],old.films[i][key]); for(const key of Object.keys(old.project||{}))assert.deepEqual(s.project[key],old.project[key]);assert.deepEqual(s.event,old.event);assert.ok(s.films.every(f=>f.releasedQuarter===undefined));}
    const past=Math.min(247,Math.max(0,old.rival.lastReportWeek||old.week-1)); assert.equal(G.getLife(s).age,23+past/4);save(s);
  }
});
test('clock only advances on a successful round; reads, saves, failed actions and event choice never age the player',()=>{
 const s=fresh();const start=clone(s);for(let i=0;i<8;i++){G.getLife(s);G.getLifeActions(s,'bank');G.getActions(s,'cafe');save(s);}assert.deepEqual(s,start);
 deny(s,'bank.stockbuy_takela');perform(s,'home.rest');assert.equal(G.getLife(s).age,23);round(s);assert.equal(G.getLife(s).age,23.25);const q=s.life.quarters;
 const pending=clone(s);assert.equal(G.endWeek(s).ok,false);assert.deepEqual(s,pending);Base.chooseBalancedEvent(s);assert.equal(s.life.quarters,q);save(s);
});
test('all cities gate on achievements; relocation preserves everything except shown cash/time/contacts',()=>{
 const novice=fresh();assert.equal(menu(novice,'bank.city_athens').careerLocked,true);deny(novice,'bank.city_athens');
 for(const city of L.CITIES.filter(c=>c.id!=='tel_aviv')){const s=ready();const before=clone(s);const a=perform(s,'bank.city_'+city.id);assert.equal(a.cost.time,4);assert.equal(s.hours,before.hours-4);assert.equal(s.cash,before.cash-city.moveCost);assert.equal(s.contacts,before.contacts-5);assert.deepEqual(s.films,before.films);assert.deepEqual(s.assets,before.assets);save(s);deny(s,a.id);}
});
test('active movie prevents a move; film grant credit never pays relocation or stocks',()=>{
 const s=ready();perform(s,'home.start_doc'); const film=clone(s.project);for(const city of L.CITIES)deny(s,'bank.city_'+city.id);assert.deepEqual(s.project,film);
 // Explicit boundary: restricted money cannot cover personal trades.
 s.project.grantBudget=900;s.project.grantAwarded=900;s.cash=0;deny(s,'bank.stockbuy_takela');assert.equal(s.project.grantBudget,900);
});
test('city wages, camera and studio discounts are each applied exactly once',()=>{
 for(const city of L.CITIES){const s=ready();s.life.cityId=city.id; // boundary: isolate price formula from travel and a multi-round production
  s.characterId='tamar';s.assets=['camera','laptop','studio_property'];s.project={...clone(full.films[0]),stage:'shoot',type:'feature',grantBudget:0,workload:require('./film-workload').create()};s.event=null;
  const wage=Math.round(G.JOBS[s.job].wage*city.workMultiplier*1.15);assert.ok(menu(s,'set.work').effects.includes('+'+wage.toLocaleString('he-IL')+' ₪'));
  assert.equal(menu(s,'set.shoot_full').cost.money,Math.round(Math.round((4200+450)*.65*.85*city.productionMultiplier)/G.PRODUCTION_DAYS.feature.shoot));
  s.project.stage='edit';if(s.project.workload)Object.assign(s.project.workload,{shootDone:G.PRODUCTION_DAYS[s.project.type].shoot,shootMode:'lean',shootCraft:0,editDone:0,editMode:null,editCraft:null});assert.equal(menu(s,'studio.edit_polish').cost.money,Math.round(Math.round((480+700-150)*.85*city.productionMultiplier)/G.PRODUCTION_DAYS.feature.edit));
 }
});
test('city cost of living is one key-week bill, not 13 repeated weeks',()=>{
 for(const city of L.CITIES){const s=fresh();s.life.cityId=city.id;const cash=s.cash;assert.equal(G.endWeek(s).ok,true);assert.equal(s.cash,cash-Math.round(330*city.livingMultiplier));assert.equal(s.weeklySummary.expenses,Math.round(330*city.livingMultiplier)+20);}
});
test('each foreign city has a usable local opportunity, limited globally for the round',()=>{
 for(const [city,id] of [['athens','set.city_athens'],['berlin','cafe.city_berlin'],['london','set.city_london'],['los_angeles','cafe.city_los_angeles']]){
  const s=ready();perform(s,'bank.city_'+city);const a=perform(s,id);assert.equal(a.cityOffer,true);deny(s,id);save(s);
  s.life.cityId=city==='berlin'?'los_angeles':'berlin';deny(s,s.life.cityId==='berlin'?'cafe.city_berlin':'cafe.city_los_angeles');
 }
});
test('stock buy and sell disclose exact fee, basis, proceeds, realized loss; no same-price arbitrage',()=>{
 for(const stock of L.STOCKS){const s=ready();const cash=s.cash,worth=G.netWorth(s),expenses=s.weeklyTotals.expenses;const buy=perform(s,'bank.stockbuy_'+stock.id);assert.equal(buy.trade.quantity,5);assert.equal(s.cash,cash-buy.trade.total);assert.equal(G.netWorth(s),worth-buy.trade.fee);assert.equal(s.life.market.costBasis[stock.id],buy.trade.total);
  const sell=perform(s,'bank.stocksell_'+stock.id);assert.equal(s.cash,cash-buy.trade.fee-sell.trade.fee);assert.equal(s.life.market.realizedProfit,-buy.trade.fee-sell.trade.fee);assert.equal(sell.trade.realizedProfit,-buy.trade.fee-sell.trade.fee);assert.equal(s.weeklyTotals.expenses,expenses+buy.trade.fee+sell.trade.fee);assert.equal(s.life.market.holdings[stock.id],0);assert.equal(s.life.market.costBasis[stock.id],0);save(s);deny(s,'bank.stockbuy_'+stock.id);
 }
});
test('market RNG is independent of player RNG, stable on reload, and produces both gains and losses',()=>{
 const a=ready(),b=clone(a);let up=false,down=false;
 for(let i=0;i<30;i++){b.rng=(b.rng+12345)>>>0||1;const ra=L.advance(a),rb=L.advance(b);assert.deepEqual(ra,rb);assert.deepEqual(a.life.market,b.life.market);for(const c of ra.changes){up||=c.change>0;down||=c.change<0;}assert.ok(a.life.market.headline.includes('%')||a.life.market.headline.includes('שקט'));}
 assert.ok(up&&down);
 const s=ready();perform(s,'bank.stockbuy_takela');const reload=save(s);G.getLife(reload);assert.deepEqual(reload,s);
});
test('all partner identities are selectable by all player characters; first meeting consumes the round date',()=>{
 for(const character of G.CHARACTERS)for(const partner of L.PARTNERS){const s=ready();s.characterId=character.id;perform(s,'cafe.partner_'+partner.id);assert.equal(G.getLife(s).relationship.partner.id,partner.id);assert.equal(s.life.relationship.closeness,45);deny(s,'home.date');perform(s,'home.breakup');assert.equal(s.life.relationship.closeness,0);deny(s,'cafe.partner_'+partner.id);save(s);}
});
test('relationship load only lowers closeness, never penalizes singles; zero survives JSON exactly',()=>{
 const a=ready(),b=clone(a);a.life.relationship.partnerId='noam';a.life.relationship.closeness=0;a.life.productionLoad=2;b.life.productionLoad=2;
 const happyA=a.happiness,happyB=b.happiness,report=L.advance(a);L.advance(b);assert.equal(report.relationshipChange,0);assert.equal(Object.is(report.relationshipChange,-0),false);assert.equal(a.happiness,happyA);assert.equal(b.happiness,happyB);
 a.life.relationship.closeness=45;a.life.productionLoad=1;assert.equal(L.advance(a).relationshipChange,-2);
});
test('continuation after lost chapter preserves active film and does not refresh market, dates or boards',()=>{
 const s=ready();perform(s,'home.start_doc');const p=clone(s.project);s.status='lost';s.ending='boundary: chapter loss';s.life.lastRecordedChapter=s.season;s.life.chaptersCompleted=s.season;
 s.life.market.trades=2;s.life.relationship.usedDate=true;const m=clone(s.life.market),boards=clone(s.locationBoards),q=s.life.quarters,hours=s.hours;assert.equal(G.getLife(s).chapter.canContinue,true);assert.equal(G.continueCareer(s).ok,true);assert.deepEqual(s.project,p);assert.equal(s.life.chapterProjectId,p.id);assert.deepEqual(s.life.market,m);assert.deepEqual(s.locationBoards,boards);assert.equal(s.life.relationship.usedDate,true);assert.equal(s.hours,hours);assert.equal(s.life.quarters,q);assert.equal(G.getCareer(s).seasonGoal.label,'להוציא את הסרט שכבר התחלת');save(s);
});
test('bankruptcy cannot be continued even with won status, or hidden by goal completion',()=>{
 for(const status of ['won','lost']){const s=ready();s.status=status;s.debt=6501;const before=clone(s);assert.equal(G.getLife(s).chapter.canContinue,false);assert.equal(G.continueCareer(s).ok,false);assert.deepEqual(s,before);}
 const s=ready();s.cash=1000000;s.debt=6501;s.craft=s.reputation=s.happiness=100;perform(s,'home.rest');assert.notEqual(s.status,'won');
});
test('optional retirement is an atomic irreversible action, works from a won chapter, and saves',()=>{
 const s=ready();s.life.quarters=s.life.market.quarter=168;s.status='won';s.life.lastRecordedChapter=s.season;s.life.chaptersCompleted=s.season;s.life.chaptersWon=s.season;
 const cash=s.cash,hours=s.hours;perform(s,'home.retire');assert.equal(s.status,'retired');assert.equal(s.cash,cash);assert.equal(s.hours,hours);assert.equal(G.getLife(s).retired,true);save(s);
 for(const id of ['home.retire','home.rest','bank.stockbuy_takela','cafe.partner_maya'])deny(s,id);assert.equal(G.continueCareer(s).ok,false);assert.equal(G.endWeek(s).ok,false);
});
test('mandatory retirement at 85 wins precedence over simultaneous chapter victory and preserves final project',()=>{
 const s=ready();s.life.quarters=s.life.market.quarter=247;s.cash=1000000;s.craft=s.reputation=s.happiness=100;
 assert.equal(G.endWeek(s).ok,true);assert.equal(G.getLife(s).age,85);assert.equal(s.status,'retired');save(s);
 const t=ready();perform(t,'home.start_doc');const title=t.project.title;t.life.quarters=t.life.market.quarter=247;assert.equal(G.endWeek(t).ok,true);assert.equal(t.project.title,title);assert.equal(t.status,'retired');save(t);
});
test('royalties decay in four defined windows for new and legacy films',()=>{
 const newFilm={royalty:100,releasedQuarter:5,releasedWeek:99};for(const [q,amount] of [[5,100],[12,100],[13,50],[20,50],[21,25],[28,25],[29,10],[247,10]])assert.equal(L.royalty(newFilm,q),amount);
 const oldFilm={royalty:100,releasedWeek:6};assert.equal(L.royalty(oldFilm,13),50);assert.deepEqual(oldFilm,{royalty:100,releasedWeek:6});
 const s=ready();s.life.quarters=s.life.market.quarter=100;const expected=s.films.reduce((sum,f)=>sum+L.royalty(f,100),0);assert.equal(G.getLife(s).currentRoyalties,expected);const rivalExpected=s.rival.films.reduce((sum,f)=>sum+L.royalty(f,100),0);G.endWeek(s);assert.equal(s.weeklySummary.royalties,expected);assert.ok(s.weeklySummary.rivalReport.royalties>=rivalExpected);save(s);
});
test('rival repays principal out of surplus and keeps cash and net-wealth ledgers consistent',()=>{
 const s=clone(full),r=s.rival;assert.ok(r.history.some(report=>report.debtRepaid>0));assert.equal(r.debt,0);
 assert.equal(r.cash,G.DIFFICULTIES[s.difficulty].startingCash+r.history.reduce((sum,report)=>sum+report.delta.cash,0));for(const report of r.history)assert.equal(report.delta.wealth,report.delta.income-report.delta.expenses);save(s);
});
test('malformed life saves reject impossible quarters, positions, relationship state and incomplete v4 state',()=>{
 const s=ready();for(const mutate of [x=>delete x.life,x=>x.life.quarters=249,x=>x.life.market.quarter++,x=>x.life.market.holdings.takela=3,x=>x.life.market.costBasis.takela=2,x=>x.life.market.prices.takela=0,x=>x.life.market.rng=0,x=>x.life.market.trades=3,x=>x.life.relationship.partnerId='unknown',x=>x.life.relationship.closeness=50,x=>x.life.retired=true,x=>x.life.chaptersCompleted=-1]){const bad=clone(s);mutate(bad);assert.equal(G.validateSave(bad),null);}
});
test('three real first chapters and full senior career remain reachable and saveable',()=>{
 for(const difficulty of ['calm','normal','hard']){const s=Base.runBalanced(difficulty,7).state;assert.equal(s.status,'won');assert.equal(s.life.chaptersWon,1);assert.ok(s.life.quarters>=s.rival.lastReportWeek);assert.ok(s.life.quarters<=s.rival.lastReportWeek*4);save(s);}
 assert.equal(G.getCareer(full).tier,4);assert.ok(full.assets.includes('studio_property'));save(full);
});
test('senior production periods advance one year, cap at85, and rotate the market only once',()=>{
 const s=ready(),before=s.life.quarters,market=clone(s.life.market);assert.equal(G.getLife(s).nextPeriodQuarters,4);assert.equal(G.getLife(s).nextPeriodMonths,12);
 const twin=clone(s);const expected=L.advance(twin,4);G.endWeek(s);assert.equal(s.life.quarters,before+4);assert.deepEqual(s.life.market,twin.life.market);assert.equal(s.weeklySummary.lifeReport.durationQuarters,4);assert.notEqual(s.life.market.rng,market.rng);
 const last=ready();last.life.quarters=last.life.market.quarter=247;assert.equal(G.getLife(last).nextPeriodMonths,3);G.endWeek(last);assert.equal(last.life.quarters,248);assert.equal(last.status,'retired');save(last);
});
test('festival entry is blocked beyond retirement and voluntary retirement waits for pending decisions',()=>{
 const s=ready();s.life.quarters=s.life.market.quarter=247;const option=G.getFestivalSubmissions(s).find(x=>x.festivalId==='world_frame'&&x.filmType!=='short');
 const world=G.getFestivalSubmissions(s).filter(x=>x.festivalId==='world_frame');assert.ok(world.length);assert.ok(world.every(x=>x.disabled));assert.ok(world.some(x=>x.reason.includes('85')));for(const x of world)deny(s,x.actionId);
 const t=ready();t.life.quarters=t.life.market.quarter=168;const available=G.getFestivalSubmissions(t).find(x=>!x.disabled);assert.ok(available);perform(t,available.actionId);deny(t,'home.retire');save(t);
});
test('a previously valid late festival entry refunds once at85, without rolling a result or discarding history',()=>{
 const s=ready();s.life.quarters=s.life.market.quarter=236;const world=G.getFestivalSubmissions(s).find(x=>x.festivalId==='world_frame'&&!x.disabled);assert.ok(world);perform(s,world.actionId);const entry=clone(s.festivalCircuit.pending[0]);
 // Boundary simulates an older save or faster period after a newly earned career tier.
 s.life.quarters=s.life.market.quarter=247;const circuitRng=s.festivalCircuit.rng,cash=s.cash,royalties=G.getLife(s).currentRoyalties,rent=s.assets.reduce((n,id)=>n+(G.ASSETS[id].rent||0),0);
 assert.equal(G.endWeek(s).ok,true);assert.equal(s.status,'retired');assert.equal(s.festivalCircuit.pending.length,0);assert.equal(s.festivalCircuit.rng,circuitRng);const result=s.festivalCircuit.history.find(x=>x.id===entry.id);assert.equal(result.outcome,'withdrawn');assert.equal(result.cash,entry.fee);assert.equal(result.reputation,0);assert.equal(s.cash,cash+royalties+rent-330+entry.fee);assert.ok(s.weeklySummary.festivalResults.some(x=>x.id===entry.id));
 const reload=save(s);const finalCash=reload.cash;assert.equal(G.endWeek(reload).ok,false);assert.equal(G.continueCareer(reload).ok,false);assert.equal(reload.cash,finalCash);
});
test('a legal city move may lower career tier without invalidating the already-drawn board',()=>{
 const s=ready();s.contacts=52;s.locationBoards.gear.offerIds=['sponsor_demo','light_demo','sound_workshop'];s.locationBoards.gear.usedIds=[];save(s);assert.equal(G.getCareer(s).tier,3);
 perform(s,'bank.city_berlin');assert.equal(G.getCareer(s).tier,2);assert.equal(menu(s,'gear.offer_sponsor_demo').careerLocked,true);assert.ok(s.locationBoards.gear.offerIds.includes('sponsor_demo'));save(s);
});
let failed=0;for(const [name,run] of tests){try{run();console.log('✓ '+name);}catch(error){failed++;console.error('✗ '+name+'\n'+error.stack);}}
console.log(`${tests.length-failed}/${tests.length} life checks passed.`);if(failed)process.exitCode=1;
