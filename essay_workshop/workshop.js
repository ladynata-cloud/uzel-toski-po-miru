(() => {
  'use strict';
  const root = document.getElementById('essay-workshop');
  const catalog = JSON.parse(document.getElementById('ew-catalog').textContent);
  const instruction = JSON.parse(document.getElementById('ew-system').textContent);
  const panel = root.querySelector('#ew-current');
  const menu = root.querySelector('#ew-steps');
  const practiceScreen = root.querySelector('#ew-practice-screen');
  const mode = root.querySelector('#ew-mode');
  const storageKey = 'uzel.essay-workshop.v1';
  const steps = [['start','Старт'],['topic','Тема'],['thesis','Тезис'],['episode','Эпизод'],['link','Аргумент'],['draft','Черновик'],['review','Самопроверка'],['drills','Упражнения']];
  const reasons = {stuck:'Не знаю, с чего начать',clarify:'Уточнить мысль',retell:'Получился пересказ',check:'На что посмотреть?'};
  const intentChoices = {thesis:'Сформулировать свою мысль',scene:'Вспомнить сцену',explain:'Объяснить, что доказывает сцена',wording:'Исправить фразу',counter:'Рассмотреть возражение'};
  steps.push(['read','Первое чтение']);
  steps.push(['library','Книжная полка'],['shelf','Моя полка'],['themeAtlas','Библиотека тем']);
  steps.push(['rehearsal','Репетиция']);
  steps.push(['thesisLab','Уточнить тезис']);
  steps.push(['draftReader','Разметить черновик'],['paragraphTrial','Абзац на новую тему'],['writingPractice','От темы до вывода']);
  const routes = {quick:'Собрать аргумент',full:'Написать сочинение',edit:'Разобрать мой черновик',draftReader:'Разметить мой черновик'};
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
  state.mode = EssayReadingLens.restore(state.mode);
  function changeLens(next, publish) {
    if (!EssayReadingLens.valid(next)) return;
    const changed = state.mode !== next;
    state.mode = mode.value = next;
    EssayReadingLens.select(next, publish);
    if (!changed) return;
    if (['rehearsal','shelf','paragraphTrial','thesisLab','themeAtlas','writingPractice'].includes(state.page)) {
      EssayReadingLens.refresh(panel);
      if (state.page==='writingPractice') window.dispatchEvent(new CustomEvent('essay-practice-lens'));
    } else {
      // Preserve a question that has been typed but has not been submitted yet.
      const previousMessage = panel.querySelector('#ew-message')?.value;
      render();
      const message = panel.querySelector('#ew-message');
      if (message && previousMessage) message.value = previousMessage;
    }
    save();
  }
  window.addEventListener('uzel-reading-lens', event => changeLens(event.detail?.mode, false));
  window.addEventListener('storage', event => {
    if (event.key === EssayReadingLens.key) changeLens(event.newValue, false);
  });
  function allTopics() { return [...catalog.topics,...state.custom]; }
  function topic() { return allTopics().find(t => t.id === state.active) || catalog.topics[0]; }
  const publicTopics = new Map(catalog.publicTopics.topics.map(t=>['public-topic-'+t.id,t]));
  const titleKey = title => title.trim().toLocaleLowerCase('ru').replace(/ё/gu,'е').replace(/\s+/gu,' ');
  const knownTitles = new Map([...catalog.publicTopics.topics,...catalog.topics].map(t=>[titleKey(t.title),t]));
  const worksById = new Map(catalog.works.map(w=>[w.id,w]));
  const scenesByCard = new Map(Object.values(catalog.bookRoutes).filter(r=>r.card).map(r=>[r.card,r]));
  function recommendations(t=topic()) {
    const known = publicTopics.get(t.id) || (t.bookRoutes ? t : knownTitles.get(titleKey(t.title)));
    const routes = known?.bookRoutes?.map(key=>catalog.bookRoutes[key]) || EssayThemePlanner.suggestionsFor(t);
    return routes.filter(route=>route && worksById.has(route.work));
  }
  function booksForThisTopic() {
    state.shelfTopic=state.active;
    Object.assign(libraryView,{section:'',query:'',limit:12});
    go('library');
  }
  function wholeLibrary() {
    delete state.shelfTopic;
    Object.assign(libraryView,{section:'',query:'',limit:12});
    go('library');
  }
  function note() {
    const id = topic().id;
    if (!state.notes[id]) state.notes[id] = {work:'',own:'',thesis:'',args:{},draft:'',checks:{},turns:{},before:null};
    return state.notes[id];
  }
  function argument() {
    const n = note();
    const key=argumentKey(n);
    if (!n.args[key]) n.args[key]={episode:'',link:''};
    return n.args[key];
  }
  function argumentKey(n=note()) {
    if(n.shelfChoice)return 'shelf:'+n.shelfChoice.id;
    return n.work && n.sceneBook===n.work?'topic:'+n.work:n.work;
  }
  function leaveShelf(n) {
    if(!n.shelfChoice)return;
    n.work=n.shelfChoice.previousWork;
    n.own=n.shelfChoice.previousTitle;
    delete n.shelfChoice;
  }
  function shelfContext() { return {topics:allTopics(),active:topic().id,use:useShelfCard}; }
  function useShelfCard(card,target) {
    let t=target.id?allTopics().find(t=>t.id===target.id):allTopics().find(t=>t.title===target.title);
    if(!t && target.title){
      t={id:'custom-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)),title:target.title,work:'own'};
      state.custom.push(t);
    }
    if(!t)return;
    state.active=t.id;
    state.route='quick';
    const n=note(), previous=n.shelfChoice;
    n.shelfChoice={id:card.id,reviewCard:card.reviewCard||'',previousWork:previous?previous.previousWork:n.work,previousTitle:previous?previous.previousTitle:n.own};
    n.work=catalog.works.some(w=>w.id===card.bookId)?card.bookId:'own';
    if(n.work==='own')n.own=card.title;
    const a=n.args[argumentKey(n)] ||= {episode:card.observation,link:'',source:card.source};
    if(card.quote){a.quote=card.quote;a.quoteSource=card.source;}
    go('link');
  }
  function captureShelf() {
    const first=state.page==='read';
    const info=first?catalog.works.find(w=>w.id===state.reading):work();
    const source=first?info?.url:(panel.querySelector('#ew-scene-source')?.value.trim()||info?.url);
    const quote=first?readingQuote(readingsById.get(state.reading)):
      (source===argument().quoteSource?argument().quote:'');
    const result=EssayShelf.add({bookId:info?.id||'own',title:info?.title||note().own,reviewCard:source===info?.url?info?.card:'',
      observation:first?state.readingNotes[state.reading]:argument().episode,quote,source});
    const status=panel.querySelector('[data-shelf-feedback]');
    status.textContent=result.message;
    if(!result.card){
      if(!(info?.title||note().own)?.trim())panel.querySelector('#ew-own')?.focus();
      else if(!(first?state.readingNotes[state.reading]:argument().episode)?.trim())sourceField(first?'reading':'episode')?.focus();
      else panel.querySelector('#ew-scene-source')?.focus();
    }
  }
  function shelfControls(first=false) {
    const w=first?null:work();
    const source=first?'':'<div class="ew-field"><label for="ew-scene-source">Где найти сцену в книге?</label>'+
      '<input id="ew-scene-source" data-shelf-source placeholder="Глава, страница, издание или ссылка" value="'+h(argument().source||w?.url||'')+'"></div>';
    return source+actions(button('shelf-capture','Сохранить сцену на полку'),button('page-shelf','Открыть мою полку'))+
      '<p class="ew-small" data-shelf-feedback role="status"></p>';
  }
  function shelfCurrent() {
    if(!note().shelfChoice)return '';
    const a=argument();
    return '<p class="ew-small">Сцена с моей полки'+(a.source && !a.quote?' · '+EssayShelf.sourceRef(a.source):'')+'</p>'+
      EssayShelf.excerpt(a.quote,a.quoteSource||a.source)+actions(button('shelf-return','Вернуться к прежнему эпизоду этой темы'));
  }
  function sceneFor(route) {
    const w=worksById.get(route.work);
    if(!route.scene && !route.url)return w;
    return {...w,title:route.title||w.title,fact:route.scene||w.fact,url:route.url||w.url,card:route.card,secular:route.why,orthodox:EssayReadingLens.routeQuestion(route,w,topic().title)};
  }
  function work() {
    const n=note();
    if(n.shelfChoice?.reviewCard){
      const id=n.shelfChoice.reviewCard;
      const here=recommendations().find(r=>r.card===id);
      if(here)return sceneFor(here);
      const saved=scenesByCard.get(id) || state.custom.flatMap(t=>t.bookSuggestions||[]).find(r=>r.card===id);
      if(saved && saved.work===n.work)return sceneFor({...saved,why:'Как выбранная тобой деталь помогает ответить на вопрос этой темы?'});
    }
    const route=!n.shelfChoice && n.sceneBook===n.work && recommendations().find(r=>r.work===n.work);
    return route?sceneFor(route):worksById.get(n.work)||null;
  }
  function selectedTitle() { return work()?.title || (note().work==='own' && note().own) || 'Книга пока не выбрана'; }
  function lensLabel() { return EssayReadingLens.label(state.mode); }
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
  function go(page,fromLibrary=false) {
    if(page==='read')state.readingFromLibrary=fromLibrary;
    if (!steps.some(([id])=>id===page)) page = 'start';
    if(location.hash.startsWith('#tema-') && (page!=='library' || state.shelfTopic!==state.active ||
        location.hash!=='#tema-'+state.active.replace(/^public-topic-/,''))){
      try { window.history.replaceState(window.history.state,'',location.href.split('#')[0]); } catch {}
    }
    if (page==='draftReader') state.route='draftReader';
    if (page === 'start' && state.page !== 'start') {
      state.previousPage = state.page;
      state.resumeFinished = state.active === finishedEssayId;
      if (state.resumeFinished && state.beforeFinishedEssay && allTopics().some(t=>t.id===state.beforeFinishedEssay.topic)) {
        state.active = state.beforeFinishedEssay.topic;
        state.route = state.beforeFinishedEssay.route;
      }
    }
    state.page = page;
    try {
      const current = window.history.state;
      if (current && Object.hasOwn(current,'essayNavigatorPage')) {
        window.history.replaceState({...current, essayNavigatorPage:page, essayTopic:state.active, essayRoute:state.route}, '');
      }
    } catch { /* The explicit back control also works offline. */ }
    render(); save();
    const currentScreen = page === 'writingPractice' ? practiceScreen : panel;
    const title = currentScreen.querySelector('h2');
    title?.focus({preventScroll:true});
    const scrollTarget = page === 'writingPractice' ? root.querySelector('#ew-back-start') : title;
    (scrollTarget || currentScreen).scrollIntoView({block:'nearest'});
  }
  const finishedEssayId = 'finished-essay';
  const unnamedEssay = 'Моё готовое сочинение';
  const entrySituations = [
    ['empty', 'route-read', 'Пока ничего не выбрал', 'Прочитай короткий эпизод и запиши одну деталь.'],
    ['topic', 'entry-topic', 'Есть тема', 'Введи свой вопрос и попробуй ответить одной фразой.'],
    ['scene', 'entry-scene', 'Помню книгу или эпизод', 'Найди знакомую книгу по названию или автору.'],
    ['paragraph', 'route-draftReader', 'Есть абзац', 'Вставь его и отметь, где поступок, а где твоя мысль.'],
    ['essay', 'entry-essay', 'Сочинение готово', 'Вставь свой текст и открой самопроверку.'],
    ['rehearsal', 'route-rehearsal', 'Хочу репетицию целиком', 'Открой комплект тем и напиши работу самостоятельно.'],
    ['quick', 'page-writingPractice', 'Начать с одной фразы', 'Выбери короткое упражнение на пять минут.']
  ];
  function entryCard([id, action, title, description]) {
    const body = '<b>'+h(title)+'</b><small>'+h(description)+'</small>';
    const attrs = ' data-entry-situation="'+id+'" data-act="'+action+'"';
    if (id === 'quick') {
      return '<div id="ew-start-offer"><a class="ew-route ew-launch" href="#ot-temy-do-vyvoda" aria-label="'+h(title)+'"'+attrs+'>'+body+'</a></div>';
    }
    return '<button type="button" class="ew-route"'+attrs+'>'+body+'</button>';
  }
  function rememberNavigation() {
    try {
      const current = window.history.state || {};
      const entry={...current, essayNavigatorPage:state.page, essayTopic:state.active, essayRoute:state.route};
      window.history.replaceState(entry, '');
      window.history.pushState(entry, '');
    } catch { /* Some browsers disable history updates for local files. */ }
  }
  function openSituation(id) {
    rememberNavigation();
    switch (id) {
      case 'empty': go('read'); break;
      case 'topic': {
        state.route = 'quick';
        state.enterOwnTopic = true;
        go('topic');
        const field = panel.querySelector('#ew-custom');
        field.focus();
        break;
      }
      case 'scene':
        wholeLibrary();
        panel.querySelector('#ew-library-search').focus();
        break;
      case 'paragraph':
        go('draftReader');
        panel.querySelector('[data-dr-field="source"]')?.focus();
        break;
      case 'essay':
        state.beforeFinishedEssay = {topic:state.active, route:state.route};
        if (!state.custom.some(item=>item.id===finishedEssayId)) {
          state.custom.push({id:finishedEssayId, title:unnamedEssay, ownEssayTopic:'', work:'own'});
        }
        state.active = finishedEssayId;
        state.route = 'edit';
        go('draft');
        sourceField('draft').focus();
        break;
      case 'rehearsal': go('rehearsal'); break;
      case 'quick': go('writingPractice'); break;
    }
  }
  function start() {
    const previous = steps.find(([id]) => id !== 'start' && id === state.previousPage);
    const resumeAction=previous?.[0]==='library'?(state.shelfTopic===state.active?'topic-books':'library-all'):'page-'+previous?.[0];
    const resume = previous ? '<div class="ew-resume">'+button(state.resumeFinished?'resume-finished':resumeAction, 'Вернуться к занятию «'+previous[1]+'»')+'</div>' : '';
    return '<section data-ew-entry id="ew-situations" aria-labelledby="ew-title">'+heading('С чего ты начинаешь?')+resume+
      '<div class="ew-entry-choices">'+entrySituations.map(entryCard).join('')+'</div>'+
      (window.EssayGigaNavigator?.panel(state.mode) || '')+
      '<div class="ew-entry-return"><a href="#knizhnaya-polka" data-act="library-all">Все книги</a><a href="#temy-sochineniya" data-act="page-themeAtlas">Библиотека тем</a></div>'+
      '<h3 class="ew-entry-heading">Другие занятия</h3><div class="ew-entry-tools">'+
      button('page-shelf','Моя полка сцен')+button('route-quick','Подобрать аргумент к теме')+button('route-full','Написать сочинение по шагам')+
      button('route-thesisLab','Уточнить свой тезис')+button('route-drills','Потренировать отдельную правку')+button('route-edit','Открыть редактор моей работы')+'</div></section>'+
      fullReviewControls(false)+
      '<p class="ew-small"><a href="https://usel-toski-po-miru.art/k-sochineniyu/itogovoe/pomoshchnik/proverka-gigachat.zip">Скачать мастерскую для занятий без интернета (ZIP)</a>. Распакуй архив и открой practice.html.</p>'+
      '<details><summary>Мне нужна подсказка к одной фразе</summary><p><a href="https://usel-toski-po-miru.art/k-sochineniyu/itogovoe/pomoshchnik/trenazher-gigachat.zip">Скачать домашнюю версию с диалогом по выделенному фрагменту</a></p></details>';
  }
  function pageAfterTopic() {
    if (state.route==='draftReader') return 'draftReader';
    return state.route==='edit'?'draft':'thesis';
  }
  function fullReviewControls(withDraft) {
    const published='https://usel-toski-po-miru.art/k-sochineniyu/itogovoe/pomoshchnik/proverka-sochineniya.html';
    const hosted=/^https?:$/.test(location.protocol) && /\/pomoshchnik\/(?:index\.html)?$/.test(location.pathname);
    const bundled=root.dataset.bundledReview && location.protocol==='file:' && /\/practice\.html$/i.test(location.pathname);
    if (location.protocol==='file:' && !bundled) {
      const online='<details><summary>Дополнительная проверка в интернете</summary><p><a href="'+published+'" target="_blank" rel="noopener noreferrer">Открыть расширенную онлайн-проверку</a></p>'+
        (withDraft?actions(button('export-review-draft','Скачать черновик для переноса')):'')+'</details>';
      // The editor already offers its local self-check; the family practice file
      // also has a sibling checker, while a single downloaded HTML does not.
      return online;
    }
    const href=hosted?'proverka-sochineniya.html':bundled?'essay-check.html':published;
    if (!withDraft || !hosted) {
      return '<p><a href="'+h(href)+'">Проверить сочинение целиком</a></p>'+
        (withDraft && !hosted?'<p class="ew-small">Скопируй сюда тему и черновик либо выгрузи их из мастерской кнопкой ниже.</p>'+actions(button('export-review-draft','Скачать для переноса в проверку')):'');
    }
    return actions(button('open-full-review','Проверить это сочинение целиком'))+
      '<p id="ew-review-transfer" class="ew-small" role="status"></p>';
  }
  function bookSuggestion(route) {
    const w=sceneFor(route), why=route.why;
    return '<article class="ew-topic-book" data-topic-work="'+h(w.id)+'"><h4>'+h(w.title)+'</h4>'+
      '<p><strong>Эпизод.</strong> '+h(w.fact)+'</p><p class="ew-topic-connection"><strong>Связь с темой.</strong> '+h(why)+'</p>'+
      (state.mode==='orthodox'?'<p class="ew-tip">'+h(w.orthodox)+'</p>':'')+
      '<div class="ew-actions">'+button('library-use-'+w.id,'Взять эту книгу для аргумента')+
      '<a href="'+h(w.url)+'" target="_blank" rel="noopener noreferrer">Свериться с текстом</a></div></article>';
  }
  function topicBookChoices(compact=false) {
    const routes=recommendations(), n=note();
    const chosen=work()?.title || (n.work==='own'?n.own:'');
    const summary=chosen?'<p class="ew-small"><strong>Твой выбор</strong> · '+h(chosen)+'</p>':'';
    const intro=routes.length?'Сцены подобрала мастерская. Выбери ту, которую помнишь и можешь объяснить своими словами.':
      'К этой формулировке пока нет готовой подборки. Можно указать произведение, которое ты читал, или поискать сцену на полке.';
    const cards=routes.map(bookSuggestion).join('');
    const block='<p>'+intro+'</p>'+cards+actions(button('choose-own-book','Указать своё произведение'),button('library-all','Посмотреть все книги'));
    return '<section class="ew-topic-picks" data-topic-picks>'+ (compact?
      '<details><summary>Книги и эпизоды к этой теме'+(routes.length?' · '+routes.length:'')+'</summary><div>'+summary+block+'</div></details>':
      (state.page==='library'?'':'<h3>Книги и эпизоды к этой теме</h3>')+summary+block)+'</section>';
  }
  function topicScreen() {
    const groups = [...new Set(catalog.topics.map(t=>t.section))];
    const opts = groups.map(g=>'<optgroup label="'+h(g)+'">'+options(catalog.topics.filter(t=>t.section===g),state.active)+'</optgroup>').join('')+
      (state.custom.length?'<optgroup label="Мои темы">'+options(state.custom,state.active)+'</optgroup>':'');
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
    return heading('О чём будешь писать?','Можно взять вопрос учителя, тему из опубликованной подборки или учебную тему мастерской. Формулировки на предстоящем экзамене заранее неизвестны.',routes[state.route])+
      examChoice+
      '<label for="ew-topic">Тема сочинения</label><select id="ew-topic">'+opts+'</select><p class="ew-topic">'+h(topic().title)+'</p>'+
      topicBookChoices()+(note().shelfChoice?shelfCurrent():note().work==='own'?ownBookField():'')+
      '<details id="ew-browse-by-book"><summary>Вся полка: найти темы по знакомой книге</summary><div><label for="ew-from-book">Какую книгу ты помнишь?</label><select id="ew-from-book"></select><div id="ew-book-topics"></div></div></details>'+
      '<details'+(state.enterOwnTopic?' open':'')+'><summary>Ввести свою тему</summary><div><form id="ew-custom-form"><label for="ew-custom">Формулировка темы</label><input id="ew-custom" required maxlength="500" value="'+h(state.ownTopicText)+'">'+actions('<button class="ew-primary">Работать с этой темой</button>')+'</form></div></details>'+
      actions(button('forward-topic',pageAfterTopic()==='thesis'?'Перейти к тезису':'Перейти к моему черновику',true));
  }
  const sectionNames = [
    'Духовно-нравственные ориентиры в жизни человека',
    'Семья, общество, Отечество в жизни человека',
    'Природа и культура в жизни человека'
  ];
  const libraryView = {query:'',section:'',limit:12};
  function selectAtlasTopic(row,mode){
    let id=row.id;
    if(row.own){
      id=allTopics().find(t=>t.title===row.title)?.id||'custom-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36));
    }else if(row.official)id='public-topic-'+row.id;
    if(!allTopics().some(t=>t.id===id))state.custom.push({id,title:row.title,work:'own'});
    state.active=id;state.route='full';
    if(mode==='books') booksForThisTopic();
    else if(mode==='ownBook'){takeLibraryWork('own');go('episode');}
    else go('thesis');
  }
  const readingsById = new Map(catalog.readings.map(r=>[r.id,r]));
  function readingQuote(reading) {
    return reading?.kind==='scene'?'':String(reading?.quote||'').trim();
  }
  function searchWords(text) {
    return String(text).toLocaleLowerCase('ru').replaceAll('ё','е').match(/[а-яa-z0-9]+/gu)||[];
  }
  function libraryScreen() {
    const choices=sectionNames.map((name,i)=>({id:String(i+1),title:name}));
    const scoped=state.shelfTopic===state.active;
    if(scoped) return '<section data-library data-topic-shelf>'+heading('Книги к выбранной теме',topic().title)+
      topicBookChoices()+actions(button('page-themeAtlas','Вернуться к библиотеке тем'),button('page-thesis','Написать тезис'))+'</section>';
    const hasTopic=Boolean(state.notes[state.active]);
    return '<section data-library>'+heading('Книжная полка','Найди знакомую книгу или выбери сцену, с которой начнёшь работу.')+
      (hasTopic?'<p class="ew-library-current"><strong>Моя тема</strong> · '+h(topic().title)+' '+button('page-topic','Сменить тему')+'</p>'+
        actions(button('topic-books','Вернуться к выбору книги для темы')):'')+
      '<div class="ew-library-filters"><div><label for="ew-library-search">Автор или название</label>'+
      '<input id="ew-library-search" type="search" value="'+h(libraryView.query)+'" placeholder="Например, Чехов" autocomplete="off"></div>'+
      '<div><label for="ew-library-section">Раздел банка тем</label><select id="ew-library-section">'+
      options([{id:'',title:'Все разделы'},...choices],libraryView.section)+'</select></div>'+
      '</div>'+
      '<p class="ew-small ew-library-status" id="ew-library-count" role="status"></p><div id="ew-library-list"></div>'+
      button('library-more','Показать ещё')+actions(button('library-own','Взять свою книгу'),button('page-shelf','Мои сохранённые сцены'))+'</section>';
  }
  function libraryCard(w) {
    const reading=readingsById.get(w.id);
    const read=reading?button('library-read-'+w.id,readingQuote(reading)?'Прочитать отрывок':'Разобрать эпизод'):'';
    return '<article class="ew-library-book" data-library-work="'+h(w.id)+'"><h3 tabindex="-1">'+h(w.title)+'</h3>'+
      '<p class="ew-small">Эпизод · пересказ мастерской</p><p>'+h(w.fact)+'</p>'+
      '<p class="ew-tip">'+h(w[state.mode])+'</p>'+
      '<a target="_blank" rel="noopener noreferrer" href="'+h(w.url)+'">К источнику</a>'+
      actions(button('library-use-'+w.id,state.notes[state.active]?'Взять для моей темы':'Взять для аргумента'),read)+'</article>';
  }
  function updateLibrary() {
    if(!panel.querySelector('#ew-library-list'))return;
    const words=searchWords(libraryView.query);
    const section=Number(libraryView.section);
    const matches=catalog.works.filter(w=>{
      if(section && !w.sections?.includes(section))return false;
      const name=searchWords(w.title).join(' ');
      return words.every(word=>name.includes(word));
    });
    const list=panel.querySelector('#ew-library-list');
    const count=panel.querySelector('#ew-library-count');
    list.innerHTML=matches.slice(0,libraryView.limit).map(libraryCard).join('');
    count.textContent=matches.length?'Найдено книг: '+matches.length+'. Показано: '+Math.min(libraryView.limit,matches.length)+'.':'Книг с таким запросом нет. Измени запрос или раздел.';
    panel.querySelector('[data-act="library-more"]').hidden=matches.length<=libraryView.limit;
  }
  function takeLibraryWork(id,fromTheme=true) {
    const n=note();
    const route=fromTheme && recommendations().find(r=>r.work===id);
    const sceneBook=route && (route.scene || route.url)?id:'';
    if(n.work===id && !n.shelfChoice && (n.sceneBook||'')===sceneBook)return;
    n.libraryPrevious={forWork:id,work:n.work,own:n.own,sceneBook:n.sceneBook||'',shelfChoice:n.shelfChoice||null};
    const unassigned=!n.work && n.args[''];
    leaveShelf(n);n.work=id;n.sceneBook=sceneBook;
    const key=argumentKey(n);
    if(unassigned && !n.args[key])n.args[key]={...unassigned};
  }
  function libraryReturn() {
    const n=note();
    return n.libraryPrevious?.forWork===n.work && !n.shelfChoice?
      actions(button('library-restore','Вернуться к прежнему выбору книги')):'';
  }
  function readingScreen() {
    const r=readingsById.get(state.reading)||catalog.readings[0];
    const w=catalog.works.find(x=>x.id===r.id), quote=readingQuote(r);
    const intro=quote
      ? heading('Начни с нескольких строк','Прочитай отрывок и запиши, какая деталь привлекла твоё внимание.')
      : heading('Разбери эпизод','Прочитай пересказ мастерской. Какой поступок, слово или предмет поможет тебе ответить на вопрос под карточкой?');
    const currentTheme=state.readingFromLibrary?topic():catalog.topics.find(t=>t.id===r.topic);
    return intro+'<label for="ew-reading">Выбрать произведение</label><select id="ew-reading">'+options(catalog.works.filter(w=>readingsById.has(w.id)),r.id)+'</select>'+
      '<div class="ew-text-card" data-reading-kind="'+(quote?'excerpt':'scene')+'"><p class="ew-small">'+(quote?'Контекст сцены':'Эпизод · пересказ мастерской')+'</p><p>'+h(r.context)+'</p>'+
      (quote?'<p class="ew-small">Цитата из произведения</p><p class="ew-topic" data-reading-quote>«'+h(quote)+'»</p>':'')+
      '<p><a target="_blank" rel="noopener noreferrer" href="'+h(w.url)+'">К источнику</a></p></div>'+
      '<p class="ew-small">Тема для этой записи · '+h(currentTheme.title)+'</p><p>'+h(r[state.mode])+'</p>'+
      field('reading',quote?'Что я заметил в тексте?':'Что я заметил в этой сцене?',state.readingNotes[r.id]||'')+
      answerControls('reading',state.readingNotes[r.id]||'')+shelfControls(true)+
      actions(button('reading-apply',state.readingFromLibrary?'Взять запись для моей темы':'Взять сцену для аргумента',true),button('library-all','Все книги на полке'))+'<p class="ew-small" id="ew-reading-status" role="status"></p>';
  }
  function bookTopics() {
    const sel=panel.querySelector('#ew-from-book'),list=panel.querySelector('#ew-book-topics');
    if(!sel||!list)return;
    if(!sel.value){list.replaceChildren();return;}
    const themes=catalog.topics.filter(t=>recommendations(t).some(r=>r.work===sel.value));
    list.innerHTML=themes.length?actions(...themes.map(t=>button('pick-'+t.id,t.title))):actions(button('use-from-book','Взять эту книгу для моей темы'));
  }
  function context(stage) {
    return {stage,mode:state.mode,topic:topic().title,work:work() || (note().work==='own' && note().own?{title:note().own}:null),thesis:note().thesis,episode:argument().episode,link:argument().link,draft:note().draft,draftHeading:note().draftHeading};
  }
  function conversationKey(stage) { return stage+'|'+((stage==='episode'||stage==='link')?argumentKey():'')+'|'+state.mode; }
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
    const key = (stage === 'episode' || stage === 'link') ? stage+'|'+argumentKey(n) : stage;
    n.revisions ||= {};
    return n.revisions[key] ||= {session:null, last:null};
  }
  function sourceField(stage) {
    return panel.querySelector('#ew-write-'+stage);
  }
  function answerKey(stage) {
    if(stage==='reading') return JSON.stringify([stage,state.reading]);
    if(stage==='drill') return JSON.stringify([stage,state.exercise]);
    return JSON.stringify([stage,topic().id,(stage==='episode'||stage==='link')?argumentKey():'']);
  }
  function answerBook(stage) {
    if(stage==='reading'||stage==='drill') return '';
    return JSON.stringify([note().work,note().work==='own'?(note().own||'').trim().toLowerCase():'']);
  }
  function inspectAnswer(stage,text) {
    if(stage==='drill') {
      const drill=catalog.drills.find(item=>item.id===state.exercise);
      return EssayAnswerFeedback.inspect({stage,text,drill});
    }
    if(stage==='reading') {
      const reading=readingsById.get(state.reading);
      const work=catalog.works.find(item=>item.id===reading.id);
      const title=state.readingFromLibrary?topic().title:catalog.topics.find(item=>item.id===reading.topic)?.title||'';
      return EssayAnswerFeedback.inspect({stage,text,reading,work,topic:title,mode:state.mode});
    }
    return EssayAnswerFeedback.inspect({...context(stage),text});
  }
  function changedPassages(before,after) {
    if(before.trim().replace(/\s+/gu,' ')===after.trim().replace(/\s+/gu,' ')) return {spacing:true};
    let start=0, tail=0;
    const limit=Math.min(before.length,after.length);
    while(start<limit && before[start]===after[start]) start++;
    while(tail<limit-start && before[before.length-1-tail]===after[after.length-1-tail]) tail++;
    const excerpt=value=>{
      const from=Math.max(0,start-45);
      const to=Math.min(value.length,start+170,value.length-tail+55);
      return (from?'…':'')+value.slice(from,to)+(to<value.length?'…':'');
    };
    return {before:excerpt(before),after:excerpt(after)};
  }
  function answerContent(stage,text) {
    const record=state.answerChecks?.[answerKey(stage)];
    const checked=record?.book===answerBook(stage);
    const stale=checked && record.beforeEdit!==undefined;
    const label=stale?'Сравнить с прошлой записью':stage==='drill'?'Проверить мою правку':'Получить отклик на мою запись';
    let result='';
    if(stale) result='<p class="ew-small" data-answer-stale>Запись изменилась. Можно проверить её ещё раз и сравнить формулировки.</p>';
    else if(checked && text.trim()) {
      const reply=inspectAnswer(stage,text), change=record.change;
      result='<div class="ew-answer-card">'+(reply.excerpt?'<p class="ew-note" data-answer-excerpt>«'+h(reply.excerpt)+'»</p>':'')+
        '<p data-answer-observation>'+h(reply.observation)+'</p><p data-answer-next><strong>Попробуй сейчас.</strong> '+h(reply.next)+'</p></div>';
      if (stage==='link') {
        const paths=EssayDraftReader.helpChoices.map(choice=>'<details data-link-help="'+h(choice.id)+'"><summary>'+
          h(choice.label)+'</summary><p>'+h(choice.hint)+'</p></details>');
        result+='<div class="ew-link-help"><h3>Что я хочу сделать со своей фразой?</h3>'+paths.join('')+'</div>';
      }
      if(change?.spacing) result+='<p class="ew-small">Изменились пробелы или переносы строк.</p>';
      else if(change) result+='<div class="ew-answer-change"><p><strong>До правки</strong><br><span class="ew-note" data-answer-before>'+h(change.before)+'</span></p>'+
        '<p><strong>После правки</strong><br><span class="ew-note" data-answer-after>'+h(change.after)+'</span></p></div>';
    }
    return {label,result};
  }
  function answerControls(stage,text) {
    const {label,result}=answerContent(stage,text);
    return '<div id="ew-answer-tools" data-answer-stage="'+stage+'">'+
      actions(button(stage==='drill'?'drill-check':'answer-check',label,stage==='drill'))+
      '<div data-answer-result id="'+(stage==='drill'?'ew-drill-feedback':'ew-answer-feedback')+'" role="status">'+result+'</div></div>';
  }
  function refreshAnswer(stage,value) {
    const tools=panel.querySelector('#ew-answer-tools');
    if(tools?.dataset.answerStage!==stage) return;
    const {label,result}=answerContent(stage,value);
    tools.querySelector('button').textContent=label;
    tools.querySelector('[data-answer-result]').innerHTML=result;
  }
  // Keep the checked text only while the learner is editing it. The stored
  // comparison needs just the two excerpts surrounding the change.
  function trackAnswerEdit(stage,oldValue,value) {
    if(oldValue===value) return;
    const key=answerKey(stage), record=state.answerChecks?.[key];
    if(record && record.book!==answerBook(stage)) {
      delete state.answerChecks[key];
      refreshAnswer(stage,value);
      return;
    }
    if(!record) {
      if(panel.querySelector('[data-answer-empty]')) refreshAnswer(stage,value);
      return;
    }
    const wasStale=record.beforeEdit!==undefined;
    if(!wasStale) record.beforeEdit=oldValue;
    if(record.beforeEdit===value) delete record.beforeEdit;
    if(wasStale!==(record.beforeEdit!==undefined) || panel.querySelector('[data-answer-empty]')) refreshAnswer(stage,value);
  }
  function checkAnswer() {
    const stage=panel.querySelector('#ew-answer-tools').dataset.answerStage;
    const editor=sourceField(stage==='drill'?'exercise':stage), text=editor.value;
    const result=panel.querySelector('[data-answer-result]');
    if(!text.trim()){
      result.innerHTML='<p class="ew-small" data-answer-empty>'+h(inspectAnswer(stage,text).next)+'</p>';
      editor.focus();return;
    }
    state.answerChecks ||= {};
    const key=answerKey(stage), book=answerBook(stage), prior=state.answerChecks[key];
    const sameBook=prior?.book===book;
    const change=sameBook && prior.beforeEdit!==undefined ? changedPassages(prior.beforeEdit,text) : sameBook && prior.change;
    state.answerChecks[key]=change?{book,change}:{book};
    save();refreshAnswer(stage,text);
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
    const holder=stage==='episode' || stage==='link'?argument():current;
    const oldValue=holder[stage];
    holder[stage]=value;
    trackAnswerEdit(stage,oldValue,value);
    if (stage==='draft') {
      note().checks={};
      if (panel.querySelector('#ew-count')) updateCounter();
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
    if(note().shelfChoice)return '<p class="ew-small">Книга для аргумента · '+h(selectedTitle())+'</p>'+shelfCurrent();
    const choices=recommendations().map(r=>w?.id===r.work?w:sceneFor(r));
    if(w && !choices.some(choice=>choice.id===w.id))choices.push(w);
    return '<div class="ew-field"><label for="ew-work">Книга для аргумента</label><select id="ew-work"><option value="" disabled'+(!note().work?' selected':'')+'>Выбери книгу или укажи свою</option>'+
      options([...choices,{id:'own',title:'Моё произведение'}],note().work)+'</select></div>'+
      (w?'<div class="ew-text-card"><p><strong>'+h(w.title)+'</strong></p><p><a target="_blank" rel="noopener noreferrer" href="'+h(w.url)+'">К источнику</a></p><details><summary>Вспомнить сцену и получить вопрос</summary><div><p class="ew-small">Пересказ мастерской</p><p>'+h(w.fact)+'</p><p>'+h(w[state.mode])+'</p></div></details></div>':
      (note().work==='own'?ownBookField():''))+libraryReturn()+topicBookChoices(Boolean(note().work));
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
    const topicDisplay=stage==='draft' && state.active===finishedEssayId
      ? '<div class="ew-field"><label for="ew-finished-topic">Тема моего сочинения</label><input id="ew-finished-topic" maxlength="500" placeholder="Впиши свою формулировку" value="'+h(topic().ownEssayTopic)+'"></div>'
      : '<p class="ew-topic">'+h(topic().title)+'</p>';
    return heading(copy[0],copy[1],routes[state.route])+topicDisplay+
      (stage==='episode'?workPicker()+readerQuestion:'')+previous+
      (stage==='draft'?'<details><summary>Книга для подсказок · '+h(selectedTitle())+'</summary><div>'+workPicker()+'</div></details>'+outline()+readerQuestion:'')+
      EssayReadingLens.detail(stage)+field(stage,copy[2],copy[3],stage==='draft'?12:4)+
      answerControls(stage,copy[3])+(stage==='episode'?shelfControls():stage==='link'?shelfCurrent():'')+
      (stage==='thesis'?topicBookChoices()+actions(button('page-thesisLab','Уточнить свой тезис на примере')):'')+
      (stage==='draft'?'<p class="ew-counter" id="ew-count"></p>'+countOptions()+actions(button('snapshot','Сохранить версию перед правкой'))+'<p id="ew-snapshot-status" class="ew-small" role="status">'+(n.before!==null?'Первая версия сохранена. Сравнение доступно в самопроверке.':'')+'</p>':'')+
      '<div id="ew-revision"></div>'+actions(nav)+(stage==='draft'?fullReviewControls(true):'')+coach(stage);
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
      actions(button('page-draft',quick?'Перейти к полному сочинению':'Вернуться к правке',true),button(quick?'page-paragraphTrial':'page-draftReader',quick?'Попробовать абзац на новую тему':'Разметить мой черновик'),button('download','Скачать мою работу (.txt)'))+
      EssayReadingLens.detail('review')+(quick?'':fullReviewControls(true))+externalPacket();
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
      EssayDrillContrast.render(d,state.drillChoices?.[d.id])+
      EssayReadingLens.detail({thesis:'thesis',observation:'motive',retelling:'retell',evidence:'link',repetition:'precision',conclusion:'ending'}[d.id]||'precision')+field('exercise','Моя редакция',v)+answerControls('drill',v)+actions(button('page-start','К выбору маршрута'));
  }
  function prepareRehearsal(set, title='') {
    state.route='full';state.practiceSet=set;
    const chosen=title && catalog.topics.find(item=>item.title===title);
    if(chosen){state.active=chosen.id;booksForThisTopic();return;}
    go('topic');
    const sets=panel.querySelector('#ew-exam-choice');
    if(sets){sets.open=true;sets.querySelector('fieldset:enabled input')?.focus();}
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
  function thesisLab() {
    const n=note();
    n.thesisLab ||= {};
    return EssayThesisLab.render({record:n.thesisLab,initial:n.thesis,work:work(),ownTitle:n.own});
  }
  function draftReaderContext() {
    const n=note();
    n.draftReader ||= {};
    return {record:n.draftReader,topicId:topic().id,topicTitle:topic().title,draft:n.draft,mode:state.mode,
      getDraft:()=>n.draft,applyDraft:text=>updateEditor('draft',text),save,go};
  }
  function render() {
    EssayRehearsal.unmount();
    closeOnlineReview();
    if (!steps.some(([id])=>id===state.page)) state.page='start';
    menu.innerHTML=steps.map(([id,title],i)=>'<button type="button" data-act="page-'+id+'"'+(state.page===id?' aria-current="step"':'')+'><span aria-hidden="true">'+(i>0&&i<7?i+' ·':'')+'</span>'+(id==='library' && state.notes[state.active]?'Книги к моей теме':title)+'</button>').join('');
    mode.value=state.mode==='orthodox'?'orthodox':'secular';
    if (state.page==='writingPractice') window.dispatchEvent(new CustomEvent('essay-practice-lens'));
    root.classList.toggle('ew-in-rehearsal',state.page==='rehearsal');
    const writingPractice = state.page === 'writingPractice';
    practiceScreen.hidden = !writingPractice;
    panel.hidden = writingPractice;
    root.querySelector('#ew-back-start').hidden = state.page === 'start';
    if (writingPractice) {
      panel.replaceChildren();
      return;
    }
    const pages={start,topic:topicScreen,review,drills,read:readingScreen,library:libraryScreen,shelf:()=>EssayShelf.render(shelfContext()),rehearsal:EssayRehearsal.render,thesisLab};
    pages.themeAtlas=()=>EssayThemeAtlas.render(catalog,sectionNames);
    pages.draftReader=()=>EssayDraftReader.render(draftReaderContext());
    pages.paragraphTrial=()=>EssayParagraphTrial.render({record:state.paragraphTrial ||= {}});
    panel.innerHTML=pages[state.page]?pages[state.page]():writing(state.page);
    if (state.page==='draftReader') EssayDraftReader.mount(panel,draftReaderContext());
    if (state.page==='paragraphTrial') EssayParagraphTrial.mount(panel,{record:state.paragraphTrial,save,go});
    if (state.page==='library') updateLibrary();
    if (state.page==='themeAtlas') EssayThemeAtlas.mount(panel,catalog,sectionNames,selectAtlasTopic,{record:state.topicPlanner ||= {},save,openDraft:plan=>EssayThemePlanner.openDraft(state,plan,go)});
    if (state.page==='shelf') EssayShelf.mount(panel,shelfContext());
    if (state.page==='thesisLab') EssayThesisLab.mount(panel,{record:note().thesisLab,save});
    if (state.page==='rehearsal') EssayRehearsal.mount(panel,catalog,reviewRehearsal,prepareRehearsal);
    if (panel.querySelector('#ew-revision')) showRevision(state.page);
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
    if (el.id==='ew-finished-topic' && state.active===finishedEssayId) {
      const selected=topic();
      selected.ownEssayTopic=el.value;
      selected.title=el.value.trim() || unnamedEssay;
      save();return;
    }
    if (el.id==='ew-custom') {state.ownTopicText=el.value;save();return;}
    if(el.id==='ew-library-search'){libraryView.query=el.value;libraryView.limit=12;updateLibrary();return;}
    if(el.hasAttribute('data-shelf-source')){argument().source=el.value;save();return;}
    if (el.id==='ew-revision-text') {
      const s=revisionRecord(state.page).session;
      if (s) {s.proposal=el.value;save();}
      return;
    }
    if(!key) return;
    if(key==='reading') {
      trackAnswerEdit('reading',state.readingNotes[state.reading]||'',el.value);
      state.readingNotes[state.reading]=el.value;
    } else if(key==='exercise') {
      trackAnswerEdit('drill',state.exercises[state.exercise]||'',el.value);
      state.exercises[state.exercise]=el.value;
    }
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
        if(sourceField(state.page)) refreshAnswer(state.page,sourceField(state.page).value);
        const question=sourceField('readerQuestion');
        if (question) question.value=argument()[readerQuestionKey()]||'';
        if (panel.querySelector('#ew-revision') && revisionRecord(state.page).session) showRevision(state.page);
      }
    }
    save();
  });
  root.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='ew-mode'){changeLens(el.value,true);return;}
    if(el.id==='ew-library-section'){libraryView.section=el.value;libraryView.limit=12;updateLibrary();return;}
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
    else if(el.id==='ew-topic') state.active=el.value;
    else if(el.id==='ew-work'){takeLibraryWork(el.value);}
    else if(el.id==='ew-drill') state.exercise=el.value;
    else if(el.dataset.check){note().checks[el.dataset.check]=el.checked;save();return;}
    else return;
    render(); save();
    if(el.id!=='ew-mode') panel.querySelector('#'+el.id)?.focus({preventScroll:true});
  });
  root.addEventListener('toggle',event=>{
    if(event.target.id!=='ew-browse-by-book' || !event.target.open)return;
    const select=event.target.querySelector('#ew-from-book');
    if(!select.options.length){
      select.innerHTML='<option value="" disabled selected>Выбери знакомую книгу</option>'+options(catalog.works,work()?.id);
      bookTopics();
    }
  },true);
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
      state.active=t.id;delete state.ownTopicText;delete state.enterOwnTopic;go(pageAfterTopic());return;
    }
    if(event.target.id==='ew-chat'){
      const input=panel.querySelector('#ew-message'), message=input.value.trim(); if(!message)return;
      const stage=panel.querySelector('[data-stage]').dataset.stage;
      const answer=EssayCoach.respond(context(stage),message,turns(stage).at(-1));
      input.value='';addTurn(stage,message,answer);input.focus({preventScroll:true});
    }
  });
  root.addEventListener('click',event=>{
    const b=event.target.closest('button[data-act], a[data-act]');if(!b)return;
    if (b.matches('a')) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
    }
    const action=b.dataset.act;
    if (b.dataset.entrySituation) {openSituation(b.dataset.entrySituation);return;}
    if (action==='resume-finished' && state.custom.some(t=>t.id===finishedEssayId)) {
      rememberNavigation();state.active=finishedEssayId;state.route='edit';go(state.previousPage);return;
    }
    if (action==='entry-navigator') {rememberNavigation();go('start');return;}
    if(action==='open-full-review'||action==='export-review-draft'){
      const n=note(), target='proverka-sochineniya.html';
      const selected=work();
      const data={topic:state.active===finishedEssayId?(topic().ownEssayTopic||'').trim():topic().title,essay:n.draft,mode:state.mode};
      if(n.draftHeading && n.draftHeading===EssayCoach.firstDraftLine(n.draft)) data.draftHeading=n.draftHeading;
      if(selected)data.cardIds=[selected.card||selected.id];
      if(action==='export-review-draft'){
        const url=URL.createObjectURL(new Blob([JSON.stringify({format:'uzel-essay-review.1',...data})],{type:'application/json'}));
        const link=document.createElement('a');
        link.href=url;link.download='chernovik-dlya-proverki.json';link.click();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
        return;
      }
      try {
        sessionStorage.setItem('uzel.essay-review.handoff.v1',JSON.stringify(data));
        location.assign(target+'#iz-masterskoy');
      } catch {
        const help=panel.querySelector('#ew-review-transfer');
        help.textContent='Браузер не разрешил перенести работу. Скопируй черновик и ';
        const link=document.createElement('a');
        link.href=target;link.textContent='открой страницу проверки';help.append(link);
      }
      return;
    }
    if(action==='topic-books'){booksForThisTopic();return;}
    if(action==='library-all'){
      wholeLibrary();return;
    }
    if(action==='library-more'){
      const previous=panel.querySelectorAll('[data-library-work]').length;
      libraryView.limit+=12;updateLibrary();
      panel.querySelectorAll('[data-library-work]')[previous]?.querySelector('h3')?.focus();
      return;
    }
    if(action.startsWith('library-read-')){
      const id=action.slice('library-read-'.length);
      if(readingsById.has(id)){state.reading=id;go('read',true);}
      return;
    }
    if(action==='library-own'||action.startsWith('library-use-')){
      const id=action==='library-own'?'own':action.slice('library-use-'.length);
      if(id==='own'||catalog.works.some(w=>w.id===id)){takeLibraryWork(id,Boolean(b.closest('[data-topic-work]')));go('episode');}
      return;
    }
    if(action==='library-restore'){
      const n=note(),before=n.libraryPrevious;
      if(before?.forWork===n.work){
        n.work=before.work;n.own=before.own;n.sceneBook=before.sceneBook||'';
        if(before.shelfChoice)n.shelfChoice=before.shelfChoice;
        delete n.libraryPrevious;
        go('episode');
      }
      return;
    }
    if(action==='shelf-capture'){captureShelf();return;}
    if(action==='shelf-return'){leaveShelf(note());go('episode');return;}
    if(action==='answer-check' || action==='drill-check'){checkAnswer();return;}
    if(action==='drill-contrast-0' || action==='drill-contrast-1'){
      const drill=catalog.drills.find(item=>item.id===state.exercise), selected=Number(action.slice(-1));
      (state.drillChoices ||= {})[drill.id]=selected;
      const card=panel.querySelector('[data-drill-contrast]');
      card.outerHTML=EssayDrillContrast.render(drill,selected);
      panel.querySelector('#ew-contrast-feedback').focus({preventScroll:true});
      save();return;
    }
    if(action.startsWith('evidence-')){handleEvidence(action);return;}
    if(action==='use-from-book'){
      takeLibraryWork(panel.querySelector('#ew-from-book').value);go('episode');return;
    }
    if(action==='choose-own-book'){
      takeLibraryWork('own');go('episode');panel.querySelector('#ew-own')?.focus();return;
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
      const r=readingsById.get(state.reading),detail=(state.readingNotes[r.id]||'').trim();
      if(!detail){panel.querySelector('#ew-reading-status').textContent='Запиши хотя бы одну деталь в поле выше.';return;}
      if(!state.readingFromLibrary){state.active=r.topic;state.route='quick';}
      takeLibraryWork(r.id,false);
      const a=argument(),quote=readingQuote(r),source=work()?.url;
      if(quote && source && !a.quote && (!a.source || a.source===source)){
        a.quote=quote;a.quoteSource=source;
      }
      if(!a.episode.includes(detail)) updateEditor('episode',[a.episode,detail].filter(Boolean).join('\n'));
      go(state.readingFromLibrary?'episode':'thesis');return;
    }
    if(action.startsWith('pick-')){
      const selected=panel.querySelector('#ew-from-book').value;
      state.active=action.slice(5);takeLibraryWork(selected);go(pageAfterTopic());return;
    }
    if(action==='page-library'){if(state.notes[state.active])booksForThisTopic();else wholeLibrary();return;}
    if(action.startsWith('page-')){if(action==='page-review')state.reviewKind='draft';go(action.slice(5));return;}
    if(action.startsWith('route-')){
      const route=action.slice(6);
      if(route==='drills'||route==='read'||route==='rehearsal'||route==='thesisLab'||route==='draftReader'||route==='themeAtlas'){go(route);return;}
      state.route=route;go('topic');return;
    }
    if(action.startsWith('hint-')){
      const stage=panel.querySelector('[data-stage]').dataset.stage, reason=action.slice(5);
      addTurn(stage,reasons[reason],{assistant:EssayCoach.advise({...context(stage),reason})});return;
    }
    if(action==='forward-topic'){go(pageAfterTopic());return;}
    if(action==='finish-argument'){state.reviewKind='argument';go('review');return;}
    if(action==='download'||action==='download-prompt'){exportText(action==='download-prompt');return;}
    if(action==='snapshot'){
      const n=note(), status=panel.querySelector('#ew-snapshot-status');
      if(!n.draft.trim()){status.textContent='Сначала вставь или напиши текст.';return;}
      if(n.before!==null){status.textContent='Первая версия уже есть. Открой «Сравнить версии» в самопроверке.';return;}
      n.before=n.draft;save();status.textContent='Первая версия сохранена. Теперь внеси правку. Сравнить тексты можно в самопроверке.';
    }
  });
  // A shared exercise opens with the learner's own saved answer for that card.
  function openLinkedExercise() {
    if(location.hash.startsWith('#tema-')){
      const id=location.hash.slice(6);
      const archived=publicTopics.get('public-topic-'+id);
      const chosen=archived || catalog.topics.find(t=>t.id===id);
      if(chosen){selectAtlasTopic({...chosen,official:Boolean(archived)},'books');return true;}
    }
    const drill=catalog.drills.find(d=>location.hash==='#uprazhnenie-'+d.id);
    if (location.hash==='#ot-temy-do-vyvoda') {
      go('writingPractice');
    } else if (location.hash==='#essay-workshop') {
      go('start');
    } else if (location.hash==='#temy-sochineniya') {
      go('themeAtlas');
    } else if (location.hash==='#knizhnaya-polka') {
      wholeLibrary();
    } else if (location.hash==='#polka') {
      go('shelf');
    } else if (drill) {
      state.exercise=drill.id;
      go('drills');
    } else if (location.hash==='#razmetka-chernovika') {
      go('draftReader');
    } else if (location.hash==='#pervoe-chtenie') {
      go('read');
    } else if (location.hash==='#novaya-tema') {
      go('paragraphTrial');
    } else if (location.hash==='#utochnit-tezis') {
      go('thesisLab');
    } else return false;
    try { window.history.replaceState(window.history.state,'',location.href.split('#')[0]); } catch {}
    return true;
  }
  window.addEventListener('popstate',event=>{
    const page=event.state?.essayNavigatorPage;
    if (!steps.some(([id])=>id===page)) return;
    if (page !== 'start' && allTopics().some(t=>t.id===event.state.essayTopic)) {
      state.active=event.state.essayTopic;
      state.route=event.state.essayRoute || state.route;
    }
    go(page,Boolean(state.readingFromLibrary));
  });
  window.addEventListener('hashchange',openLinkedExercise);
  if (!openLinkedExercise()) {render();save();}
})();
