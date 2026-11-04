(function(root){
'use strict';
function exerciseId(name){return String(name||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ')}
var equipmentLabels={unspecified:'Sin especificar',barbell:'Barra',dumbbell:'Mancuernas',band:'Banda',bodyweight:'Peso corporal',machine:'Máquina'};
function equipmentOf(row){return row.equipment||'unspecified'}
function variantId(row){var equipment=equipmentOf(row);return exerciseId(row.name)+(equipment==='unspecified'?'':'::'+equipment)}
function displayName(row){return row.name+' · '+equipmentLabels[equipmentOf(row)]}
function validSet(set){return Number.isInteger(set.reps)&&set.reps>=1&&set.reps<=1000&&Number.isFinite(set.weight)&&set.weight>=0&&set.weight<=2000}
function rowSets(row){if(Array.isArray(row.sets))return row.sets.map(function(s){return {reps:s.reps,weight:s.weight}});if(!Number.isInteger(row.sets)||row.sets<1||row.sets>30)throw Error('Cada ejercicio necesita entre 1 y 30 series.');return Array.from({length:row.sets},function(){return {reps:row.reps,weight:row.weight}})}
function validateRoutine(rows){var seen=new Set();if(!rows.length)throw Error('Agregá al menos un ejercicio.');return rows.map(function(row){var name=String(row.name||'').trim(),id=variantId(row);if(!Object.prototype.hasOwnProperty.call(equipmentLabels,equipmentOf(row)))throw Error('Elegí un equipamiento válido.');if(!name||name.length>100)throw Error('Cada ejercicio necesita un nombre de hasta 100 caracteres.');if(seen.has(id))throw Error('No repitas el mismo ejercicio en esta rutina.');seen.add(id);var sets=rowSets(row);if(!sets.length||sets.length>30||sets.some(function(s){return !validSet(s)}))throw Error('Revisá las repeticiones y el peso de cada serie. El peso puede ser 0.');return {id:id,name:name,equipment:equipmentOf(row),sets:sets}})}
function fromRoutine(rows){return rows.map(function(row){return {id:row.id,name:row.name,equipment:equipmentOf(row),sets:rowSets(row)}})}
function validateWorkout(exercises){if(!exercises.length)throw Error('Agregá ejercicios a la rutina antes de registrar.');return exercises.map(function(ex){if(!ex.sets.length)throw Error('Cada ejercicio necesita al menos una serie.');if(ex.sets.some(function(set){return !validSet(set)}))throw Error('Completá las repeticiones y el peso de cada serie. Usá 0 kg para peso corporal.');return {id:ex.id,name:ex.name,equipment:equipmentOf(ex),sets:ex.sets.map(function(s){return {reps:s.reps,weight:s.weight}})}})}
function history(workouts,id){return Object.keys(workouts||{}).sort().flatMap(function(date){var sets=(workouts[date].exercises||[]).filter(function(e){return e.id===id}).flatMap(function(e){return e.sets});if(!sets.length)return [];var max=Math.max.apply(null,sets.map(function(s){return s.weight}));return [{date:date,max:max,reps:Math.max.apply(null,sets.filter(function(s){return s.weight===max}).map(function(s){return s.reps})),sets:sets}]})}
// Resolve legacy entries for display without rewriting the original history.
// A later second equipment variant makes the old entries ambiguous again.
function historyView(input){var data=migrate(input),variants=new Map(),all=[];
 data.routineDays.forEach(function(day){all.push.apply(all,day.rows)});
 Object.values(data.workouts).forEach(function(w){all.push.apply(all,w.exercises||[])});
 all.forEach(function(ex){var name=exerciseId(ex.name),equipment=equipmentOf(ex);if(equipment==='unspecified')return;if(!variants.has(name))variants.set(name,new Set());variants.get(name).add(equipment)});
 all.forEach(function(ex){var choices=variants.get(exerciseId(ex.name));if(equipmentOf(ex)==='unspecified'&&choices&&choices.size===1)ex.equipment=Array.from(choices)[0];ex.id=variantId(ex)});
 return data;
}
function migrate(input){var data=JSON.parse(JSON.stringify(input||{routines:{},workouts:{}}));if(!data.workouts)data.workouts={};if(!data.routineDays){var keys=Object.keys(data.routines||{}).sort(function(a,b){return (Number(a)+6)%7-(Number(b)+6)%7});data.routineDays=keys.map(function(key,i){return {id:'legacy-'+key,name:'Día '+(i+1),rows:data.routines[key]}});while(data.routineDays.length<3){var n=data.routineDays.length+1;data.routineDays.push({id:'day-'+n,name:'Día '+n,rows:[]})}}data.routineDays.forEach(function(day){day.rows=day.rows.map(function(row){return {id:row.id||exerciseId(row.name),name:row.name,equipment:equipmentOf(row),sets:rowSets(row)}})});return data}
var api={historyView:historyView,equipmentLabels:equipmentLabels,displayName:displayName,variantId:variantId,migrate:migrate,exerciseId:exerciseId,validateRoutine:validateRoutine,fromRoutine:fromRoutine,validateWorkout:validateWorkout,history:history};if(typeof module==='object'&&module.exports)module.exports=api;else root.TrainingModel=api;
})(typeof window==='undefined'?globalThis:window);
