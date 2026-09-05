/* Independent single-day workload regression audit. Run: node test-film-workload.js
 * Only this file is written. Resource/RNG boundary fixtures isolate production rules;
 * this is not an action-only balance or lifetime playthrough.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.env.FILM_GAME_ROOT || __dirname;
const G = require(path.join(ROOT, 'game-engine.js'));
const W = require(path.join(ROOT, 'film-workload.js'));
const N = require(path.join(ROOT, 'film-network.js'));
const copy = s => JSON.parse(JSON.stringify(s));
const tests = [];
const test = (name, run) => tests.push({name, run});
const EXPECTED = {short:{shoot:2,edit:3},doc:{shoot:3,edit:4},comedy:{shoot:4,edit:6},feature:{shoot:8,edit:12},blockbuster:{shoot:12,edit:18}};
const fixture = name => G.validateSave(fs.readFileSync(path.join(ROOT, 'tests/fixtures', name), 'utf8'));
const restore = s => {
  const value = G.validateSave(JSON.stringify(s));
  assert.ok(value, `valid ${s.project?.type || 'archive'}/${s.project?.stage || 'none'} save`);
  assert.deepEqual(value, s, 'round trip preserves every pending outcome, resource and workday');
  return value;
};
const replenish = s => { s.hours = s.maxHours = 50; s.used.overtime = 0; s.energy = 100; };
const menu = (s, loc) => {
  const before = copy(s), result = G.getActions(s, loc);
  assert.deepEqual(s, before, 'preview never changes state or RNG');
  return result;
};
const preview = (s, id) => menu(s, id.split('.')[0]).find(a => a.id === id);
const gross = a => a.cost.money + a.fundingUsed + a.crowdUsed + a.contractUsed;
const act = (s, id) => {
  const a = preview(s, id);
  assert.ok(a && !a.disabled, `${id} available: ${a?.reason}`);
  const before = copy(s), result = G.act(s, id);
  assert.equal(result.ok, true, result.message);
  assert.equal(s.hours, before.hours - a.cost.time);
  assert.equal(s.energy, before.energy - a.cost.energy);
  assert.ok(s.cash >= 0 && s.energy >= 0 && s.hours >= 0);
  return {before, a, result};
};
const deny = (s, invoke, label) => {
  const before = copy(s), result = invoke();
  assert.equal(result.ok, false, label);
  assert.deepEqual(s, before, `${label}: denial changes nothing`);
};
const notices = s => {
  if (s.productionAlert) assert.equal(G.acknowledgeSetback(s).ok, true);
  if (s.event) {
    const i = s.event.kind === 'production' ? 2 : s.event.options.findIndex(o => !o.disabled && !(o.effects?.cash < 0));
    assert.equal(G.chooseEvent(s, i >= 0 ? i : 0).ok, true);
  }
};
function scene(type = 'short', opts = {}) {
  const s = opts.fresh ? G.createGame({difficulty:'calm', characterId:opts.character || 'amir', seed:opts.seed || 19}) : fixture('v5-lifetime-world.json');
  assert.ok(s, 'career fixture is valid');
  assert.equal(s.project, null, 'world fixture has no active project');
  Object.assign(s, {cash:100000, happiness:30, characterId:opts.character || 'amir', assets:opts.assets || []});
  if (opts.craft !== undefined) s.craft = opts.craft;
  if (opts.seed !== undefined) s.rng = opts.seed;
  replenish(s); notices(s);
  act(s, 'home.start_' + type);
  if (opts.legacy) delete s.project.workload;
  if (opts.stage !== 'script') {replenish(s); act(s, 'home.write'); notices(s);}
  restore(s);
  return s;
}
function work(s, phase, mode, visit = () => {}) {
  const id = phase === 'shoot' ? 'set.shoot_' + mode : mode === 'polish' ? 'studio.edit_polish' : 'studio.edit';
  const rows = [];
  while (s.project.stage === phase) {
    replenish(s);
    const beforeWork = G.getWorkload(s.project);
    const remaining = beforeWork[phase] - beforeWork[phase+'Done'];
    const beforePreview = preview(s,id);
    assert.equal(beforePreview.workDays,1,'each shoot/edit card performs one workday');
    if (!beforeWork.legacy) assert.deepEqual(beforePreview.workProgress,
      {phase,done:beforeWork[phase+'Done'],total:beforeWork[phase],mode},
      'same action card exposes completed days, total days and its mode');
    const row = act(s,id), count = 1, complete = remaining === 1;
    rows.push({...row,count});
    if (!beforeWork.legacy) assert.equal(s.project.workload[phase+'Done'], beforeWork[phase+'Done'] + 1);
    assert.equal(s.project.stage, complete ? phase === 'shoot' ? 'edit' : 'release' : phase);
    assert.equal(s.life.productionLoad,row.before.life.productionLoad+1,'one accepted day adds one production-load unit');
    if (!complete) {
      const next=preview(s,id);
      assert.equal(next.workProgress.done,beforeWork[phase+'Done']+1,'counter updates immediately after the day');
      assert.equal(next.workProgress.total,beforeWork[phase]);
      assert.equal(next.workProgress.mode,mode);
      assert.equal(s.event, null, 'no creative dilemma on an intermediate workday');
      assert.equal(s.productionAlert, null, 'no surprise on an intermediate workday');
      assert.equal(row.result.setback, null);
      assert.equal(row.result.breakthrough, null);
      assert.equal(s.rng, row.before.rng, 'intermediate workdays do not consume production RNG');
    }
    assert.ok(!(row.result.setback && row.result.breakthrough), 'at most one surprise at a stage boundary');
    restore(s);
    visit(row, complete, s);
    if (complete) notices(s);
    assert.ok(rows.length <= 18, 'work terminates');
  }
  return rows;
}
function advanceToEdit(s) {work(s,'shoot','full'); return s;}
function compareCosts(s,phase,mode) {
  const old=copy(s);delete old.project.workload;
  const id=phase==='shoot'?'set.shoot_'+mode:mode==='polish'?'studio.edit_polish':'studio.edit';
  const legacyCost=gross(preview(old,id));
  const rows=work(s,phase,mode);
  assert.equal(rows.reduce((sum,r)=>sum+gross(r.a),0),legacyCost,'daily gross production costs telescope to legacy whole-stage price');
  return rows;
}

test('workload table, fresh projects and pure read APIs', () => {
  assert.deepEqual(W.DAYS, EXPECTED);
  assert.deepEqual(G.PRODUCTION_DAYS, EXPECTED);
  assert.equal(W.view(null), null);
  for (const type of Object.keys(EXPECTED)) {
    const s = scene(type,{stage:'script'}), w = G.getWorkload(s.project);
    assert.equal(w.shoot,EXPECTED[type].shoot); assert.equal(w.edit,EXPECTED[type].edit);
    assert.equal(w.shootDone,0); assert.equal(w.editDone,0);
    assert.equal(w.shootMode,null); assert.equal(w.editMode,null); assert.equal(w.legacy,false);
    const before=copy(s); for(const loc of G.LOCATIONS)menu(s,loc.id); assert.deepEqual(s,before);
  }
});

for (const type of Object.keys(EXPECTED)) {
  test(`${type}: single-day actions finish only on final day and preserve save state`, () => {
    const s=scene(type), all=[];
    const shooting=work(s,'shoot','full',(row,complete,state)=>{
      all.push(row);
      if(complete) {
        assert.equal(state.event?.kind,'production','one dilemma opens when shooting finishes');
        assert.equal(state.event.projectId,state.project.id);
        deny(state,()=>G.act(state,'studio.edit'),'editing before pending notices');
        deny(state,()=>G.endWeek(state),'Cut before pending notices');
      } else {
        assert.equal(preview(state,'studio.edit').disabled,true,'editing is gated during partial shooting');
        assert.equal(preview(state,'studio.release_commercial').disabled,true);
      }
    });
    assert.equal(shooting.reduce((n,r)=>n+r.count,0),EXPECTED[type].shoot);
    assert.ok(s.project.twist,'creative dilemma resolved exactly once');
    const twist=copy(s.project.twist);
    const editing=work(s,'edit','polish',row=>all.push(row));
    assert.equal(editing.reduce((n,r)=>n+r.count,0),EXPECTED[type].edit);
    assert.deepEqual(s.project.twist,twist,'edit days never replace the creative decision');
    assert.equal(s.event,null);
    assert.equal(s.project.setbacks.length<=2,true);
    assert.equal(s.project.breakthroughs.length<=1,true);
    const reports=s.project.setbacks.concat(s.project.breakthroughs);
    assert.equal(new Set(reports.map(r=>r.stage)).size,reports.length,'one surprise maximum per transition');
    const filmId=s.project.id;
    replenish(s);act(s,'studio.release_commercial');
    const film=s.films.find(f=>f.id===filmId);
    assert.equal(film.stage,'released'); assert.equal(film.workload.shootDone,EXPECTED[type].shoot); assert.equal(film.workload.editDone,EXPECTED[type].edit);
    restore(s);
  });
}

for (const type of Object.keys(EXPECTED)) {
  test(`${type}: divided costs and cumulative preview quality`,()=>{
    for(const shootMode of ['lean','full']) for(const editMode of ['basic','polish']) {
      const s=scene(type,{craft:100,assets:['camera','laptop','studio_property']});
      s.project.quality=0;
      const old=copy(s);delete old.project.workload;
      const expectedShootQuality=Number(preview(old,'set.shoot_'+shootMode).effects.find(x=>x.includes('איכות')).match(/^\+(\d+)/)[1]);
      const shots=compareCosts(s,'shoot',shootMode);
      assert.equal(shots.reduce((n,r)=>n+Number(r.a.effects.find(x=>x.includes('איכות')).match(/^\+(\d+)/)[1]),0),expectedShootQuality);
      s.project.quality=0;
      const oldEdit=copy(s);delete oldEdit.project.workload;
      const expectedEditQuality=Number(preview(oldEdit,editMode==='polish'?'studio.edit_polish':'studio.edit').effects.find(x=>x.includes('איכות')).match(/^\+(\d+)/)[1]);
      const edits=compareCosts(s,'edit',editMode);
      assert.equal(edits.reduce((n,r)=>n+Number(r.a.effects.find(x=>x.includes('איכות')).match(/^\+(\d+)/)[1]),0),expectedEditQuality);
      assert.equal(s.project.quality,expectedEditQuality,'editing applies the advertised total without multiplying by workdays');
    }
  });
}

test('each action exactly applies gross expense, personal cost, funding, hours and energy',()=>{
  for(const phase of ['shoot','edit']) {
    const s=scene('doc'); if(phase==='edit')advanceToEdit(s);
    work(s,phase,phase==='shoot'?'full':'polish',(r,complete,state)=>{
      const bad=r.result.setback,good=r.result.breakthrough;
      assert.equal(state.project.budget,r.before.project.budget+gross(r.a)+(bad?.amount||0));
      assert.equal(state.cash,r.before.cash-r.a.cost.money-(bad?.cashPaid||0)+(good?.rewardCash||0));
      assert.equal(state.debt,r.before.debt+(bad?.debtAdded||0));
      assert.equal(state.weeklyTotals.expenses,r.before.weeklyTotals.expenses+r.a.cost.money+(bad?.cashPaid||0)+(bad?.debtAdded||0));
    });
  }
});

test('insufficient hours, cash or energy atomically reject one day and retain the counter',()=>{
  for(const phase of ['shoot','edit']) for(const mode of phase==='shoot'?['lean','full']:['basic','polish']) {
    const base=scene('doc');if(phase==='edit')advanceToEdit(base);
    const id=phase==='shoot'?'set.shoot_'+mode:mode==='polish'?'studio.edit_polish':'studio.edit';
    for(const resource of ['hours','cash','energy']) {
      const s=copy(base);replenish(s);s.location=id.split('.')[0];
      const a=preview(s,id),costKey={hours:'time',cash:'money',energy:'energy'}[resource];
      assert.ok(a.cost[costKey]>0);s[resource]=a.cost[costKey]-1;
      assert.equal(preview(s,id).disabled,true);
      assert.deepEqual(preview(s,id).workProgress,a.workProgress);
      deny(s,()=>G.act(s,id),`${phase} day with insufficient ${resource}`);
      s[resource]=a.cost[costKey];
      act(s,id);
      assert.equal(s.project.workload[phase+'Done'],1);
      assert.equal(preview(s,id).workProgress.done,1);
    }
  }
});

test('exactly affordable single days succeed without fast-forwarding the remaining workload',()=>{
  for(const phase of ['shoot','edit']) {
    const s=scene('doc');if(phase==='edit')advanceToEdit(s);
    const id=phase==='shoot'?'set.shoot_full':'studio.edit_polish';replenish(s);
    const a=preview(s,id);s.hours=a.cost.time;s.energy=a.cost.energy;s.cash=a.cost.money;
    act(s,id);
    assert.equal(s.hours,0);assert.equal(s.energy,0);assert.equal(s.cash,0);
    assert.equal(s.project.stage,phase);assert.equal(s.project.workload[phase+'Done'],1);
    assert.equal(preview(s,id).workProgress.done,1);
  }
});

test('all removed two-day action IDs are absent and rejected atomically at every stage',()=>{
  const removed=['set.shoot_lean_block','set.shoot_full_block','studio.edit_block','studio.edit_polish_block'];
  const check=s=>{
    replenish(s);s.cash=100000;
    const all=G.LOCATIONS.flatMap(loc=>menu(s,loc.id));
    assert.ok(!all.some(a=>a.id.endsWith('_block')),'no block card is exposed anywhere');
    for(const id of removed){assert.equal(preview(s,id),undefined);deny(s,()=>G.act(s,id),'removed ID '+id);}
  };
  const s=scene('comedy',{stage:'script'});check(s);
  act(s,'home.write');notices(s);check(s);
  act(s,'set.shoot_full');check(s);
  advanceToEdit(s);check(s);
  act(s,'studio.edit_polish');check(s);
  work(s,'edit','polish');check(s);
  act(s,'studio.release_commercial');check(s);
  const old=scene('doc',{legacy:true});check(old);
});

test('mode locks on the first accepted day and survives save/Cut',()=>{
  for(const phase of ['shoot','edit']) for(const mode of phase==='shoot'?['lean','full']:['basic','polish']) {
    const s=scene('comedy',{fresh:true});if(phase==='edit')advanceToEdit(s);
    const prefix=phase==='shoot'?'set.shoot_':'studio.';
    const actionMode=m=>phase==='shoot'?m:m==='basic'?'edit':'edit_polish';
    replenish(s);act(s,prefix+actionMode(mode));
    const stored=copy(s.project.workload),other=phase==='shoot'?(mode==='lean'?'full':'lean'):(mode==='basic'?'polish':'basic');
    let saved=restore(s);
    assert.equal(G.endWeek(saved).ok,true);notices(saved);
    assert.deepEqual(saved.project.workload,stored,'Cut does not reset daily progress or selected mode');
    deny(saved,()=>G.act(saved,prefix+actionMode(other)),'alternate mode is locked');
    assert.equal(preview(saved,prefix+actionMode(mode)).workProgress.done,stored[phase+'Done']);
    replenish(saved);act(saved,prefix+actionMode(mode));restore(saved);
  }
});

test('partial shooting and editing save/resume produce exactly the same next action and outcome',()=>{
  for(const phase of ['shoot','edit']) {
    const s=scene('comedy');if(phase==='edit')advanceToEdit(s);
    const id=phase==='shoot'?'set.shoot_full':'studio.edit_polish';
    replenish(s);act(s,id);const twin=restore(s);replenish(s);replenish(twin);
    assert.deepEqual(menu(s,id.split('.')[0]),menu(twin,id.split('.')[0]));
    assert.equal(preview(s,id).workProgress.done,1);
    const result=G.act(s,id);assert.equal(result.ok,true);
    assert.deepEqual(result,G.act(twin,id));
    assert.equal(preview(s,id).workProgress.done,2);
    assert.deepEqual(s,twin);restore(s);
  }
});

test('malformed progress fields and impossible stage combinations are rejected',()=>{
  const initial=scene('doc',{stage:'script'}),partial=scene('doc');replenish(partial);act(partial,'set.shoot_full');
  const edit=advanceToEdit(scene('doc'));replenish(edit);act(edit,'studio.edit');
  const mutations=[
    ['null',s=>s.project.workload=null],['array',s=>s.project.workload=[]],['empty',s=>s.project.workload={}],
    ['missing shootDone',s=>delete s.project.workload.shootDone],['negative',s=>s.project.workload.shootDone=-1],
    ['fractional',s=>s.project.workload.shootDone=0.5],['string',s=>s.project.workload.shootDone='1'],
    ['shoot overflow',s=>s.project.workload.shootDone=EXPECTED.doc.shoot+1],['edit overflow',s=>s.project.workload.editDone=EXPECTED.doc.edit+1],
    ['unknown shoot mode',s=>s.project.workload.shootMode='polish'],['unknown edit mode',s=>s.project.workload.editMode='full'],
  ];
  for(const [label,mutate] of mutations)for(const base of [initial,partial,edit]){const s=copy(base);mutate(s);assert.equal(G.validateSave(s),null,label);}
  for(const [base,mutate,label] of [
    [initial,s=>s.project.workload.shootMode='full','mode selected with zero days'],
    [partial,s=>s.project.workload.shootMode=null,'day completed without mode'],
    [partial,s=>{s.project.workload.editDone=1;s.project.workload.editMode='basic';},'editing before shooting finishes'],
    [partial,s=>s.project.stage='edit','premature edit stage'],
    [edit,s=>s.project.stage='release','premature release stage'],
    [edit,s=>s.project.workload.editMode=null,'editing completed without edit mode'],
    [edit,s=>s.project.stage='script','completed work regressed to script'],
  ]){const s=copy(base);mutate(s);assert.equal(G.validateSave(s),null,label);}
});

test('saved override fields cannot shorten workload, bypass modes or create an invalid post-action save',()=>{
  for(const [field,value] of [['shoot',1],['edit',1],['legacy',true]]) {
    const corrupt=scene('doc');corrupt.project.workload[field]=value;
    const loaded=G.validateSave(corrupt);
    if(!loaded)continue; // Either reject unknown derived fields or ignore them safely.
    const w=G.getWorkload(loaded.project);
    assert.equal(w.shoot,EXPECTED.doc.shoot,`${field} cannot override canonical shooting total`);
    assert.equal(w.edit,EXPECTED.doc.edit,`${field} cannot override canonical editing total`);
    assert.equal(w.legacy,false);
    replenish(loaded);act(loaded,'set.shoot_full');
    assert.equal(loaded.project.stage,'shoot');restore(loaded);
  }
});

test('cumulative quality and craft stay equal to one original stage at changing skill thresholds',()=>{
  for(const phase of ['shoot','edit']) for(let craft=0;craft<35;craft++) {
    const s=scene(phase==='shoot'?'short':'doc',{fresh:true,craft,seed:37});
    if(phase==='edit')advanceToEdit(s);
    s.project.quality=0;s.location=phase==='shoot'?'set':'studio';
    const old=copy(s);delete old.project.workload;
    const id=phase==='shoot'?'set.shoot_full':'studio.edit_polish';
    const wholeQuality=Number(preview(old,id).effects.find(x=>x.includes('איכות')).match(/^\+(\d+)/)[1]);
    const startCraft=s.craft;
    let finalQuality;
    const rows=work(s,phase,phase==='shoot'?'full':'polish',(r,complete,state)=>{if(complete)finalQuality=state.project.quality;});
    assert.equal(finalQuality,wholeQuality,`${phase}, starting craft ${craft}: quality total`);
    assert.equal(s.craft,Math.min(100,startCraft+5),'craft reward is distributed, not multiplied by days');
    assert.equal(rows.length,EXPECTED[s.project.type][phase]);
  }
});

test('crowdfunding is consumed per day and an unaffordable day cannot partially spend restricted funds',()=>{
  // Read the genuine funded campaign while normalizing only its development-era
  // zero-day workload in memory. No fixture or source file is changed.
  const raw=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/v5-crowdfunding-funded.json'),'utf8'));
  assert.equal(raw.project.stage,'script');delete raw.project.workload;
  const s=G.validateSave(raw);assert.ok(s);s.happiness=30;
  s.project.workload=W.create();restore(s);
  replenish(s);act(s,'home.write');notices(s);replenish(s);s.location='set';
  const a=preview(s,'set.shoot_full');assert.ok(a.crowdUsed>0);
  if(a.cost.money>0)s.cash=a.cost.money-1;else s.hours=a.cost.time-1;
  deny(s,()=>G.act(s,'set.shoot_full'),'cannot partly consume crowdfunding on a denied day');
  replenish(s);s.cash=100000;
  const before=copy(s);act(s,'set.shoot_full');
  assert.equal(s.project.crowdfunding.balance,before.project.crowdfunding.balance-a.crowdUsed);
  assert.equal(s.project.crowdfunding.spent,before.project.crowdfunding.spent+a.crowdUsed);
  assert.equal(s.cash,before.cash-a.cost.money);
  assert.equal(preview(s,'set.shoot_full').workProgress.done,1);restore(s);
});

test('captured skill values are required only after their phase begins and cannot be malformed',()=>{
  const script=scene('doc',{stage:'script'}),shoot=scene('doc'),edit=advanceToEdit(scene('doc'));
  replenish(shoot);act(shoot,'set.shoot_full');
  replenish(edit);act(edit,'studio.edit');
  for(const phase of ['shoot','edit']) {
    const field=phase+'Craft';
    for(const value of [null,-1,101,1.5,'20',{},[]]) {
      const s=copy(phase==='shoot'?shoot:edit);s.project.workload[field]=value;
      assert.equal(G.validateSave(s),null,`${field} rejects ${JSON.stringify(value)} after a day is completed`);
    }
    const missing=copy(phase==='shoot'?shoot:edit);delete missing.project.workload[field];
    assert.equal(G.validateSave(missing),null,'missing captured skill is corruption in a modern workload');
    const premature=copy(script);premature.project.workload[field]=20;
    assert.equal(G.validateSave(premature),null,'unstarted phase has no captured skill');
  }
});

test('phase skill is captured once: an intervening course cannot change already chosen daily quality totals',()=>{
  for(const phase of ['shoot','edit']) {
    const s=scene('doc',{fresh:true,craft:8});if(phase==='edit')advanceToEdit(s);
    const id=phase==='shoot'?'set.shoot_full':'studio.edit_polish';replenish(s);act(s,id);
    const savedCraft=s.project.workload[phase+'Craft'];
    const before=preview(s,id).effects.find(x=>x.includes('איכות'));
    replenish(s);act(s,'school.course');
    assert.ok(s.craft>savedCraft);
    assert.equal(s.project.workload[phase+'Craft'],savedCraft);
    assert.equal(preview(s,id).effects.find(x=>x.includes('איכות')),before);
    restore(s);
  }
});

test('director fee and foreign-shoot milestone happen once, only after all shooting days',()=>{
  for(const kind of ['producer','copro']) {
    const s=scene('comedy');
    const person=N.PEOPLE.find(p=>p.role===kind&&p.city===s.life.cityId);
    N.meet(s,person.id);N.meet(s,person.id);
    const offer=N.offer(s,person,1);s.project.contract=N.contract(s,s.project,offer,0);
    N.ensure(s).lastContractWeek=s.week;restore(s);
    const fullFee=s.project.contract.directorFee;
    work(s,'shoot','full',(r,complete,state)=>{
      const c=state.project.contract;
      assert.equal(c.feePaid,complete?fullFee/2:0);
      assert.equal(c.shootPaidWeek,complete?s.week:null);
      assert.equal(c.shotAbroad,complete&&kind==='copro');
      assert.equal(state.cash,r.before.cash-r.a.cost.money-(r.result.setback?.cashPaid||0)+(r.result.breakthrough?.rewardCash||0)+(complete?fullFee/2:0));
    });
    const c=copy(s.project.contract);replenish(s);
    deny(s,()=>G.act(s,'set.shoot_full'),'no extra shoot after final payment');
    act(s,'studio.edit_polish');
    assert.equal(s.project.contract.feePaid,c.feePaid);restore(s);
  }
});

test('production notice save is deterministic and neither acknowledgment nor repeated choice rerolls hooks',()=>{
  let found;
  for(let seed=1;seed<=100&&!found;seed++) {
    const s=scene('doc',{seed:Math.imul(seed,2654435761)>>>0});
    work(s,'shoot','full',(r,complete,state)=>{if(complete&&state.productionAlert)found=copy(state);});
  }
  assert.ok(found,'seeded stage-boundary surprise reached');
  const twin=restore(found),before=copy(found);
  deny(found,()=>G.chooseEvent(found,2),'dilemma blocked by production notice');
  assert.equal(G.acknowledgeSetback(found).ok,true);assert.equal(G.acknowledgeSetback(twin).ok,true);
  for(const key of ['project','cash','debt','rng','hours','energy','event'])assert.deepEqual(found[key],before[key]);
  deny(found,()=>G.acknowledgeSetback(found),'double production acknowledgment');
  assert.deepEqual(G.chooseEvent(found,2),G.chooseEvent(twin,2));assert.deepEqual(found,twin);
  deny(found,()=>G.chooseEvent(found,2),'repeated dilemma choice');restore(found);
});

test('Kobi improvisation randomness occurs only on final shoot day',()=>{
  const s=scene('doc',{character:'kobi'});
  let earlier=0,final=0;
  work(s,'shoot','lean',(r,complete,state)=>{
    if(complete){final++;assert.notEqual(state.rng,r.before.rng);}else{earlier++;assert.equal(state.rng,r.before.rng);}
  });
  assert.equal(earlier,2);assert.equal(final,1);
  assert.equal(s.log.filter(entry=>JSON.stringify(entry).includes('האלתור של קובי:')).length,1);
});

test('legacy active project still finishes in single actions; its next new project uses workloads',()=>{
  const s=fixture('film-v2-active-save.json');assert.ok(s);
  assert.equal(s.version,5);assert.equal(s.project.workload,undefined);s.cash=100000;s.happiness=30;
  replenish(s);act(s,'home.write');notices(s);
  assert.equal(G.getWorkload(s.project).legacy,true);
  assert.equal(preview(s,'set.shoot_full_block'),undefined);
  work(s,'shoot','full');assert.equal(s.project.stage,'edit');
  assert.equal(preview(s,'studio.edit_polish_block'),undefined);
  work(s,'edit','polish');assert.equal(s.project.stage,'release');
  replenish(s);act(s,'studio.release_commercial');restore(s);
  const legacyFilm=copy(s.films.at(-1));assert.equal(legacyFilm.workload,undefined);
  replenish(s);act(s,'home.start_short');
  assert.equal(G.getWorkload(s.project).legacy,false);assert.equal(s.project.workload.shootDone,0);
  assert.deepEqual(s.films.at(-1),legacyFilm);restore(s);
});

test('modern released films and legacy films coexist without converting either save shape',()=>{
  const s=scene('short');
  const oldIds=s.films.filter(f=>f.workload===undefined).map(f=>f.id);
  // Ensure at least one complete earlier film retains the explicitly supported legacy shape.
  if(!oldIds.length){delete s.films[0].workload;oldIds.push(s.films[0].id);}
  advanceToEdit(s);work(s,'edit','polish');replenish(s);act(s,'studio.release_commercial');
  const loaded=restore(s);
  assert.ok(loaded.films.at(-1).workload);
  for(const id of oldIds)assert.equal(loaded.films.find(f=>f.id===id).workload,undefined);
});

let passed=0;
const failed=[];
for(const t of tests){
  try{t.run();passed++;console.log('PASS '+t.name);}
  catch(error){failed.push({name:t.name,message:error.message});console.error('FAIL '+t.name+'\n'+error.stack);}
}
console.log(`\n${passed}/${tests.length} single-day workload tests passed.`);
if(failed.length){console.log(JSON.stringify({failed},null,2));process.exitCode=1;}
