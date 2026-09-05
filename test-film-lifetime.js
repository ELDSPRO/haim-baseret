/* A complete life uses only exposed game actions; no resources or ages are injected. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const G=require('./game-engine.js');
const Base=require('./test-film-game.js');
const Career=require('./test-film-career.js');
const copy=s=>JSON.parse(JSON.stringify(s));
function runLifetime(difficulty,seed){
 const early=Career.runFullCareer(difficulty,seed),s=early.state;
 const trace=early.trace.slice(),visited=new Set([G.getLife(s).city.id]),traded=new Set();
 let moves=0,dates=0,chapterLosses=0,steps=0,lastSavedWeek=-1,tradeWeek=-1,optionalRetirementChecked=false;
 const targetCities=['athens','berlin','london','los_angeles','tel_aviv'];
 const frame={};
 while(steps++<16000){
  const life=G.getLife(s);
  if(s.status==='retired')break;
  if(s.status!=='playing'){
   if(s.status==='lost')chapterLosses++;
   const r=G.continueCareer(s);
   assert.equal(r.ok,true,`career can continue at age ${life.age}: ${r.message}`);
   trace.push({week:s.week,id:'continueCareer'});
  }
  Base.chooseBalancedEvent(s);
  if(s.status!=='playing')continue;
  if(lastSavedWeek!==s.week){
   assert.deepEqual(G.validateSave(copy(s)),s,`life remains saved at age ${life.age}`);
   lastSavedWeek=s.week;
  }
  const menu=G.LOCATIONS.flatMap(l=>G.getActions(s,l.id));
  const can=id=>menu.find(a=>a.id===id&&!a.disabled);
  const first=ids=>ids.find(id=>can(id));
  if(life.age>=65&&!optionalRetirementChecked&&!s.project&&can('home.retire')){
   const twin=G.validateSave(copy(s));assert.ok(twin);
   assert.equal(G.act(twin,'home.retire').ok,true);
   assert.equal(twin.status,'retired');
   assert.deepEqual(G.validateSave(copy(twin)),twin);
   assert.equal(G.act(twin,'set.work').ok,false);
   assert.equal(G.continueCareer(twin).ok,false);
   optionalRetirementChecked=true;
   frame.optional=copy(twin);
  }
  let id;
  const work=()=>first(['set.city_athens','set.city_london','festival.jury','school.teach_masterclass','set.ad','school.lecture','set.wedding','set.work']);
  const reserve=G.DIFFICULTIES[difficulty].living*4+(s.project?G.FILM_TYPES[s.project.type].shootCost*1.8:9000);
  if(s.energy<30)id=first(['home.rest','cafe.meal']);
  if(!id&&s.happiness<60)id=first(['home.date','home.family','cafe.fun']);
  if(!id&&s.cash<reserve)id=work();
  if(!id&&s.debt>0&&s.cash>s.debt+reserve)id=first(['bank.repay_all']);
  if(!id&&!s.project&&moves<targetCities.length&&s.cash>reserve+7000){
   const target=targetCities[moves],action='bank.city_'+target;
   if(can(action)){id=action;moves++;}
  }
  if(!id&&!life.relationship.partner&&life.relationship.options?.length){
   id=life.relationship.options.map(p=>p.actionId||'cafe.partner_'+p.id).find(can);
  }
  if(!id&&life.relationship.partner&&s.happiness<95)id=first(['home.date']);
  if(!id&&s.cash>reserve+2500&&tradeWeek!==s.week&&life.market.unlocked){
   const stock=life.market.stocks[(s.week+seed)%life.market.stocks.length];
   id=first([stock.shares>=5?stock.sellActionId:stock.buyActionId]);
   if(id){tradeWeek=s.week;traded.add(stock.id);}
  }
  if(!id&&s.project){
   id=first([{script:'home.write',shoot:'set.shoot_full',edit:'studio.edit_polish',release:'studio.release_commercial'}[s.project.stage]]);
  }
  if(!id&&!s.project){
   // Alternate a commercial release and a smaller personal project where the chapter permits it.
   const type=s.season>=3?'blockbuster':s.season===2?'feature':s.films.length%2?'doc':'comedy';
   id=first(['home.start_'+type]);
  }
  if(!id&&s.happiness<90)id=first(['home.family','cafe.fun']);
  if(!id&&s.energy<75)id=first(['home.rest','cafe.meal']);
  if(!id)id=work();
  if(id){
   const r=G.act(s,id);assert.equal(r.ok,true,r.message);
   if(id==='home.date')dates++;
   trace.push({week:s.week,id});
   if(s.productionAlert)assert.equal(G.acknowledgeProductionEvent(s).ok,true);
  }else{
   const before=G.getLife(s).age, elapsed=G.getLife(s).nextPeriodQuarters/4;
   const r=G.endWeek(s);assert.equal(r.ok,true,r.message);
   assert.equal(G.getLife(s).age,before+elapsed,'every closed period advances the duration shown before confirmation');
   trace.push({week:s.week,id:'endWeek'});
  }
  visited.add(G.getLife(s).city.id);
  if(visited.size===5&&!frame.world)frame.world=copy(s);
 }
 assert.equal(s.status,'retired',`${difficulty} ${seed}: the complete life reaches retirement, age ${G.getLife(s).age}`);
 assert.equal(G.getLife(s).age,85);
 assert.equal(visited.size,5,'all five cities are reachable with earned money and film achievements');
 assert.equal(traded.size,3,'all three fictional stocks can be traded');
 assert.ok(dates>0,'a relationship remains available alongside a cinema career');
 assert.equal(optionalRetirementChecked,true,'retirement at 65 was possible but could be declined');
 assert.deepEqual(G.validateSave(copy(s)),s,'the final career remains loadable');
 frame.final=copy(s);
 return {s,frame,trace,stats:{difficulty,seed,age:G.getLife(s).age,films:s.films.length,chapters:s.season,dates,cities:visited.size,stocks:traded.size,chapterLosses,steps}};
}
if(require.main===module){
 const results=[runLifetime('calm',43),runLifetime('normal',7)];
 console.table(results.map(r=>r.stats));
 fs.mkdirSync('tests/fixtures',{recursive:true});
 for(const [kind,s] of Object.entries(results[0].frame))fs.writeFileSync(`tests/fixtures/v5-lifetime-${kind}.json`,JSON.stringify(s,null,2));
 fs.writeFileSync('tests/fixtures/v5-lifetime-trace.json',JSON.stringify(results[0].trace));
 console.log('2/2 action-only lifetime careers passed, including five cities, three stocks and retirement.');
}
module.exports={runLifetime};
