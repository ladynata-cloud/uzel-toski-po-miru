'use strict';
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const {runInNewContext} = require('node:vm');

const source = join(__dirname, '..', 'essay_workshop');
const read = file => readFileSync(join(source, file), 'utf8');
const coach = runInNewContext(read('intent-model.js') + '\n' + read('coach.js') + '\nEssayCoach');
const context = {
  stage:'episode', mode:'secular', topic:'Что значит помощь?',
  work:{id:'own',title:'Моё произведение',secular:'Какая деталь важна?',orthodox:'Как в сцене проявилась милость?'}
};
const reply = message => coach.reply(context, message);

test('checks the length of the full essay and guides a paragraph by its argument', () => {
  for (const message of [
    'Этот абзац пока 86 слов. Раз абзац короче 250, мой аргумент уже провалил проверку?',
    'В одном фрагменте 110 слов. Этого хватит?',
  ]) {
    const answer=reply(message);
    assert.match(answer,/250 слов относится ко всему сочинению/u);
    assert.match(answer,/деталь.*ответить на вопрос темы/u);
    assert.doesNotMatch(answer,/незачёт/u);
  }
  for (const message of [
    'Я пересчитал: в готовой работе ровно 249 слов без заголовка. Что это значит по правилам?',
    'В абзаце 86 слов, а во всей работе ровно 249 слов. Это мало?',
  ]) assert.match(reply(message),/«незачёт» за всё сочинение/u);
  assert.match(reply('Это всё сочинение, я насчитал ровно 250 слов. Если 350 только рекомендуют, что мне осталось проверить?'),/требование к объёму выполнено.*самостоятельность/u);
  assert.doesNotMatch(reply('К полному объёму осталось написать 15 слов.'),/«незачёт» за всё сочинение/u);
});

test('asks for the source of exact words from an unverified work', () => {
  const work={title:'«Сырая тропа»'};
  for (const question of [
    'Мне запомнился рассказ «Сырая тропа». Там, кажется, сторож вернул письмо. Дай точную цитату именно из этой сцены.',
    'Процитируй эту сцену дословно.',
    'Можешь привести короткую цитату из повести?',
  ]) {
    const answer=coach.respond({...context,work},question);
    assert.match(answer.assistant,/сверь слова.*короткий отрывок.*автора, название и главу или страницу/u);
    assert.doesNotMatch(answer.assistant,/сторож|письмо|https?:|«/u);
    assert.equal(answer.exam,undefined);
  }
  assert.match(reply('Можно ли привести цитату в сочинении?'),/Укажи источник в свободной форме/u);
});

test('answers the source question before the pupil’s affiliation or choice of lens', () => {
  for (const message of ['А Библия подойдёт как источник?', 'Можно ли взять Коран как литературный аргумент?',
    'Я не православная. Можно ли сослаться на Тору?', 'Можно ли использовать пример из другой священной книги?',
    'Можно ли ссылаться на Куран?', 'Можно ли взять священный текст другой традиции?']) {
    assert.match(reply(message), /священные книги религий мира/u, message);
    assert.match(reply(message), /фрагмент в опубликованном издании/u, message);
  }
});

test('distinguishes an optional example from a required book or library loan', () => {
  for (const message of ['Я обязан приводить пример из священной книги?',
    'Можно ли обойтись без Корана и Библии?', 'Можно читать светскую книгу, если я верующий?',
    'Можно ли взять книгу из библиотеки?', 'Можно библиотечную книгу?', 'А обязательно выбирать именно Евангелие?']) {
    assert.match(reply(message), /сам выбираешь подходящий опубликованный текст/u, message);
    assert.doesNotMatch(reply(message), /Библию и другие священные книги/u, message);
  }
  assert.doesNotMatch(reply('Герой зашёл в библиотеку и нашёл там книгу.'), /священные книги/u);
  assert.match(reply('Можно взять притчу из Корана без второй книги?'), /священные книги/u);
});

test('asks for evidence without assigning a religious perspective or asking for personal information', () => {
  for (const message of ['Можно ли не соглашаться с христианским толкованием?', 'Обязательно ли верить так же, как герой?',
    'Можно ли рассуждать с атеистической точки зрения?', 'Хочу написать с мусульманской точки зрения.',
    'Можно ли предложить своё прочтение?', 'А можно не согласиться с автором?']) {
    assert.match(reply(message), /своё прочтение/u, message);
    assert.match(reply(message), /деталь текста/u, message);
  }
  assert.match(reply('Мне снизят балл за религиозные убеждения?'), /нет оценки за убеждения/u);
  for (const message of ['Я не православный.', 'Я мусульманка.', 'Я атеист.', 'Обязательно ли назвать свою религию?']) {
    assert.match(reply(message), /рассказывать необязательно/u, message);
    assert.doesNotMatch(reply(message), /переключ|выбери.*ракурс/iu);
  }
});

test('offers a lens only when asked and keeps literary discussion separate', () => {
  for (const message of ['Не хочу православный уклон.', 'Я мусульманин, можно без православного прочтения?',
    'Не хочу православный, хочу светский.']) {
    assert.match(reply(message), /в светском ракурсе/u, message);
  }
  for (const message of ['Можно православный ракурс?', 'Я не хочу светский, хочу православный.',
    'Хочу попробовать православный комментарий.']) {
    assert.match(reply(message), /православный комментарий/u, message);
  }
  for (const message of ['Почему герой не верит в Бога?', 'Как герой читал Коран?', 'Что значила для героя жизнь без веры?',
    'Я хочу понять, как православный герой принимает решение.', 'Я не верю, что герой забыл о друге.']) {
    assert.doesNotMatch(reply(message), /в переключателе|о своих убеждениях|ФИПИ допускает/iu, message);
  }
});

test('checking a quotation goes to the source before grading or writing advice', () => {
  const inputs = [
    'Я не помню точную цитату из рассказа. Как проверить, что это слова героя?',
    'Не помню точных слов. Как проверить цитату в моём тексте?',
    'В черновике цитата по памяти. Проверь, говорил ли это герой?'
  ];
  for (const message of inputs) {
    assert.match(reply(message), /Можешь найти в книге именно те слова/u);
    assert.match(reply(message), /без кавычек/u);
  }
});

test('shared reading lens preserves older personal settings and both questions for each writing skill', () => {
  const stored = new Map();
  const storage = {getItem:key => stored.get(key),setItem:(key,val) => stored.set(key,val)};
  const events = [];
  class Event { constructor(type, params) { this.type=type; this.detail=params.detail; } }
  const lens = runInNewContext(read('reading-lens.js')+'\nEssayReadingLens', {
    localStorage:storage,CustomEvent:Event,window:{dispatchEvent:event => events.push(event)}
  });
  assert.equal(lens.restore('orthodox'),'orthodox');
  lens.select('secular');
  assert.equal(stored.get('uzel-reading-lens-v1'),'secular');
  assert.equal(events[0].detail.mode,'secular');
  assert.equal(lens.restore('orthodox'),'secular');
  for (const skill of ['topic','thesis','retell','motive','quote','transition','ending','precision','alternative']) {
    const questions=['secular','orthodox'].map(mode=>lens.question(skill,mode));
    assert.notEqual(...questions);
    assert.ok(questions.every(q=>q.includes('?')));
  }
  const card={fact:'Первая сцена.',orthodox:'Вопрос о первой сцене?'};
  assert.equal(lens.routeQuestion({scene:card.fact,why:'Семья'},card,'Моя тема'),card.orthodox);
  assert.notEqual(lens.routeQuestion({scene:'Другая сцена.',why:'Семья'},card,'Моя тема'),card.orthodox);
  const unavailable = runInNewContext(read('reading-lens.js')+'\nEssayReadingLens', {
    localStorage:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}},
    CustomEvent:Event,window:{dispatchEvent(){}}
  });
  assert.equal(unavailable.restore('broken'),'secular');
  unavailable.select('orthodox');
  assert.equal(unavailable.current(),'orthodox');
});
