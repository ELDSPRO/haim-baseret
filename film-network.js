(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.FilmNetwork=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CITIES=['tel_aviv','athens','berlin','london','los_angeles'];
const NAMES={tel_aviv:['מיכל רז','אורי לב','דנה מרום'],athens:['אנה פאפא','דימיטריס לאמבו','אלכסנדרה פטרו'],berlin:['יוליה קליין','מרטין ובר','לנה הופמן'],london:['קלייר וילסון','סיימון ריד','סופי בנט'],los_angeles:['נעמי פארקר','דיוויד קול','נינה מורגן']};
const ROLES=['agent','producer','copro'];
const PEOPLE=CITIES.flatMap(city=>ROLES.map((role,i)=>({id:role+'_'+city,role,city,name:NAMES[city][i],portrait:i,title:['סוכנת יוצרים','מפיק','מפיקה בינלאומית'][i]})));
const person=id=>PEOPLE.find(p=>p.id===id);
const empty=()=>({contacts:{},agent:null,gigLastWeek:0,lastContractWeek:0,bankLastWeek:0,festivalMeetings:[]});
const state=s=>s.network||empty();
const ensure=s=>s.network||(s.network=empty());
function visitors(s){const n=state(s),city=s.life.cityId,rotating=ROLES[Math.floor((s.week-1)/2)%3];const ready=PEOPLE.filter(p=>p.city===city&&n.contacts[p.id]&&(n.contacts[p.id].meetings===1&&s.week>=n.contacts[p.id].lastWeek+2||n.contacts[p.id].meetings===2&&n.contacts[p.id].lastWeek===s.week));const list=ready.concat(PEOPLE.filter(p=>p.city===city&&p.role===rotating));return [...new Map(list.map(p=>[p.id,p])).values()].slice(0,2);}
function meet(s,id){const n=ensure(s),c=n.contacts[id];n.contacts[id]={firstWeek:c?.firstWeek||s.week,lastWeek:s.week,meetings:c?Math.min(2,c.meetings+1):1};}
function spec(kind,type){const scale={short:1,doc:1,comedy:2,feature:6,blockbuster:15}[type];return {awarded:(kind==='producer'?1100:600)*scale,directorFee:(kind==='producer'?180:100)*scale,share:kind==='producer'?40:25,window:({short:5,doc:6,comedy:7,feature:10,blockbuster:14}[type])+(kind==='copro'?1:0),quality:kind==='producer'?60:55};}
function destination(city){return city==='athens'?'berlin':'athens';}
function offer(s,p,tier){const type=p.role==='producer'?(tier>=3?'blockbuster':tier>=2?'feature':'comedy'):s.project?.type||'short',terms=spec(p.role,type);return {...terms,id:p.id+'_'+s.week,personId:p.id,kind:p.role,type,signedCity:s.life.cityId,productionCity:p.role==='copro'?destination(s.life.cityId):s.life.cityId,dueWeek:s.week+terms.window,agentRate:state(s).agent?10:0};}
function contract(s,p,o,initialSpent){return {id:p.id+':'+o.personId+':'+s.week,personId:o.personId,kind:o.kind,type:p.type,signedWeek:s.week,signedCity:o.signedCity,productionCity:o.productionCity,dueWeek:o.dueWeek,awarded:o.awarded,balance:o.awarded-initialSpent,spent:initialSpent,expired:0,directorFee:o.directorFee,share:o.share,qualityTarget:o.quality,agentRate:o.agentRate,feePaid:0,feeCommission:0,shootPaidWeek:null,releasePaidWeek:null,producerPaid:0,netRevenue:null,status:'active',closedWeek:null,shotAbroad:false};}
function close(p,week,status='closed'){const c=p?.contract;if(!c||c.status!=='active')return;c.expired+=c.balance;c.balance=0;c.status=status;c.closedWeek=week;}
function validContract(p,s){const c=p.contract;if(c===undefined)return true;const integer=(x,l,h)=>Number.isInteger(x)&&x>=l&&x<=h;const actor=person(c?.personId),t=spec(c?.kind,p.type);
 if(!c||!s.network||s.network.contacts[c.personId]?.meetings!==2||!actor||actor.role!==c.kind||!['producer','copro'].includes(c.kind)||c.type!==p.type||c.id!==p.id+':'+c.personId+':'+c.signedWeek||!CITIES.includes(c.signedCity)||actor.city!==c.signedCity||c.productionCity!==(c.kind==='copro'?destination(c.signedCity):c.signedCity))return false;
 if(!integer(c.signedWeek,Math.max(p.startedWeek,s.network.contacts[c.personId].firstWeek),s.week)||c.dueWeek!==c.signedWeek+t.window||c.awarded!==t.awarded||c.directorFee!==t.directorFee||c.share!==t.share||c.qualityTarget!==t.quality||![0,10].includes(c.agentRate))return false;
 if(!['balance','spent','expired'].every(k=>integer(c[k],0,c.awarded))||c.balance+c.spent+c.expired!==c.awarded||c.spent>p.budget||typeof c.shotAbroad!=='boolean')return false;
 const half=c.directorFee/2,shot=c.shootPaidWeek!==null,release=c.releasePaidWeek!==null;
 if(shot&&(!integer(c.shootPaidWeek,c.signedWeek,s.week)||!['edit','release','released'].includes(p.stage)))return false;
 if(release&&(!shot||p.stage!=='released'||c.releasePaidWeek!==p.releasedWeek||p.releasedWeek>c.dueWeek||p.quality<c.qualityTarget))return false;
 if(c.feePaid!==(shot?half:0)+(release?half:0)||c.feeCommission!==Math.round(c.feePaid*c.agentRate/100)||c.feePaid>p.budget)return false;
 if(c.kind==='copro'&&shot!==c.shotAbroad||c.kind==='producer'&&c.shotAbroad)return false;
 if(c.status==='active')return p.stage!=='released'&&!s.life.retired&&!(s.status==='lost'&&s.debt>6500)&&c.closedWeek===null&&c.expired===0&&c.producerPaid===0&&c.netRevenue===null;
 if(!['released','closed'].includes(c.status)||c.balance!==0||!integer(c.closedWeek,c.signedWeek,s.week))return false;
 if(c.status==='released')return p.stage==='released'&&shot&&(c.kind!=='producer'||p.route==='commercial')&&c.closedWeek===p.releasedWeek&&c.producerPaid===Math.round(p.revenue*c.share/100)&&c.netRevenue===p.revenue-c.producerPaid&&p.netRevenue===c.netRevenue;
 return p.stage!=='released'&&(s.life.retired||s.debt>6500)&&c.producerPaid===0&&c.netRevenue===null;
}
function valid(s){const n=s.network;if(n===undefined)return true;const int=(x,l,h)=>Number.isInteger(x)&&x>=l&&x<=h;if(!n||typeof n!=='object'||!n.contacts||typeof n.contacts!=='object'||Array.isArray(n.contacts))return false;
 if(Object.keys(n.contacts).length>PEOPLE.length||Object.entries(n.contacts).some(([id,c])=>!person(id)||!c||!int(c.firstWeek,1,s.week)||!int(c.lastWeek,c.firstWeek,s.week)||!int(c.meetings,1,2)||c.meetings===2&&c.lastWeek<c.firstWeek))return false;
 if(n.agent!==null&&(!n.agent||person(n.agent.personId)?.role!=='agent'||n.contacts[n.agent.personId]?.meetings!==2||!int(n.agent.signedWeek,n.contacts[n.agent.personId].lastWeek,s.week)))return false;
 if(!['gigLastWeek','lastContractWeek','bankLastWeek'].every(k=>int(n[k],0,s.week)))return false;
 return Array.isArray(n.festivalMeetings)&&n.festivalMeetings.length<=1500&&new Set(n.festivalMeetings).size===n.festivalMeetings.length&&n.festivalMeetings.every(id=>s.festivalCircuit.history.some(e=>e.id===id&&['award','selected'].includes(e.outcome)));
}
return {PEOPLE,CITIES,person,state,ensure,visitors,meet,spec,offer,contract,close,validContract,valid};
});
