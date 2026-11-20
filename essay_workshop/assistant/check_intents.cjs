'use strict';
// Count misrouted questions and abstentions separately. Callers may supply a
// different evaluation set and a baseline JS model to compare on the same rows.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const evaluationFile = process.argv[2] || path.join(__dirname, 'intent-evaluation.json');
const modelFile = process.argv[3] || path.join(__dirname, '..', 'intent-model.js');
const training = JSON.parse(fs.readFileSync(path.join(__dirname, 'intent-training.json'), 'utf8'));
const evaluation = JSON.parse(fs.readFileSync(evaluationFile, 'utf8'));
const modelSource = fs.readFileSync(modelFile, 'utf8');
const router = vm.runInNewContext(modelSource + '\nEssayIntent');
const labels = new Set(training.map(row => row.label));
const normalize = text => text.toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim();
const seen = new Set(training.map(row => normalize(row.text)));
const groups = {};
const relevant = {total: 0, correct: 0, wrong: 0, abstain: 0};

for (const item of evaluation) {
  const expected = item.label ?? item.expected;
  const key = normalize(item.text);
  if (!key || seen.has(key) || !labels.has(expected)) {
    throw new Error('Expected a unique evaluation example, separate from training data, with a known label.');
  }
  seen.add(key);
  const row = groups[expected] ||= {total: 0, correct: 0, wrong: 0, abstain: 0};
  const {label} = router.classify(item.text);
  const outcome = label === null ? 'abstain' : label === expected ? 'correct' : 'wrong';
  row.total++;
  row[outcome]++;
  if (expected !== 'other') {
    relevant.total++;
    relevant[outcome]++;
  }
}
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
console.log(JSON.stringify({
  sha256: hash(modelSource),
  evaluation_sha256: hash(fs.readFileSync(evaluationFile)),
  groups,
  relevant
}, null, 2));
