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

const {firstReadingReply, afterReadingReply, asksForSafeMode, trustedReplyLinks} = require('../dist/assets/reader-search.js');
const fs = require('node:fs');
const path = require('node:path');
const urls = cards.map(c => ({...c, url: 'https://reader.example/poisk-po-pamyati/#' + c.id}));
const cases = require('../docs/reader-assistant-evals.json');
const byId = id => cases.find(c => c.id === id);

// Exercise the real prepared questions against the same card IDs used by the page.
test('a second detail narrows the same books and respects an unfinished reading', () => {
  const first = firstReadingReply(urls, catalog, [], byId('ambiguous-kindness').turns[0]);
  assert.deepEqual(new Set(first.links.map(link => link.id)), new Set(byId('ambiguous-kindness').expected_ids));
  const next = 'Да, именно горница, а рассказ я ещё не дочитала.';
  assert.equal(asksForSafeMode(next), true);
  const result = firstReadingReply(urls, catalog, first.indices, next);
  assert.deepEqual(result.links.map(x => x.id), ['work-matrenin-dvor']);
  assert.doesNotMatch(result.text, /погиб|гибел|умер|похорон/iu);
  const unknown = firstReadingReply(urls, catalog, first.indices, 'метеорит Андромеды');
  assert.deepEqual(unknown.indices, first.indices);
  assert.equal(unknown.matched, false);
  assert.deepEqual(unknown.links, []);
  assert.equal(firstReadingReply(urls, catalog, [], 'метеорит Андромеды').matched, false);
});

test('the source links of the active edition use local trusted addresses', () => {
  const card = urls[0];
  const main = 'https://reader.example/prefix/masterskaya/yushka-nevidimoe-dobro/';
  const source = {label: 'Источник', url: 'https://work.example/text'};
  const remote = [{id: card.id, label: 'x', url: 'https://different.example'}, {id: 'unknown', url: 'javascript:alert(1)'}];
  assert.deepEqual(trustedReplyLinks(remote, urls, null), [{label:card.title, url:card.url}]);
  assert.deepEqual(trustedReplyLinks([...remote, source], [], {card_id:card.id, url:main, sources:[source]}),
    [{label:'Разбор мастерской',url:main}, source]);
});

test('after-reading replies stay within the selected source and identify editorial words', () => {
  const dir = path.resolve(__dirname, '../dist/assistant/v1/after-reading');
  const packet = key => JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8')).record;
  const forest = packet('work-potaennyy-les');
  const ending = afterReadingReply(forest, byId('limited-page-ending').turns[0]);
  assert.match(ending.text, /нельзя установить развязку/);
  assert.match(ending.text, /страницу 9/);
  const obs = afterReadingReply(forest, byId('limited-page-observation').turns[0]);
  assert.match(obs.text, /Енисей/);
  assert.match(obs.text, /Лёшка/);
  assert.ok(obs.links.some(l => l.url === forest.sources[0].url));
  const yushka = packet('work-yushka');
  const why = afterReadingReply(yushka, byId('already-read-yushka').turns[0]);
  assert.match(why.text, /девочке-сироте/);
  const quote = afterReadingReply(yushka, byId('commentary-is-not-quotation').turns[0], why.paragraph);
  assert.match(quote.text, /комментарий мастерской/);
  assert.equal(quote.paragraph, why.paragraph);
  assert.ok(quote.links.some(l => l.url === yushka.sources[0].url));
  const unknown = afterReadingReply(yushka, 'Квакша на Сатурне?');
  assert.match(unknown.text, /нет отдельного ответа/);
  const opening = afterReadingReply(yushka, 'Что разбирает мастерская?');
  assert.equal(afterReadingReply(yushka, 'А дальше?', opening.paragraph).paragraph, opening.paragraph + 1);
});
