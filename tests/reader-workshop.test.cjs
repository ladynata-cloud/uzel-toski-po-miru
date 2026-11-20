'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'dist/assets/reader-workshop.js');
const api = require(runtimePath);
// Exercise the production builder without writing or depending on stale dist JSON.
const packets = JSON.parse(execFileSync('python3', ['-c',
  'import json; from reader_catalogue import load_cards; from reader_workshop import packets; print(json.dumps(packets(load_cards()), ensure_ascii=False))'],
{cwd: root, encoding: 'utf8'}));
const packet = (work, mode) => packets.find(p => p.work_id === work && p.mode === mode);
const clone = value => JSON.parse(JSON.stringify(value));

const approved = {
  'kb-reader-doctor-opening-after': 'ec744fa3d8c97a8973a41eeecbb98b5a084b7d91f21e1e496f7b8283b38d6ed0',
  'kb-reader-shinel-opening-after': '361678fc6899289fe6a913043096a7b9784a66c06b557ab70de759dc33697645',
  'kb-reader-student-opening-before': '93be25fa474c7ed453ca93bb8d5b04fb43ec99daca9a5eda06ed30aa7b62e8a8',
  'kb-reader-vorona-full-during': 'b01c01e7870da1ce88c74b42b0291676a257cc27eeb2fb0fb19733badeb02100',
};

test('all twelve mode packets derive only from four unchanged reviewed public cards', () => {
  assert.equal(packets.length, 12);
  assert.equal(new Set(packets.map(p => p.work_id + ':' + p.mode)).size, 12);
  for (const p of packets) {
    assert.equal(api.validatePacket(p, p.work_id, p.mode), true);
    const id = p.provenance.public_seed_id;
    const raw = fs.readFileSync(path.join(root, 'reader_workshop_cards', id + '.json'));
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), approved[id]);
    const source = JSON.parse(raw).public_card;
    assert.equal(p.source.url, source.links[0]);
    assert.ok(source.anchor_text.startsWith(p.source.text));
    assert.doesNotMatch(JSON.stringify(p), /"(?:tutor_private|answer_key|cause_hypothesis)"/);
    if (p.mode === source.read_mode) {
      assert.equal(p.source.text, source.anchor_text);
      assert.deepEqual(p.task.branches.map(b => b.steps), source.branches.map(b => b.hints.map(h => h.text)));
      assert.deepEqual(p.task.branches.map(b => b.check), source.branches.map(b => b.understanding_check.question));
    }
  }
});

test('before-reading packets contain only the opening phrase; after means the selected opening', () => {
  const openings = {
    'work-student': 'Погода вначале была хорошая, тихая.',
    'work-vorona-i-lisitsa': 'Уж сколько раз твердили миру,',
    'work-chudesnyy-doktor': 'Следующий рассказ не есть плод досужего вымысла.',
    'work-shinel': 'В департаменте... но лучше не называть, в каком департаменте.',
  };
  for (const [work, opening] of Object.entries(openings)) {
    assert.equal(packet(work, 'before').source.text, opening);
    assert.match(packet(work, 'before').source.scope, /Только первая фраза/);
    assert.match(packet(work, 'after').source.scope, /не полный текст произведения/);
    assert.equal(packet(work, 'during').source.text, packet(work, 'after').source.text);
  }
  assert.equal(packet('work-vorona-i-lisitsa', 'during').source.text.split('\n').length, 10);
  assert.doesNotMatch(packet('work-vorona-i-lisitsa', 'during').source.text, /каркнула|сыр выпал/iu);
});

test('packet validation rejects a different work, a different mode and unsafe sources', () => {
  const p = packet('work-student', 'before');
  assert.equal(api.validatePacket(p, 'work-shinel', 'before'), false);
  assert.equal(api.validatePacket(p, 'work-student', 'after'), false);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '/relative-source', 'http://unsafe.example']) {
    const bad = clone(p); bad.source.url = url;
    assert.equal(api.validatePacket(bad, p.work_id, p.mode), false, url);
  }
  const duplicate = clone(p); duplicate.task.branches[1].id = duplicate.task.branches[0].id;
  assert.equal(api.validatePacket(duplicate, p.work_id, p.mode), false);
  const noSteps = clone(p); noSteps.task.branches[0].steps = [];
  assert.equal(api.validatePacket(noSteps, p.work_id, p.mode), false);
});

test('a route exposes one selected prompt, then its check, and restores no invalid branch', () => {
  const p = packet('work-student', 'before');
  const branch = p.task.branches[0];
  assert.equal(api.currentStep(p, null), null);
  assert.equal(api.currentStep(p, {branchId: '__proto__', step: 4}), null);
  for (let i = 0; i < 5; i++) {
    const result = api.currentStep(p, {branchId: branch.id, step: i});
    assert.equal(result.text, i < 4 ? branch.steps[i] : branch.check);
    assert.equal(result.isCheck, i === 4);
    assert.equal(result.step, i);
  }
  assert.equal(api.normalizeProgress({branchId: branch.id, step: -99}, p).step, 0);
  assert.equal(api.normalizeProgress({branchId: branch.id, step: 999}, p).step, 4);
  assert.equal(api.normalizeProgress({branchId: branch.id, step: Infinity}, p).step, 0);
  assert.equal(api.normalizeProgress({note: 'x'.repeat(10000)}, p).note.length, 4000);
});

function memoryStorage() {
  const items = new Map();
  return {getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value),
    removeItem: key => items.delete(key), items};
}

test('notes and progress are isolated by work and mode, including literal markup', () => {
  const storage = memoryStorage();
  const p = packet('work-shinel', 'after');
  const key = api.progressKey(p.work_id, p.mode);
  const state = {branchId: p.task.branches[0].id, step: 2, note: '<img src=x onerror=alert(1)> Моя версия'};
  assert.equal(api.writeProgress(storage, key, state, p), true);
  assert.deepEqual(api.readProgress(storage, key, p).state, {...state, version: 1});
  const before = packet(p.work_id, 'before');
  assert.equal(api.readProgress(storage, api.progressKey(p.work_id, 'before'), before).state.note, '');
  assert.equal(api.readProgress(storage, api.progressKey('work-student', 'after'), packet('work-student', 'after')).state.note, '');
  assert.equal(api.removeProgress(storage, key), true);
  assert.equal(api.readProgress(storage, key, p).state.note, '');
});

test('blocked or malformed storage leaves a usable empty session', () => {
  const p = packet('work-student', 'before');
  const blocked = {getItem() {throw new Error('SecurityError');}, setItem() {throw new Error('QuotaExceeded');}, removeItem() {throw new Error('SecurityError');}};
  for (const storage of [blocked, null, {getItem() {return 'not JSON';}}]) {
    const restored = api.readProgress(storage, 'key', p);
    assert.equal(restored.available, false);
    assert.equal(restored.state.branchId, null);
    assert.equal(restored.state.note, '');
  }
  assert.equal(api.writeProgress(blocked, 'key', {note:'текст'}, p), false);
  assert.equal(api.removeProgress(blocked, 'key'), false);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
const response = p => ({ok: true, json: async () => clone(p)});

test('loader waits for an explicit selection and ignores stale success or cancellation', async () => {
  const calls = [];
  const loader = api.createLoader((url, options) => {const pending = deferred(); calls.push({url, options, pending}); return pending.promise;});
  assert.equal(calls.length, 0);
  const old = loader.select('/student-before', 'work-student', 'before');
  const current = loader.select('/shinel-after', 'work-shinel', 'after');
  assert.equal(calls.length, 2);
  calls[1].pending.resolve(response(packet('work-shinel', 'after')));
  assert.equal((await current).work_id, 'work-shinel');
  calls[0].pending.resolve(response(packet('work-student', 'before')));
  assert.equal(await old, null);
  const cancelled = loader.select('/doctor-during', 'work-chudesnyy-doktor', 'during');
  loader.cancel();
  calls[2].pending.resolve(response(packet('work-chudesnyy-doktor', 'during')));
  assert.equal(await cancelled, null);
  for (const call of calls) assert.deepEqual(call.options, {credentials:'same-origin', redirect:'error'});
});

test('a stale failure cannot replace a newer selection; a current failure remains visible', async () => {
  const pending = [];
  const loader = api.createLoader(() => {const next = deferred(); pending.push(next); return next.promise;});
  const old = loader.select('/old', 'work-student', 'before');
  const current = loader.select('/current', 'work-shinel', 'after');
  pending[0].reject(new Error('old offline'));
  assert.equal(await old, null);
  pending[1].resolve(response(packet('work-shinel', 'after')));
  assert.equal((await current).work_id, 'work-shinel');
  const failed = loader.select('/failed', 'work-student', 'during');
  pending[2].resolve({ok:false});
  await assert.rejects(failed, /unavailable/);
});

test('a cached packet cannot cross work or mode identity', async () => {
  let count = 0;
  const loader = api.createLoader(async () => {count++; return response(packet('work-student','before'));});
  await loader.select('/same-address', 'work-student', 'before');
  await assert.rejects(loader.select('/same-address', 'work-shinel', 'after'), Error);
  assert.equal(count, 1);
});

// The harness runs the shipped UI code, not a second implementation of its states.
class Element {
  constructor() {this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.textContent = ''; this.value = ''; this.hidden = false;}
  set innerHTML(_value) {throw new Error('Unsafe HTML insertion');}
  addEventListener(name, handler) {(this.listeners[name] ||= []).push(handler);}
  async fire(name) {for (const handler of this.listeners[name] || []) await handler({target:this, preventDefault() {}});}
  appendChild(child) {child.remove(); this.children.push(child); child.parent = this;}
  append(...children) {for (const child of children) this.appendChild(child);}
  remove() {if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null;}
  replaceChildren(...children) {this.children = children;}
  setAttribute(name, value) {this.attributes[name] = value;}
  removeAttribute(name) {delete this.attributes[name];}
  querySelectorAll() {return this.children;}
  focus() {this.focused = true;}
}

function uiHarness(storage, fetcher) {
  const elements = new Map();
  const element = id => {if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id);};
  const modes = ['before', 'during', 'after'].map(mode => {const b = new Element(); b.dataset.mode = mode; return b;});
  element('reading-modes').children = modes;
  const calls = [];
  let aiCalls = 0;
  const window = {SiteDialogueClient:{ask() {aiCalls++; throw new Error('No model calls allowed');}}};
  Object.defineProperty(window, 'localStorage', {get() {if (storage instanceof Error) throw storage; return storage;}});
  const document = {baseURI:'https://reader.example/prefix/poisk-po-pamyati/', getElementById:element,
    createElement:() => new Element(), dispatchEvent() {}};
  const context = {window, document, URL, location:{origin:'https://reader.example'}, CustomEvent:class {constructor(type) {this.type=type;}},
    fetch:(url, options) => {calls.push({url,options}); return fetcher(url,options);}};
  vm.runInNewContext(fs.readFileSync(runtimePath, 'utf8'), context, {filename:runtimePath});
  return {element, modes, window, calls, aiCalls:() => aiCalls};
}

test('the UI opens no fragment or saved note until a mode is selected and renders notes as text', async () => {
  const storage = memoryStorage();
  const after = packet('work-shinel','after');
  const note = '<img src=x onerror=alert(1)> Моё прочтение';
  api.writeProgress(storage, api.progressKey('work-shinel','after'), {branchId:after.task.branches[0].id, step:2, note}, after);
  const ui = uiHarness(storage, async url => {
    const match = new URL(url).pathname.match(/\/(work-[a-z-]+)\/(before|during|after)\.json$/);
    assert.ok(match, url); return response(packet(match[1], match[2]));
  });
  ui.window.ReaderWorkshop.open({id:'work-shinel',title:'Шинель'});
  assert.equal(ui.calls.length, 0);
  assert.equal(ui.element('reading-source-text').textContent, '');
  assert.equal(ui.element('reading-note').value, '');
  await ui.modes[0].fire('click');
  assert.equal(ui.calls.length, 1);
  assert.match(ui.calls[0].url, /^https:\/\/reader\.example\/prefix\/assistant\/v1\/workshop\/work-shinel\/before\.json$/);
  assert.equal(ui.element('reading-source-text').textContent, packet('work-shinel','before').source.text);
  assert.equal(ui.element('reading-note').value, '');
  await ui.modes[2].fire('click');
  assert.equal(ui.element('reading-note').value, note);
  assert.equal(ui.element('reading-prompt').textContent, after.task.branches[0].steps[2]);
  const beforeCalls = ui.calls.length;
  ui.element('reading-note').value = '<script>alert(1)</script>';
  await ui.element('reading-note').fire('input');
  await ui.element('reading-next').fire('click');
  assert.equal(ui.element('reading-prompt').textContent, after.task.branches[0].steps[3]);
  assert.equal(ui.calls.length, beforeCalls);
  assert.equal(ui.aiCalls(), 0);
  ui.window.ReaderWorkshop.close();
  assert.equal(ui.element('reading-source-text').textContent, '');
  assert.equal(ui.element('reading-note').value, '');
  assert.equal(ui.element('reading-prompt').textContent, '');
});

test('blocked localStorage still permits the actual UI to choose a branch and advance', async () => {
  const p = packet('work-student', 'before');
  const ui = uiHarness(new Error('SecurityError'), async () => response(p));
  ui.window.ReaderWorkshop.open({id:p.work_id,title:'Студент'});
  await ui.modes[0].fire('click');
  assert.match(ui.element('reading-saved').textContent, /сохранение недоступно/);
  await ui.element('reading-branches').children[0].fire('click');
  assert.equal(ui.element('reading-prompt').textContent, p.task.branches[0].steps[0]);
  await ui.element('reading-next').fire('click');
  assert.equal(ui.element('reading-prompt').textContent, p.task.branches[0].steps[1]);
  assert.match(ui.element('reading-saved').textContent, /не разрешил сохранение/);
  assert.equal(ui.aiCalls(), 0);
});

test('the actual UI keeps a newer work when an earlier load succeeds or fails late', async () => {
  for (const lateResult of ['success', 'failure']) {
    const pending = [];
    const ui = uiHarness(memoryStorage(), () => {const next = deferred(); pending.push(next); return next.promise;});
    ui.window.ReaderWorkshop.open({id:'work-shinel',title:'Шинель'});
    const old = ui.modes[2].fire('click');
    ui.window.ReaderWorkshop.open({id:'work-student',title:'Студент'});
    const selected = ui.modes[0].fire('click');
    pending[1].resolve(response(packet('work-student','before')));
    await selected;
    const currentStatus = ui.element('reading-status').textContent;
    if (lateResult === 'success') pending[0].resolve(response(packet('work-shinel','after')));
    else pending[0].reject(new Error('old packet unavailable'));
    await old;
    assert.equal(ui.element('reading-source-text').textContent, packet('work-student','before').source.text);
    assert.equal(ui.element('reading-status').textContent, currentStatus);
    assert.equal(ui.element('reader-workshop').hidden, false);
  }
});

test('generated page keeps server consent unchecked and ships only local scripts and four practice entries', () => {
  const inspection = JSON.parse(execFileSync('python3', ['-c', String.raw`
import json
from html.parser import HTMLParser
from reader_catalogue import load_cards
from reader_search import reader_search_body
class Inspect(HTMLParser):
    def __init__(self):
        super().__init__(); self.tags=[]; self.practice=[]; self.article=None
    def handle_starttag(self,tag,attrs):
        data=dict(attrs)
        if tag=='article': self.article=data.get('id')
        if tag in ('script','form','input'): self.tags.append({'tag':tag,'attrs':data})
        if tag=='button' and 'memory-practice' in data.get('class','').split():
            self.practice.append({'work':self.article,'attrs':data})
    def handle_endtag(self,tag):
        if tag=='article': self.article=None
p=Inspect(); p.feed(reader_search_body(load_cards()))
print(json.dumps({'tags':p.tags,'practice':p.practice}))
  `], {cwd:root, encoding:'utf8', env:{...process.env, SITE_ASSISTANT_ORIGIN:'https://assistant.example'}}));
  const consent = inspection.tags.find(t => t.attrs.id === 'memory-server-consent');
  assert.equal(consent.attrs.type, 'checkbox');
  assert.equal(Object.hasOwn(consent.attrs, 'checked'), false);
  const form = inspection.tags.find(t => t.attrs.id === 'memory-form');
  assert.equal(form.attrs['data-assistant-origin'], 'https://assistant.example');
  const scripts = inspection.tags.filter(t => t.tag === 'script').map(t => t.attrs.src);
  assert.deepEqual(scripts, ['/assets/reader-workshop.js', '/assets/reader-search.js']);
  assert.deepEqual(new Set(inspection.practice.map(p => p.work)),
    new Set(['work-student','work-shinel','work-vorona-i-lisitsa','work-chudesnyy-doktor']));
  assert.ok(inspection.practice.every(p => p.attrs.type === 'button'));
});

function searchHarness(client) {
  const elements = new Map();
  const element = id => {if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id);};
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'assistant_cards.json'), 'utf8'));
  const practices = new Map();
  for (const card of catalogue) {
    const row = new Element(); row.id = card.id; row.dataset.cues = card.cues.join(' ');
    const values = {'h2':card.title, '.memory-author':card.author, '.memory-teaser':card.teaser};
    if (card.detail_hint) values['.memory-hint'] = card.detail_hint;
    const selectors = Object.fromEntries(Object.entries(values).map(([selector,text]) => {
      const node = new Element(); node.textContent = text; return [selector,node];
    }));
    selectors['.memory-discuss'] = new Element();
    if (['work-student','work-shinel','work-vorona-i-lisitsa','work-chudesnyy-doktor'].includes(card.id)) {
      selectors['.memory-practice'] = new Element(); practices.set(card.id, selectors['.memory-practice']);
    }
    row.querySelector = selector => selectors[selector] || null;
    element('memory-results').appendChild(row);
  }
  element('memory-form').dataset.assistantOrigin = 'https://assistant.example';
  element('memory-server-consent').checked = false;
  const head = new Element();
  const events = new Element();
  const opened = [];
  const window = {ReaderWorkshop:{close() {}, open(work) {opened.push(work);}}};
  if (client) window.SiteDialogueClient = client;
  const document = {head, baseURI:'https://reader.example/prefix/poisk-po-pamyati/', getElementById:element,
    createElement:tag => {const e = new Element(); e.tagName = tag; return e;},
    addEventListener:(name, fn) => events.addEventListener(name, fn)};
  const context = {window, document, URL, AbortController, setTimeout, clearTimeout,
    location:{href:document.baseURI, pathname:'/prefix/poisk-po-pamyati/', origin:'https://reader.example'},
    fetch() {throw new Error('Unexpected packet fetch in local search');}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'dist/assets/reader-search.js'), 'utf8'), context);
  return {element, practices, head, window, opened};
}
const flushMicrotasks = async () => {for (let i=0;i<8;i++) await Promise.resolve();};

test('the existing search loads its optional client only after checked consent and a submitted query', async () => {
  const ui = searchHarness();
  assert.equal(ui.head.children.length, 0);
  ui.element('memory-query').value = 'Студент';
  await ui.element('memory-form').fire('submit'); await flushMicrotasks();
  assert.equal(ui.head.children.length, 0);
  ui.element('memory-server-consent').checked = true;
  await ui.element('memory-server-consent').fire('change');
  assert.equal(ui.head.children.length, 0);
  ui.element('memory-query').value = 'Студент';
  await ui.element('memory-form').fire('submit'); await flushMicrotasks();
  assert.equal(ui.head.children.length, 1);
  assert.equal(ui.head.children[0].src, 'https://assistant.example/client.js');
  let calls = 0;
  ui.window.SiteDialogueClient = {async ask() {calls++; return {version:1,site:'uzel',reply:'Серверный ответ',links:[]};}};
  ui.head.children[0].onload(); await flushMicrotasks();
  assert.equal(calls, 1);
});

test('entering the local workshop aborts a pending server reply and ignores its late result', async () => {
  const reply = deferred();
  const calls = [];
  const ui = searchHarness({ask(payload, options) {calls.push({payload, options}); return reply.promise;}});
  ui.element('memory-server-consent').checked = true;
  await ui.element('memory-server-consent').fire('change');
  ui.element('memory-query').value = 'Студент';
  await ui.element('memory-form').fire('submit'); await flushMicrotasks();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.signal.aborted, false);
  await ui.practices.get('work-student').fire('click');
  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(ui.element('memory-form').hidden, true);
  assert.equal(ui.opened.length, 1);
  assert.equal(ui.opened[0].id, 'work-student');
  assert.equal(ui.element('memory-log').children.length, 0);
  reply.resolve({version:1,site:'uzel',reply:'LATE SERVER SPOILER',links:[]}); await flushMicrotasks();
  assert.equal(ui.element('memory-log').children.length, 0);
  assert.equal(ui.element('memory-form').hidden, true);
  assert.equal(calls.length, 1);
});

test('entering practice while the optional client is loading cannot send a queued query', async () => {
  const ui = searchHarness();
  ui.element('memory-server-consent').checked = true;
  await ui.element('memory-server-consent').fire('change');
  ui.element('memory-query').value = 'Студент';
  await ui.element('memory-form').fire('submit'); await flushMicrotasks();
  assert.equal(ui.head.children.length, 1);
  await ui.practices.get('work-student').fire('click');
  let calls = 0;
  ui.window.SiteDialogueClient = {async ask() {calls++; return {version:1,site:'uzel',reply:'unexpected'};}};
  ui.head.children[0].onload(); await flushMicrotasks();
  assert.equal(calls, 0);
  assert.equal(ui.element('memory-form').hidden, true);
});
