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
  assert.deepEqual(new Set(matches('рассказ Чехова')), new Set(['work-student', 'work-toska']));
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

test('an existing title and author select the requested work rather than another by that author', () => {
  for (const id of ['exact-toska', 'exact-kust-sireni']) {
    const example = byId(id);
    const result = firstReadingReply(urls, catalog, [], example.turns[0]);
    assert.equal(result.matched, true);
    assert.deepEqual(result.links.map(link => link.id), example.expected_ids);
  }
  assert.deepEqual(matches('Расскажи о «Тоске» Антона Чехова'), ['work-toska']);
  assert.deepEqual(matches('«Куст сирени» А. И. Куприна'), ['work-kust-sireni']);
  assert.deepEqual(matches('Иван Великопольский'), ['work-student']);
});

test('an author alone cannot substitute for an unknown or contradictory title', () => {
  for (const query of [
    byId('unknown-title-known-author').turns[0],
    byId('unknown-quoted-title').turns[0],
    '«Неизвестный доктор» Куприна',
    'Неизвестная планета Куприна',
    'Юшка Чехова',
    'Куст сирени Чехова',
  ]) {
    const result = firstReadingReply(urls, catalog, [], query);
    assert.equal(result.matched, false, query);
    assert.deepEqual(result.links, [], query);
    assert.deepEqual(result.indices, [], query);
  }
});

test('an author query keeps alternatives and the next detail identifies the work', () => {
  const chekhov = firstReadingReply(urls, catalog, [], 'рассказ Чехова');
  assert.deepEqual(new Set(chekhov.links.map(link => link.id)), new Set(['work-toska', 'work-student']));
  assert.deepEqual(new Set(matches('Какие рассказы Чехова у вас есть в подборке?')), new Set(['work-toska', 'work-student']));
  const iona = firstReadingReply(urls, catalog, chekhov.indices, byId('author-followup-toska').turns[1]);
  assert.deepEqual(iona.links.map(link => link.id), ['work-toska']);
  const kuprin = firstReadingReply(urls, catalog, [], 'Куприн');
  assert.deepEqual(new Set(kuprin.links.map(link => link.id)), new Set(['work-kust-sireni', 'work-chudesnyy-doktor']));
  const drawing = firstReadingReply(urls, catalog, kuprin.indices, 'Помню пятно на чертеже');
  assert.deepEqual(drawing.links.map(link => link.id), ['work-kust-sireni']);
  const unknown = firstReadingReply(urls, catalog, chekhov.indices, 'Каштанка Чехова');
  assert.equal(unknown.matched, false);
  assert.deepEqual(unknown.links, []);
  assert.deepEqual(unknown.indices, chekhov.indices);
  assert.match(unknown.text, /уточнить пока не получается/);
});

test('the new first-reading cards and replies keep the ending out even when asked for it', () => {
  const before = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../dist/assistant/v1/before-reading.json'), 'utf8'));
  for (const [id, query, forbidden] of [
    ['work-toska', 'Чем заканчивается «Тоска» Чехова?', /конюшн|кобыл|лошад|рассказывает ей всё/iu],
    ['work-kust-sireni', 'Какой финал у «Куста сирени» Куприна?', /посад|сажают|садовник|ломбард|драгоценност|извинил|уловка удалась/iu],
  ]) {
    const record = before.records.find(entry => entry.id === id);
    assert.ok(record);
    assert.deepEqual(Object.keys(record).sort(), ['author', 'cues', 'id', 'teaser', 'title', 'url']);
    assert.doesNotMatch(JSON.stringify(record), forbidden);
    const reply = firstReadingReply(urls, catalog, [], query);
    assert.deepEqual(reply.links.map(link => link.id), [id]);
    assert.doesNotMatch(reply.text, forbidden);
  }
});

test('article discussion packets reuse the published commentary and primary links', () => {
  for (const [id, slug] of [
    ['work-toska', 'chekhov-toska-temp-finala'],
    ['work-kust-sireni', 'kuprin-kust-sireni-dva-vzglyada'],
  ]) {
    const article = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../article_data/' + slug + '.json'), 'utf8'));
    const packet = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../dist/assistant/v1/after-reading/' + id + '.json'), 'utf8'));
    const record = packet.record;
    assert.equal(packet.version, 1);
    assert.equal(packet.mode, 'after_reading');
    assert.equal(record.kind, 'article');
    assert.equal(record.card_id, id);
    assert.equal(record.source_status, 'not_recorded');
    assert.equal(record.source_note, article.sources_note);
    assert.deepEqual(record.commentary_paragraphs, article.sections.flatMap(section => section.paragraphs));
    assert.deepEqual(record.sources.map(source => source.url), article.sources.map(source => source.url));
    assert.equal(record.reading_task, article.task);
    const answer = afterReadingReply(record, 'Где сверить точную цитату?');
    assert.match(answer.text, /комментарий мастерской/);
    assert.ok(answer.links.some(link => link.url === article.sources[0].url));
  }
});

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

test('a corrected title reopens the catalogue while ordinary clarifications keep their context', () => {
  const found = firstReadingReply(urls, catalog, [], '«Тоска» Чехова');
  const changed = firstReadingReply(urls, catalog, found.indices, 'Я ошиблась, ищу не «Тоску», а «Куст сирени».');
  assert.deepEqual(changed.links.map(item => item.id), ['work-kust-sireni']);
  const requested = firstReadingReply(urls, catalog, found.indices, 'А теперь найди «Куст сирени»');
  assert.deepEqual(requested.links.map(item => item.id), ['work-kust-sireni']);
  const missing = firstReadingReply(urls, catalog, changed.indices, 'Я имела в виду «Каштанка» Чехова.');
  assert.equal(missing.matched, false);
  assert.deepEqual(missing.indices, []);
  assert.deepEqual(missing.links, []);
});

test('unsupported page requests give the source boundary first and link to the actual fragment', () => {
  const forest = require('../dist/assistant/v1/after-reading/work-potaennyy-les.json').record;
  for (const q of ['Что ребята услышали на 11-й странице?', 'Выпишите слова со стр. 9–12.', 'Что там сказано на страницах 9 и 10?', 'Кто говорил у костра на странице №12?', 'А кто на стр 12?', 'Кто у костра на двенадцатой странице?']) {
    const response = afterReadingReply(forest, q);
    assert.match(response.text, /^Эта страница выходит за пределы проверенного фрагмента/u);
    assert.equal(response.links.length, 1);
    assert.equal(response.links[0].kind, 'primary_fragment');
  }
  const known = afterReadingReply(forest, 'Что ребята слышат у костра на странице 9?');
  assert.match(known.text, /Енисей/u);
  const source = afterReadingReply(forest, 'Где посмотреть разворот?');
  assert.equal(source.links[0].kind, 'primary_fragment');
});
