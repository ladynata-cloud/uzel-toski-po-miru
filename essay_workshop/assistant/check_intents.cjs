'use strict';
// Report coverage separately from accuracy on the requests the router actually accepts.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const modelFile = path.join(__dirname, '..', 'intent-model.js');
const modelSource = fs.readFileSync(modelFile, 'utf8');
const router = vm.runInNewContext(modelSource + '\nEssayIntent');
const reference = JSON.parse(fs.readFileSync(path.join(__dirname, 'intent-evaluation.json'), 'utf8'));
const map = new Map();
for (const item of reference) {
  const predicted = router.classify(item.text).label || 'abstain';
  if (!map.has(item.label)) map.set(item.label, {total:0, correct:0, wrong:0, abstain:0});
  const row = map.get(item.label);
  row.total++;
  if (predicted === 'abstain') row.abstain++;
  else if (predicted === item.label) row.correct++;
  else row.wrong++;
}
console.log(JSON.stringify({
  sha256:crypto.createHash('sha256').update(modelSource).digest('hex'),
  groups:Object.fromEntries(map)
}, null, 2));
