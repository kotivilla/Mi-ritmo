(function(root){
'use strict';
// El cumplimiento mide porciones pautadas, no calorías ni el número de grupos.
// Escala única de colores para cumplimiento alimentario.
function color(percent,hasData){
 if(!hasData)return '#dce2df';
 var pct=Math.max(0,Math.min(100,Math.round(Number(percent)||0)));
 return pct<50?'#D94B4B':pct<75?'#E99A3E':pct<90?'#E5C14D':pct<100?'#4CAF50':'#2E7D32';
}
function portion(value,target){
 var max=Number(target)||0,amount=Number(value)||0;
 return max>0?Math.max(0,Math.min(max,amount)):0;
}
function mealPortions(data,spec){
 var completed=0,total=0;
 (spec&&spec.groups||[]).forEach(function(group){
  var target=Math.max(0,Number(group.target)||0);
  total+=target;completed+=portion(data&&data[group.id],target);
 });
 return {completed:completed,total:total,fraction:total>0?completed/total:0,complete:total>0&&completed>=total};
}
function dayScore(mealsData,mealSpec){
 var meals=mealSpec||[],points=0,complete=0,any=false,portionsCompleted=0,portionsTotal=0;
 meals.forEach(function(meal){
  var scored=mealPortions((mealsData||{})[meal.id]||{},meal);
  points+=scored.fraction;portionsCompleted+=scored.completed;portionsTotal+=scored.total;
  if(scored.complete)complete++;
  if(scored.completed>0)any=true;
 });
 return {points:points,total:meals.length,complete:complete,any:any,
  portionsCompleted:portionsCompleted,portionsTotal:portionsTotal,
  rate:meals.length?100*points/meals.length:0};
}
var api={portion:portion,mealPortions:mealPortions,dayScore:dayScore,color:color};
if(typeof module==='object'&&module.exports)module.exports=api;else root.NutritionScoring=api;
})(typeof window==='undefined'?globalThis:window);
