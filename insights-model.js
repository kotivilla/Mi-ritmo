(function(root){
'use strict';
var NutritionScoring=typeof module==='object'&&module.exports?require('./nutrition-scoring.js'):root.NutritionScoring;
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
   var score=NutritionScoring.mealPortions(data,meal);
   completed+=score.fraction;total++; // Cada comida evaluada tiene el mismo peso.
   meal.groups.forEach(function(g){
    var filled=Math.max(0,Math.min(g.target,Number(data[g.id])||0))/g.target;
    if(!groups[g.id])groups[g.id]={done:0,total:0};
    groups[g.id].done+=filled;groups[g.id].total++;
   });
  });
 });
 Object.keys(groups).forEach(function(g){
  groups[g].pct=groups[g].total?Math.round(100*groups[g].done/groups[g].total):null;
 });
 return {registeredDays:registered,registeredMeals:registeredMeals,evaluatedMeals:evaluatedMeals,
  skippedMeals:skippedMeals,rate:total?Math.round(100*completed/total):null,groups:groups};
}
// Un único rango para promedios por grupo, por comida y cumplimiento diario.
// Un día completamente vacío no se promedia. En días pasados con algún registro,
// las comidas omitidas son 0%; hoy solo se evalúan comidas hasta la última cargada.
function nutritionStats(days,mealSpec,start,end,asOf,selectedMeal){
 var todayKey=asOf||key(new Date()),daily=[],groups={},registeredDays=0,evaluatedMeals=0,skippedMeals=0;
 var daySum=0,mealSum=0,foodDays=days||{},spec=mealSpec||[];
 var weekdays=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(function(label){return {label:label,count:0,sum:0,percent:null}});
 var filter=selectedMeal&&selectedMeal!=='all'?selectedMeal:null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end){
  return {daily:[],weekdays:weekdays,registeredDays:0,dailyAverage:null,groups:{},evaluatedMeals:0,skippedMeals:0,mealAverage:null};
 }
 for(var date=start,n=0;date<=end&&date<=todayKey&&n<5000;date=addDay(date,1),n++){
  var food=((foodDays[date]||{}).meals)||{},lastLogged=-1;
  spec.forEach(function(meal,i){if(mealWasLogged(food[meal.id]||{},meal))lastLogged=i});
  if(lastLogged<0){daily.push({date:date,percent:null,recorded:false});continue}
  var score=NutritionScoring.dayScore(food,spec);
  registeredDays++;daySum+=score.rate;
  var weekday=weekdays[(dateObj(date).getDay()+6)%7];
  weekday.count++;weekday.sum+=score.rate;
  daily.push({date:date,percent:Math.round(score.rate),recorded:true});
  var lastCounted=date<todayKey?spec.length-1:lastLogged;
  spec.forEach(function(meal,index){
   if(index>lastCounted||(filter&&meal.id!==filter))return;
   var entry=food[meal.id]||{},scored=NutritionScoring.mealPortions(entry,meal);
   evaluatedMeals++;mealSum+=scored.fraction;
   if(!mealWasLogged(entry,meal))skippedMeals++;
   meal.groups.forEach(function(g){
    var filled=Math.max(0,Math.min(g.target,Number(entry[g.id])||0))/g.target;
    if(!groups[g.id])groups[g.id]={done:0,total:0};
    groups[g.id].done+=filled;groups[g.id].total++;
   });
  });
 }
 Object.keys(groups).forEach(function(id){
  groups[id].pct=groups[id].total?Math.round(100*groups[id].done/groups[id].total):null;
 });
 weekdays.forEach(function(item){item.percent=item.count?Math.round(item.sum/item.count):null;delete item.sum});
 return {daily:daily,weekdays:weekdays,registeredDays:registeredDays,
  dailyAverage:registeredDays?Math.round(daySum/registeredDays):null,
  groups:groups,evaluatedMeals:evaluatedMeals,skippedMeals:skippedMeals,
  mealAverage:evaluatedMeals?Math.round(100*mealSum/evaluatedMeals):null};
}
function weightEntries(days,until){
 return Object.keys(days||{}).filter(function(date){return date<=until&&finite(days[date].weightKg)&&days[date].weightKg>=20&&days[date].weightKg<=350}).sort().map(function(date){return {date:date,weight:days[date].weightKg}});
}
function avg(values){return values.length?values.reduce(function(a,b){return a+b},0)/values.length:null}
function weightTrend(days,until){
 // El último pesaje de cada semana (lunes a domingo), sin exigir registros diarios.
 var entries=weightEntries(days,until),byWeek={};
 entries.forEach(function(item){byWeek[weekStart(item.date)]=item});
 var weekly=Object.keys(byWeek).sort().map(function(week){return byWeek[week]});
 if(!weekly.length)return {entries:[],last:null,previous:null,change:null};
 var last=weekly[weekly.length-1],previous=weekly.length>1?weekly[weekly.length-2]:null;
 return {entries:weekly,last:last,previous:previous,change:previous?last.weight-previous.weight:null};
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
 var start=weekStart(until),days=state.days||{},workouts=state.training&&state.training.workouts||{},nut=nutritionWeek(days,mealSpec,start,until,until);
 var attended=dateRange(start,until).filter(function(d){return !!(days[d]&&days[d].gym)}).length;
 var weight=weightTrend(days,until),recovery=recoveryWeek(days,start,until);
 var changes=progressChanges(workouts,start,until,TrainingModel);
 var lines=[];
 if(attended)lines.push('Registraste '+attended+' '+(attended===1?'entrenamiento':'entrenamientos')+' esta semana.');else lines.push('Todavía no registraste entrenamientos esta semana.');
 if(nut.rate!==null)lines.push('En los '+nut.registeredDays+' días con comidas registradas completaste, en promedio, el '+nut.rate+'% de las porciones de tu plan por comida.');else lines.push('Todavía no hay comidas registradas para analizar esta semana.');
 if(changes.length)lines.push('Mejoraste en '+changes[0].name.toLowerCase()+' respecto al entrenamiento previo.');
 if(weight.change!==null)lines.push('Tu peso cambió '+(weight.change>=0?'+':'')+fmt(weight.change,2)+' kg respecto de tu registro semanal anterior.');
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
var api={weekStart:weekStart,addDay:addDay,dateRange:dateRange,fmt:fmt,workoutVolume:workoutVolume,muscleSeries:muscleSeries,nutritionWeek:nutritionWeek,nutritionStats:nutritionStats,weightEntries:weightEntries,weightTrend:weightTrend,recoveryWeek:recoveryWeek,progressChanges:progressChanges,weeklyReport:weeklyReport,blockStats:blockStats,shoppingList:shoppingList};
if(typeof module==='object'&&module.exports)module.exports=api;else root.InsightsModel=api;
})(typeof window==='undefined'?globalThis:window);
