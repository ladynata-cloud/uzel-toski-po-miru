(() => {
  'use strict';
  const root = document.getElementById('essay-workshop');
  const catalog = JSON.parse(document.getElementById('ew-catalog').textContent);
  const instruction = JSON.parse(document.getElementById('ew-system').textContent);
  const panel = root.querySelector('#ew-current');
  const menu = root.querySelector('#ew-steps');
  const mode = root.querySelector('#ew-mode');
  const storageKey = 'uzel.essay-workshop.v1';
  const steps = [['start','Старт'],['topic','Тема'],['thesis','Тезис'],['episode','Эпизод'],['link','Аргумент'],['draft','Черновик'],['review','Самопроверка'],['drills','Упражнения']];
  const reasons = {stuck:'Не знаю, с чего начать',clarify:'Уточнить мысль',retell:'Получился пересказ',check:'На что посмотреть?'};
  steps.push(['read','Первое чтение']);
  const routes = {quick:'Собрать аргумент',full:'Написать сочинение',edit:'Разобрать мой черновик'};
  const checklist = [
    ['topic','Тема','Я могу показать фразу, в которой отвечаю на вопрос темы.'],
    ['book','Литературный аргумент','Я назвал произведение, точно передал деталь и объяснил, что она доказывает.'],
    ['logic','Композиция и логика','Я вижу, как от моего первого утверждения читатель приходит к выводу.'],
    ['speech','Речь','Я перечитал текст вслух и уточнил повторяющиеся или двусмысленные слова.'],
    ['spelling','Грамотность','Я проверил окончания, орфографию и знаки препинания в трудных предложениях.'],
    ['own','Самостоятельность','Я написал текст сам. У заимствованных слов указан источник.']
  ];
  function fresh() {
    return {version:1,mode:'secular',page:'start',route:'quick',active:catalog.topics[0].id,custom:[],notes:{},exercises:{},exercise:catalog.drills[0].id,reading:catalog.readings[0].id,readingNotes:{}};
  }
  let state = fresh();
  let storageOK = true;
  try {
    const data = JSON.parse(localStorage.getItem(storageKey));
    if (data && data.version === 1 && Array.isArray(data.custom) && data.notes && data.exercises) state = {...state,...data};
  } catch { storageOK = false; }
  function allTopics() { return [...catalog.topics,...state.custom]; }
  function topic() { return allTopics().find(t => t.id === state.active) || catalog.topics[0]; }
  function note() {
    const id = topic().id;
    if (!state.notes[id]) state.notes[id] = {work:topic().work || 'own',own:'',thesis:'',args:{},draft:'',checks:{},turns:{},before:null};
    return state.notes[id];
  }
  function argument() {
    const n = note();
    if (!n.args[n.work]) n.args[n.work] = {episode:'',link:''};
    return n.args[n.work];
  }
  function work() { return catalog.works.find(w => w.id === note().work) || null; }
  function selectedTitle() { return work()?.title || note().own || 'Своё произведение'; }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); storageOK = true; } catch { storageOK = false; }
    root.querySelector('#ew-save').textContent = storageOK ? 'Записи сохраняются в этом браузере.' : 'Пока записи только на экране. Скачай их перед закрытием.';
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  const h = escapeHtml;
  const button = (action,title,primary=false) => '<button type="button" data-act="'+h(action)+'"'+(primary?' class="ew-primary"':'')+'>'+h(title)+'</button>';
  const actions = (...buttons) => '<div class="ew-actions">'+buttons.join('')+'</div>';
  function heading(title,desc='',kicker='') {
    return (kicker?'<p class="ew-overline">'+h(kicker)+'</p>':'')+'<h2 id="ew-title" tabindex="-1">'+h(title)+'</h2>'+(desc?'<p class="ew-sub">'+h(desc)+'</p>':'');
  }
  function field(key,label,value,rows=4) {
    return '<div class="ew-field"><label for="ew-write-'+key+'">'+h(label)+'</label><textarea id="ew-write-'+key+'" data-field="'+key+'" rows="'+rows+'">'+h(value)+'</textarea></div>';
  }
  function options(items,active) {
    return items.map(x=>'<option value="'+h(x.id)+'"'+(x.id===active?' selected':'')+'>'+h(x.title)+'</option>').join('');
  }
  function go(page) {
    if (!steps.some(([id])=>id===page)) page = 'start';
    state.page = page;
    render(); save();
    document.getElementById('ew-title')?.focus({preventScroll:true});
    panel.scrollIntoView({block:'nearest'});
  }
  function routeButton(id,name,summary) {
    return '<button class="ew-route" type="button" data-act="route-'+id+'"><span><b>'+h(name)+'</b><small>'+h(summary)+'</small></span><em aria-hidden="true">→</em></button>';
  }
  function start() {
    return heading('С чем нужна помощь?','Выбери задание по тому, что у тебя уже есть.')+'<div class="ew-routes">'+
      routeButton('read','Пока не знаю, о чём писать','Прочитай короткую сцену и запиши одно наблюдение.')+
      routeButton('quick','Помню книгу. Как сделать из неё аргумент?','За один короткий подход — от сцены до её объяснения.')+
      routeButton('full','Хочу написать целое сочинение','Выбери тему, наметь ход мысли и перейди к свободному письму.')+
      routeButton('edit','У меня уже есть черновик','Вставь свой текст, выбери место для правки и сравни две версии.')+
      routeButton('drills','Хочу потренировать одно трудное место','Шесть коротких упражнений на чужих черновиках.')+'</div>';
  }
  function topicScreen() {
    const groups = [...new Set(catalog.topics.map(t=>t.section))];
    const opts = groups.map(g=>'<optgroup label="'+h(g)+'">'+options(catalog.topics.filter(t=>t.section===g),state.active)+'</optgroup>').join('')+
      (state.custom.length?'<optgroup label="Мои темы">'+options(state.custom,state.active)+'</optgroup>':'');
    const bookChoices=catalog.works.map(w=>({id:w.id,title:w.title}));
    return heading('О чём будешь писать?','Можно взять тему учителя или выбрать авторскую тренировочную тему. Формулировки на предстоящем экзамене заранее неизвестны.',routes[state.route])+
      '<label for="ew-topic">Тема сочинения</label><select id="ew-topic">'+opts+'</select><p class="ew-topic">'+h(topic().title)+'</p>'+
      (topic().focus?'<p>'+h(topic().focus)+'</p>':'')+
      '<details><summary>Начать со знакомой книги</summary><div><label for="ew-from-book">Какую книгу ты помнишь?</label><select id="ew-from-book">'+options(bookChoices,topic().work)+'</select><div id="ew-book-topics"></div></div></details>'+
      '<details><summary>Ввести свою тему</summary><div><form id="ew-custom-form"><label for="ew-custom">Формулировка темы</label><input id="ew-custom" required maxlength="500">'+actions('<button class="ew-primary">Работать с этой темой</button>')+'</form></div></details>'+
      actions(button('forward-topic',state.route==='edit'?'Перейти к моему черновику':'Перейти к тезису',true));
  }
  function readingScreen() {
    const r=catalog.readings.find(x=>x.id===state.reading)||catalog.readings[0], w=catalog.works.find(x=>x.id===r.id);
    return heading('Начни с нескольких строк','Прочитай, что происходит в сцене. Запиши деталь, за которую зацепился взгляд. Это заготовка для первого аргумента.')+
      '<label for="ew-reading">Что прочитать?</label><select id="ew-reading">'+options(catalog.readings.map(x=>catalog.works.find(w=>w.id===x.id)),r.id)+'</select>'+
      '<div class="ew-text-card"><p>'+h(r.context)+'</p><p class="ew-topic">«'+h(r.quote)+'»</p><p><a target="_blank" rel="noopener noreferrer" href="'+h(w.url)+'">Прочитать '+h(w.title)+' ↗</a></p></div>'+
      '<p>'+h(r[state.mode])+'</p>'+field('reading','Что я заметил в тексте?',state.readingNotes[r.id]||'')+
      actions(button('reading-apply','Взять сцену для аргумента',true))+'<p class="ew-small" id="ew-reading-status" role="status"></p>';
  }
  function bookTopics() {
    const sel=panel.querySelector('#ew-from-book'),list=panel.querySelector('#ew-book-topics');
    if(!sel||!list)return;
    list.innerHTML=actions(...catalog.topics.filter(t=>t.work===sel.value).map(t=>button('pick-'+t.id,t.title)));
  }
  function context(stage) {
    return {stage,mode:state.mode,topic:topic().title,work:work() || (note().own?{title:note().own}:null),thesis:note().thesis,episode:argument().episode,link:argument().link,draft:note().draft};
  }
  function conversationKey(stage) { return stage+'|'+((stage==='episode'||stage==='link')?note().work:'')+'|'+state.mode; }
  function turns(stage) { return note().turns[conversationKey(stage)] || []; }
  function history(stage) {
    return turns(stage).map(t=>'<div class="ew-turn"><strong>Ты</strong><p>'+h(t.user)+'</p><strong>Помощник</strong><p>'+h(t.assistant)+'</p></div>').join('');
  }
  function revisionRecord(stage) {
    const n = note();
    const key = (stage === 'episode' || stage === 'link') ? stage+'|'+n.work : stage;
    n.revisions ||= {};
    return n.revisions[key] ||= {session:null, last:null};
  }
  function sourceField(stage) {
    return panel.querySelector('#ew-write-'+stage);
  }
  function closeOnlineReview() {
    root.dispatchEvent(new CustomEvent('ew-revision-close'));
  }
  function showRevision(stage, message='') {
    const slot=panel.querySelector('#ew-revision');
    if (!slot) return;
    closeOnlineReview();
    const {session,last}=revisionRecord(stage);
    const source=sourceField(stage).value;
    const current=EssayRevision.matches(session,source);
    const canUndo=last && last.after===source;
    let form='';
    if (session) {
      const question=EssayRevision.question({...context(stage), passage:session.passage});
      const book=work();
      const sourceLink=book ? '<p class="ew-small"><a href="'+h(book.url)+'" target="_blank" rel="noopener noreferrer">Сверить сцену с текстом · '+h(book.title)+'</a></p>' : '';
      form='<div class="ew-coach"><h3>Разбор фразы</h3>'+
        '<p class="ew-topic" id="ew-revision-original">'+h(session.passage)+'</p>'+
        '<p id="ew-revision-question">'+h(question)+'</p>'+sourceLink+
        '<div id="ew-model-help"></div><div class="ew-field"><label for="ew-revision-text">Мой вариант после подсказки</label>'+
        '<textarea id="ew-revision-text" rows="3">'+h(session.proposal)+'</textarea></div>'+
        actions('<button type="button" class="ew-primary" data-act="rev-apply"'+(current?'':' disabled')+'>Внести мою правку</button>',button('rev-close','Закрыть разбор'))+'</div>';
      if (!current) message='Исходный текст изменился. Выдели фразу ещё раз, чтобы внести правку в новое место.';
    }
    slot.innerHTML=actions(button('rev-open','Разобрать фразу'),...(canUndo?[button('rev-undo','Отменить мою правку')]:[]))+
      '<p class="ew-small">Выдели фразу или поставь курсор в нужный абзац.</p>'+
      '<p id="ew-revision-status" class="ew-small" role="status">'+h(message)+'</p>'+form;
    if (current) {
      const book=work();
      root.dispatchEvent(new CustomEvent('ew-revision-open',{detail:{
        stage,mode:state.mode,topic:topic().title,workId:book?.id||'',workTitle:selectedTitle(),passage:session.passage
      }}));
    }
  }
  function updateEditor(stage, value) {
    if (stage==='episode' || stage==='link') argument()[stage]=value;
    else note()[stage]=value;
    if (stage==='draft') {
      note().checks={};
      panel.querySelector('#ew-count').textContent=counter(value);
    }
  }
  function handleRevision(action) {
    const stage=state.page, editor=sourceField(stage), record=revisionRecord(stage);
    if (action==='rev-open') {
      const selection=EssayRevision.select(editor.value,editor.selectionStart,editor.selectionEnd);
      if (selection.message) {
        // Leave a previously typed alternative intact when the new selection is empty.
        const status=panel.querySelector('#ew-revision-status');
        status.textContent=selection.message;editor.focus();return;
      }
      if (!EssayRevision.matches(record.session,editor.value) || selection.start!==record.session.start || selection.end!==record.session.end) {
        record.session=selection;
      }
      save();showRevision(stage);
      panel.querySelector('#ew-revision-text').focus({preventScroll:true});
      panel.querySelector('#ew-revision-original').scrollIntoView({block:'nearest'});
      return;
    }
    if (action==='rev-close') {
      record.session=null;save();showRevision(stage);
      panel.querySelector('[data-act="rev-open"]').focus();return;
    }
    if (action==='rev-apply') {
      const s=record.session;
      if (!EssayRevision.matches(s,editor.value)) {showRevision(stage);return;}
      const change=EssayRevision.replace(s,editor.value,s.proposal);
      if (!change) {
        panel.querySelector('#ew-revision-status').textContent='Впиши собственное изменение в поле «Мой вариант после подсказки».';
        panel.querySelector('#ew-revision-text').focus();return;
      }
      if (stage==='draft' && note().before===null) {
        note().before=editor.value;
        panel.querySelector('#ew-snapshot-status').textContent='Первая версия сохранена. Сравнение доступно в самопроверке.';
      }
      editor.value=change.after;
      updateEditor(stage,change.after);
      record.last=change;record.session=null;
      save();showRevision(stage,'Твоя правка внесена.');
      editor.focus({preventScroll:true});editor.setSelectionRange(change.start,change.start+change.revised.length);
      return;
    }
    if (action==='rev-undo') {
      const last=record.last;
      const before=EssayRevision.undo(last,editor.value);
      if (before===null) {showRevision(stage,'Текст уже изменился.');return;}
      editor.value=before;updateEditor(stage,before);record.last=null;record.session=null;
      save();showRevision(stage,'Исходная фраза возвращена.');
      editor.focus({preventScroll:true});editor.setSelectionRange(last.start,last.start+last.original.length);
    }
  }
  function coach(stage) {
    return '<div class="ew-coach" data-stage="'+stage+'"><h3>Помощник</h3><p class="ew-small">Подсказки работают на устройстве. Выбери трудность или задай короткий вопрос.</p>'+
      actions(...Object.entries(reasons).map(([id,title])=>button('hint-'+id,title)))+
      '<div id="ew-log" aria-live="polite">'+history(stage)+'</div>'+
      '<form id="ew-chat"><div class="ew-field"><label for="ew-message">Твоя реплика помощнику</label><textarea id="ew-message" required maxlength="2000" rows="2"></textarea></div><button>Ответить помощнику</button></form></div>';
  }
  function addTurn(stage,user,assistant) {
    const key=conversationKey(stage);
    (note().turns[key] ||= []).push({user,assistant});
    if (note().turns[key].length>24) note().turns[key].shift();
    save(); const log=panel.querySelector('#ew-log');
    log.innerHTML=history(stage); log.lastElementChild?.scrollIntoView({block:'nearest'});
  }
  function workPicker() {
    const w=work();
    return '<div class="ew-field"><label for="ew-work">Книга для аргумента</label><select id="ew-work">'+options([...catalog.works,{id:'own',title:'Моё произведение'}],note().work)+'</select></div>'+
      (w?'<div class="ew-text-card"><p><strong>'+h(w.title)+'</strong></p><p><a target="_blank" rel="noopener noreferrer" href="'+h(w.url)+'">Прочитать произведение или главу ↗</a></p><details><summary>Вспомнить сцену и получить вопрос</summary><div><p>'+h(w.fact)+'</p><p>'+h(w[state.mode])+'</p></div></details></div>':
      '<div class="ew-field"><label for="ew-own">Автор и название</label><input id="ew-own" data-field="own" value="'+h(note().own)+'"></div>');
  }
  function outline() {
    const parts = [['Тезис',note().thesis],['Эпизод · '+selectedTitle(),argument().episode],['Что доказывает эпизод',argument().link]];
    return '<details><summary>Мои заметки к сочинению</summary><div>'+parts.map(([k,v])=>'<p><strong>'+h(k)+'</strong><br><span class="ew-note">'+h(v||'Пока пусто')+'</span></p>').join('')+'</div></details>';
  }
  function writing(stage) {
    const n=note(), a=argument();
    const copy={
      thesis:['Твой ответ на вопрос темы','Представь, что этот вопрос задал одноклассник. Запиши, что бы ты ему ответил и почему.','Мой тезис',n.thesis],
      episode:['Одна сцена из книги','Выбери произведение, которое помнишь. Запиши одно действие героя и деталь, которую можно сверить с текстом.','Что произошло в этой сцене?',a.episode],
      link:['Что доказывает эпизод?','Представь читателя, который знает сюжет, но ещё не согласен с твоим ответом на тему.','Как деталь помогает обосновать мой тезис?',a.link],
      draft:[state.route==='edit'?'Разбери свой черновик':'Напиши сочинение целиком',state.route==='edit'?'Вставь текст. Сохрани первую версию, затем выбери одну правку, с которой хочешь начать.':'Перед тобой отдельный лист. При необходимости раскрой свой план и попроси подсказку.','Мой текст',n.draft]
    }[stage];
    const previous=stage==='link'?'<div class="ew-text-card"><p><strong>Мой тезис</strong><br>'+h(n.thesis||'Тезис можно дописать на шаге выше.')+'</p><p><strong>Мой эпизод</strong><br>'+h(a.episode||'Можно вернуться к сцене после первой попытки.')+'</p></div>':'';
    const nav={thesis:button('page-episode','Выбрать эпизод',true),episode:button('page-link','Объяснить связь',true),link:state.route==='quick'?button('finish-argument','Собрать мои заметки',true):button('page-draft','Написать черновик',true),draft:button('page-review','Проверить работу',true)}[stage];
    return heading(copy[0],copy[1],routes[state.route])+'<p class="ew-topic">'+h(topic().title)+'</p>'+
      (stage==='episode'?workPicker():'')+previous+
      (stage==='draft'?'<details><summary>Книга для подсказок · '+h(selectedTitle())+'</summary><div>'+workPicker()+'</div></details>'+outline():'')+
      field(stage,copy[2],copy[3],stage==='draft'?12:4)+
      (stage==='draft'?'<p class="ew-counter" id="ew-count"></p>'+actions(button('snapshot','Сохранить версию перед правкой'))+'<p id="ew-snapshot-status" class="ew-small" role="status">'+(n.before!==null?'Первая версия сохранена. Сравнение доступно в самопроверке.':'')+'</p>':'')+
      '<div id="ew-revision"></div>'+actions(nav)+coach(stage);
  }
  function review() {
    const n=note(), quick=state.reviewKind==='argument';
    const text=quick?'Перечитай три записи вместе. Сможет ли читатель по выбранной детали понять, почему ты так ответил на вопрос темы?':'Отметь, что проверил самостоятельно. Помощник может задать вопрос по твоей правке, а окончательную оценку выставляет эксперт.';
    const body=quick?'<div class="ew-text-card"><p><strong>Тезис</strong></p><p class="ew-note">'+h(n.thesis||'Тезис пока пуст.')+'</p><p><strong>'+h(selectedTitle())+'</strong></p><p class="ew-note">'+h(argument().episode||'Эпизод пока пуст.')+'</p><p class="ew-note">'+h(argument().link||'Объяснение пока пусто.')+'</p></div>':
      '<p class="ew-topic">'+h(topic().title)+'</p><p class="ew-small">'+h(counter(n.draft))+'</p><details><summary>Перечитать мой черновик</summary><div class="ew-note">'+h(n.draft||'Можно вставить текст на шаге «Черновик».')+'</div></details>'+
      checklist.map(([key,title,detail])=>'<label class="ew-check"><input type="checkbox" data-check="'+key+'"'+(n.checks[key]?' checked':'')+'><span><strong>'+h(title)+'</strong> · '+h(detail)+'</span></label>').join('')+
      (n.before!==null?'<details><summary>Сравнить версии</summary><div><p><strong>До правки</strong></p><p class="ew-note">'+h(n.before)+'</p><p><strong>После правки</strong></p><p class="ew-note">'+h(n.draft)+'</p></div></details>':'');
    return heading(quick?'Мой литературный аргумент':'Самопроверка',text)+body+
      actions(button('page-draft',quick?'Перейти к полному сочинению':'Вернуться к правке',true),button('download','Скачать мою работу (.txt)'))+
      '<details><summary>Продолжить с диалоговым ИИ-помощником</summary><div><p>Скачай инструкцию с выбранной темой, ракурсом и своими записями. Её можно передать выбранному тобой чат-помощнику. Страница сама ничего не отправляет.</p>'+actions(button('download-prompt','Скачать задание для чата'))+'</div></details>';
  }
  function counter(value) {
    const total=EssayCoach.countWords(value);
    const hint=!total?'':total<250?'До минимального объёма полной работы ещё около '+(250-total)+' сл.':total<350?'Минимальный объём набран. Рекомендуемый ориентир — от 350 слов.':'Рекомендуемый объём набран. Проверь доказательство и переходы.';
    return 'Примерный подсчёт: '+total+' сл. '+hint;
  }
  function drills() {
    const d=catalog.drills.find(x=>x.id===state.exercise)||catalog.drills[0];
    const v=state.exercises[d.id]||'';
    return heading('Потренируй одну правку','Выбери трудность, исправь фрагмент своими словами и сравни свою версию с вопросом для самопроверки.')+
      '<label for="ew-drill">Что потренировать?</label><select id="ew-drill">'+options(catalog.drills,d.id)+'</select><p class="ew-topic">'+h(d.example)+'</p><p>'+h(d.task)+'</p>'+
      '<details><summary>Нужна подсказка</summary><div>'+h(d.hint)+'</div></details>'+
      field('exercise','Моя редакция',v)+actions(button('drill-check','Проверить мою правку',true))+'<p id="ew-drill-feedback" class="ew-tip" role="status"></p>'+actions(button('page-start','К выбору маршрута'));
  }
  function render() {
    closeOnlineReview();
    if (!steps.some(([id])=>id===state.page)) state.page='start';
    menu.innerHTML=steps.map(([id,title],i)=>'<button type="button" data-act="page-'+id+'"'+(state.page===id?' aria-current="step"':'')+'><span aria-hidden="true">'+(i>0&&i<7?i+' ·':'')+'</span>'+title+'</button>').join('');
    mode.value=state.mode==='orthodox'?'orthodox':'secular';
    const pages={start,topic:topicScreen,review,drills,read:readingScreen};
    panel.innerHTML=pages[state.page]?pages[state.page]():writing(state.page);
    if (panel.querySelector('#ew-revision')) showRevision(state.page);
    if(state.page==='topic') bookTopics();
    if(state.page==='draft') panel.querySelector('#ew-count').textContent=counter(note().draft);
  }
  function exportText(withPrompt) {
    const n=note();
    const text=[topic().title,'Ракурс: '+(state.mode==='orthodox'?'православный':'светский'),'Произведение: '+selectedTitle(),'Тезис\n'+n.thesis,'Эпизод\n'+argument().episode,'Объяснение\n'+argument().link,'Сочинение\n'+n.draft];
    if(n.before!==null) text.push('До правки\n'+n.before);
    if(withPrompt) text.unshift(instruction,'Далее — сам черновик ученика. Начни с одного полезного вопроса к этой работе.');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+text.join('\n\n')],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a'); a.href=url; a.download=withPrompt?'zadanie-pomoshchniku.txt':'moe-sochinenie.txt'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  root.addEventListener('input',event=>{
    const el=event.target,key=el.dataset.field;
    if (el.id==='ew-revision-text') {
      const s=revisionRecord(state.page).session;
      if (s) {s.proposal=el.value;save();}
      return;
    }
    if(!key) return;
    if(key==='reading') state.readingNotes[state.reading]=el.value;
    else if(key==='exercise') state.exercises[state.exercise]=el.value;
    else if (['thesis','episode','link','draft'].includes(key)) {
      updateEditor(key,el.value);
      const record=revisionRecord(key);
      if ((record.session && !record.session.stale) || record.last) {
        if (record.session) record.session.stale=true;
        record.last=null;
        showRevision(key);
      }
    } else {
      note()[key]=el.value;
      if (key==='own' && revisionRecord(state.page).session) showRevision(state.page);
    }
    save();
  });
  root.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='ew-from-book'){bookTopics();return;}
    if(el.id==='ew-reading') state.reading=el.value;
    else if(el.id==='ew-mode') state.mode=el.value;
    else if(el.id==='ew-topic') state.active=el.value;
    else if(el.id==='ew-work') note().work=el.value;
    else if(el.id==='ew-drill') state.exercise=el.value;
    else if(el.dataset.check){note().checks[el.dataset.check]=el.checked;save();return;}
    else return;
    render(); save();
    if(el.id!=='ew-mode') panel.querySelector('#'+el.id)?.focus({preventScroll:true});
  });
  root.addEventListener('submit',event=>{
    event.preventDefault();
    if(event.target.id==='ew-custom-form'){
      const title=panel.querySelector('#ew-custom').value.trim(); if(!title)return;
      let t=allTopics().find(x=>x.title===title);
      if(!t){t={id:'custom-'+Date.now().toString(36),title,work:'own'};state.custom.push(t);}
      state.active=t.id; go(state.route==='edit'?'draft':'thesis');return;
    }
    if(event.target.id==='ew-chat'){
      const input=panel.querySelector('#ew-message'), message=input.value.trim(); if(!message)return;
      const stage=panel.querySelector('[data-stage]').dataset.stage;
      const answer=EssayCoach.reply(context(stage),message,turns(stage).at(-1));
      input.value='';addTurn(stage,message,answer);input.focus({preventScroll:true});
    }
  });
  root.addEventListener('click',event=>{
    const b=event.target.closest('button[data-act]');if(!b)return;
    const action=b.dataset.act;
    if(action.startsWith('rev-')) {handleRevision(action);return;}
    if(action==='reading-apply'){
      const r=catalog.readings.find(x=>x.id===state.reading),detail=(state.readingNotes[r.id]||'').trim();
      if(!detail){panel.querySelector('#ew-reading-status').textContent='Запиши хотя бы одну деталь в поле выше.';return;}
      state.active=r.topic;state.route='quick';note().work=r.id;
      const a=argument();
      if(!a.episode.includes(detail)) a.episode=[a.episode,detail].filter(Boolean).join('\n');
      go('thesis');return;
    }
    if(action.startsWith('pick-')){state.active=action.slice(5);go(state.route==='edit'?'draft':'thesis');return;}
    if(action.startsWith('page-')){if(action==='page-review')state.reviewKind='draft';go(action.slice(5));return;}
    if(action.startsWith('route-')){
      const route=action.slice(6);
      if(route==='drills'||route==='read'){go(route);return;}
      state.route=route;go('topic');return;
    }
    if(action.startsWith('hint-')){
      const stage=panel.querySelector('[data-stage]').dataset.stage, reason=action.slice(5);
      addTurn(stage,reasons[reason],EssayCoach.advise({...context(stage),reason}));return;
    }
    if(action==='forward-topic'){go(state.route==='edit'?'draft':'thesis');return;}
    if(action==='finish-argument'){state.reviewKind='argument';go('review');return;}
    if(action==='download'||action==='download-prompt'){exportText(action==='download-prompt');return;}
    if(action==='drill-check'){
      const d=catalog.drills.find(x=>x.id===state.exercise);
      panel.querySelector('#ew-drill-feedback').textContent=state.exercises[d.id]?.trim()?d.check:'Напиши хотя бы одну свою фразу, затем открой вопрос для сверки.';return;
    }
    if(action==='snapshot'){
      const n=note(), status=panel.querySelector('#ew-snapshot-status');
      if(!n.draft.trim()){status.textContent='Сначала вставь или напиши текст.';return;}
      if(n.before!==null){status.textContent='Первая версия уже есть. Открой «Сравнить версии» в самопроверке.';return;}
      n.before=n.draft;save();status.textContent='Первая версия сохранена. Теперь внеси правку. Сравнить тексты можно в самопроверке.';
    }
  });
  render();save();
})();
