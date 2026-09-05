(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.FilmCrowdfunding=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TARGETS={short:600,doc:500,comedy:900,feature:2400,blockbuster:4000};
const chance=c=>Math.min(85,Math.round(32+c.contactsAtLaunch*.3+c.reputationAtLaunch*.16+c.qualityAtLaunch*.12)+(c.promoted?12:0));
const fee=t=>Math.round(t*.08),rewards=t=>Math.round(t*.12);
function quote(type){const target=TARGETS[type];return {target,fee:fee(target),rewards:rewards(target),net:target-fee(target)-rewards(target),launchCost:Math.max(30,Math.round(target*.05))};}
function launch(project,s,roll){const q=quote(project.type),c={startedWeek:s.week,dueWeek:s.week+2,target:q.target,contactsAtLaunch:s.contacts,reputationAtLaunch:s.reputation,qualityAtLaunch:project.quality,promoted:false,roll,status:'pending',gross:0,fee:0,rewards:0,awarded:0,balance:0,spent:0,expired:0,resolvedWeek:null};c.chance=chance(c);return c;}
function promote(c){c.promoted=true;c.chance=chance(c);}
function settle(p,week){const c=p?.crowdfunding;if(!c||c.status!=='pending'||week<c.dueWeek)return null;c.resolvedWeek=week;c.status=c.roll<c.chance?'funded':'failed';if(c.status==='funded'){c.gross=c.target;c.fee=fee(c.target);c.rewards=rewards(c.target);c.awarded=c.gross-c.fee-c.rewards;c.balance=c.awarded;p.budget+=c.fee+c.rewards;}return c;}
function close(p,week){const c=p?.crowdfunding;if(!c)return;if(c.status==='pending'){c.status='withdrawn';c.resolvedWeek=week;}c.expired+=c.balance;c.balance=0;}
function valid(p,week,retired){const c=p.crowdfunding;if(c===undefined||c===null)return true;const n=(v,max=1e7)=>Number.isInteger(v)&&v>=0&&v<=max;const stat=v=>Number.isFinite(v)&&v>=0&&v<=100;
 if(typeof c!=='object'||Array.isArray(c)||c.target!==TARGETS[p.type]||!n(c.startedWeek,week)||c.startedWeek<p.startedWeek||c.dueWeek!==c.startedWeek+2||!['contactsAtLaunch','reputationAtLaunch','qualityAtLaunch'].every(k=>stat(c[k]))||typeof c.promoted!=='boolean'||c.chance!==chance(c)||!Number.isFinite(c.roll)||c.roll<0||c.roll>=100||!['pending','funded','failed','withdrawn'].includes(c.status))return false;
 if(!['gross','fee','rewards','awarded','balance','spent','expired'].every(k=>n(c[k]))||c.awarded!==c.balance+c.spent+c.expired||c.spent>p.budget)return false;
 if((p.stage==='released'||retired)&&(c.status==='pending'||c.balance!==0))return false;
 if(c.status==='pending')return c.resolvedWeek===null&&week<=c.dueWeek&&['gross','fee','rewards','awarded','balance','spent','expired'].every(k=>c[k]===0);
 if(!n(c.resolvedWeek,week)||c.resolvedWeek<c.startedWeek||c.status!=='withdrawn'&&c.resolvedWeek<c.dueWeek)return false;
 if(c.status==='funded')return c.roll<c.chance&&c.gross===c.target&&c.fee===fee(c.target)&&c.rewards===rewards(c.target)&&c.awarded===c.gross-c.fee-c.rewards;
 return (c.status!=='failed'||c.roll>=c.chance)&&['gross','fee','rewards','awarded','balance','spent','expired'].every(k=>c[k]===0);
}
return {quote,launch,promote,settle,close,valid};
});
