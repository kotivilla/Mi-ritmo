(function(root){
'use strict';
function normalize(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function apply(entry,dish,groups){
 var next=JSON.parse(JSON.stringify(entry||{}));var logs=next._dishes||[];
 if(logs.some(function(x){return x.id===dish.id}))return {entry:next,duplicate:true};
 var applied={};groups.forEach(function(g){var old=Math.max(0,Math.min(g.target,Number(next[g.id])||0));var value=Math.max(0,Math.min(g.target,Number(dish.portions[g.id])||0));next[g.id]=Math.min(g.target,old+value);applied[g.id]=next[g.id]-old});
 next._dishes=logs.concat([{id:dish.id,name:dish.name,portions:dish.portions,applied:applied}]);return {entry:next,duplicate:false};
}
function remove(entry,dish,groups){
 var next=JSON.parse(JSON.stringify(entry||{})),logs=Array.isArray(next._dishes)?next._dishes:[];
 if(!logs.some(function(item){return item.id===dish.id}))return {entry:next,missing:true};
 var base={};
 groups.forEach(function(g){
  var value=Math.max(0,Math.min(g.target,Number(next[g.id])||0));
  var applied=logs.reduce(function(total,item){return total+Math.max(0,Number(item.applied&&item.applied[g.id])||0)},0);
  base[g.id]=Math.max(0,Math.min(g.target,value-applied));
 });
 var remaining=logs.filter(function(item){return item.id!==dish.id});
 groups.forEach(function(g){
  var current=base[g.id];
  remaining.forEach(function(item){
   var portion=Math.max(0,Math.min(g.target,Number(item.portions&&item.portions[g.id])||0));
   var nextValue=Math.min(g.target,current+portion);
   if(!item.applied)item.applied={};
   item.applied[g.id]=nextValue-current;
   current=nextValue;
  });
  next[g.id]=current;
 });
 next._dishes=remaining;
 return {entry:next,removed:true};
}
var api={normalize:normalize,apply:apply,remove:remove};if(typeof module==='object'&&module.exports)module.exports=api;else root.DishModel=api;
})(typeof window==='undefined'?globalThis:window);
