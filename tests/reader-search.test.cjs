'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const cards = require('../assistant_cards.json');
const {indexCard, search} = require('../dist/assets/reader-search.js');

const catalog = cards.map(card => indexCard({...card, cues: card.cues.join(' ')}));
function matches(query) {
  return search(catalog, query).map(i => cards[i].id);
}

test('recognizes an inflected detail, including a longer free-form question', () => {
  assert.deepEqual(matches('Летом уходил из города'), ['work-yushka']);
  assert.deepEqual(matches('Не помню названия. Кажется, там разбирали горницу?'), ['work-matrenin-dvor']);
});

test('a shared detail leaves both candidates, a name resolves the ambiguity', () => {
  assert.deepEqual(new Set(matches('незаметное добро')), new Set(['work-yushka', 'work-matrenin-dvor']));
  assert.deepEqual(new Set(matches('Добро которого замечают слишком поздно')), new Set(['work-yushka', 'work-matrenin-dvor']));
  assert.deepEqual(new Set(matches('у костра')), new Set(['work-student', 'work-potaennyy-les']));
  assert.deepEqual(matches('у костра говорил Енисей'), ['work-potaennyy-les']);
});

test('matches title and author across case and ё, leaves unknown questions unanswered', () => {
  assert.deepEqual(matches('ПОТАЕННЫЙ ЛЕС'), ['work-potaennyy-les']);
  assert.deepEqual(matches('рассказ Чехова'), ['work-student']);
  assert.deepEqual(matches('ТЮТЧЕВ'), ['work-silentium']);
  assert.deepEqual(matches('метеорит на Андромеде'), []);
  assert.deepEqual(matches('Не помню название рассказа'), []);
});
