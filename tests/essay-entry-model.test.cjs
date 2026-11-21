'use strict';
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const vm = require('node:vm');
const dir = path.resolve(__dirname,'../essay_workshop/entry_router');
const source = readFileSync(path.join(dir,'router.js'),'utf8');
const weights = readFileSync(path.join(dir,'weights.json'),'utf8');
const window = {};
vm.runInNewContext(source.replace('__ENTRY_PARAMETERS__',weights), {window});
const router = window.EssayLocalNavigator;

test('offline navigator exposes the same seven routes as the pupil-facing buttons', () => {
  const order = JSON.parse(readFileSync(path.join(dir,'../personal-gigachat/navigation-steps.json'),'utf8')).map(step=>step.id);
  for(const [description,expected] of [
    ['Пока ничего не выбрал','empty'],
    ['Тема есть, книги нет','topic'],
    ['Помню книгу, темы нет','scene'],
    ['Хочу проверить абзац','paragraph'],
    ['Я всё написал','essay'],
    ['Хочу репетицию целиком','rehearsal'],
    ['5 минут на одну фразу','quick']
  ]) assert.equal(order[router.suggest(description)-1],expected,description);
});

test('offline navigator leaves the choice open for incomplete or negated requests', () => {
  for(const description of ['', 'Какое расписание завтра?', 'Не хочу писать пробник',
    'Есть тема и книга, не знаю что выбрать']) {
    assert.equal(router.suggest(description),null,description);
  }
});
