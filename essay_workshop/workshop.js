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
  const intentChoices = {thesis:'Сформулировать свою мысль',scene:'Вспомнить сцену',explain:'Объяснить, что доказывает сцена',wording:'Исправить фразу',counter:'Рассмотреть возражение'};
  steps.push(['read','Первое чтение']);
  steps.push(['rehearsal','Репетиция']);
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
  function lensLabel() { return state.mode==='orthodox'?'православный комментарий к тексту':'литературный разбор'; }
  function readerQuestionKey() {
    return note().work==='own'?'readerQuestion:'+(note().own||'').trim().toLowerCase():'readerQuestion';
  }
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
    return '<div class="ew-field"><label for="ew-write-'+key+'">'+h(label)+'</label><textarea id="ew-write-'+key+'" data-field="'+key+'" rows="'+rows+'">\n'+h(value)+'</textarea></div>';
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
      routeButton('rehearsal','Репетиция без подсказок','Открой шесть тем и напиши работу самостоятельно. Таймер включается по желанию.')+
      routeButton('edit','У меня уже есть черновик','Вставь свой текст, выбери место для правки и сравни две версии.')+
      routeButton('drills','Хочу потренировать одно трудное место','Шесть коротких упражнений на чужих черновиках.')+'</div>'+
      '<p class="ew-small"><a href="https://usel-toski-po-miru.art/k-sochineniyu/itogovoe/pomoshchnik/trenazher-gigachat.zip">Для родителей · скачать тренажёр с подключением своего GigaChat API (ZIP)</a></p>';
  }
  function topicScreen() {
    const groups = [...new Set(catalog.topics.map(t=>t.section))];
    const opts = groups.map(g=>'<optgroup label="'+h(g)+'">'+options(catalog.topics.filter(t=>t.section===g),state.active)+'</optgroup>').join('')+
      (state.custom.length?'<optgroup label="Мои темы">'+options(state.custom,state.active)+'</optgroup>':'');
    const bookChoices=catalog.works.map(w=>({id:w.id,title:w.title}));
    let examChoice='';
    if (state.route==='full') {
      const activeSet=state.practiceSet===1?1:0;
      const sets=[0,1].map(set=>{
        const topics=groups.flatMap(group=>catalog.topics.filter(t=>t.section===group).slice(2*set,2*set+2));
        const choices=topics.map((t,index)=>'<label class="ew-check"><input type="radio" required name="practice-'+set+'" value="'+h(t.id)+'"><span>'+String(index+1)+'. '+h(t.title)+'</span></label>').join('');
        return '<fieldset data-exam-set="'+set+'"'+(set===activeSet?'':' hidden disabled')+'><legend>Какую тему возьмёшь?</legend>'+choices+'</fieldset>';
      }).join('');
      examChoice='<details id="ew-exam-choice"><summary>Попробовать экзаменационный выбор</summary><div><p>В каждом комплекте шесть авторских тем «Узла», по две из каждого раздела ФИПИ. Выбери одну тему, для которой ты помнишь конкретный поступок, разговор или деталь из книги.</p>'+
        '<form id="ew-exam-form"><label for="ew-exam-set">Тренировочный комплект</label><select id="ew-exam-set">'+options([{id:'0',title:'Комплект 1'},{id:'1',title:'Комплект 2'}],String(activeSet))+'</select>'+
        sets+actions('<button class="ew-primary">Выбрать тему и перейти к тезису</button>')+'</form></div></details>';
    }
    return heading('О чём будешь писать?','Можно взять тему учителя или выбрать авторскую тренировочную тему. Формулировки на предстоящем экзамене заранее неизвестны.',routes[state.route])+
      examChoice+
      '<label for="ew-topic">Тема сочинения</label><select id="ew-topic">'+opts+'</select><p class="ew-topic">'+h(topic().title)+'</p>'+
      (topic().focus && note().work===topic().work?'<p>'+h(topic().focus)+'</p>':'')+
      (work() && note().work!==topic().work?'<p>Книга для этой темы · '+h(selectedTitle())+'</p>':'')+
      (note().work==='own'?ownBookField()+(topic().work && topic().work!=='own'?actions(button('restore-topic-book','Вернуться к книге из карточки темы')):''):actions(button('choose-own-book','Взять своё произведение')))+
      '<details><summary>Начать со знакомой книги</summary><div><label for="ew-from-book">Какую книгу ты помнишь?</label><select id="ew-from-book">'+options(bookChoices,work()?.id||topic().work)+'</select><div id="ew-book-topics"></div></div></details>'+
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
    const themes=catalog.topics.filter(t=>t.work===sel.value);
    list.innerHTML=themes.length?actions(...themes.map(t=>button('pick-'+t.id,t.title))):actions(button('use-from-book','Взять эту книгу для моей темы'));
  }
  function context(stage) {
    return {stage,mode:state.mode,topic:topic().title,work:work() || (note().own?{title:note().own}:null),thesis:note().thesis,episode:argument().episode,link:argument().link,draft:note().draft,draftHeading:note().draftHeading};
  }
  function conversationKey(stage) { return stage+'|'+((stage==='episode'||stage==='link')?note().work:'')+'|'+state.mode; }
  function turns(stage) { return note().turns[conversationKey(stage)] || []; }
  function history(stage) {
    return turns(stage).map((t,i,list)=>{
      const controls=t.exam===true?'<p class="ew-small"><a target="_blank" rel="noopener noreferrer" href="https://doc.fipi.ru/itogovoe-sochinenie/2026/04_Kriterii_it_soch.pdf">Проверить по критериям ФИПИ, с. 1–2 (PDF)</a></p>'+button('focus-writing','Вернуться к своей записи'):'';
      let next='';
      if(i===list.length-1 && t.chooseIntent===true) next=actions(...Object.entries(intentChoices).map(([id,title])=>button('intent-'+id,title)));
      if(i===list.length-1 && t.selectedIntent===true) next=button('focus-writing','Вернуться к своей записи');
      return '<div class="ew-turn"><strong>Ты</strong><p>'+h(t.user)+'</p><strong>Помощник</strong><p>'+h(t.assistant)+'</p>'+controls+next+'</div>';
    }).join('');
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
  function gigaChatHandOff(passage) {
    const prompt=[
      'Помоги мне подготовиться к итоговому сочинению.',
      'Тема: '+topic().title,
      'Книга: '+selectedTitle(),
      'Тип подсказки к тексту: '+lensLabel(),
      'Моя фраза: «'+passage+'»',
      'Задай один короткий вопрос, который поможет мне уточнить эту фразу с опорой на книгу. Свой вариант я напишу самостоятельно.'
    ].join('\n');
    return '<details id="ew-giga-handoff"><summary>Спросить в своём ГигаЧате</summary><div>'+
      '<label for="ew-giga-prompt">Задание для чата · можно изменить перед копированием</label>'+
      '<textarea id="ew-giga-prompt" rows="4">'+h(prompt)+'</textarea>'+
      actions(button('copy-giga-prompt','Скопировать задание'),'<a href="https://giga.chat/" target="_blank" rel="noopener noreferrer">Открыть ГигаЧат ↗</a>')+
      '<p id="ew-giga-copy-status" class="ew-small" role="status"></p>'+
      '<p>Вставь задание в чат. Прочитай вопрос помощника и вернись сюда, чтобы вписать свою правку.</p>'+
      '<p class="ew-small">Если тебе ещё нет 18 лет, пользуйся ГигаЧатом с согласия и под контролем родителя или другого законного представителя, который принял условия сервиса. <a href="https://developers.sber.ru/docs/ru/policies/gigachat/agreement" target="_blank" rel="noopener noreferrer">Условия ГигаЧата, пункт 3.1</a></p>'+
      '</div></details>';
  }
  async function copyGigaPrompt() {
    const input=panel.querySelector('#ew-giga-prompt');
    const status=panel.querySelector('#ew-giga-copy-status');
    if (!input || !status) return;
    if (!input.value.trim()) {status.textContent='Впиши задание, которое хочешь скопировать.';input.focus();return;}
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent='Задание скопировано. Его можно вставить в ГигаЧат.';
    } catch {
      if (!input.isConnected) return;
      input.focus();input.select();
      status.textContent='Текст выделен. Нажми Ctrl+C, ⌘C или выбери «Копировать» в меню телефона.';
    }
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
        '<div id="ew-model-help"></div>'+(current?gigaChatHandOff(session.passage):'')+'<div class="ew-field"><label for="ew-revision-text">Мой вариант после подсказки</label>'+
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
    const current=note();
    if (stage==='draft' && value!==current.draft && current.evidence) {
      for (const mark of Object.values(current.evidence)) mark.stale=true;
    }
    if (stage==='episode' || stage==='link') argument()[stage]=value;
    else note()[stage]=value;
    if (stage==='draft') {
      note().checks={};
      updateCounter();
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
  function addTurn(stage,user,answer) {
    const key=conversationKey(stage);
    (note().turns[key] ||= []).push({user,...answer});
    if (note().turns[key].length>24) note().turns[key].shift();
    save(); const log=panel.querySelector('#ew-log');
    log.innerHTML=history(stage); log.lastElementChild?.scrollIntoView({block:'nearest'});
  }
  function ownBookField() {
    return '<div class="ew-field"><label for="ew-own">Название произведения и автор, если он известен</label><input id="ew-own" data-field="own" value="'+h(note().own)+'"><p class="ew-small">Подойдёт и текст, которого нет в подборке. Если сомневаешься в детали, сверь эпизод с опубликованным текстом.</p></div>';
  }
  function workPicker() {
    const w=work();
    return '<div class="ew-field"><label for="ew-work">Книга для аргумента</label><select id="ew-work">'+options([...catalog.works,{id:'own',title:'Моё произведение'}],note().work)+'</select></div>'+
      (w?'<div class="ew-text-card"><p><strong>'+h(w.title)+'</strong></p><p><a target="_blank" rel="noopener noreferrer" href="'+h(w.url)+'">Прочитать произведение или главу ↗</a></p><details><summary>Вспомнить сцену и получить вопрос</summary><div><p>'+h(w.fact)+'</p><p>'+h(w[state.mode])+'</p></div></details></div>':
      ownBookField());
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
    const question=a[readerQuestionKey()]||'';
    const readerQuestion='<details'+(question?' open':'')+'><summary>Мой вопрос к эпизоду</summary><div>'+field('readerQuestion','Что в этом эпизоде ты хочешь понять?',question,2)+'</div></details>';
    const previous=stage==='link'?'<div class="ew-text-card"><p><strong>Мой тезис</strong><br>'+h(n.thesis||'Тезис можно дописать на шаге выше.')+'</p><p><strong>Мой эпизод</strong><br>'+h(a.episode||'Можно вернуться к сцене после первой попытки.')+'</p>'+(question?'<p><strong>Мой вопрос к эпизоду</strong><br>'+h(question)+'</p>':'')+'</div>':'';
    const nav={thesis:button('page-episode','Выбрать эпизод',true),episode:button('page-link','Объяснить связь',true),link:state.route==='quick'?button('finish-argument','Собрать мои заметки',true):button('page-draft','Написать черновик',true),draft:button('page-review','Проверить работу',true)}[stage];
    return heading(copy[0],copy[1],routes[state.route])+'<p class="ew-topic">'+h(topic().title)+'</p>'+
      (stage==='episode'?workPicker()+readerQuestion:'')+previous+
      (stage==='draft'?'<details><summary>Книга для подсказок · '+h(selectedTitle())+'</summary><div>'+workPicker()+'</div></details>'+outline()+readerQuestion:'')+
      field(stage,copy[2],copy[3],stage==='draft'?12:4)+
      (stage==='draft'?'<p class="ew-counter" id="ew-count"></p>'+countOptions()+actions(button('snapshot','Сохранить версию перед правкой'))+'<p id="ew-snapshot-status" class="ew-small" role="status">'+(n.before!==null?'Первая версия сохранена. Сравнение доступно в самопроверке.':'')+'</p>':'')+
      '<div id="ew-revision"></div>'+actions(nav)+coach(stage);
  }
  const evidenceTasks = {
    position:{title:'Мой ответ на вопрос темы',criterion:'К1',hint:'Что ты сам отвечаешь на вопрос темы? Сформулируй ответ в одном предложении.'},
    detail:{title:'Деталь из произведения',criterion:'К2',hint:'Вернись к книге. Какой поступок, реплика или деталь служит примером для твоей мысли?'},
    reasoning:{title:'Почему деталь доказывает мысль',criterion:'К2',hint:'Что становится понятно из выбранной детали? Свяжи её с собственным ответом на тему.'}
  };
  function evidenceIsCurrent(mark,draft) {
    return mark && !mark.stale && !mark.missing && draft.replace(/\r\n?/g,'\n').slice(mark.start,mark.end)===mark.quote;
  }
  function evidenceFindings(n) {
    return Object.entries(evidenceTasks).map(([key,task])=>{
      const mark=n.evidence?.[key];
      if(!mark)return '';
      const current=evidenceIsCurrent(mark,n.draft);
      const feedback=current?'<p class="ew-note">«'+h(mark.quote)+'»</p>':
        '<p>'+(mark.stale?'Текст изменился. Отметь фразу заново.':'Пока не нашёл. '+h(task.hint))+'</p>';
      return '<div class="ew-text-card" data-evidence-result="'+key+'"><strong>'+task.title+'</strong>'+feedback+
        actions(button('evidence-edit-'+key,current?'Править эту фразу':'Перейти к правке'))+'</div>';
    }).join('');
  }
  function evidenceScreen(n) {
    const tasks=Object.entries(evidenceTasks).map(([id,t])=>({id,title:t.criterion+' · '+t.title}));
    const pending=tasks.find(t=>!n.evidence?.[t.id] || n.evidence[t.id].stale)?.id;
    return '<section aria-labelledby="ew-evidence-title"><h3 id="ew-evidence-title">Проверь, чем ты доказал свою мысль</h3>'+
      '<label for="ew-evidence-kind">Что ищешь в своей работе?</label><select id="ew-evidence-kind">'+options(tasks,pending)+'</select>'+
      '<div class="ew-field"><label for="ew-evidence-draft">Выдели нужные слова в черновике</label>'+
      '<textarea id="ew-evidence-draft" readonly rows="7">\n'+h(n.draft)+'</textarea></div>'+
      actions(button('evidence-mark','Отметить выделенную фразу',true),button('evidence-missing','Пока не нашёл'))+
      '<p role="status" id="ew-evidence-status"></p><div id="ew-evidence-results">'+evidenceFindings(n)+'</div></section>';
  }
  function handleEvidence(action) {
    if(action==='evidence-start'){
      go('draft');
      sourceField('draft').focus();
      return;
    }
    const n=note(), select=panel.querySelector('#ew-evidence-kind');
    if(!select)return;
    if(action.startsWith('evidence-edit-')){
      const key=action.slice('evidence-edit-'.length);
      if(!Object.hasOwn(evidenceTasks,key))return;
      const mark=n.evidence?.[key];
      go('draft');
      const editor=sourceField('draft');
      const current=evidenceIsCurrent(mark,editor.value);
      const previous=n.evidence?.[key==='reasoning'?'detail':'position'];
      let caret=editor.value.length;
      if(key==='position')caret=0;
      else if(evidenceIsCurrent(previous,editor.value))caret=previous.end;
      editor.focus();
      editor.setSelectionRange(current?mark.start:caret,current?mark.end:caret);
      const help=document.createElement('p');
      help.className='ew-tip'; help.id='ew-evidence-edit-hint';
      help.textContent=evidenceTasks[key].hint;
      editor.setAttribute('aria-describedby',help.id);
      editor.before(help);
      return;
    }
    const key=select.value, task=evidenceTasks[key];
    const source=panel.querySelector('#ew-evidence-draft'), status=panel.querySelector('#ew-evidence-status');
    const missing=action==='evidence-missing';
    let start=source.selectionStart, end=source.selectionEnd;
    const selected=source.value.slice(start,end);
    if(!missing && !selected.trim()){
      status.textContent='Сначала выдели фразу в тексте. На телефоне нажми на слово и растяни границы выделения.';
      source.focus();return;
    }
    start+=selected.length-selected.trimStart().length;
    end=start+selected.trim().length;
    n.evidence ||= {};
    n.evidence[key]=missing?{missing:true}:{start,end,quote:source.value.slice(start,end)};
    save();
    panel.querySelector('#ew-evidence-results').innerHTML=evidenceFindings(n);
    const next=Object.keys(evidenceTasks).find(id=>!n.evidence[id] || n.evidence[id].stale);
    if(next)select.value=next;
    source.setSelectionRange(end,end);
    const message=missing?'Отмечено «Пока не нашёл».':'Отметка «'+task.title+'» добавлена.';
    status.textContent=message+(next?' Следующий шаг — «'+evidenceTasks[next].title+'».':' Перечитай свои отметки и выбери место для правки.');
  }
  function review() {
    const n=note(), quick=state.reviewKind==='argument';
    if(!quick && !n.draft.trim()){
      return heading('Самопроверка','Напиши или вставь хотя бы один свой абзац. Тогда сможешь найти в нём ответ на тему и литературное доказательство.')+
        '<p class="ew-topic">'+h(topic().title)+'</p>'+actions(button('evidence-start','Открыть мой черновик',true));
    }
    const text=quick?'Перечитай три записи вместе. Сможет ли читатель по выбранной детали понять, почему ты так ответил на вопрос темы?':'Найди в своём тексте ответ на вопрос темы, пример из книги и объяснение. Если чего-то пока нет, вернись к этому месту и допиши.';
    const body=quick?'<div class="ew-text-card"><p><strong>Тезис</strong></p><p class="ew-note">'+h(n.thesis||'Тезис пока пуст.')+'</p><p><strong>'+h(selectedTitle())+'</strong></p><p class="ew-note">'+h(argument().episode||'Эпизод пока пуст.')+'</p><p class="ew-note">'+h(argument().link||'Объяснение пока пусто.')+'</p></div>':
      '<p class="ew-topic">'+h(topic().title)+'</p><p class="ew-small">'+h(counter(n.draft))+'</p>'+evidenceScreen(n)+
      checklist.map(([key,title,detail])=>'<label class="ew-check"><input type="checkbox" data-check="'+key+'"'+(n.checks[key]?' checked':'')+'><span><strong>'+h(title)+'</strong> · '+h(detail)+'</span></label>').join('')+
      (n.before!==null?'<details><summary>Сравнить версии</summary><div><p><strong>До правки</strong></p><p class="ew-note">'+h(n.before)+'</p><p><strong>После правки</strong></p><p class="ew-note">'+h(n.draft)+'</p></div></details>':'');
    return heading(quick?'Мой литературный аргумент':'Самопроверка',text)+body+
      actions(button('page-draft',quick?'Перейти к полному сочинению':'Вернуться к правке',true),button('download','Скачать мою работу (.txt)'))+
      externalPacket();
  }
  function counter(value) {
    const total=EssayCoach.countWords(value,note().draftHeading);
    const hint=!total?'':total<250?'До минимального объёма полной работы ещё около '+(250-total)+' сл.':total<350?'Минимальный объём набран. Рекомендуемый ориентир — от 350 слов.':'Рекомендуемый объём набран. Проверь доказательство и переходы.';
    return 'Примерный подсчёт: '+total+' сл. '+(note().draftHeading?'Заголовок исключён. ':'')+hint;
  }
  function countOptions() {
    return '<details><summary>Как считать слова и убрать заголовок из подсчёта</summary><div>'+
      '<label class="ew-check"><input type="checkbox" id="ew-draft-heading"><span>Первая непустая строка моего черновика — отдельный заголовок с темой.</span></label>'+
      '<p>Если вопрос темы входит во вступление, оставь отметку пустой. Слова цитаты и служебные слова входят в объём. «Всё-таки» — одно слово, «всё же» — два. «5 лет» — одно слово. Инициалы и фамилия считаются одним словом.</p>'+
      '<p><a href="https://doc.fipi.ru/itogovoe-sochinenie/mr_organizacia_it_sochineniya_2026-27.pdf#page=29" target="_blank" rel="noopener noreferrer">Правила подсчёта · пункт 5.2.3, с. 29–30</a></p></div></details>';
  }
  function updateCounter() {
    const n=note();
    const firstLine=EssayCoach.firstDraftLine(n.draft);
    if (n.draftHeading && firstLine!==n.draftHeading) n.draftHeading='';
    const checkbox=panel.querySelector('#ew-draft-heading');
    checkbox.disabled=!firstLine;
    checkbox.checked=Boolean(n.draftHeading);
    panel.querySelector('#ew-count').textContent=counter(n.draft);
  }
  function drills() {
    const d=catalog.drills.find(x=>x.id===state.exercise)||catalog.drills[0];
    const v=state.exercises[d.id]||'';
    return heading('Потренируй одну правку','Выбери трудность, исправь фрагмент своими словами и сравни свою версию с вопросом для самопроверки.')+
      '<label for="ew-drill">Что потренировать?</label><select id="ew-drill">'+options(catalog.drills,d.id)+'</select><p class="ew-topic">'+h(d.example)+'</p><p>'+h(d.task)+'</p>'+
      '<details><summary>Нужна подсказка</summary><div>'+h(d.hint)+'</div></details>'+
      field('exercise','Моя редакция',v)+actions(button('drill-check','Проверить мою правку',true))+'<p id="ew-drill-feedback" class="ew-tip" role="status"></p>'+actions(button('page-start','К выбору маршрута'));
  }
  function reviewRehearsal({title,draft,attemptId}) {
    const id='rehearsal-'+attemptId;
    const firstVisit=!state.custom.some(t=>t.id===id);
    if (firstVisit) state.custom.push({id,title,work:'own'});
    state.active=id;
    state.route='edit';
    state.reviewKind='draft';
    if (firstVisit) {
      note().draft=draft;
      note().before=draft;
    }
    go('review');
  }
  function render() {
    EssayRehearsal.unmount();
    closeOnlineReview();
    if (!steps.some(([id])=>id===state.page)) state.page='start';
    menu.innerHTML=steps.map(([id,title],i)=>'<button type="button" data-act="page-'+id+'"'+(state.page===id?' aria-current="step"':'')+'><span aria-hidden="true">'+(i>0&&i<7?i+' ·':'')+'</span>'+title+'</button>').join('');
    mode.value=state.mode==='orthodox'?'orthodox':'secular';
    root.classList.toggle('ew-in-rehearsal',state.page==='rehearsal');
    const pages={start,topic:topicScreen,review,drills,read:readingScreen,rehearsal:EssayRehearsal.render};
    panel.innerHTML=pages[state.page]?pages[state.page]():writing(state.page);
    if (state.page==='rehearsal') EssayRehearsal.mount(panel,catalog,reviewRehearsal);
    if (panel.querySelector('#ew-revision')) showRevision(state.page);
    if(state.page==='topic') bookTopics();
    if(state.page==='draft') updateCounter();
  }
  function externalPacket() {
    const previous = note().before
      ? '<label class="ew-check"><input type="checkbox" id="ew-share-before" autocomplete="off"><span>Добавить первую версию для сравнения в этот файл</span></label>'
      : '';
    return '<details><summary>Продолжить с диалоговым ИИ-помощником</summary><div>'+
      '<p>В файл войдут инструкция помощнику, тема, тип подсказки, книга, тезис, эпизод, объяснение и весь текущий черновик. Просмотри текст, затем скачай его и сам передай в выбранный чат. Для обсуждения одной фразы выдели её в черновике и нажми «Разобрать фразу».</p>'+
      previous+'<label for="ew-packet-preview">Точный текст файла для чата</label>'+
      '<textarea id="ew-packet-preview" rows="8" readonly>'+h(composeExport(true, false))+'</textarea>'+
      actions(button('download-prompt','Скачать задание для чата'))+'<p id="ew-packet-status" class="ew-small" role="status"></p></div></details>';
  }
  function composeExport(withPrompt, includeBefore) {
    const n=note();
    const text=[topic().title,'Тип подсказки к тексту: '+lensLabel(),'Произведение: '+selectedTitle(),'Тезис\n'+n.thesis,'Эпизод\n'+argument().episode,'Объяснение\n'+argument().link,'Сочинение\n'+n.draft];
    const question=argument()[readerQuestionKey()];
    if (!withPrompt && question) text.push('Мой вопрос к эпизоду\n'+question);
    if(includeBefore && n.before) text.push('До правки\n'+n.before);
    if(withPrompt) text.unshift(instruction,'Далее — сам черновик ученика. Начни с одного полезного вопроса к этой работе.');
    return text.join('\n\n');
  }
  function exportText(withPrompt) {
    const preview=panel.querySelector('#ew-packet-preview');
    const text=withPrompt?preview.value:'\uFEFF'+composeExport(false,true);
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a'); a.href=url; a.download=withPrompt?'zadanie-pomoshchniku.txt':'moe-sochinenie.txt'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    if(!withPrompt) return;
    const previous=panel.querySelector('#ew-share-before');
    const status=panel.querySelector('#ew-packet-status');
    status.textContent='Файл для чата подготовлен.';
    if(previous?.checked){
      previous.checked=false;
      preview.value=composeExport(true,false);
      status.textContent='Первая версия включена в этот файл. Для следующего скачивания её можно выбрать снова.';
    }
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
    else if(key==='readerQuestion') argument()[readerQuestionKey()]=el.value;
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
      if (key==='own'){
        const question=sourceField('readerQuestion');
        if (question) question.value=argument()[readerQuestionKey()]||'';
        if (panel.querySelector('#ew-revision') && revisionRecord(state.page).session) showRevision(state.page);
      }
    }
    save();
  });
  root.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='ew-share-before'){
      panel.querySelector('#ew-packet-preview').value=composeExport(true,el.checked);
      panel.querySelector('#ew-packet-status').textContent='';
      return;
    }
    if(el.id==='ew-exam-set'){
      state.practiceSet=Number(el.value);
      for(const choices of el.form.querySelectorAll('[data-exam-set]')){
        choices.hidden=choices.disabled=choices.dataset.examSet!==el.value;
      }
      save();return;
    }
    if(el.id==='ew-draft-heading'){
      note().draftHeading=el.checked?EssayCoach.firstDraftLine(note().draft):'';
      updateCounter();save();return;
    }
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
    if(event.target.id==='ew-exam-form'){
      const choice=event.target.querySelector('fieldset:enabled input:checked');
      if(choice){state.active=choice.value;go('thesis');}
      return;
    }
    if(event.target.id==='ew-custom-form'){
      const title=panel.querySelector('#ew-custom').value.trim(); if(!title)return;
      let t=allTopics().find(x=>x.title===title);
      if(!t){t={id:'custom-'+Date.now().toString(36),title,work:'own'};state.custom.push(t);}
      state.active=t.id; go(state.route==='edit'?'draft':'thesis');return;
    }
    if(event.target.id==='ew-chat'){
      const input=panel.querySelector('#ew-message'), message=input.value.trim(); if(!message)return;
      const stage=panel.querySelector('[data-stage]').dataset.stage;
      const answer=EssayCoach.respond(context(stage),message,turns(stage).at(-1));
      input.value='';addTurn(stage,message,answer);input.focus({preventScroll:true});
    }
  });
  root.addEventListener('click',event=>{
    const b=event.target.closest('button[data-act]');if(!b)return;
    const action=b.dataset.act;
    if(action.startsWith('evidence-')){handleEvidence(action);return;}
    if(action==='use-from-book'){
      note().work=panel.querySelector('#ew-from-book').value;
      render();save();panel.querySelector('#ew-topic').focus({preventScroll:true});return;
    }
    if(action==='choose-own-book'||action==='restore-topic-book'){
      const own=action==='choose-own-book';
      note().work=own?'own':topic().work;
      render();save();panel.querySelector(own?'#ew-own':'[data-act="choose-own-book"]')?.focus({preventScroll:true});return;
    }
    if(action==='focus-writing'){sourceField(state.page)?.focus();return;}
    if(action.startsWith('intent-')){
      const choice=action.slice(7);
      if(!Object.hasOwn(intentChoices,choice) || turns(state.page).at(-1)?.chooseIntent!==true) return;
      addTurn(state.page,intentChoices[choice],{assistant:EssayCoach.intentFeedback(choice,context(state.page)),selectedIntent:true});
      panel.querySelector('#ew-log .ew-turn:last-child button')?.focus({preventScroll:true});
      return;
    }
    if(action==='copy-giga-prompt') {void copyGigaPrompt();return;}
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
      if(route==='drills'||route==='read'||route==='rehearsal'){go(route);return;}
      state.route=route;go('topic');return;
    }
    if(action.startsWith('hint-')){
      const stage=panel.querySelector('[data-stage]').dataset.stage, reason=action.slice(5);
      addTurn(stage,reasons[reason],{assistant:EssayCoach.advise({...context(stage),reason})});return;
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
