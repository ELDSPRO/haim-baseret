(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.FilmWorkload=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// Key working days in the game's compressed calendar, not industry rate cards.
const DAYS={short:{shoot:2,edit:3},doc:{shoot:3,edit:4},comedy:{shoot:4,edit:6},feature:{shoot:8,edit:12},blockbuster:{shoot:12,edit:18}};
function create(){return {shootDone:0,editDone:0,shootMode:null,editMode:null,shootCraft:null,editCraft:null};}
function view(p){if(!p)return null;const w=p.workload;if(!w)return {shoot:1,edit:1,shootDone:['edit','release','released'].includes(p.stage)?1:0,editDone:['release','released'].includes(p.stage)?1:0,legacy:true};return {...w,...DAYS[p.type],legacy:false};}
function slice(total,done,count,need){return Math.round(total*(done+count)/need)-Math.round(total*done/need);}
function valid(p){if(p.workload===undefined)return true;const w=p.workload,t=DAYS[p.type];if(!w||!t||Object.keys(w).length!==6||Object.keys(w).some(k=>!['shootDone','editDone','shootMode','editMode','shootCraft','editCraft'].includes(k))||!Number.isInteger(w.shootDone)||!Number.isInteger(w.editDone)||w.shootDone<0||w.shootDone>t.shoot||w.editDone<0||w.editDone>t.edit)return false;
if(![null,'full','lean'].includes(w.shootMode)||![null,'polish','basic'].includes(w.editMode)||(w.shootDone===0)!==(w.shootMode===null)||(w.editDone===0)!==(w.editMode===null))return false;
for(const phase of ['shoot','edit']){const craft=w[phase+'Craft'];if(w[phase+'Done']===0?craft!==null:!Number.isInteger(craft)||craft<0||craft>100)return false;}
return p.stage==='script'?w.shootDone===0&&w.editDone===0:p.stage==='shoot'?w.shootDone<t.shoot&&w.editDone===0:p.stage==='edit'?w.shootDone===t.shoot&&w.editDone<t.edit:['release','released'].includes(p.stage)&&w.shootDone===t.shoot&&w.editDone===t.edit;
}
return {DAYS,create,view,slice,valid};
});
