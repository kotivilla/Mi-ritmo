'use strict';
const assert=require('node:assert/strict');
const Scoring=require('../nutrition-scoring.js');
const InsightsModel=require('../insights-model.js');
const breakfast={id:'breakfast',groups:[{id:'carb',target:1},{id:'protein',target:3},{id:'fat',target:1}]};
const lunch={id:'lunch',groups:[{id:'carb',target:1},{id:'protein',target:1},{id:'veg',target:1},{id:'fat',target:1}]};
const snack={id:'snack',groups:breakfast.groups};
const dinner={id:'dinner',groups:lunch.groups};
const meals=[breakfast,lunch,snack,dinner];
const partial={carb:1,protein:2,fat:1};
assert.equal(Scoring.mealPortions(partial,snack).fraction,.8,'4 de 5 porciones = 80%');
assert.equal(Scoring.mealPortions({protein:2},snack).fraction,.4,'2 proteínas = 40%, más que grasas');
assert.equal(Scoring.mealPortions({fat:1},snack).fraction,.2,'grasas = 20%');
assert.equal(Scoring.dayScore({snack:partial},meals).rate,20,'té al 80% = 20 puntos diarios');
assert.equal(Scoring.dayScore({breakfast:{carb:1,protein:3,fat:1},lunch:{carb:1,protein:1},dinner:{carb:1,protein:1,veg:1,fat:1}},meals).rate,62.5,'cada comida vale 25%');
assert.equal(Scoring.dayScore({snack:partial,daily:{fruit:2}},meals).rate,20,'frutas fuera del porcentaje');
assert.equal(Scoring.mealPortions({protein:9,carb:-2,fat:1},snack).fraction,.8,'topes y negativos');
assert.equal(Scoring.dayScore({},meals).rate,0,'día vacío');
const days={'2026-11-18':{meals:{snack:partial}},'2026-11-19':{meals:{breakfast:{protein:3,carb:1,fat:1}}}};
const week=InsightsModel.nutritionWeek(days,meals,'2026-11-18','2026-11-19','2026-11-19');
assert.equal(week.evaluatedMeals,5,'ayer incluye las cuatro comidas, hoy hasta la última cargada');
assert.equal(week.skippedMeals,3,'las omitidas ayer cuentan como cero');
assert.equal(week.rate,36,'(80 + 100)/5 = 36%');
const empty=InsightsModel.nutritionWeek({'2026-11-18':{meals:{daily:{fruit:2}}}},meals,'2026-11-18','2026-11-18','2026-11-19');
assert.equal(empty.rate,null,'frutas solas no activan cumplimiento alimentario');
console.log('Cumplimiento por porciones, 25% por comida, frutas y promedios: OK');

const range=InsightsModel.nutritionStats(days,meals,'2026-11-17','2026-11-19','2026-11-19','snack');
assert.equal(range.daily.length,3,'rango completo de tres días');
assert.equal(range.daily[0].percent,null,'día sin registro se muestra vacío');
assert.equal(range.daily[1].percent,20,'té de 4/5 = 20% del día');
assert.equal(range.daily[2].percent,25,'desayuno completo = 25% del día');
assert.equal(range.registeredDays,2,'los días completamente vacíos no entran en el promedio');
assert.equal(range.dailyAverage,23,'promedio diario de 20% y 25% redondeado');
assert.equal(range.evaluatedMeals,1,'el té de hoy no se cuenta si todavía no fue cargado');
assert.equal(range.groups.protein.pct,67,'dos de tres proteínas en té = 67%');
assert.equal(range.groups.veg,undefined,'el té no tiene vegetales');
const allRange=InsightsModel.nutritionStats(days,meals,'2026-11-18','2026-11-19','2026-11-19','all');
assert.equal(allRange.evaluatedMeals,5,'todas las comidas: 4 ayer y una hoy');
assert.equal(allRange.skippedMeals,3,'las comidas omitidas en días anteriores cuentan cero');
const fruitOnly=InsightsModel.nutritionStats({'2026-11-18':{meals:{daily:{fruit:2}}}},meals,'2026-11-18','2026-11-18','2026-11-19','all');
assert.equal(fruitOnly.daily[0].percent,null,'solo fruta no activa registro de comida');
assert.equal(fruitOnly.dailyAverage,null,'sin comidas no hay promedio diario');
assert.equal(Scoring.color(89,true),'#E5C14D','amarillo hasta 89');
assert.equal(Scoring.color(90,true),'#4CAF50','verde vivo a partir de 90');
assert.equal(Scoring.color(100,true),'#2E7D32','verde intenso al cien');
console.log('Estadísticas por período, comida, día y escala de colores: OK');

const weekdaysData={
 '2026-11-02':{meals:{breakfast:{carb:1,protein:3,fat:1},lunch:{carb:1,protein:1,veg:1,fat:1},snack:{carb:1,protein:3,fat:1},dinner:{carb:1,protein:1,veg:1,fat:1}}},
 '2026-11-09':{meals:{breakfast:{carb:1,protein:3,fat:1},lunch:{carb:1,protein:1,veg:1,fat:1}}},
 '2026-11-03':{meals:{lunch:{carb:1,protein:1,veg:1,fat:1}}},
 '2026-11-10':{meals:{daily:{fruit:2}}}
};
const weekdayStats=InsightsModel.nutritionStats(weekdaysData,meals,'2026-11-01','2026-11-10','2026-11-11','all');
assert.equal(weekdayStats.weekdays.length,7,'Siempre muestra lunes a domingo');
assert.equal(weekdayStats.weekdays[0].label,'Lunes','La semana empieza en lunes');
assert.equal(weekdayStats.weekdays[0].count,2,'Dos lunes con registros');
assert.equal(weekdayStats.weekdays[0].percent,75,'Promedio lunes: 100% y 50% => 75%');
assert.equal(weekdayStats.weekdays[1].count,1,'Martes sin comidas se excluye');
assert.equal(weekdayStats.weekdays[1].percent,25,'Martes registrado: almuerzo completo = 25%');
assert.equal(weekdayStats.weekdays[2].percent,null,'Miércoles sin registros no tiene promedio');
assert.equal(weekdayStats.weekdays[6].percent,null,'Domingo sin registros no tiene promedio');
assert.equal(weekdayStats.registeredDays,3,'Las frutas solas no activan día alimentario');
const weekdayEmpty=InsightsModel.nutritionStats({},meals,'2026-11-01','2026-11-07','2026-11-11','all');
assert.ok(weekdayEmpty.weekdays.every(item=>item.percent===null&&item.count===0),'Sin registros: siete barras vacías');
console.log('Promedios por día de la semana y días sin registros: OK');
