'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../dist/assets/app.js'), 'utf8');
const key = 'uzel-workshop-draft-v1:sample';
const otherKey = 'uzel-workshop-draft-v1:another-lesson';

// Exercise the shipped event handlers with browser-shaped elements and storage.
class Element {
  constructor() { this.listeners = {}; this.value = ''; this.textContent = ''; this.dataset = {}; this.disabled = false; }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  fire(name, event = {}) { for (const handler of this.listeners[name] || []) handler(event); }
}
function storage(entries = []) {
  const values = new Map(entries);
  return {values, failRead: false, failWrite: false, failRemove: false,
    getItem(k) { if (this.failRead) throw new Error('Blocked'); return values.get(k) ?? null; },
    setItem(k, v) { if (this.failWrite) throw new Error('Quota'); values.set(k, v); },
    removeItem(k) { if (this.failRemove) throw new Error('Blocked'); values.delete(k); }};
}
function open(store) {
  const fields = Object.fromEntries(['textarea', 'select', '.writing-prompt', '.draft-status', '[data-download]',
    '[data-save-draft]', '[data-delete-draft]', '[data-draft-source]', '.word-count', '.print-draft'].map(k => [k, new Element()]));
  const select = fields.select;
  select.options = [
    {textContent: 'Учебный абзац', dataset: {prompt: 'Первый вопрос'}},
    {textContent: 'Сопоставление', dataset: {prompt: 'Второй вопрос'}},
  ];
  select.selectedIndex = 0;
  Object.defineProperty(select, 'selectedOptions', {get() { return [this.options[this.selectedIndex]]; }});
  const practice = {dataset: {lesson: 'sample'}, querySelector: selector => fields[selector] || null};
  const window = new Element();
  window.location = {href: 'https://reader.example/masterskaya/sample/'};
  const context = {window, localStorage: store, document: {
    querySelector: selector => selector === '.practice' ? practice : selector === 'h1' ? {textContent: 'Занятие'} : null,
  }};
  vm.runInNewContext(source, context);
  return {fields, area: fields.textarea, select, status: fields['.draft-status'],
    save: fields['[data-save-draft]'], forget: fields['[data-delete-draft]'], taskSource: fields['[data-draft-source]'],
    type(text) { fields.textarea.value = text; fields.textarea.fire('input'); },
    choose(index) { select.selectedIndex = index; select.fire('change'); },
    wouldWarn() { let warned = false; window.fire('beforeunload', {preventDefault() {warned = true;}}); return warned; }};
}

test('saving and restoring retain text, chosen task and its source', () => {
  const store = storage();
  const ui = open(store);
  assert.equal(ui.forget.disabled, true);
  ui.type('Мой ответ'); ui.choose(1); ui.taskSource.value = 'Книга, глава 2'; ui.taskSource.fire('input');
  ui.save.fire('click');
  assert.equal(ui.forget.disabled, false);
  assert.equal(ui.wouldWarn(), false);
  const restored = open(store);
  assert.equal(restored.area.value, 'Мой ответ');
  assert.equal(restored.select.selectedIndex, 1);
  assert.equal(restored.fields['.writing-prompt'].textContent, 'Второй вопрос');
  assert.equal(restored.taskSource.value, 'Книга, глава 2');
  assert.match(restored.status.textContent, /Восстановлен/);
});

test('changing the task invalidates the saved status and warns until saved again', () => {
  const store = storage();
  const ui = open(store);
  ui.type('Сохранённый ответ'); ui.save.fire('click'); ui.choose(1);
  assert.equal(ui.status.textContent, '');
  assert.equal(ui.wouldWarn(), true);
  ui.save.fire('click');
  assert.equal(open(store).select.selectedIndex, 1);
  assert.equal(ui.wouldWarn(), false);
  ui.type(''); ui.choose(0);
  assert.equal(ui.wouldWarn(), false, 'An empty editor does not trigger a leave warning');
});

test('deleting a saved copy preserves visible edits and every other lesson', () => {
  const store = storage([[key, JSON.stringify({text: 'Старая версия', mode: 1})], [otherKey, 'other draft']]);
  const ui = open(store);
  ui.type('Несохранённая новая версия'); ui.forget.fire('click');
  assert.equal(store.values.has(key), false);
  assert.equal(store.values.get(otherKey), 'other draft');
  assert.equal(ui.area.value, 'Несохранённая новая версия');
  assert.equal(ui.select.selectedIndex, 1);
  assert.equal(ui.forget.disabled, true);
  assert.equal(ui.wouldWarn(), true);
  assert.match(ui.status.textContent, /удалена.*Текст на странице не изменён/);
  assert.equal(open(store).area.value, '');
  ui.save.fire('click');
  assert.equal(open(store).area.value, 'Несохранённая новая версия');
});

test('a saved copy can still be removed after the editor is cleared', () => {
  const store = storage([[key, JSON.stringify({text: 'Старый ответ', mode: 0})]]);
  const ui = open(store);
  ui.type('');
  assert.equal(ui.save.disabled, true);
  assert.equal(ui.forget.disabled, false);
  ui.forget.fire('click');
  assert.equal(store.values.has(key), false);
  assert.equal(ui.wouldWarn(), false);
});

test('failed save and deletion report failure without discarding the current text', () => {
  const store = storage([[key, JSON.stringify({text: 'Сохранённая версия', mode: 0})]]);
  const ui = open(store);
  ui.type('Новая версия'); store.failWrite = true; ui.save.fire('click');
  assert.match(ui.status.textContent, /не разрешил сохранение/);
  assert.equal(ui.wouldWarn(), true);
  store.failRemove = true; ui.forget.fire('click');
  assert.match(ui.status.textContent, /не разрешил удалить/);
  assert.equal(ui.area.value, 'Новая версия');
  assert.equal(JSON.parse(store.values.get(key)).text, 'Сохранённая версия');
  assert.equal(ui.forget.disabled, false, 'Failure must not masquerade as successful removal');
});

test('unreadable or malformed storage does not prevent writing or an explicit removal attempt', () => {
  for (const malformed of [false, true]) {
    const store = storage([[key, malformed ? '{broken' : JSON.stringify({text: 'Старый текст', mode: 0})]]);
    store.failRead = !malformed;
    const ui = open(store);
    assert.match(ui.status.textContent, /Не удалось прочитать/);
    assert.equal(ui.forget.disabled, false);
    ui.type('Можно писать'); ui.forget.fire('click');
    assert.equal(ui.area.value, 'Можно писать');
    assert.equal(store.values.has(key), false);
    assert.equal(ui.forget.disabled, true);
  }
});
