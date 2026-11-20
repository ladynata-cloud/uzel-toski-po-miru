const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder=path.join(__dirname,'..','essay_workshop');
const read=name=>fs.readFileSync(path.join(folder,name),'utf8');
const feedback=vm.runInNewContext(read('answer-feedback.js')+'\nEssayAnswerFeedback');
const catalog=JSON.parse(read('catalog.json'));
const drills=JSON.parse(read('drills.json'));
const topic='Как помочь человеку, сохранив его достоинство?';
const work=catalog.works.find(w=>w.id==='doctor');
const review=(stage,text,extras={})=>feedback.inspect({stage,text,topic,work,...extras});

test('the question, an opening and a claim trigger different responses',()=>{
  assert.equal(review('thesis',' «'+topic+'» ').kind,'topic-echo');
  assert.equal(review('thesis','Я считаю, что...').kind,'unfinished');
  for(const text of ['—','777','']) assert.equal(review('thesis',text).kind,'empty');
  assert.equal(review('episode','Пока не помню.').kind,'stuck');
  const claim='Лучше помочь так, чтобы человек мог отказаться.';
  assert.equal(review('thesis',claim).kind,'reader-check');
  assert.equal(review('thesis',claim).excerpt,claim);
});

test('an exact retelling and a circular restatement are flagged; a distinct explanation is open to review',()=>{
  const thesis='У незнакомца должен остаться выбор.';
  const episode='Доктор оставил деньги под блюдцем.';
  const link='Дар от врача можно было принять без унизительной просьбы.';
  assert.equal(review('link',episode,{thesis,episode}).kind,'episode-echo');
  assert.equal(review('link',thesis,{thesis,episode}).kind,'thesis-echo');
  assert.equal(review('link','Это доказывает мой тезис, потому что поступок героя его доказывает.',{thesis,episode}).kind,'empty-link');
  const res=review('link',link,{thesis,episode});
  assert.equal(res.kind,'reader-check');assert.ok(res.next.includes(thesis));
  assert.equal(res.excerpt,link);
});

test('points to the exact sentence within a draft, including text preceding a newline',()=>{
  const sentence='Доктор был добрым человеком.';
  const draft='Врач помог семье\n'+sentence+' Мне важно, как он попрощался.';
  const res=review('draft',draft);
  assert.equal(res.kind,'general-claim');assert.equal(res.excerpt,sentence);
  assert.match(res.next,/поступку врача/u);
  const repeated='Поэт придаёт этому жесту особое значение.';
  assert.equal(review('draft',repeated+'\n'+repeated).kind,'repeated-sentence');
  assert.equal(review('link','Человек не всегда может сразу попросить помощи.').kind,'reader-check');
});

test('a book-specific factual comparison stays with the selected book',()=>{
  const passage='Пирогов лично вручает Мерцалову деньги и заставляет его расписаться в получении.';
  const res=review('episode',passage);
  assert.equal(res.kind,'check-source');assert.match(res.observation,/блюдцем/u);
  assert.equal(review('episode',passage,{work:{title:'Моя книга'}}).kind,'reader-check');
  for (const text of ['А если бы врач вручил деньги лично?', 'Доктор не передавал деньги лично.', 'Доктор не стал лично передавать деньги, Мерцалов обнаружил их под блюдцем.']) {
    assert.notEqual(review('episode',text).kind,'check-source');
  }
});

test('reading distinguishes the whole displayed source and a selected phrase from personal observation',()=>{
  const reading=catalog.readings.find(r=>r.id==='doctor');
  assert.equal(review('read',reading.quote,{reading}).kind,'source-echo');
  assert.equal(review('reading','лежало несколько крупных кредитных билетов',{reading}).kind,'source-detail');
  assert.equal(review('reading','Меня удивил способ оставить помощь незаметно.',{reading}).kind,'reader-check');
});

test('exercise feedback detects verbatim submission, and retains each specific editorial question',()=>{
  for (const drill of drills) {
    assert.equal(review('drill',drill.task,{drill}).kind,'task-echo');
    assert.equal(review('drill',drill.example,{drill}).kind,'example-echo');
    const res=review('exercise','Я хочу изменить последнюю фразу по-своему.',{drill});
    assert.equal(res.kind,'drill-review');assert.equal(res.next,drill.check);
  }
  const drill=drills.find(d=>d.id==='repetition');
  assert.equal(review('drill','Гринёв отказывается. Гринёв связан своим обещанием.',{drill}).kind,'sentence-openings');
  for (const [id,text,signal] of [
    ['thesis','Каждому надо быть добрее.','general-claim'],
    ['observation','Василиса наверняка вспомнила о своей вине.','interpretation'],
    ['retelling','Сначала мальчик растопил печку, потом другой разогрел самовар.','sequence'],
    ['evidence','Об этом мы узнаём в последней сцене.','locate-detail'],
    ['conclusion','Тот, кто говорит правду, всегда спасается.','scope']
  ]) assert.equal(review('drill',text,{drill:drills.find(d=>d.id===id)}).kind,signal);
});

test('multiple readings have the same criteria and do not receive a simulated grade',()=>{
  const claims=['Я вижу в этом молчании молитву.','Я вижу в этом молчании неловкость.','Я не разделяю взгляд рассказчика.'];
  for(const text of claims) {
    const a=review('thesis',text,{mode:'secular'}), b=review('thesis',text,{mode:'orthodox'});
    assert.equal(a.kind,'reader-check');assert.deepEqual(a,b);
    assert.doesNotMatch(a.observation+' '+a.next,/зач[её]т|балл|верно|неверно/iu);
  }
});
