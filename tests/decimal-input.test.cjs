'use strict';
const assert=require('node:assert/strict');
const decimal=require('../decimal-input.js');
const training=require('../training-model.js');
for(const [text,number] of [['22,5',22.5],['22.5',22.5],['68,7',68.7],['68.7',68.7],['0,5',0.5],['0',0],['2000',2000]]){
 assert.equal(decimal.parse(text),number);
 assert.equal(decimal.parse(decimal.format(number)),number);
}
for(const invalid of ['', ' ', 'abc','22,5,6','22.5kg','-1', '22,','22.','1,234.5']) assert.equal(decimal.parse(invalid),null);
assert.equal(decimal.format(22.5),'22,5');
assert.equal(decimal.format(68.7),'68,7');
assert.equal(decimal.format(null),'');
const sets=[{reps:10,weight:decimal.parse('22,5')},{reps:12,weight:decimal.parse('0,5')}];
const trainingResult=training.validateWorkout([{id:'x',name:'Ejercicio',sets}]);
assert.equal(trainingResult[0].sets[0].weight,22.5);
assert.equal(trainingResult[0].sets[1].weight,0.5);
assert.equal(training.history({'2026-11-16':{exercises:trainingResult}},'x')[0].volume,231);
console.log('Decimal weights: PASS');
