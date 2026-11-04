(function(root){
'use strict';
var b=null,draft=null,tickId=null;
function $(id){return document.getElementById(id)}
function fmt(n){return Number(n).toLocaleString('es-AR',{maximumFractionDigits:2})}
function escape(v){return b.safe(v)}
function key(){return 'mi-ritmo-active-session-v1-'+b.userId()}
function freshDraft(){return {owner:b.userId(),date:'',routineId:'',routineName:'',exercises:[],index:0,restDuration:90,restUntil:null,updatedAt:Date.now()}}
function readDraft(){
 if(!b.userId())return null;
 try{var d=JSON.parse(localStorage.getItem(key())||'null');
  if(d&&d.owner===b.userId()&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&
  Array.isArray(d.exercises)&&d.exercises.length<=30&&Number.isInteger(d.index))return d;
 }catch(e){}return null;
}
function persist(){if(!draft||!b.userId())return;draft.updatedAt=Date.now();try{localStorage.setItem(key(),JSON.stringify(draft))}catch(e){}}
function clearSaved(){if(b&&b.userId())try{localStorage.removeItem(key())}catch(e){}}
function completed(ex){return ex.sets.filter(function(set){return set.done}).length}
function overall(){return draft&&draft.exercises.reduce(function(total,ex){return total+completed(ex)},0)||0}
function planned(){return draft&&draft.exercises.reduce(function(total,ex){return total+ex.sets.length},0)||0}
function getRoutines(){return b.routines().filter(function(r){return !r.archived&&r.rows&&r.rows.length})}
function safeText(s){return String(s==null?'':s)}
function timeFormat(seconds){var n=Math.max(0,Math.ceil(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
function routineChoiceMarkup(){
 var items=getRoutines();
 if(!items.length)return '<div class="active-empty"><h3>Configurá tu rutina</h3><p>Primero agregá ejercicios a un día de rutina.</p><button type="button" class="pill primary" data-active-action="settings">Abrir rutina</button></div>';
 return '<div class="active-picker"><p class="active-step-caption">ELEGÍ TU RUTINA</p><h3>¿Qué vas a entrenar?</h3><div class="active-routine-list">'+items.map(function(day){
  return '<button type="button" class="active-routine" data-active-routine="'+escape(day.id)+'"><span><strong>'+escape(day.name)+'</strong><small>'+day.rows.length+' '+(day.rows.length===1?'ejercicio':'ejercicios')+'</small></span><span aria-hidden="true">→</span></button>';
 }).join('')+'</div></div>';
}
function lastText(ex){
 var prior=b.lastExercise(ex,draft.date);
 if(!prior||!prior.sets||!prior.sets.length)return 'Sin registro anterior';
 var date=new Date(prior.date+'T12:00:00');
 var dateLabel=new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short'}).format(date);
 return 'Última vez · '+dateLabel+' · '+prior.sets.slice(0,4).map(function(s){return s.reps+'×'+fmt(s.weight)+' kg'}).join(' · ')+(prior.sets.length>4?'…':'');
}
function exerciseMarkup(){
 var ex=draft.exercises[draft.index],n=draft.exercises.length,pct=Math.round(100*overall()/Math.max(1,planned()));
 var prior=b.lastExercise(ex,draft.date);
 return '<div class="active-exercise-screen">'+
 '<div class="active-topline"><span>'+escape(draft.routineName)+'</span><span>'+overall()+'/'+planned()+' series</span></div>'+
 '<div class="active-progress" role="progressbar" aria-label="Series completadas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><span style="width:'+pct+'%"></span></div>'+
 '<div class="active-exercise-heading"><span class="active-step-caption">EJERCICIO '+(draft.index+1)+' DE '+n+'</span>'+
 '<h3>'+escape(ex.name)+'</h3><p class="active-prior">'+escape(lastText(ex))+'</p></div>'+
 '<div class="active-sets-header"><span>Serie</span><span>Reps.</span><span>Peso (kg)</span><span></span></div>'+
 '<div class="active-sets">'+ex.sets.map(function(set,i){
  var old=prior&&prior.sets&&prior.sets[i]||null,plannedSet=ex.planned&&ex.planned[i]||{};
  var repsPlaceholder=old&&old.reps!=null?old.reps:plannedSet.reps==null?'Reps':plannedSet.reps;
  var weightPlaceholder=old&&old.weight!=null?old.weight:'Kg';
  return '<div class="active-set-row'+(set.done?' done':'')+'">'+
   '<span class="active-set-number">'+(i+1)+'</span>'+
   '<input type="number" data-active-field="reps" data-active-set="'+i+'" inputmode="numeric" min="1" max="1000" step="1" placeholder="'+escape(repsPlaceholder)+'" value="'+escape(set.reps==null?'':set.reps)+'" aria-label="Repeticiones serie '+(i+1)+'">'+
   '<input type="number" data-active-field="weight" data-active-set="'+i+'" inputmode="decimal" min="0" max="2000" step="any" placeholder="'+escape(weightPlaceholder)+'" value="'+escape(set.weight==null?'':set.weight)+'" aria-label="Peso serie '+(i+1)+'">'+
   '<button type="button" class="active-set-done" data-active-set-done="'+i+'" aria-pressed="'+String(!!set.done)+'" aria-label="'+(set.done?'Desmarcar':'Completar')+' serie '+(i+1)+'">'+(set.done?'✓':'○')+'</button>'+
   '</div>';
 }).join('')+'</div>'+
 '<div class="active-exercise-actions"><button type="button" class="active-add-set" data-active-action="add-set">+ Agregar serie</button>'+
 (ex.sets.length>1?'<button type="button" class="active-remove-set" data-active-action="remove-set">Quitar última serie</button>':'')+'</div>'+
 '</div>';
}
function updateTimer(){
 var root=$('active-workout-rest');if(!root||!draft)return;
 var remaining=draft.restUntil?Math.ceil((draft.restUntil-Date.now())/1000):0;
 if(remaining<=0){
  if(draft.restUntil){draft.restUntil=null;persist()}
  root.hidden=true;return;
 }
 root.hidden=false;
 $('active-workout-countdown').textContent=timeFormat(remaining);
}
function render(){
 if(!b||!$('active-workout-dialog').open)return;
 $('active-workout-error').textContent='';
 $('active-workout-date').textContent=draft?new Intl.DateTimeFormat('es-AR',{weekday:'short',day:'numeric',month:'short'}).format(new Date(draft.date+'T12:00:00')):'';
 $('active-workout-body').innerHTML=draft&&draft.routineId&&draft.exercises.length?exerciseMarkup():routineChoiceMarkup();
 var engaged=!!(draft&&draft.routineId&&draft.exercises.length);
 $('active-workout-footer').hidden=!engaged;
 if(engaged){
  $('active-workout-prev').disabled=draft.index===0;
  $('active-workout-next').textContent=draft.index===draft.exercises.length-1?'Finalizar y guardar':'Siguiente ejercicio →';
  $('active-workout-change').hidden=draft.exercises.length===1;
  $('active-workout-rest-seconds').textContent=draft.restDuration+' s';
  $('active-workout-body').scrollTop=0;
 }
 updateTimer();
}
function startRoutine(id){
 var day=getRoutines().find(function(r){return r.id===id});if(!day)return;
 if(draft&&overall()&&!confirm('¿Cambiar de rutina y descartar las series completadas de este borrador?'))return;
 var date=draft.date,owner=draft.owner;
 draft=freshDraft();draft.date=date;draft.owner=owner;draft.routineId=day.id;draft.routineName=day.name;
 draft.exercises=day.rows.map(function(ex){
  return {id:ex.id,name:ex.name,equipment:ex.equipment,muscle:ex.muscle,planned:ex.sets.map(function(s){return {reps:s.reps,weight:s.weight}}),
   sets:ex.sets.map(function(){return {reps:null,weight:null,done:false}})};
 });
 persist();render();
}
function open(date){
 if(!b.userId()){b.openAccount();return}
 if(date>b.today()){b.toast('No podés registrar un entrenamiento futuro.');return}
 if(b.hasWorkout(date)){b.openClassic(date);return}
 var saved=readDraft();
 if(saved&&saved.date!==date&&saved.exercises.length&&saved.exercises.some(function(ex){return ex.sets.some(function(x){return x.done})})){
  if(!confirm('Tenés un entrenamiento sin guardar del '+saved.date+'. ¿Descartarlo para empezar el de hoy?'))return;
 }
 draft=saved&&saved.date===date?saved:freshDraft();
 draft.date=date;draft.owner=b.userId();
 if(draft.index<0||draft.index>=draft.exercises.length)draft.index=0;
 persist();
 $('active-workout-dialog').showModal();
 render();
 if(tickId)clearInterval(tickId);
 tickId=setInterval(updateTimer,1000);
}
function close(){
 $('active-workout-dialog').close();
 if(draft&&draft.routineId&&overall())b.toast('Borrador guardado en este teléfono.');
}
function updateEntryButton(){
 var btn=$('gym-register-today');if(!btn)return;
 var date=b.today();
 if(b.hasWorkout(date))btn.textContent='Editar entrenamiento de hoy';
 else{var saved=readDraft();btn.textContent=saved&&saved.date===date&&saved.routineId?'Continuar entrenamiento':'+ Iniciar entrenamiento'}
}
function applyField(input){
 if(!draft||!draft.exercises.length)return;
 var ex=draft.exercises[draft.index],i=Number(input.dataset.activeSet),set=ex.sets[i];
 if(!set)return;
 var value=input.value.trim();set[input.dataset.activeField]=value===''?null:Number(value);
 if(set.done){set.done=false;var row=input.closest('.active-set-row');if(row){row.classList.remove('done');var done=row.querySelector('.active-set-done');if(done){done.textContent='○';done.setAttribute('aria-pressed','false')}}}
 persist();
}
function setDone(index){
 var ex=draft.exercises[draft.index],set=ex&&ex.sets[index];if(!set)return;
 if(set.done){set.done=false;persist();render();return}
 if(!Number.isInteger(set.reps)||set.reps<1||set.reps>1000||!Number.isFinite(set.weight)||set.weight<0||set.weight>2000){
  $('active-workout-error').textContent='Completá repeticiones y peso de esa serie. Para ejercicios sin lastre, usá 0 kg.';
  var input=$('active-workout-body').querySelector('[data-active-set="'+index+'"][data-active-field="'+(!Number.isInteger(set.reps)||set.reps<1?'reps':'weight')+'"]');
  if(input)input.focus();
  return;
 }
 set.done=true;draft.restUntil=Date.now()+draft.restDuration*1000;persist();render();
}
function finish(){
 if(!draft||!draft.routineId)return;
 var exercises=draft.exercises.map(function(ex){
  return {id:ex.id,name:ex.name,equipment:ex.equipment,muscle:ex.muscle,
   sets:ex.sets.filter(function(s){return s.done}).map(function(s){return {reps:s.reps,weight:s.weight}})};
 }).filter(function(ex){return ex.sets.length});
 if(!exercises.length){$('active-workout-error').textContent='Marcá al menos una serie como completada.';return}
 if(overall()<planned()&&!confirm('Quedan series sin marcar. ¿Guardar solo las que completaste?'))return;
 try{
  b.saveWorkout(draft.date,draft.routineId,draft.routineName,exercises);
  clearSaved();draft=null;$('active-workout-dialog').close();b.toast('Entrenamiento guardado.');
 }catch(e){$('active-workout-error').textContent=e.message||'No se pudo guardar el entrenamiento.'}
}
function handleAction(e){
 var btn=e.target.closest('[data-active-routine],[data-active-action],[data-active-set-done]');if(!btn)return;
 if(btn.hasAttribute('data-active-routine')){startRoutine(btn.dataset.activeRoutine);return}
 if(btn.hasAttribute('data-active-set-done')){setDone(Number(btn.dataset.activeSetDone));return}
 if(!draft)return;
 var action=btn.dataset.activeAction;
 if(action==='add-set'){
  var ex=draft.exercises[draft.index];if(ex.sets.length>=30)return;
  ex.sets.push({reps:null,weight:null,done:false});persist();render();
 }else if(action==='remove-set'){
  var ex2=draft.exercises[draft.index];
  if(ex2.sets.length<=1)return;
  if(ex2.sets[ex2.sets.length-1].done&&!confirm('¿Quitar esta serie completada?'))return;
  ex2.sets.pop();persist();render();
 }else if(action==='settings'){
  $('active-workout-dialog').close();b.openRoutineSettings();
 }
}
function init(bridge){
 if(b)return;
 b=bridge;
 $('active-workout-body').addEventListener('click',handleAction);
 $('active-workout-body').addEventListener('input',function(event){if(event.target.matches('[data-active-field]'))applyField(event.target)});
 $('active-workout-close').addEventListener('click',close);
 $('active-workout-prev').addEventListener('click',function(){if(draft&&draft.index>0){draft.index--;persist();render()}});
 $('active-workout-next').addEventListener('click',function(){
  if(!draft)return;
  if(draft.index<draft.exercises.length-1){draft.index++;persist();render()}else finish();
 });
 $('active-workout-save').addEventListener('click',finish);
 $('active-workout-change').addEventListener('click',function(){
  if(!draft)return;
  if(overall()&&!confirm('¿Cambiar de rutina? Las series marcadas en este borrador se descartarán.'))return;
  draft.routineId='';draft.routineName='';draft.exercises=[];draft.index=0;draft.restUntil=null;
  persist();render();
 });
 $('active-workout-rest-skip').addEventListener('click',function(){if(draft){draft.restUntil=null;persist();updateTimer()}});
 $('active-workout-rest-duration').addEventListener('click',function(){
  if(!draft)return;
  draft.restDuration=draft.restDuration===90?120:draft.restDuration===120?60:90;
  persist();$('active-workout-rest-seconds').textContent=draft.restDuration+' s';
 });
 $('active-workout-dialog').addEventListener('close',function(){
  if(tickId){clearInterval(tickId);tickId=null}updateEntryButton();
 });
 updateEntryButton();
}
root.ActiveWorkoutUI={init:init,open:open,updateEntryButton:updateEntryButton};
})(typeof window==='undefined'?globalThis:window);
