(function(root){
'use strict';
function finite(n){return typeof n==='number'&&Number.isFinite(n)}
function dateParts(s){return String(s||'').split('-').map(Number)}
function dateObj(s){var p=dateParts(s);return new Date(p[0],p[1]-1,p[2],12)}
function key(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function addDay(s,num){var d=dateObj(s);d.setDate(d.getDate()+num);return key(d)}
function weekStart(s){var d=dateObj(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return key(d)}
function dateRange(from,to){var days=[];for(var day=from;day<=to&&days.length<370;day=addDay(day,1))days.push(day);return days}
function fmt(n,d){return Number(n).toLocaleString('es-AR',{maximumFractionDigits:d==null?1:d})}
function workoutVolume(w){return (w&&w.exercises||[]).reduce(function(total,ex){return total+(ex.sets||[]).reduce(function(sum,set){return sum+Math.max(0,Number(set.reps)||0)*Math.max(0,Number(set.weight)||0)},0)},0)}
function muscleSeries(workouts,start,end,resolveMuscle){
 var result={};Object.keys(workouts||{}).filter(function(d){return d>=start&&d<=end}).forEach(function(date){
 (workouts[date].exercises||[]).forEach(function(ex){
 var muscle=resolveMuscle(ex),sets=(ex.sets||[]).filter(function(s){return s&&finite(s.reps)&&s.reps>0}).length;
 if(sets)result[muscle]=(result[muscle]||0)+sets;
 });
 });return result;
}
function mealWasLogged(data,spec){
 return spec.groups.some(function(g){return Number(data[g.id])>0})||
  (Array.isArray(data._dishes)&&data._dishes.length>0);
}
function nutritionWeek(days,mealSpec,start,end,asOf){
 var registered=0,registeredMeals=0,evaluatedMeals=0,skippedMeals=0,total=0,completed=0,groups={};
 var todayKey=asOf||key(new Date());
 dateRange(start,end).forEach(function(date){
  if(date>todayKey)return;
  var item=(days||{})[date],meals=item&&item.meals||{},lastLogged=-1;
  mealSpec.forEach(function(meal,index){
   if(mealWasLogged(meals[meal.id]||{},meal))lastLogged=index;
  });
  if(lastLogged<0)return; // Día sin ninguna comida registrada: no se considera incumplido.
  registered++;
  var lastCounted=date<todayKey?mealSpec.length-1:lastLogged;
  mealSpec.forEach(function(meal,index){
   if(index>lastCounted)return; // Comidas futuras de hoy: todavía pendientes.
   var data=meals[meal.id]||{},logged=mealWasLogged(data,meal);
   evaluatedMeals++;
   if(logged)registeredMeals++;else skippedMeals++;
   meal.groups.forEach(function(g){
    var filled=Math.max(0,Math.min(g.target,Number(data[g.id])||0))/g.target;
    if(!groups[g.id])groups[g.id]={done:0,total:0};
    groups[g.id].done+=filled;groups[g.id].total++;total++;completed+=filled;
   });
  });
 });
 Object.keys(groups).forEach(function(g){
  groups[g].pct=groups[g].total?Math.round(100*groups[g].done/groups[g].total):null;
 });
 return {registeredDays:registered,registeredMeals:registeredMeals,evaluatedMeals:evaluatedMeals,
  skippedMeals:skippedMeals,rate:total?Math.round(100*completed/total):null,groups:groups};
}
function weightEntries(days,until){
 return Object.keys(days||{}).filter(function(date){return date<=until&&finite(days[date].weightKg)&&days[date].weightKg>=20&&days[date].weightKg<=350}).sort().map(function(date){return {date:date,weight:days[date].weightKg}});
}
function avg(values){return values.length?values.reduce(function(a,b){return a+b},0)/values.length:null}
function weightTrend(days,until){
 var entries=weightEntries(days,until);
 if(!entries.length)return {entries:[],last:null,average7:null,change:null};
 var latest=entries[entries.length-1],recent=entries.filter(function(v){return v.date>=addDay(until,-6)});
 var prev=entries.filter(function(v){return v.date>=addDay(until,-13)&&v.date<addDay(until,-6)});
 var currentAvg=avg(recent.map(function(x){return x.weight})),previousAvg=avg(prev.map(function(x){return x.weight}));
 return {entries:entries,last:latest,average7:currentAvg,change:currentAvg!==null&&previousAvg!==null?currentAvg-previousAvg:null};
}
function recoveryWeek(days,start,end){
 var logs=dateRange(start,end).map(function(day){return (days||{})[day]&&(days||{})[day].recovery}).filter(function(v){return v&&typeof v==='object'&&Object.keys(v).length>0});
 return {logged:logs.length,sleep:avg(logs.map(function(v){return Number(v.sleepHours)}).filter(function(n){return finite(n)&&n>0})),energy:avg(logs.map(function(v){return Number(v.energy)}).filter(function(n){return finite(n)&&n>=1&&n<=5})),soreness:avg(logs.map(function(v){return Number(v.soreness)}).filter(function(n){return finite(n)&&n>=1&&n<=5}))};
}
function progressChanges(workouts,start,end,TrainingModel){
 var improvements=[];
 var history=TrainingModel.historyView({routineDays:[],workouts:workouts||{}}).workouts,exerciseIds={};
 Object.keys(history).sort().forEach(function(date){
  (history[date].exercises||[]).forEach(function(ex){exerciseIds[ex.id]=ex.name});
 });
 Object.keys(exerciseIds).forEach(function(id){
  var entries=TrainingModel.history(history,id).filter(function(v){return v.date<=end});
  entries.forEach(function(item,i){
   if(i===0||item.date<start)return;
   var prev=entries[i-1];
   if(item.max>prev.max)improvements.push({name:exerciseIds[id],date:item.date,type:'peso',delta:item.max-prev.max});
   else if(item.max===prev.max&&item.volume>prev.volume)improvements.push({name:exerciseIds[id],date:item.date,type:'volumen',delta:item.volume-prev.volume});
  });
 });
 return improvements.sort(function(a,b){return b.date.localeCompare(a.date)}).slice(0,5);
}
function weeklyReport(state,mealSpec,TrainingModel,until){
 var start=weekStart(until),days=state.days||{},workouts=state.training&&state.training.workouts||{},nut=nutritionWeek(days,mealSpec,start,until);
 var attended=dateRange(start,until).filter(function(d){return !!(days[d]&&days[d].gym)}).length;
 var weight=weightTrend(days,until),recovery=recoveryWeek(days,start,until);
 var changes=progressChanges(workouts,start,until,TrainingModel);
 var lines=[];
 if(attended)lines.push('Registraste '+attended+' '+(attended===1?'entrenamiento':'entrenamientos')+' esta semana.');else lines.push('Todavía no registraste entrenamientos esta semana.');
 if(nut.rate!==null)lines.push('En los '+nut.registeredDays+' días con comidas registradas completaste, en promedio, el '+nut.rate+'% de los grupos de tu plan.');else lines.push('Todavía no hay comidas registradas para analizar esta semana.');
 if(changes.length)lines.push('Mejoraste en '+changes[0].name.toLowerCase()+' respecto al entrenamiento previo.');
 if(weight.change!==null)lines.push('Tu promedio de peso de 7 días cambió '+(weight.change>=0?'+':'')+fmt(weight.change,2)+' kg respecto a la semana anterior.');
 return {start:start,end:until,attended:attended,nutrition:nut,weight:weight,recovery:recovery,improvements:changes,lines:lines};
}
function blockStats(block,workouts){
 var matches=Object.keys(workouts||{}).filter(function(day){return day>=block.start&&day<=block.end}).sort();
 var total=matches.reduce(function(sum,date){return sum+workoutVolume(workouts[date])},0);
 return {sessions:matches.length,totalVolume:total,days:matches};
}
function shoppingList(plan,dishes,foodCatalog,start,end){
 var tally=new Map(),fallback=new Map(),byId=new Map((dishes||[]).map(function(d){return [d.id,d]}));
 dateRange(start,end).forEach(function(day){
  Object.keys((plan||{})[day]||{}).forEach(function(meal){
   var entry=plan[day][meal],dish=byId.get(entry.dishId),ingredients=entry.ingredients||(dish&&dish.portions&&dish.portions._ingredients)||[];
   if(!ingredients.length){var label=String(entry.label||dish&&dish.name||'').trim();if(label)fallback.set(label,(fallback.get(label)||0)+1);return}
   ingredients.forEach(function(ingredient){
    var food=foodCatalog.items.find(function(f){return f.id===ingredient.id});
    if(!food)return;
    var units=foodCatalog.serving(food,meal).unit,qty=Number(ingredient.quantity)||0;
    if(qty<=0)return;
    var id=food.id+'::'+units,existing=tally.get(id);
    if(existing)existing.quantity+=qty;else tally.set(id,{name:food.name,quantity:qty,unit:units});
   });
  });
 });
 return {items:Array.from(tally.values()).sort(function(a,b){return a.name.localeCompare(b.name,'es')}),fallback:Array.from(fallback).map(function(p){return {name:p[0],count:p[1]}})};
}
var api={weekStart:weekStart,addDay:addDay,dateRange:dateRange,fmt:fmt,workoutVolume:workoutVolume,muscleSeries:muscleSeries,nutritionWeek:nutritionWeek,weightEntries:weightEntries,weightTrend:weightTrend,recoveryWeek:recoveryWeek,progressChanges:progressChanges,weeklyReport:weeklyReport,blockStats:blockStats,shoppingList:shoppingList};
if(typeof module==='object'&&module.exports)module.exports=api;else root.InsightsModel=api;
})(typeof window==='undefined'?globalThis:window);
