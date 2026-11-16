(function(root){
'use strict';
// Acepta coma o punto decimal sin confundirlos con separadores de miles.
function parse(raw){
 var text=String(raw==null?'':raw).trim();
 if(!/^\d+(?:[.,]\d+)?$/.test(text))return null;
 var value=Number(text.replace(',','.'));
 return Number.isFinite(value)?value:null;
}
function format(value){
 return Number.isFinite(value)?String(value).replace('.',','):'';
}
var api={parse:parse,format:format};
if(typeof module==='object'&&module.exports)module.exports=api;else root.DecimalInput=api;
})(typeof window==='undefined'?globalThis:window);
