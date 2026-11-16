'use strict';
const assert=require('node:assert/strict');
const model=require('../insights-model.js');
global.InsightsModel=model;
const smart=require('../smart-analysis.js');
const days={
 '2026-10-26':{weightKg:78},
 '2026-11-02':{weightKg:77.5},
 '2026-11-09':{weightKg:77},
 '2026-11-10':{weightKg:76.8}
};
const trend=model.weightTrend(days,'2026-11-15');
assert.equal(trend.entries.length,3,'un registro por semana, el último de cada semana');
assert.equal(trend.last.date,'2026-11-10');
assert.equal(trend.previous.date,'2026-11-02');
assert.ok(Math.abs(trend.change-(-.7))<1e-9);
assert.equal(model.weightTrend({},'2026-11-15').change,null);
assert.equal(model.weightTrend({'2026-11-10':{weightKg:76.8}},'2026-11-15').change,null);
const report=smart.weightReport(days,'2026-11-15');
assert.equal(report.recent.count,1);
assert.equal(report.previous.count,1);
assert.ok(Math.abs(report.change-(-.7))<1e-9);
assert.equal(smart.weightReport({'2026-11-03':{weightKg:77}},'2026-11-15').change,null,'sin penalizar semanas sin pesajes');
const missingWeek=model.weightTrend({'2026-10-19':{weightKg:78},'2026-11-10':{weightKg:77}},'2026-11-15');
assert.equal(missingWeek.change,-1,'comparar registros existentes aun con semanas intermedias vacías');
console.log('Pruebas de pesaje semanal correctas');
