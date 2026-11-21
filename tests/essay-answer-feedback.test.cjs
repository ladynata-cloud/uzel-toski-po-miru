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

test('a causal connector and a proposed motive cannot establish that an argument is sound',()=>{
  const thesis='Помощь может сохранить достоинство человека.';
  const episode='После ухода врача Мерцалов нашёл деньги под блюдцем.';
  const samples=[
    'Мерцалов заметил деньги, потому что поднял блюдце.',
    'Оставляя деньги под блюдцем, врач избавил семью от необходимости благодарить его при встрече.',
    'Доктор боялся славы.',
    'Мы не знаем, боялся ли доктор славы.',
    'Если бы доктор ждал благодарности, он мог бы задержаться.'
  ];
  for (const text of samples) {
    const reply=review('link',text,{thesis,episode});
    assert.equal(reply.kind,'reader-check');
    assert.equal(reply.excerpt,text);
    assert.match(reply.next,/деталь/u);
    assert.ok(reply.next.includes(thesis));
    assert.doesNotMatch(reply.observation,/тво[её] объяснение|доказан|верно|ошибка/iu);
  }
  assert.equal(review('link','Потому что.',{thesis,episode}).kind,'unfinished');
});

test('a book-specific factual comparison stays with the selected book',()=>{
  const passage='Пирогов лично вручает Мерцалову крупные кредитные билеты.';
  const res=review('episode',passage);
  assert.equal(res.kind,'check-source');assert.match(res.observation,/блюдцем/u);
  assert.equal(review('episode',passage,{work:{title:'Моя книга'}}).kind,'reader-check');
  for (const text of ['А если бы врач вручил деньги лично?', 'Доктор не передавал деньги лично.', 'Доктор не стал лично передавать деньги, Мерцалов обнаружил их под блюдцем.']) {
    assert.notEqual(review('episode',text).kind,'check-source');
  }
});

test('the large-banknote comparison selects its own sentence despite a separate negation',()=>{
  for (const stage of ['episode','draft']) {
    for (const sentence of [
      'Пирогов вручил Мерцалову крупные кредитные билеты.',
      'Пирогов дал Мерцалову крупные кредитные билеты в руки.',
      'Пирогов дал в руки Мерцалову несколько крупных кредитных билетов.',
      'Пирогов вручил Мерцалову крупные кредитные билеты на еду.'
    ]) {
      for (const text of [sentence+' Семья не ожидала помощи.', 'Семья не ожидала помощи. '+sentence]) {
        const result=review(stage,text);
        assert.equal(result.kind,'check-source',stage+': '+text);
        assert.equal(result.excerpt,sentence);
        assert.match(result.observation,/под чайным блюдцем/u);
        assert.match(result.next,/когда он увидел крупные билеты/u);
        assert.notEqual(review(stage,text,{work:{id:'student'}}).kind,'check-source');
      }
    }
  }
});

test('a negated, hypothetical or corrected banknote account is not turned into a handover claim',()=>{
  for (const stage of ['episode','draft']) {
    for (const text of [
      'Пирогов не вручил Мерцалову крупные кредитные билеты.',
      'Пирогов не дал Мерцалову крупные кредитные билеты в руки.',
      'Нельзя утверждать, что Пирогов вручил Мерцалову крупные кредитные билеты.',
      'Неверно писать, что Пирогов вручил Мерцалову крупные кредитные билеты.',
      'Ошибочно считать, что Пирогов вручил Мерцалову крупные кредитные билеты.',
      'Это ошибка: Пирогов вручил Мерцалову крупные кредитные билеты.',
      'Если бы Пирогов лично вручил крупные кредитные билеты, Мерцалов мог бы смутиться.',
      'Разве Пирогов лично вручил Мерцалову крупные кредитные билеты?',
      '«Пирогов лично вручил крупные кредитные билеты» — это спорная запись.',
      'Пирогов дал совет. Позже Мерцалов взял найденные крупные кредитные билеты в руки.',
      'Пирогов дал совет, а крупные кредитные билеты Мерцалов взял в руки позже.',
      'Вернувшись из коридора, Мерцалов нашёл крупные кредитные билеты под блюдцем.'
    ]) {
      const result=review(stage,text);
      assert.notEqual(result.kind,'check-source',stage+': '+text);
      assert.notEqual(result.kind,'money-episode',stage+': '+text);
    }
  }
});

test('the earlier three roubles for food remain distinct from the large banknotes',()=>{
  for (const stage of ['episode','draft']) {
    for (const text of [
      'Пирогов лично передал Мерцалову деньги — три рубля на еду.',
      'Пирогов дал Мерцалову деньги в руки: 3 рубля на чай и сахар.',
      'Пирогов вручил Мерцалову деньги на продукты.',
      'Пирогов дал Мерцалову деньги.',
      'Пирогов лично передал Мерцалову три рубля, а крупные кредитные билеты тот нашёл после его ухода.',
      'На три рубля, полученные от доктора, Мерцалов купил еды.'
    ]) {
      const result=review(stage,text);
      assert.notEqual(result.kind,'check-source',stage+': '+text);
      assert.notEqual(result.kind,'money-episode',stage+': '+text);
    }
    const ambiguous='Пирогов лично вручил Мерцалову деньги.';
    const result=review(stage,ambiguous);
    assert.equal(result.kind,'money-episode');
    assert.equal(result.excerpt,ambiguous);
    assert.match(result.observation,/два эпизода/u);
    assert.match(result.observation,/три рубля/u);
    assert.match(result.next,/Уточни, о каких деньгах/u);
    assert.doesNotMatch(result.observation+' '+result.next,/ошибк|неверн|не давал|не вручил/iu);
    const banknotes='Пирогов вручил Мерцалову крупные кредитные билеты.';
    assert.equal(review(stage,'Пирогов передал Мерцалову три рубля на еду. '+banknotes).excerpt,banknotes);
    const mixed='Пирогов дал Мерцалову три рубля, а затем лично вручил крупные кредитные билеты.';
    const mixedResult=review(stage,mixed);
    assert.equal(mixedResult.kind,'check-source');
    assert.equal(mixedResult.excerpt,mixed);
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
