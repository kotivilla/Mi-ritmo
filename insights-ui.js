(function(root){
'use strict';
var b,plannerDate='',plannerWeek='',blockNotice='',weightDate='',recoveryDate='',initDone=false;
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
function weekEnd(start){return InsightsModel.addDay(start,6)}
function renderNutrition(){
 var end=b.date()<today()?b.date():today(),start=InsightsModel.weekStart(end),nut=InsightsModel.nutritionWeek(state().days,b.meals,start,end);
 $('insights-nutrition-date').textContent=displayWeek(start);
 if(nut.rate===null){$('insights-nutrition-body').innerHTML='<div class="insights-empty">Todavía no hay comidas registradas en esta semana. Cuando las cargues, vas a ver qué grupos pudiste cubrir.</div>';return}
 var order=[['protein','Proteínas'],['veg','Vegetales'],['carb','Hidratos'],['fat','Grasas']];
 $('insights-nutrition-body').innerHTML='<p class="mini">Promedio de los <b>'+nut.registeredDays+' '+(nut.registeredDays===1?'día':'días')+' con registros</b>: '+nut.rate+'% de grupos completos. Los días sin cargar no cuentan como incumplidos.</p><div class="insights-metrics">'+order.map(function(group){
  var item=nut.groups[group[0]];if(!item)return '';
  return '<div class="insights-bar-row"><div class="insights-bar-head"><b>'+group[1]+'</b><strong>'+item.pct+'%</strong></div><div class="insights-bar"><span style="width:'+item.pct+'%"></span></div></div>'
 }).join('')+'</div>';
}
function plannerDayOptions(){
 var days=InsightsModel.dateRange(plannerWeek,weekEnd(plannerWeek));
 $('insights-plan-days').innerHTML=days.map(function(date){var d=new Date(date+'T12:00:00'),name=new Intl.DateTimeFormat('es-AR',{weekday:'short'}).format(d).replace('.','');return '<button type="button" class="insights-day'+(date===plannerDate?' active':'')+'" data-plan-date="'+date+'">'+clean(name)+'<small>'+d.getDate()+'</small></button>'}).join('');
 $('insights-plan-days').querySelectorAll('[data-plan-date]').forEach(function(btn){btn.addEventListener('click',function(){plannerDate=btn.dataset.planDate;renderPlanner()})});
}
function renderPlanner(){
 if(!plannerWeek)plannerWeek=InsightsModel.weekStart(today());
 if(!plannerDate||plannerDate<plannerWeek||plannerDate>weekEnd(plannerWeek))plannerDate=plannerWeek;
 $('insights-plan-week').textContent=displayWeek(plannerWeek);
 plannerDayOptions();
 var plans=settings().mealPlan,selected=plans[plannerDate]||{},all=b.dishList();
 $('insights-plan-meals').innerHTML=b.meals.map(function(meal){
 var options=all.filter(function(d){return d.meal===meal.id}),record=selected[meal.id]||null;
 var choices='<option value="">Sin planificar</option>'+options.map(function(d){return '<option value="'+clean(d.id)+'" '+(record&&record.dishId===d.id?'selected':'')+'>'+clean(d.name)+'</option>'}).join('');
 if(record&&!options.some(function(d){return d.id===record.dishId}))choices+='<option selected value="__legacy"> '+clean(record.label)+' (guardado)</option>';
 return '<label class="insights-plan-meal"><span>'+meal.icon+' '+meal.name+'</span><select class="field" data-plan-meal="'+meal.id+'">'+choices+'</select></label>';
 }).join('');
 $('insights-plan-meals').querySelectorAll('select').forEach(function(el){el.addEventListener('change',function(){
  if(!active())return;
  var date=plannerDate,meal=el.dataset.planMeal,all=b.dishList();
  var plan=settings().mealPlan;
  if(!plan[date])plan[date]={};
  if(el.value==='__legacy')return;
  if(!el.value)delete plan[date][meal];
  else{
   var dish=all.find(function(d){return d.id===el.value});if(!dish)return;
   plan[date][meal]={dishId:dish.id,label:dish.name,ingredients:JSON.parse(JSON.stringify((dish.portions&&dish.portions._ingredients)||[]))};
  }
  if(!Object.keys(plan[date]).length)delete plan[date];
  writeSettings();
 })});
 renderShopping();
}
function renderShopping(){
 var items=InsightsModel.shoppingList(settings().mealPlan,b.dishList(),FoodCatalog,plannerWeek,weekEnd(plannerWeek));
 var html=items.items.map(function(row){return '<li><span>'+clean(row.name)+'</span><b>'+fmt(row.quantity,2)+' '+clean(row.unit)+'</b></li>'}).join('');
 var legacy=items.fallback.map(function(row){return '<li><span>'+clean(row.name)+'</span><b>'+row.count+' '+(row.count===1?'vez':'veces')+'</b></li>'}).join('');
 $('insights-shopping-count').textContent=items.items.length+items.fallback.length+' elementos';
 $('insights-shopping-items').innerHTML=html+legacy||'<li class="insights-empty">Elegí platos para la semana y acá aparecerán sus ingredientes.</li>';
 $('insights-shopping-note').textContent='Las cantidades son porciones del catálogo, no kilos exactos de compra. Ajustalas según el tamaño de los envases.';
}
function exportShopping(){
 var rows=InsightsModel.shoppingList(settings().mealPlan,b.dishList(),FoodCatalog,plannerWeek,weekEnd(plannerWeek));
 var txt='Mi Ritmo — compras '+displayWeek(plannerWeek)+'\n'+rows.items.map(function(r){return '- '+r.name+': '+fmt(r.quantity,2)+' '+r.unit}).concat(rows.fallback.map(function(r){return '- '+r.name+': '+r.count+' veces (revisar ingredientes)'})).join('\n');
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){b.toast('Lista de compras copiada')}).catch(function(){fallbackCopy(txt)});
 else fallbackCopy(txt);
}
function fallbackCopy(s){var el=document.createElement('textarea');el.value=s;document.body.appendChild(el);el.select();document.execCommand('copy');el.remove();b.toast('Lista de compras copiada')}
function weightChart(entries){
 var pts=entries.slice(-14),low=Math.min.apply(null,pts.map(function(p){return p.weight})),high=Math.max.apply(null,pts.map(function(p){return p.weight})),span=Math.max(1,high-low),min=low-span*.2,max=high+span*.2;
 var points=pts.map(function(p,i){return [pts.length===1?176:46+i*(270/(pts.length-1)),141-((p.weight-min)/(max-min))*100]});
 return '<svg class="insights-line-chart" role="img" viewBox="0 0 355 180" aria-label="Peso corporal de los últimos registros"><line x1="46" y1="141" x2="318" y2="141" stroke="#bbcfc0"/>'+
 '<text x="39" y="36" font-size="11" fill="#698776" text-anchor="end">'+fmt(high,1)+'</text><text x="39" y="145" font-size="11" fill="#698776" text-anchor="end">'+fmt(low,1)+'</text>'+
 '<polyline fill="none" stroke="#17664b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="'+points.map(function(p){return p.join(',')}).join(' ')+'"/>'+
 points.map(function(p,i){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="#17664b"><title>'+clean(pts[i].date)+' — '+fmt(pts[i].weight,2)+' kg</title></circle>'}).join('')+
 '<text x="46" y="163" font-size="11" fill="#698776">'+clean(shortDate(pts[0].date))+'</text><text x="318" text-anchor="end" y="163" font-size="11" fill="#698776">'+clean(shortDate(pts[pts.length-1].date))+'</text></svg>';
}
function renderWeight(){
 var s=state(),date=weightDate||today(),entry=s.days&&s.days[date]||{},x=entry.weightKg;
 $('insights-weight-date').value=date;
 $('insights-weight-value').value=Number.isFinite(x)?x:'';
 var trend=InsightsModel.weightTrend(s.days||{},today());
 var heading=trend.last?'Último registro: <strong>'+fmt(trend.last.weight,2)+' kg</strong>':'Todavía no hay registros de peso.';
 var average=trend.average7!==null?'Promedio últimos 7 días: <b>'+fmt(trend.average7,2)+' kg</b>':'';
 var change=trend.change!==null?' · Diferencia entre promedios semanales: <b>'+(trend.change>=0?'+':'')+fmt(trend.change,2)+' kg</b>':'';
 $('insights-weight-summary').innerHTML=heading+'<p class="mini">'+average+change+'</p>';
 $('insights-weight-chart').innerHTML=trend.entries.length?weightChart(trend.entries):'<div class="insights-empty">Registrá tu peso para empezar a ver la tendencia. Las variaciones de un día pueden deberse a muchos factores.</div>';
}
function saveWeight(e){e.preventDefault();if(!active())return;
 var date=$('insights-weight-date').value,val=$('insights-weight-value').value.trim();
 if(!date||date>today()){setStatus('insights-weight-feedback','Elegí hoy o una fecha anterior.');return}
 var row=writtenDay(date);
 if(val){var n=Number(val);if(!Number.isFinite(n)||n<20||n>350){setStatus('insights-weight-feedback','Ingresá un peso entre 20 y 350 kg.');return}row.weightKg=n}
 else if(Number.isFinite(row.weightKg))delete row.weightKg;
 else{setStatus('insights-weight-feedback','Ingresá un peso para registrar.');return}
 weightDate=date;writeDay(date);setStatus('insights-weight-feedback',val?'Peso guardado.':'Peso de esa fecha eliminado.');
}
function renderRecovery(){
 var date=recoveryDate||today(),row=state().days&&state().days[date]||{},v=row.recovery||{};
 $('insights-recovery-date').value=date;
 $('insights-sleep').value=v.sleepHours==null?'':v.sleepHours;
 $('insights-energy').value=v.energy==null?'':v.energy;
 $('insights-soreness').value=v.soreness==null?'':v.soreness;
 var wk=InsightsModel.weekStart(today()),rec=InsightsModel.recoveryWeek(state().days||{},wk,today());
 $('insights-recovery-summary').textContent=rec.logged?'Esta semana registraste cómo te sentiste '+rec.logged+' '+(rec.logged===1?'día':'días')+'. '+(rec.sleep!==null?'Sueño promedio: '+fmt(rec.sleep,1)+' h. ':'')+(rec.energy!==null?'Energía promedio: '+fmt(rec.energy,1)+'/5. ':''):'Opcional: registrá sueño, energía y fatiga en pocos segundos.';
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
 $('insights-report-cards').innerHTML=
 '<div><small>Gimnasio</small><strong>'+report.attended+'/'+target+'</strong><span>Entrenamientos esta semana</span></div>'+
 '<div><small>Alimentación</small><strong>'+(report.nutrition.rate===null?'—':report.nutrition.rate+'%')+'</strong><span>'+report.nutrition.registeredDays+' días con registros</span></div>'+
 '<div><small>Peso corporal</small><strong>'+(report.weight.average7===null?'—':fmt(report.weight.average7,1)+' kg')+'</strong><span>Promedio de últimos 7 días</span></div>'+
 '<div><small>Recuperación</small><strong>'+report.recovery.logged+' días</strong><span>Registros esta semana</span></div>';
 $('insights-report-notes').innerHTML=report.lines.map(function(line){return '<li>'+clean(line)+'</li>'}).join('');
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
 var routine=b.trainingData().routineDays.filter(function(d){return !d.archived});
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
 renderNutrition();renderPlanner();renderWeight();renderRecovery();renderReport();renderMuscles();renderExerciseProgress();renderBlocks();
}
function init(bridge){
 if(initDone)return;
 b=bridge;initDone=true;plannerWeek=InsightsModel.weekStart(today());plannerDate=today();weightDate=today();recoveryDate=today();
 $('insights-weight-form').addEventListener('submit',saveWeight);
 $('insights-weight-date').addEventListener('change',function(){weightDate=this.value;renderWeight();setStatus('insights-weight-feedback','')});
 $('insights-recovery-form').addEventListener('submit',saveRecovery);
 $('insights-recovery-date').addEventListener('change',function(){recoveryDate=this.value;renderRecovery();setStatus('insights-recovery-feedback','')});
 $('insights-plan-prev').addEventListener('click',function(){plannerWeek=InsightsModel.addDay(plannerWeek,-7);plannerDate=plannerWeek;renderPlanner()});
 $('insights-plan-next').addEventListener('click',function(){plannerWeek=InsightsModel.addDay(plannerWeek,7);plannerDate=plannerWeek;renderPlanner()});
 $('insights-plan-copy').addEventListener('click',exportShopping);
 $('insights-block-form').addEventListener('submit',createBlock);
 $('insights-block-start').value=today();
 $('insights-block-goal-save').addEventListener('click',saveGoal);
 render();
}
root.InsightsUI={init:init,render:render};
})(typeof window==='undefined'?globalThis:window);
