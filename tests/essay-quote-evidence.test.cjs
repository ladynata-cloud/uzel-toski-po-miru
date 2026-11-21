'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {findAll, checkReview} = require('../essay_workshop/quote-evidence.js');
const text = 'Он вернулся.\nОн вернулся. <b>слова</b>';
function review() {
  return {priority: 'Перечитай вывод.', criteria: ['K1','K2','K3','K4','K5'].map(id =>
    ({id, quote: 'Он вернулся.', comment: 'Видно действие.', action: 'Объясни его связь с мыслью.'}))};
}
test('exact evidence preserves repeated, overlapping and literal source text', () => {
  assert.deepEqual(findAll(text, 'Он вернулся.'), [0, 13]);
  assert.deepEqual(findAll('ааа', 'аа'), [0, 1]);
  assert.deepEqual(findAll(text, 'он вернулся.'), []);
  assert.deepEqual(findAll(text, 'вернулся. Он'), []);
  assert.deepEqual(findAll(text, ''), []);
  assert.deepEqual(findAll(text, '<b>слова</b>'), [26]);
});
test('a rejected quotation removes dependent advice and global priority on the client', () => {
  const input = review();
  input.criteria[1] = {id: 'K2', quote: 'Он раскаялся.', comment: 'Чужой вывод.', action: 'Удалить верный аргумент.'};
  input.priority = 'Удалить верный аргумент.';
  const result = checkReview(input, text);
  assert.deepEqual(result.unverified, ['K2']);
  assert.deepEqual(result.criteria[1], {id:'K2', quote:'', comment:'', action:''});
  assert.equal(result.priority, input.criteria[0].action);
  assert.equal(input.criteria[1].quote, 'Он раскаялся.', 'Input and stored snapshot remain unchanged');
});
test('server rejections and restored reports receive the same protection', () => {
  const input = review();
  const result = checkReview(input, text, ['K1', 'unknown', 'K1']);
  assert.deepEqual(result.unverified, ['K1']);
  assert.equal(result.criteria[0].quote, '');
  assert.deepEqual(checkReview(result, text, result.unverified), result);
  const missing = checkReview(input, 'Другой текст.');
  assert.equal(missing.unverified.length, 5);
  assert.match(missing.priority, /Выбери в своей работе фразу/u);
});
test('duplicate or malformed criteria cannot become a restored valid report', () => {
  const duplicate = review(); duplicate.criteria[4].id = 'K1';
  assert.equal(checkReview(duplicate, text), null);
  assert.equal(checkReview(null, text), null);
  const broken = review(); broken.criteria[0].comment = null;
  assert.equal(checkReview(broken, text), null);
});
test('literal matching does not claim that an interpretation is correct', () => {
  const input = review();
  input.criteria[0].comment = 'Он вернулся, следовательно, навсегда стал честным.';
  assert.equal(checkReview(input, text).criteria[0].comment, input.criteria[0].comment);
  assert.deepEqual(checkReview(input, text).unverified, []);
});
