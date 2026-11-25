(function(root){
'use strict';
var b,blockNotice='',weightDate='',recoveryDate='',initDone=false;
var nutritionFrom='',nutritionTo='',nutritionPreset='30',nutritionMeal='all';
function $(id){return document.getElementById(id)}
function state(){return b.state()}
function today(){return b.today()}
function clean(x){return b.safe(x)}
function fmt(x,n){return InsightsModel.fmt(x,n)}
function active(){if(!b.user()){b.openAccount();return false}return true}
function writtenDay(key){if(!state().days[key])state().days[key]={meals:{},gym:false,note:''};return state().days[key]}
function writeDay(key){b.markDay(key);b.renderAll()}
function settings(){var s=state().settings;if(!s.mealPlan)s.mealPlan={};if(!Array.isArray(s.trainingBlocks))s.trainingBlocks=[];if(!s.goalFocus)s.goalFocus='muscle';return s}
function writeSettings(){b.saveSettings();b.renderAll()}
function setStatus(id,msg){$(id).textContent=msg}
function shortDate(s){return new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short'}).format(new Date(s+'T12:00:00'))}
function longDate(s){return new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(s+'T12:00:00'))}
function displayWeek(s){return shortDate(s)+' – '+shortDate(InsightsModel.addDay(s,6))}
function statsDays(n){
 nutritionTo=today();nutritionFrom=InsightsModel.addDay(nutritionTo,-n+1);
 nutritionPreset=String(n);
}
function renderNutrition(){
 var max=today();
 if(!nutritionFrom||!nutritionTo)statsDays(30);
 $('nutrition-stats-from').max=max;
 $('nutrition-stats-to').max=max;
 $('nutrition-stats-from').value=nutritionFrom;
 $('nutrition-stats-to').value=nutritionTo;
 document.querySelectorAll('[data-nutrition-range]').forEach(function(btn){
  var selected=btn.dataset.nutritionRange===nutritionPreset;
  btn.classList.toggle('active',selected);
  btn.setAttribute('aria-pressed',String(selected));
 });
 var invalid=!/^\d{4}-\d{2}-\d{2}$/.test(nutritionFrom)||!/^\d{4}-\d{2}-\d{2}$/.test(nutritionTo)||
  nutritionFrom>nutritionTo||nutritionTo>max;
 $('nutrition-stats-error').hidden=!invalid;
 $('nutrition-stats-error').textContent=invalid?'Elegí un rango válido: desde una fecha anterior o igual a hasta, sin días futuros.':'';
 if(invalid)return;
 var data=InsightsModel.nutritionStats(state().days,b.meals,nutritionFrom,nutritionTo,max,nutritionMeal);
 $('nutrition-stats-average').textContent=data.dailyAverage===null?'—':data.dailyAverage+'%';
 $('nutrition-stats-recorded').textContent=data.registeredDays+' / '+data.daily.length;
 $('nutrition-stats-total-days').textContent='Días con comidas registradas';
 var name=nutritionMeal==='all'?'todas las comidas':(b.meals.find(function(m){return m.id===nutritionMeal})||{}).name||'comida elegida';
 $('insights-nutrition-caption').textContent=data.evaluatedMeals?
  'Promedio de '+data.evaluatedMeals+' '+(data.evaluatedMeals===1?'comida evaluada':'comidas evaluadas')+' en '+name.toLowerCase()+'. '+
  (data.skippedMeals?data.skippedMeals+' '+(data.skippedMeals===1?'comida sin cargar cuenta':'comidas sin cargar cuentan')+' como 0%. ':'')+
  'Cada grupo se mide según sus propias porciones.':
  'No hay comidas evaluables para este filtro y rango de fechas.';
 var order=[['protein','Proteínas'],['veg','Vegetales'],['carb','Hidratos'],['fat','Grasas']];
 var activeGroups=order.filter(function(g){return data.groups[g[0]]});
 $('insights-nutrition-body').innerHTML=activeGroups.length?activeGroups.map(function(g){
  var item=data.groups[g[0]],pct=item.pct;
  return '<div class="insights-bar-row"><div class="insights-bar-head"><b>'+g[1]+'</b><strong>'+pct+'%</strong></div>'+
  '<div class="insights-bar"><span style="width:'+pct+'%;background:'+NutritionScoring.color(pct,true)+'"></span></div></div>';
 }).join(''):'<div class="insights-empty">Todavía no hay datos de estos grupos en el período.</div>';
 $('nutrition-stats-daily-list').innerHTML=data.weekdays.map(function(item){
  var hasData=item.count>0,pct=item.percent;
  return '<div class="nutrition-stats-day'+(hasData?'':' is-empty')+'" aria-label="'+clean(item.label)+': '+(hasData?pct+'% promedio de '+item.count+' registros':'sin registros')+'">'+
   '<span class="nutrition-stats-day-label">'+clean(item.label)+'</span>'+
   '<div class="nutrition-stats-day-track" aria-hidden="true"><span style="width:'+(hasData?pct:0)+'%;background:'+(hasData?NutritionScoring.color(pct,true):'#dce2df')+'"></span></div>'+
   '<span class="nutrition-stats-day-value">'+(hasData?pct+'%':'—')+
   '<small>'+(hasData?item.count+' '+(item.count===1?'día':'días'):'Sin datos')+'</small></span></div>';
 }).join('');
 $('nutrition-stats-daily-note').textContent='Promedio de cada día de la semana en el rango elegido. Se muestran cuántos '+ 
  'registros componen cada promedio. Los días completamente vacíos se excluyen; en días anteriores con al menos una comida cargada, las demás cuentan como 0%.';
}
function weightChart(entries){
 var pts=entries.slice(-14),weights=pts.map(function(p){return p.weight});
 var low=Math.min.apply(null,weights),high=Math.max.apply(null,weights),span=Math.max(.6,high-low);
 var min=low-span*.3,max=high+span*.3;
 var first=Date.parse(pts[0].date+'T12:00:00'),last=Date.parse(pts[pts.length-1].date+'T12:00:00'),duration=Math.max(1,last-first);
 function y(kg){return 141-(kg-min)/(max-min)*100}
 var points=pts.map(function(p){return [pts.length===1?176:46+272*(Date.parse(p.date+'T12:00:00')-first)/duration,y(p.weight)]});
 var trendLine='';
 if(pts.length>=3){
  var xs=pts.map(function(p){return (Date.parse(p.date+'T12:00:00')-first)/86400000});
  var meanX=xs.reduce(function(s,x){return s+x},0)/xs.length;
  var meanY=weights.reduce(function(s,x){return s+x},0)/weights.length;
  var den=xs.reduce(function(s,x){return s+(x-meanX)*(x-meanX)},0);
  var slope=den?xs.reduce(function(s,x,i){return s+(x-meanX)*(weights[i]-meanY)},0)/den:0;
  var begin=meanY-slope*meanX,end=begin+slope*xs[xs.length-1];
  trendLine='<line x1="46" y1="'+y(begin)+'" x2="318" y2="'+y(end)+'" stroke="#7eac8d" stroke-width="2" stroke-dasharray="6 5" aria-hidden="true"/>';
 }
 return '<svg class="insights-line-chart" role="img" viewBox="0 0 355 180" aria-label="Evolución del peso semanal por fecha, con línea de tendencia cuando hay tres o más pesajes">'+
  '<line x1="46" y1="141" x2="318" y2="141" stroke="#bbcfc0"/>'+
  '<text x="39" y="46" font-size="11" fill="#698776" text-anchor="end">'+fmt(max,1)+'</text>'+
  '<text x="39" y="145" font-size="11" fill="#698776" text-anchor="end">'+fmt(min,1)+'</text>'+
  trendLine+
  '<polyline fill="none" stroke="#17664b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="'+points.map(function(p){return p.join(',')}).join(' ')+'"/>'+
  points.map(function(p,i){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4.5" fill="#17664b"><title>'+clean(shortDate(pts[i].date))+' — '+fmt(pts[i].weight,2)+' kg</title></circle>'}).join('')+
  '<text x="46" y="163" font-size="11" fill="#698776">'+clean(shortDate(pts[0].date))+'</text>'+
  '<text x="318" text-anchor="end" y="163" font-size="11" fill="#698776">'+clean(shortDate(pts[pts.length-1].date))+'</text></svg>'+
  (pts.length>=3?'<p class="progress-weight-chart-caption">Línea punteada: tendencia de tus últimos registros semanales.</p>':'');
}
function renderWeight(){
 var values=state().days||{},date=weightDate||today(),entry=values[date]||{},raw=entry.weightKg;
 $('insights-weight-date').value=date;
 $('insights-weight-value').value=DecimalInput.format(raw);
 var trend=InsightsModel.weightTrend(values,today()),start=InsightsModel.weekStart(today());
 var thisWeek=trend.entries.some(function(item){return item.date>=start});
 $('insights-weight-weekly-hint').textContent=thisWeek?
  'Ya te pesaste esta semana. Próximo registro: preferentemente el lunes por la mañana.':
  (today()===start?'Hoy es un buen día para pesarte. Si no podés, elegí otro día de la semana.':
   'Una vez por semana alcanza. Si no pudiste el lunes, registrá tu peso cualquier otro día que puedas.');
 if(trend.last){
  var label='Último registro · '+shortDate(trend.last.date),chips=[];
  if(trend.previous)chips.push('<span class="progress-weight-chip">Vs. registro anterior: <b>'+(trend.change>0?'+':'')+fmt(trend.change,2)+' kg</b></span>');
  $('insights-weight-summary').innerHTML=
   '<div class="progress-current-weight"><strong>'+fmt(trend.last.weight,2)+' <span>kg</span></strong><small>'+clean(label)+'</small></div>'+
   (chips.length?'<div class="progress-weight-context">'+chips.join('')+'</div>':'');
 }else $('insights-weight-summary').innerHTML=
  '<div class="progress-weight-empty">Empezá con un pesaje semanal. No necesitás pesarte todos los días.</div>';
 $('insights-weight-chart').innerHTML=trend.entries.length?weightChart(trend.entries):
  '<div class="insights-empty">El gráfico aparecerá a medida que registres tu peso.</div>';
 var recent=trend.entries.slice(-6).reverse();
 $('insights-weight-history').innerHTML=recent.length?
  '<div class="progress-weight-history-heading">Últimos registros</div><div class="progress-weight-history-list">'+
  recent.map(function(item){return '<button type="button" class="progress-weight-history-row" data-weight-date="'+clean(item.date)+'"><span>'+clean(shortDate(item.date))+'</span><strong>'+fmt(item.weight,2)+' kg</strong><small>Editar</small></button>'}).join('')+
  '</div>':'';
}
function saveWeight(e){
 e.preventDefault();if(!active())return;
 var date=$('insights-weight-date').value,val=$('insights-weight-value').value.trim();
 if(!date||date>today()){setStatus('insights-weight-feedback','Elegí hoy o una fecha anterior.');return}
 var row=writtenDay(date);
 if(val){
  var n=DecimalInput.parse(val);
  if(!Number.isFinite(n)||n<20||n>350){setStatus('insights-weight-feedback','Ingresá un peso válido entre 20 y 350 kg (ej.: 68,7).');return}
  row.weightKg=n;
 }else if(Number.isFinite(row.weightKg))delete row.weightKg;
 else{setStatus('insights-weight-feedback','Ingresá un peso para registrar.');return}
 weightDate=date;writeDay(date);
 setStatus('insights-weight-feedback',val?'Peso semanal guardado.':'Registro de esa fecha eliminado.');
}
function renderRecovery(){
 var date=recoveryDate||today(),row=state().days&&state().days[date]||{},v=row.recovery||{};
 $('insights-recovery-date').value=date;
 $('insights-sleep').value=v.sleepHours==null?'':v.sleepHours;
 $('insights-energy').value=v.energy==null?'':v.energy;
 $('insights-soreness').value=v.soreness==null?'':v.soreness;
 var wk=InsightsModel.weekStart(today()),rec=InsightsModel.recoveryWeek(state().days||{},wk,today());
 if(!rec.logged){
  $('insights-recovery-summary').innerHTML='<div class="progress-recovery-empty">Registrá cómo te sentiste después de entrenar o al terminar el día. Con el tiempo vas a poder observar si descansás mejor.</div>';
  return;
 }
 var stats=[
  ['Días registrados',rec.logged+' <span>esta semana</span>'],
  ['Sueño promedio',rec.sleep===null?'—':fmt(rec.sleep,1)+' <span>horas</span>'],
  ['Energía promedio',rec.energy===null?'—':fmt(rec.energy,1)+'<span> / 5</span>'],
  ['Fatiga muscular',rec.soreness===null?'—':fmt(rec.soreness,1)+'<span> / 5</span>']
 ];
 $('insights-recovery-summary').innerHTML='<div class="progress-recovery-stats">'+stats.map(function(item){
  return '<div class="progress-recovery-stat"><small>'+item[0]+'</small><strong>'+item[1]+'</strong></div>';
 }).join('')+'</div>';
}

function saveRecovery(e){e.preventDefault();if(!active())return;
 var date=$('insights-recovery-date').value,sleep=$('insights-sleep').value,energy=$('insights-energy').value,soreness=$('insights-soreness').value;
 if(!date||date>today()){setStatus('insights-recovery-feedback','Elegí hoy o una fecha anterior.');return}
 var value={};
 if(sleep!==''){var hours=Number(sleep);if(!Number.isFinite(hours)||hours<0||hours>18){setStatus('insights-recovery-feedback','Revisá las horas de sueño.');return}value.sleepHours=hours}
 if(energy!=='')value.energy=Number(energy);
 if(soreness!=='')value.soreness=Number(soreness);
 writtenDay(date).recovery=value;recoveryDate=date;writeDay(date);
 setStatus('insights-recovery-feedback',Object.keys(value).length?'Recuperación guardada.':'Registro de recuperación de esa fecha borrado.');
}
function renderReport(){
 var report=InsightsModel.weeklyReport(state(),b.meals,TrainingModel,today());
 $('insights-report-range').textContent=displayWeek(report.start);
 var target=Number(state().settings.gymTarget)||3;
 var nutrition=report.nutrition,weight=report.weight,recovery=report.recovery;
 var rows=[
  ['Gimnasio',report.attended,'/'+target,'sesiones esta semana'],
  ['Alimentación',nutrition.rate===null?'—':nutrition.rate,nutrition.rate===null?'':'%','en '+nutrition.evaluatedMeals+' '+(nutrition.evaluatedMeals===1?'comida evaluada':'comidas evaluadas')],
  ['Último peso',weight.last?fmt(weight.last.weight,1):'—',weight.last?' kg':'',weight.last?'registro del '+shortDate(weight.last.date):'sin registros'],
  ['Recuperación',recovery.logged,'',recovery.logged===1?'día registrado':'días registrados']
 ];
 $('insights-report-cards').innerHTML=rows.map(function(row){
  return '<article class="progress-kpi"><span class="progress-kpi-label">'+row[0]+'</span>'+
   '<strong>'+row[1]+(row[2]?'<em>'+row[2]+'</em>':'')+'</strong><small>'+row[3]+'</small></article>';
 }).join('');
 var observations=[];
 if(report.improvements.length){
  var improvement=report.improvements[0];
  observations.push('Mejoraste en '+improvement.name+' respecto a tu entrenamiento anterior.');
 }
 if(report.attended>0){
  observations.push('Llevás '+report.attended+' '+(report.attended===1?'entrenamiento registrado':'entrenamientos registrados')+' esta semana'+(report.attended>=target?', alcanzando tu objetivo semanal.':'.'));
 }
 if(nutrition.rate!==null){
  observations.push('En '+nutrition.evaluatedMeals+' '+(nutrition.evaluatedMeals===1?'comida evaluada':'comidas evaluadas')+', completaste en promedio el '+nutrition.rate+'% de las porciones de tu plan por comida'+(nutrition.skippedMeals?'; '+nutrition.skippedMeals+' sin cargar '+(nutrition.skippedMeals===1?'cuenta':'cuentan')+' como 0%.':'.'));
 }
 if(weight.change!==null){
  observations.push('Tu peso cambió '+(weight.change>0?'+':'')+fmt(weight.change,2)+' kg entre los últimos dos registros semanales.');
 }
 if(!observations.length)observations.push('Empezá registrando tus comidas o entrenamientos. Cuando haya datos, este espacio te mostrará lo más relevante.');
 $('insights-report-notes').innerHTML=observations.slice(0,2).map(function(line){return '<p>'+clean(line)+'</p>'}).join('');
 var smart=SmartAnalysis.analyze(state(),b.meals,TrainingModel,today());
 var insight=smart.insights[0],others=smart.insights.slice(1);
 $('smart-analysis-content').innerHTML=insight?
  '<div class="smart-analysis-main"><strong>'+clean(insight.title)+'</strong><p>'+clean(insight.body)+'</p></div>'+
  (others.length?'<details class="smart-analysis-extra"><summary>Ver '+others.length+' '+(others.length===1?'observación más':'observaciones más')+'</summary>'+
   others.map(function(item){return '<div class="smart-analysis-item"><strong>'+clean(item.title)+'</strong><p>'+clean(item.body)+'</p></div>'}).join('')+'</details>':''):
  '<p class="mini">Tus observaciones aparecerán a medida que sumes registros.</p>';

}

function renderMuscles(){
 var wk=InsightsModel.weekStart(b.date()),end=InsightsModel.addDay(wk,6),m=InsightsModel.muscleSeries(b.trainingData().workouts,wk,end,TrainingModel.muscleOf);
 $('insights-muscle-week').textContent=displayWeek(wk);
 var list=Object.keys(m).sort(function(a,b){return m[b]-m[a]});
 $('insights-muscle-list').innerHTML=list.length?list.map(function(group){
 var count=m[group];return '<div class="insights-muscle-row"><span>'+clean(TrainingModel.muscleLabels[group]||'Otros')+'</span><strong>'+count+' '+(count===1?'serie':'series')+'</strong></div>'
 }).join(''):'<div class="insights-empty">Cuando registres ejercicios vas a ver las series semanales de cada grupo muscular.</div>';
}
function renderExerciseProgress(){
 var end=b.date()>today()?today():b.date(),start=InsightsModel.addDay(end,-27),improvements=InsightsModel.progressChanges(b.trainingData().workouts,start,end,TrainingModel);
 $('insights-progression-list').innerHTML=improvements.length?improvements.map(function(v){
 return '<div class="insights-activity"><b>'+clean(v.name)+'</b><small>'+shortDate(v.date)+' · +'+fmt(v.delta,1)+' '+(v.type==='peso'?'kg de peso máximo':'kg de volumen')+' respecto al entrenamiento anterior</small></div>'
 }).join(''):'<div class="insights-empty">Todavía no hay mejoras comparables entre sesiones. A medida que repitas ejercicios vas a poder ver tus progresos.</div>';
}
function renderBlocks(){
 var list=settings().trainingBlocks,w=b.trainingData().workouts;
 $('insights-block-goal').value=settings().goalFocus||'muscle';
 $('insights-blocks-list').innerHTML=list.length?list.slice().sort(function(a,b){return b.start.localeCompare(a.start)}).map(function(block){
 var stats=InsightsModel.blockStats(block,w);
 var active=block.start<=today()&&block.end>=today();
 return '<article class="insights-block-item"><div><b>'+clean(block.name)+'</b><small>'+shortDate(block.start)+' – '+shortDate(block.end)+(active?' · En curso':'')+'</small><span>'+stats.sessions+' entrenamientos · '+fmt(stats.totalVolume,0)+' kg de volumen registrado</span></div>'+(active?'<button type="button" class="pill" data-finish-block="'+clean(block.id)+'">Finalizar</button>':'')+'</article>';
 }).join(''):'<div class="insights-empty">Todavía no creaste un bloque. Empezá uno de ocho semanas cuando quieras seguir una rutina durante un período concreto.</div>';
 $('insights-blocks-list').querySelectorAll('[data-finish-block]').forEach(function(btn){btn.addEventListener('click',function(){if(!active())return;var block=settings().trainingBlocks.find(function(b){return b.id===btn.dataset.finishBlock});if(!block)return;if(!confirm('¿Finalizar este bloque hoy? No se borrarán los entrenamientos.'))return;block.end=today();writeSettings()})});
 var completed=list.filter(function(block){return block.end<today()}).sort(function(a,b){return a.end.localeCompare(b.end)});
 var compare=completed.slice(-2);
 if(compare.length===2){
  var a=InsightsModel.blockStats(compare[0],w),z=InsightsModel.blockStats(compare[1],w);
  var comparable={};
  var normalized=TrainingModel.historyView({routineDays:[],workouts:w}).workouts;
  function peaks(block){
   var found={};Object.keys(normalized).filter(function(date){return date>=block.start&&date<=block.end}).forEach(function(date){
    (normalized[date].exercises||[]).forEach(function(ex){
     var kg=Math.max(0,...(ex.sets||[]).map(function(set){return Number(set.weight)||0}));
     if(!found[ex.id]||kg>found[ex.id].kg)found[ex.id]={name:ex.name,kg:kg};
    });
   });return found;
  }
  var oldPeaks=peaks(compare[0]),newPeaks=peaks(compare[1]);
  Object.keys(oldPeaks).forEach(function(id){
   if(newPeaks[id])comparable[id]={name:newPeaks[id].name,change:newPeaks[id].kg-oldPeaks[id].kg};
  });
  var shared=Object.values(comparable).sort(function(a,b){return b.change-a.change}).slice(0,3);
  $('insights-blocks-compare').innerHTML='<div class="insights-block-compare"><b>Comparación de los últimos dos bloques finalizados</b>'+
   '<p class="mini">'+clean(compare[0].name)+': '+a.sessions+' entrenamientos · '+clean(compare[1].name)+': '+z.sessions+' entrenamientos.</p>'+
   (shared.length?'<p class="mini">Pico de peso en ejercicios presentes en ambos bloques:</p>'+shared.map(function(ex){return '<div class="insights-muscle-row"><span>'+clean(ex.name)+'</span><strong>'+(ex.change>0?'+':'')+fmt(ex.change,1)+' kg</strong></div>'}).join(''):'<p class="mini">Todavía no hay ejercicios en común con registros en ambos bloques.</p>')+
   '<p class="mini">Compará ejercicios equivalentes: el volumen total depende de cuántas sesiones y series hiciste.</p></div>';
 }else $('insights-blocks-compare').innerHTML='';
 var last=list.filter(function(x){return x.start<=today()&&x.end>=today()})[0];
 $('insights-block-ongoing').textContent=last?'Bloque actual: '+last.name+' · hasta '+shortDate(last.end):'No hay ningún bloque activo.';
 $('insights-block-note').textContent=blockNotice;
}
function createBlock(e){e.preventDefault();if(!active())return;
 var name=$('insights-block-name').value.trim(),start=$('insights-block-start').value,weeks=Number($('insights-block-duration').value);
 if(!start||!Number.isInteger(weeks)||weeks<4||weeks>16){blockNotice='Completá una fecha y una duración válida.';renderBlocks();return}
 var end=InsightsModel.addDay(start,weeks*7-1),list=settings().trainingBlocks;
 var overlap=list.some(function(b){return start<=b.end&&end>=b.start});
 if(overlap){blockNotice='Ya hay un bloque que se superpone con esas fechas. Finalizalo o elegí otro período.';renderBlocks();return}
 var routine=b.trainingData().routineDays.filter(function(d){return !d.archived&&d.rows.length});
 if(!routine.length){blockNotice='Guardá al menos un día de rutina con ejercicios antes de crear el bloque.';renderBlocks();return}
 list.push({id:crypto.randomUUID(),name:name||'Bloque '+(list.length+1),start:start,end:end,routineSnapshot:JSON.parse(JSON.stringify(routine))});
 blockNotice='Bloque creado. Los entrenamientos ya guardados en ese período cuentan automáticamente.';
 $('insights-block-name').value='';writeSettings();
}
function saveGoal(){
 if(!active())return;settings().goalFocus=$('insights-block-goal').value;writeSettings();
 b.toast('Objetivo personal actualizado.');
}
function render(){
 if(!initDone)return;
 renderNutrition();renderWeight();renderRecovery();renderReport();renderMuscles();renderExerciseProgress();renderBlocks();
}
function init(bridge){
 if(initDone)return;
 b=bridge;initDone=true;weightDate=today();recoveryDate=today();
 $('nutrition-stats-from').addEventListener('change',function(){nutritionFrom=this.value;nutritionPreset='';renderNutrition()});
 $('nutrition-stats-to').addEventListener('change',function(){nutritionTo=this.value;nutritionPreset='';renderNutrition()});
 $('nutrition-stats-meal').addEventListener('change',function(){nutritionMeal=this.value;renderNutrition()});
 document.querySelectorAll('[data-nutrition-range]').forEach(function(btn){btn.addEventListener('click',function(){
  if(btn.dataset.nutritionRange==='all'){
   var saved=Object.keys(state().days||{}).filter(function(day){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&day<=today()}).sort();
   nutritionFrom=saved[0]||today();nutritionTo=today();nutritionPreset='all';
  }else statsDays(Number(btn.dataset.nutritionRange));
  renderNutrition();
 })});
 $('insights-weight-form').addEventListener('submit',saveWeight);
 $('insights-weight-date').addEventListener('change',function(){weightDate=this.value;renderWeight();setStatus('insights-weight-feedback','')});
 $('insights-weight-history').addEventListener('click',function(event){var btn=event.target.closest('[data-weight-date]');if(!btn)return;weightDate=btn.getAttribute('data-weight-date');renderWeight();setStatus('insights-weight-feedback','Editá el valor y guardá. Para borrar este registro, dejá el peso vacío y guardá.');$('insights-weight-value').focus()});
 $('insights-recovery-form').addEventListener('submit',saveRecovery);
 $('insights-recovery-date').addEventListener('change',function(){recoveryDate=this.value;renderRecovery();setStatus('insights-recovery-feedback','')});
 $('insights-block-form').addEventListener('submit',createBlock);
 $('insights-block-start').value=today();
 $('insights-block-goal-save').addEventListener('click',saveGoal);
 render();
}
root.InsightsUI={init:init,render:render};
})(typeof window==='undefined'?globalThis:window);
