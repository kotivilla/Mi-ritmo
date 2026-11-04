(function(root){
'use strict';
function add(s,n){return InsightsModel.addDay(s,n)}
function avg(xs){return xs.length?xs.reduce(function(a,b){return a+b},0)/xs.length:null}
function period(days,from,to){var xs=InsightsModel.weightEntries(days,to).filter(function(x){return x.date>=from});return {count:xs.length,mean:avg(xs.map(function(x){return x.weight}))}}
function delta(w){return (w>0?'+':'')+w.toLocaleString('es-AR',{maximumFractionDigits:2})}
function weightReport(days,end){
 var a=period(days,add(end,-6),end),b=period(days,add(end,-13),add(end,-7));
 var weeks=[0,1,2].map(function(i){return period(days,add(end,-(7*i+6)),add(end,-7*i))});
 return {recent:a,previous:b,change:a.count>=2&&b.count>=2?a.mean-b.mean:null,
  stableThree:weeks.every(function(w){return w.count>=2})&&Math.max.apply(null,weeks.map(function(w){return w.mean}))-Math.min.apply(null,weeks.map(function(w){return w.mean}))<=0.3};
}
function workoutReport(workouts,start,end,TrainingModel){
 var normalized=TrainingModel.historyView({routineDays:[],workouts:workouts||{}}).workouts,ids={};
 Object.keys(normalized).filter(function(day){return day<=end}).forEach(function(day){
  (normalized[day].exercises||[]).forEach(function(ex){ids[ex.id]=ex.name});
 });
 var changes=[];
 Object.keys(ids).forEach(function(id){
  var series=TrainingModel.history(normalized,id).filter(function(x){return x.date<=end});
  for(var i=1;i<series.length;i++){
   var curr=series[i],prev=series[i-1];if(curr.date<start)continue;
   if(curr.max>prev.max+.0001)changes.push({id:id,name:ids[id],kind:'peso',date:curr.date});
   else if(Math.abs(curr.max-prev.max)<.0001&&curr.volume>prev.volume*1.03&&curr.volume>0)changes.push({id:id,name:ids[id],kind:'volumen',date:curr.date});
  }
 });
 changes.sort(function(a,b){return b.date.localeCompare(a.date)});
 var unique=[],seen=new Set();
 changes.forEach(function(x){if(!seen.has(x.id)){unique.push(x);seen.add(x.id)}});
 return {sessions:Object.keys(normalized).filter(function(day){return day>=start&&day<=end}).length,improvements:unique};
}
function analyze(state,mealSpec,TrainingModel,end){
 var days=state.days||{},workouts=state.training&&state.training.workouts||{},weight=weightReport(days,end);
 var gym=workoutReport(workouts,add(end,-27),end,TrainingModel);
 var nutrition=InsightsModel.nutritionWeek(days,mealSpec,add(end,-13),end),goal=state.settings&&state.settings.goalFocus||'muscle',insights=[],change=weight.change;
 function note(kind,title,body){insights.push({kind:kind,title:title,body:body})}
 if(change!==null&&gym.improvements.length){
  if(Math.abs(change)<.2)note('combined','Más fuerza con peso estable','Tu peso promedio se mantuvo bastante estable y registraste mejoras en al menos un ejercicio. Son tendencias simultáneas, no una relación causal.');
  else if(change>.2)note('combined','Peso y rendimiento en aumento','Tu promedio de peso subió '+delta(change)+' kg frente a la semana anterior, y registraste mejoras en el gimnasio. Esto no indica por sí solo cuánto músculo ganaste.');
  else note('combined','Peso y rendimiento','El promedio de peso cambió '+delta(change)+' kg mientras registraste mejoras en el gimnasio. Conviene observar más semanas antes de ajustar el plan.');
 }else if(gym.improvements.length){
  var ex=gym.improvements[0];note('training','Mejoras en el gimnasio','En las últimas 4 semanas mejoraste '+gym.improvements.length+' '+(gym.improvements.length===1?'ejercicio':'ejercicios')+'. Ejemplo: '+ex.name+' ('+(ex.kind==='peso'?'peso máximo':'volumen')+').');
 }
 if(weight.stableThree&&goal==='muscle')note('weight','Peso estable durante 3 semanas','Los promedios semanales variaron como máximo 0,3 kg. Si tu objetivo es ganar masa muscular, podés conversar sobre la tendencia con tu nutricionista antes de ajustar porciones.');
 else if(change!==null&&!gym.improvements.length){
  if(Math.abs(change)<.2)note('weight','Peso bastante estable','El peso promedio de los últimos 7 días varió menos de 0,2 kg frente a la semana anterior.');
  else note('weight','Cambio de peso promedio','El peso promedio de los últimos 7 días cambió '+delta(change)+' kg respecto de la semana anterior. Un cambio semanal aislado no define una tendencia.');
 }
 if(nutrition.registeredMeals>=6)note('nutrition','Alimentación registrada','En las últimas 2 semanas anotaste '+nutrition.registeredMeals+' comidas, con '+nutrition.rate+'% de los grupos completados en promedio. Las comidas sin registrar no cuentan como incumplidas.');
 if(!insights.length){
  var needed=[];
  if(weight.recent.count<2||weight.previous.count<2)needed.push('pesarte varias veces durante dos semanas');
  if(gym.sessions<2)needed.push('registrar dos o más entrenamientos');
  if(nutrition.registeredMeals<6)needed.push('registrar varias comidas');
  note('collect','Construyendo tu evolución','Para relacionar alimentación, peso y rendimiento, ayuda '+(needed.length?needed.join(', '):'seguir registrando tus hábitos')+'.');
 }
 return {insights:insights.slice(0,3),coverage:{weightRecent:weight.recent.count,weightPrevious:weight.previous.count,gymSessions:gym.sessions,improvedExercises:gym.improvements.length,meals:nutrition.registeredMeals},weightChange:change};
}
var api={analyze:analyze,weightReport:weightReport,workoutReport:workoutReport};
if(typeof module==='object'&&module.exports)module.exports=api;else root.SmartAnalysis=api;
})(typeof window==='undefined'?globalThis:window);
