'use strict';
// Rebuild with Node.js. No dependencies, API calls, or student messages.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {entryFeatures,entryScores,entryDecision}=require('./router.js');
const input=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const labels=['none','topic','scene','paragraph','essay','rehearsal','quick','unknown'];
const complete=process.argv.includes('--report');
const examples=input('training.json');
function validate(rows,seen) {
  for(const {label,text} of rows) {
    const key=text.toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/gu,' ').trim();
    assert.ok(labels.includes(label) && key && !seen.has(key),'Invalid or duplicate example: '+text);
    seen.add(key);
  }
}
const normalize=set=>{const n=Math.hypot(...Array.from(set.values()))||1;return Array.from(set,([key,value])=>[key,value/n]);};
function fit(rows) {
  const frequencies=new Map();
  for(const {features} of rows) {
    for(const key of features.keys()) frequencies.set(key,(frequencies.get(key)||0)+1);
  }
  const weights=Object.create(null);
  for(const [key,count] of [...frequencies.entries()].sort(([a],[b])=>a<b?-1:1)) {
    if(count>=2) weights[key]=Array(labels.length).fill(0);
  }
  const batch=rows.map(row=>({
    target:labels.indexOf(row.label),
    vector:normalize(new Map(Array.from(row.features).filter(([k])=>weights[k])))
  }));
  for(let epoch=0;epoch<90;epoch++) {
    const gradient=Object.fromEntries(Object.keys(weights).map(k=>[k,Array(labels.length).fill(0)]));
    for(const {target,vector} of batch) {
      const scores=Array(labels.length).fill(0);
      for(const [key,value] of vector) for(let j=0;j<labels.length;j++) scores[j]+=value*weights[key][j];
      const max=Math.max(...scores), exp=scores.map(s=>Math.exp(s-max)), sum=exp.reduce((a,b)=>a+b,0);
      const delta=exp.map((v,j)=>(j===target?1:0)-v/sum);
      for(const [key,value] of vector) for(let j=0;j<labels.length;j++) gradient[key][j]+=value*delta[j];
    }
    const rate=.5/(1+.02*epoch);
    for(const [key,row] of Object.entries(weights)) {
      for(let j=0;j<labels.length;j++) row[j]+=rate*(gradient[key][j]-.14*row[j]);
    }
  }
  for(const row of Object.values(weights)) for(let j=0;j<row.length;j++) row[j]=Math.round(row[j]*1000);
  return {labels,weights};
}
function stats(rows) {
  let correct=0,wrong=0,abstain=0,offeredOutside=0;
  for(const {predicted,actual} of rows) {
    if(actual==='unknown') { if(predicted!==null) offeredOutside++; }
    else if(predicted===null) abstain++;
    else if(predicted===actual) correct++;
    else wrong++;
  }
  return {correct,wrong,abstain,offeredOutside};
}
function evaluate(data, model) {
  return stats(data.map(row=>({actual:row.label,predicted:entryDecision(row.text,model)})));
}
const unique=new Set();
validate(examples,unique);
const rows=examples.map(row=>({...row,features:entryFeatures(row.text)}));
const foldCount=4;
const grouped=labels.map(label=>rows.filter(r=>r.label===label));
const held=[];
for(let f=0;f<foldCount;f++){
  const training=grouped.flatMap(group=>group.filter((_,i)=>i%foldCount!==f));
  const model=fit(training);
  for(const group of grouped) for(const [index,row] of group.entries()) {
    if(index%foldCount!==f)continue;
    const scores=entryScores(row.features,model),order=scores.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]);
    held.push({actual:row.label, best:labels[order[0]], top:scores[order[0]], gap:scores[order[0]]-scores[order[1]]});
  }
}
const cutoffs=[];
for(const minimum of [1.25,1.5,1.75,2,2.25,2.5]) for(const margin of [.45,.6,.75,.9,1.05,1.2]) {
  const quality=stats(held.map(r=>({actual:r.actual,predicted:r.best==='unknown'||r.top<minimum||r.gap<margin?null:r.best})));
  const precision=quality.correct/Math.max(1,quality.correct+quality.wrong+quality.offeredOutside);
  const utility=quality.correct - 3*quality.wrong - 5*quality.offeredOutside;
  cutoffs.push({minimum,margin,quality,precision,utility});
}
const selected=cutoffs.sort((a,b)=>b.utility-a.utility||b.precision-a.precision||a.minimum-b.minimum||a.margin-b.margin)[0];
const parameters={...fit(rows),minimum:selected.minimum,margin:selected.margin};
const output=JSON.stringify(parameters)+'\n';
const file=path.join(__dirname,'weights.json');
if(process.argv.includes('--check')) assert.equal(fs.readFileSync(file,'utf8'),output);
else fs.writeFileSync(file,output);
console.log(JSON.stringify({examples:rows.length,features:Object.keys(parameters.weights).length,calibration:selected}));
if(complete) {
  const heldOut=input('holdout.json');
  validate(heldOut,unique);
  console.log(JSON.stringify({holdout:heldOut.length,metrics:evaluate(heldOut,parameters)}));
}
