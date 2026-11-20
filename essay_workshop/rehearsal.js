/* An independent attempt has its own record. A review receives a copy. */
const EssayRehearsal = (() => {
  'use strict';
  const prefix = 'uzel.essay-rehearsal.v1.';
  const records = new Map();
  const persisted = new Map();
  const memoryOnly = new Set();
  const durations = {none:0, standard:235, extended:325};
  let selected, cleanup, notice = '', readError = false;

  const h = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const button = (action, label, primary = false) =>
    '<button type="button" data-rehearsal="'+action+'"'+(primary?' class="ew-primary"':'')+'>'+h(label)+'</button>';
  const dateText = time => new Date(time).toLocaleString('ru-RU', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const titleOf = record => record.topics[record.choice] || 'Тема пока не выбрана';
  const makeId = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const ordered = () => [...records.values()].sort((a,b)=>b.started-a.started || b.id.localeCompare(a.id));
  const baseOutput = '<section class="ew-rehearsal"><h2 id="ew-title" tabindex="-1">Самостоятельная репетиция</h2><div data-rehearsal-body></div></section>';

  function valid(record, key) {
    return record && prefix+record.id===key && typeof record.draft==='string' &&
      Array.isArray(record.topics) && record.topics.length===6 && record.topics.every(t=>typeof t==='string') &&
      Number.isInteger(record.choice) && record.choice>=-1 && record.choice<6 &&
      Number.isFinite(record.started) && Number.isFinite(record.finished) && Number.isFinite(record.deadline);
  }

  function loadAll() {
    readError = false;
    try {
      const found = new Set();
      for (let i=0; i<localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(prefix)) continue;
        const raw = localStorage.getItem(key);
        let record;
        try { record = JSON.parse(raw); } catch { continue; }
        if (!valid(record,key)) continue;
        found.add(record.id);
        if (memoryOnly.has(record.id)) continue;
        records.set(record.id, record);
        persisted.set(record.id, raw);
      }
      for (const id of records.keys()) if (!found.has(id) && !memoryOnly.has(id)) {
        records.delete(id);
        persisted.delete(id);
      }
    } catch { readError = true; }
  }

  function write(record) {
    let id = record.id;
    try {
      const raw = localStorage.getItem(prefix+id);
      const expected = persisted.get(id) ?? null;
      if (raw !== expected) {
        // An edit made in another tab stays intact. Save this tab's version too.
        const oldId = id;
        memoryOnly.delete(oldId);
        id = makeId();
        record.id = id;
        if (selected === oldId) selected = id;
        notice = 'В другой вкладке сохранилась своя версия. Работа из этой вкладки записана отдельной попыткой.';
        loadAll();
      }
      const payload = JSON.stringify(record);
      if (payload !== persisted.get(id)) localStorage.setItem(prefix+id,payload);
      persisted.set(id,payload);
      memoryOnly.delete(id);
    } catch { memoryOnly.add(id); }
    records.set(id,record);
    if (memoryOnly.size) window.addEventListener('beforeunload',warnBeforeLeaving);
    else window.removeEventListener('beforeunload',warnBeforeLeaving);
  }

  function warnBeforeLeaving(event) {
    flush();
    if (memoryOnly.size) {event.preventDefault();event.returnValue='';}
  }

  function flush() {
    for (const id of [...memoryOnly]) if (records.has(id)) write(records.get(id));
  }
  function storageText(record) {
    if (record && memoryOnly.has(record.id)) return 'Браузер не сохранил эту попытку. Скачай TXT до закрытия вкладки.';
    if (readError) return 'Сохранения браузера сейчас недоступны. Во время работы можно скачать TXT.';
    return (record ? 'Попытка сохранена в этом браузере.' : '') + (notice?' '+notice:'');
  }

  function topicsIn(catalog,set) {
    const sections = [...new Set(catalog.topics.map(t=>t.section))];
    return sections.flatMap(s=>catalog.topics.filter(t=>t.section===s).slice(set*2,set*2+2).map(t=>t.title));
  }

  function setup() {
    return '<p class="ew-sub">Когда начнёшь, откроются шесть авторских тем. Выбери одну и напиши работу самостоятельно. Можно писать здесь или распечатать темы и взять бумагу.</p>'+
      '<form data-r-form="start"><label for="ew-r-set">Комплект тем</label><select id="ew-r-set" name="set"><option value="0">Комплект 1</option><option value="1">Комплект 2</option></select>'+
      '<label for="ew-r-time">Время на репетицию</label><select id="ew-r-time" name="duration"><option value="standard">3 часа 55 минут</option><option value="extended">5 часов 25 минут · увеличенное время</option><option value="none">Без таймера</option></select>'+
      '<p class="ew-small">Время на выбор темы входит в репетицию. Учебный черновик хранится отдельно.</p>'+
      '<div class="ew-actions"><button class="ew-primary" type="submit">Начать и открыть темы</button></div></form>';
  }

  function chooser(record) {
    return '<fieldset class="ew-r-topics"><legend>Выбери одну тему</legend>'+record.topics.map((t,i)=>
      '<label class="ew-check"><input type="radio" name="rehearsalTopic" value="'+i+'"'+(record.choice===i?' checked':'')+'><span>'+String(i+1)+'. '+h(t)+'</span></label>').join('')+'</fieldset>';
  }

  function writing(record) {
    const selectedTopic = record.choice>=0;
    return '<p class="ew-sub">Комплект '+(record.set+1)+' · авторские тренировочные темы</p>'+
      '<p class="ew-r-clock" data-r-clock role="timer" aria-live="off"></p><p data-r-expired role="status"></p>'+
      (selectedTopic ? '<p class="ew-topic" data-r-title>'+h(titleOf(record))+'</p><details><summary>Посмотреть шесть тем или изменить выбор</summary><div>'+chooser(record)+'</div></details>' : chooser(record))+
      '<div class="ew-actions">'+button('print','Распечатать темы')+'</div>'+
      '<div class="ew-field"'+(selectedTopic?'':' hidden')+'><label for="ew-r-draft">Моё сочинение</label><textarea id="ew-r-draft" rows="13">\n'+h(record.draft)+'</textarea></div>'+
      '<div class="ew-actions">'+button('download','Скачать попытку (TXT)')+(selectedTopic?button('finish','Завершить репетицию',true):'')+'</div>'+
      '<div data-r-confirm></div><p class="ew-small" data-r-status role="status">'+h(storageText(record))+'</p>';
  }

  function finished(record) {
    return '<p class="ew-sub">Репетиция завершена · '+h(dateText(record.finished))+'</p><p class="ew-topic">'+h(titleOf(record))+'</p>'+
      (record.draft?'<details><summary>Прочитать исходную работу</summary><div class="ew-note">'+h(record.draft)+'</div></details>':'<p>В этой попытке сохранена тема. Текст с бумаги можно внести при разборе.</p>')+
      '<div class="ew-actions">'+button('review',record.draft?'Разобрать копию работы':'Ввести текст с бумаги для разбора',true)+button('download','Скачать попытку (TXT)')+button('new','Новая репетиция')+'</div>'+
      '<p class="ew-small" data-r-status role="status">'+h(storageText(record))+'</p>';
  }

  function history() {
    const other = ordered().filter(r=>r.id!==selected);
    if (!other.length) return '';
    return '<details><summary>Другие мои попытки ('+other.length+')</summary><div class="ew-r-history">'+other.map(r=>
      '<button type="button" data-r-open="'+h(r.id)+'">'+h(dateText(r.started))+' · '+(r.finished?'Завершена':'Продолжить')+'<br>'+h(titleOf(r))+'</button>').join('')+'</div></details>';
  }

  function download(record) {
    const lines = ['Самостоятельная репетиция итогового сочинения','Начало: '+dateText(record.started),
      record.finished?'Завершена: '+dateText(record.finished):'Попытка продолжается','Комплект '+(record.set+1),titleOf(record),'',record.draft];
    const url = URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\n')], {type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href=url; link.download='sochinenie-'+record.id+'.txt'; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function printTopics(record) {
    document.querySelector('.ew-r-printout')?.remove();
    const sheet=document.createElement('section');
    sheet.className='ew-r-printout';
    sheet.innerHTML='<h1>Итоговое сочинение</h1><p>Самостоятельная репетиция · Комплект '+(record.set+1)+'</p>'+
      '<p>Выбери одну из шести авторских тренировочных тем. Запиши её номер и название. Дай свой ответ и обоснуй его примером из прочитанного произведения.</p>'+
      '<ol>'+record.topics.map(t=>'<li>'+h(t)+'</li>').join('')+'</ol>';
    document.body.append(sheet);
    const remove=()=>sheet.remove();
    window.addEventListener('afterprint',remove,{once:true});
    window.print();
  }

  function mount(panel,catalog,onReview) {
    unmount();
    const root=panel.querySelector('.ew-rehearsal');
    if (!root) return;
    const body=root.querySelector('[data-rehearsal-body]');
    loadAll();
    if (selected === undefined || (selected && !records.has(selected))) {
      selected=ordered().find(r=>!r.finished)?.id || ordered()[0]?.id || null;
    }
    let timer=0;
    const controller=new AbortController();
    const options={signal:controller.signal};
    function updateClock(record) {
      const clock=body.querySelector('[data-r-clock]');
      if (!clock) return;
      if (!record.deadline) {clock.textContent='Без таймера';return;}
      const seconds=Math.max(0,Math.ceil((record.deadline-Date.now())/1000));
      const hours=Math.floor(seconds/3600), minutes=Math.floor(seconds%3600/60);
      clock.textContent='Осталось '+hours+':'+String(minutes).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
      if (seconds===0) {
        const expired=body.querySelector('[data-r-expired]');
        if (!expired.textContent) expired.textContent='Время вышло. Ты можешь завершить попытку сейчас или дописать её.';
        clearInterval(timer);timer=0;
      }
    }
    function draw(focus) {
      clearInterval(timer);timer=0;
      const record=records.get(selected);
      body.innerHTML=(record?(record.finished?finished(record):writing(record)):setup()+'<p class="ew-small" data-r-status role="status">'+h(storageText(null))+'</p>')+history();
      if (record && !record.finished) {
        updateClock(record);
        if (record.deadline>Date.now()) timer=setInterval(()=>{
          if (!root.isConnected) {unmount();return;}
          updateClock(record);
        },1000);
      }
      if (focus) body.querySelector(focus)?.focus();
    }
    function updateStatus(record) {
      const status=body.querySelector('[data-r-status]');
      const next=storageText(record);
      if (status && status.textContent!==next) status.textContent=next;
    }
    root.addEventListener('submit',event=>{
      const form=event.target;
      if (form.dataset.rForm!=='start') return;
      event.preventDefault();
      if (selected) return;
      const set=Number(form.elements.set.value), minutes=durations[form.elements.duration.value];
      if (![0,1].includes(set)||!Number.isFinite(minutes)) return;
      const topics=topicsIn(catalog,set);
      if (topics.length!==6) return;
      const now=Date.now();
      const record={id:makeId(),set,topics,choice:-1,draft:'',started:now,deadline:minutes?now+minutes*60000:0,finished:0};
      selected=record.id;notice='';write(record);draw('input[name="rehearsalTopic"]');
    },options);
    root.addEventListener('change',event=>{
      const field=event.target;
      const record=records.get(selected);
      if (!record||record.finished||field.name!=='rehearsalTopic') return;
      const i=Number(field.value);
      if (!Number.isInteger(i)||i<0||i>=6) return;
      record.choice=i;write(record);draw('#ew-r-draft');
    },options);
    root.addEventListener('input',event=>{
      const record=records.get(selected);
      if (record && !record.finished && event.target.id==='ew-r-draft') {
        record.draft=event.target.value;write(record);updateStatus(record);
      }
    },options);
    root.addEventListener('click',event=>{
      const target=event.target.closest('button');
      if (!target) return;
      if (target.dataset.rOpen && records.has(target.dataset.rOpen)) {
        selected=target.dataset.rOpen;notice='';draw();root.querySelector('h2')?.focus();return;
      }
      const record=records.get(selected), action=target.dataset.rehearsal;
      if (!record||!action) return;
      if (action==='download') {download(record);return;}
      if (action==='print') {printTopics(record);return;}
      if (action==='review' && record.finished) {
        onReview({title:titleOf(record),draft:record.draft,attemptId:record.id});return;
      }
      if (action==='new' && record.finished) {selected=null;notice='';draw('#ew-r-set');return;}
      if (!record.finished && record.choice>=0) {
        const confirm=body.querySelector('[data-r-confirm]');
        if (action==='finish') {
          confirm.innerHTML='<p>'+(record.draft.trim()?'Сохранить эту версию как законченную? Для правок после этого можно открыть копию.':'В поле сочинения пока пусто. Если работа написана на бумаге, можно сохранить выбранную тему и завершить репетицию.')+'</p><div class="ew-actions">'+button('confirm','Да, завершить',true)+button('continue','Продолжить писать')+'</div>';
          confirm.querySelector('button').focus();
        } else if (action==='confirm') {
          record.finished=Date.now();write(record);draw('[data-rehearsal="review"]');
        } else if (action==='continue') {
          confirm.replaceChildren();body.querySelector('#ew-r-draft').focus();
        }
      }
    },options);
    const onVisibility=()=>{
      if (document.visibilityState==='hidden') {flush();return;}
      const record=records.get(selected);
      if (record && !record.finished) updateClock(record);
    };
    document.addEventListener('visibilitychange',onVisibility,options);
    window.addEventListener('pagehide',flush,options);
    cleanup=()=>{clearInterval(timer);controller.abort();flush();};
    draw();
  }
  function unmount() {
    if (cleanup) {const release=cleanup;cleanup=null;release();}
  }
  return Object.freeze({render:()=>baseOutput,mount,unmount});
})();
