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
