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
 line('Decime qué comiste. Si mencionás una marca o un local, voy a buscarlo en internet para identificar mejor los ingredientes. Después lo comparo con tu plan.','assistant');
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
 if(result.webLookup&&result.webLookup.searched){
  var references=document.createElement('div');references.className='food-chat-sources';
  var heading=document.createElement('strong');heading.className='food-chat-sources-label';
  heading.textContent='Búsqueda en internet';references.append(heading);
  var sourceItems=result.webLookup.sources||[];
  if(sourceItems.length){
   sourceItems.slice(0,3).forEach(function(item){
    try{
     var url=new URL(String(item.url));
     if(url.protocol!=='https:'&&url.protocol!=='http:')return;
     var anchor=document.createElement('a');anchor.href=url.href;anchor.target='_blank';anchor.rel='noopener noreferrer';
     anchor.textContent=String(item.title||url.hostname).slice(0,85);references.append(anchor);
    }catch(e){}
   });
  }else{
   var warning=document.createElement('small');warning.textContent='No pude recuperar enlaces para confirmar el producto. Si podés, revisá la etiqueta.';references.append(warning);
  }
  bubble.append(references);
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
  var data=await root.FoodPuterAI.ask({
   message:text,meal:meal,date:date,saved:savedGroups(meal,date),
   fruit:bridge.fruit(date),history:oldHistory,meals:bridge.meals(),
   webEnabled:$('food-chat-web-enabled').checked,
   onStage:function(stage){$('food-chat-send').textContent=stage==='search'?'Buscando…':'Analizando…'}
  });
  buildResult(data);
  history.push({role:'user',content:text},{role:'assistant',content:data.answer});
  history=history.slice(-6);
 }catch(error){
  var details=String(error&&((error.msg||error.message||error.error))||'');
  var message=/auth_window_closed|popup_blocked/.test(details)?'Para usar el asistente, permití la ventana de inicio de sesión de Puter.':
   /credit|quota|balance|insufficient|limit/i.test(details)?'Se agotaron los créditos gratuitos de Puter o hay un límite de uso. Revisá tu cuenta de Puter.':
   /network|failed to fetch/i.test(details)?'No pude conectarme. Revisá Internet e intentá nuevamente.':
   details.slice(0,240)||'No pude completar la consulta. Probá nuevamente.';
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
