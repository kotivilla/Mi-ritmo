(function(root){
'use strict';
var bridge=null,history=[],currentDate='',sending=false;
function $(id){return document.getElementById(id)}
function scrollToEnd(){var node=$('food-chat-messages');node.scrollTop=node.scrollHeight}
function line(text,type){
 var row=document.createElement('div');row.className='food-chat-msg '+(type==='user'?'is-user':'is-ai');
 var bubble=document.createElement('div');bubble.className='food-chat-bubble';
 var p=document.createElement('p');p.textContent=String(text||'');
 bubble.append(p);row.append(bubble);$('food-chat-messages').append(row);scrollToEnd();
 return bubble;
}
function welcome(){
 $('food-chat-messages').innerHTML='';
 line('Contame qué comiste y te ayudo a identificar los grupos de tu plan que podrías haber cubierto y cuáles te faltarían. Podés mencionar un restaurante, pero decime qué plato pediste.','assistant');
}
function dateLabel(key){
 var date=new Date(key+'T12:00:00');
 return new Intl.DateTimeFormat('es-AR',{weekday:'short',day:'numeric',month:'short'}).format(date);
}
function initContext(){
 var date=bridge.date();
 if(currentDate===date)return;
 currentDate=date;history=[];welcome();
 $('food-chat-selected-date').textContent=dateLabel(date);
}
function inferMeal(text){
 var t=String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(t.includes('desayun'))return 'breakfast';
 if(t.includes('almorc')||t.includes('almuerz'))return 'lunch';
 if(t.includes('merend')||/\btome (un |el )?te\b/.test(t))return 'snack';
 if(/\b(cene|cena|cenar|cenamos)\b/.test(t))return 'dinner';
 return null;
}
function buildResult(result){
 var bubble=line(result.answer,'assistant'),small=document.createElement('small');
 small.className='food-chat-status';
 small.textContent=result.confidence==='baja'?'Estimación incierta':result.confidence==='media'?'Estimación aproximada':'Estimación orientativa';
 bubble.append(small);
 if(result.question){
  var q=document.createElement('p');q.className='food-chat-question';q.textContent=result.question;bubble.append(q);
 }
 if(Array.isArray(result.remaining)&&result.remaining.length){
  var heading=document.createElement('strong');heading.className='food-chat-result-heading';heading.textContent='Para completar esta comida:';bubble.append(heading);
  var list=document.createElement('div');list.className='food-chat-groups';
  result.remaining.forEach(function(group){
   var tag=document.createElement('span');
   tag.className='food-chat-group'+(group.remaining?' is-pending':' is-complete');
   tag.textContent=group.remaining?group.label+': '+group.remaining+' pendiente'+(group.remaining===1?'':'s'):group.label+': cubierto*';
   list.append(tag);
  });bubble.append(list);
  var note=document.createElement('small');note.className='food-chat-footnote';note.textContent='*Solo si la estimación de porciones es correcta. Tus marcas previas también cuentan.';bubble.append(note);
 }
 if(typeof result.fruitRemaining==='number'){
  var fruit=document.createElement('small');fruit.className='food-chat-footnote';fruit.textContent='Frutas: '+result.fruitRemaining+'/2 todavía por cubrir (estimado).';bubble.append(fruit);
 }
 var go=document.createElement('button');go.type='button';go.className='food-chat-goto';go.textContent='Ver y marcar mi comida';
 go.addEventListener('click',function(){$('food-chat-dialog').close();bridge.openMeal($('food-chat-meal').value)});
 bubble.append(go);
 var footer=document.createElement('small');footer.className='food-chat-disclaimer';
 footer.textContent='No se guardó ninguna comida. Confirmá porciones y marcá los grupos en tu registro.';
 bubble.append(footer);scrollToEnd();
}
function setBusy(value){
 sending=!!value;$('food-chat-send').disabled=sending;
 $('food-chat-send').textContent=sending?'Consultando…':'Enviar';
 $('food-chat-input').disabled=sending;$('food-chat-meal').disabled=sending;
}
function savedGroups(meal,date){
 var row=(bridge.day(date).meals||{})[meal]||{},spec=bridge.meals().find(function(x){return x.id===meal});
 var saved={};(spec&&spec.groups||[]).forEach(function(g){saved[g.id]=Number(row[g.id])||0});return saved;
}
async function send(message){
 var text=String(message||'').trim().slice(0,550);
 if(!text||sending)return;
 if(!bridge.user()){bridge.openAccount();return}
 var date=bridge.date();if(date!==currentDate)initContext();
 var predicted=inferMeal(text);
 if(predicted&&$('food-chat-meal').value!==predicted){
  $('food-chat-meal').value=predicted;history=[];welcome();
 }
 var meal=$('food-chat-meal').value,oldHistory=history.slice(-4);
 line(text,'user');$('food-chat-input').value='';setBusy(true);
 try{
  var token=await bridge.accessToken();
  if(!token)throw Error('Tu sesión venció. Iniciá sesión nuevamente.');
  var response=await fetch('/api/food-chat',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
   body:JSON.stringify({message:text,meal,date,saved:savedGroups(meal,date),fruit:bridge.fruit(date),history:oldHistory})});
  var data=await response.json().catch(function(){return {}});
  if(!response.ok)throw Error(data.error||('No pude responder (error '+response.status+').'));
  buildResult(data);
  history.push({role:'user',content:text},{role:'assistant',content:data.answer});
  history=history.slice(-6);
 }catch(error){
  var message=error instanceof TypeError?'No pude conectarme. Revisá Internet e intentá nuevamente.':String(error.message||'No pude completar la consulta.');
  line(message,'assistant');
 }finally{setBusy(false);$('food-chat-input').focus()}
}
function init(b){
 if(bridge)return;bridge=b;
 $('food-chat-open').addEventListener('click',function(){
  if(!bridge.user()){bridge.openAccount();return}
  var modal=$('food-chat-dialog');
  var hour=new Date().getHours();
  $('food-chat-meal').value=hour<11?'breakfast':hour<16?'lunch':hour<20?'snack':'dinner';
  initContext();modal.showModal();$('food-chat-input').focus();
 });
 $('food-chat-close').addEventListener('click',function(){$('food-chat-dialog').close()});
 $('food-chat-form').addEventListener('submit',function(event){event.preventDefault();send($('food-chat-input').value)});
 $('food-chat-input').addEventListener('keydown',function(event){
  if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send($('food-chat-input').value)}
 });
 $('food-chat-meal').addEventListener('change',function(){history=[];welcome()});
 $('food-chat-examples').addEventListener('click',function(event){
  var btn=event.target.closest('[data-example]');if(!btn)return;
  $('food-chat-input').value=btn.dataset.example;$('food-chat-input').focus();
 });
}
function refresh(){
 if(bridge&&$('food-chat-dialog').open&&bridge.date()!==currentDate)initContext();
}
root.FoodChatUI={init:init,refresh:refresh};
})(typeof window==='undefined'?globalThis:window);
