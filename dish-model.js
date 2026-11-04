(function(root){
'use strict';
function normalize(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function apply(entry,dish,groups){
 var next=JSON.parse(JSON.stringify(entry||{}));var logs=next._dishes||[];
 if(logs.some(function(x){return x.id===dish.id}))return {entry:next,duplicate:true};
 var applied={};groups.forEach(function(g){var old=Math.max(0,Math.min(g.target,Number(next[g.id])||0));var value=Math.max(0,Math.min(g.target,Number(dish.portions[g.id])||0));next[g.id]=Math.min(g.target,old+value);applied[g.id]=next[g.id]-old});
 next._dishes=logs.concat([{id:dish.id,name:dish.name,portions:dish.portions,applied:applied}]);return {entry:next,duplicate:false};
}
var api={normalize:normalize,apply:apply};if(typeof module==='object'&&module.exports)module.exports=api;else root.DishModel=api;
})(typeof window==='undefined'?globalThis:window);
