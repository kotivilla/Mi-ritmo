(function(root){
'use strict';
var MODEL='gpt-5.4-nano';
var SYSTEM=[
'Sos asistente de alimentación de Mi Ritmo, respondé en español argentino, breve y concreto, sin moralizar.',
'No calcules calorías, ni diagnostiques, ni inventes ingredientes, cantidades o menús de locales.',
'Si mencionan un restaurante sin plato preciso, pedí el nombre y los ingredientes. Solo una porción suficiente equivale a una opción completa.',
'Desayuno y Té: 1 opción de hidratos (aprox. 120 g de pan o avena), 3 opciones de proteína (1 huevo o 200 ml yogur = 1 opción), 1 de grasas (aprox. 20 g frutos secos).',
'Almuerzo y Comida: 1 opción hidratos (aprox. 300 g arroz, papa o pasta cocidos), 1 proteína (120-150 g carne cocida), 1 vegetales (medio plato), 1 grasas (una cucharada de aceite).',
'Frutas: 2 al día, objetivo aparte. No cuentan en porcentaje de las otras comidas.',
'No asumas aceite, guarnición o porciones invisibles. Si no hay cantidad segura para un grupo, estimá 0 y pedí aclaración.',
'estimate expresa las opciones COMPLETAS del plato conversado, NO incluye lo que el usuario ya registró. Si solo pregunta qué falta sin nueva comida, todos los estimate son 0.',
'Respondé siempre únicamente un JSON válido según el esquema indicado. Nunca guardes comidas ni afirmes haberlas guardado.'
].join('\n');
var SCHEMA={type:'object',additionalProperties:false,
 properties:{
  answer:{type:'string'},
  estimate:{type:'object',additionalProperties:false,properties:{
    carb:{type:'integer'},protein:{type:'integer'},veg:{type:'integer'},fat:{type:'integer'},fruit:{type:'integer'}
   },required:['carb','protein','veg','fat','fruit']},
  confidence:{type:'string',enum:['alta','media','baja']},
  question:{type:'string'},
  assumptions:{type:'array',items:{type:'string'}}
 },required:['answer','estimate','confidence','question','assumptions']};
function clamp(x,n){var v=Number(x);return Number.isFinite(v)?Math.max(0,Math.min(n,Math.floor(v))):0}
function specs(meals,id){return meals.find(function(m){return m.id===id})}
function remaining(meal,saved,estimate){
 return meal.groups.map(function(g){
  var recorded=clamp(saved[g.id],g.target),proposed=clamp(estimate[g.id],g.target);
  return {id:g.id,label:g.id==='carb'?'Hidratos':g.id==='protein'?'Proteínas':g.id==='veg'?'Vegetales':'Grasas',
   target:g.target,recorded:recorded,proposed:proposed,remaining:Math.max(0,g.target-Math.max(recorded,proposed))};
 });
}
function prompt(args,meal){
 var history=(args.history||[]).slice(-4).map(function(h){
  return {role:h.role==='assistant'?'assistant':'user',content:String(h.content||'').slice(0,400)};
 });
 return [{role:'system',content:SYSTEM}].concat(history).concat([{
  role:'user',content:JSON.stringify({
   fecha:args.date,comida:meal.name,
   grupos:meal.groups.map(function(g){return {id:g.id,nombre:g.name,opciones:g.target,guia:g.help}}),
   gruposYaMarcados:args.saved,frutasYaMarcadas:args.fruit,
   consulta:args.message,
   indicacion:'Estimá opciones enteras del plato (no de las marcas previas), sé conservador, pedí las porciones que falten.'
  })
 }]);
}
function parse(response,meal,args){
 var str=response&&response.message&&response.message.content;
 if(Array.isArray(str))str=str.map(function(x){return x.text||''}).join('');
 if(typeof str!=='string')throw Error('No pude interpretar la respuesta de la IA.');
 str=str.trim();
 if(str.charCodeAt(0)===96)str=str.replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\x60{3}$/,'').trim();
 var data;
 try{data=JSON.parse(str)}catch(e){throw Error('La respuesta no se pudo interpretar. Probá describiendo el plato de otra forma.')}
 if(!data||typeof data.answer!=='string'||!data.answer.trim())throw Error('La IA respondió de forma incompleta. Probá nuevamente.');
 var estimate={carb:0,protein:0,veg:0,fat:0,fruit:0};
 meal.groups.forEach(function(g){estimate[g.id]=clamp(data.estimate&&data.estimate[g.id],g.target)});
 estimate.fruit=clamp(data.estimate&&data.estimate.fruit,2);
 return {answer:data.answer.slice(0,900),question:String(data.question||'').slice(0,220),
  confidence:['alta','media','baja'].includes(data.confidence)?data.confidence:'baja',
  estimate:estimate,remaining:remaining(meal,args.saved||{},estimate),
  fruitRemaining:Math.max(0,2-Math.max(clamp(args.fruit,2),estimate.fruit)),
  assumptions:Array.isArray(data.assumptions)?data.assumptions.slice(0,2):[]};
}
async function ask(args){
 if(!root.puter||!root.puter.ai||typeof root.puter.ai.chat!=='function')throw Error('No se cargó la IA. Revisá tu conexión.');
 var meal=specs(args.meals,args.meal);
 if(!meal)throw Error('Elegí qué comida querés analizar.');
 var response=await root.puter.ai.chat(prompt(args,meal),{
  model:MODEL,normalize:true,
  outputFormat:{type:'json_schema',name:'meal_groups',strict:true,schema:SCHEMA}
 });
 return parse(response,meal,args);
}
root.FoodPuterAI={ask:ask,parse:parse,remaining:remaining};
})(typeof window==='undefined'?globalThis:window);
