const EssayShelf = (() => {
  'use strict';
  const prefix = 'uzel.essay-shelf.v1.';
  const inMemory = new Map();
  const pending = new Map();
  const h = value => String(value ?? '').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = value => String(value || '').trim();
  function id() {
    return globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  }
  function valid(card) {
    return card && typeof card.id==='string' && typeof card.title==='string' &&
      typeof card.observation==='string' && typeof card.source==='string';
  }
  function list() {
    try {
      const stored = new Map();
      for (let i=0; i<localStorage.length; i++) {
        const key=localStorage.key(i);
        if (!key?.startsWith(prefix)) continue;
        try {
          const card=JSON.parse(localStorage.getItem(key));
          if(valid(card) && prefix+card.id===key) stored.set(card.id,card);
        } catch { /* One unreadable card must not hide the others. */ }
      }
      inMemory.clear();
      for(const [key,card] of stored) inMemory.set(key,card);
    } catch { /* Cards created in this session remain available. */ }
    for (const [key,card] of pending) {
      if (card) inMemory.set(key,card); else inMemory.delete(key);
    }
    return [...inMemory.values()].sort((a,b)=>b.createdAt-a.createdAt);
  }
  function persist(key,card) {
    try {
      if (card) localStorage.setItem(prefix+key,JSON.stringify(card));
      else localStorage.removeItem(prefix+key);
      pending.delete(key);
      return true;
    } catch {
      pending.set(key,card);
      return false;
    }
  }
  function add(value) {
    const title=clean(value.title),source=clean(value.source),observation=clean(value.observation);
    if(!title) return {message:'Укажи название произведения.'};
    if(!observation) return {message:'Запиши, что именно ты заметил в сцене.'};
    if(!source) return {message:'Укажи, где найти это место: главу, страницу, издание или ссылку.'};
    const bookId=value.bookId||'own', quote=clean(value.quote);
    const previous=list().find(c=>c.bookId===bookId && c.title===title && c.source===source &&
      c.observation===observation && (!quote || !c.quote || c.quote===quote));
    const card=previous || {id:id(),createdAt:Date.now(),bookId,title,source,observation};
    if(quote)card.quote=quote;
    if(value.reviewCard)card.reviewCard=value.reviewCard;
    inMemory.set(card.id,card);
    const saved=persist(card.id,card);
    return {card,message:saved?(previous?'Эта сцена уже есть на полке.':'Сцена сохранена на полке.'):
      'Сцена доступна до закрытия страницы. Браузер не смог сохранить её. Открой полку и скачай карточки.'};
  }
  function remove(key) {
    inMemory.delete(key);
    return persist(key,null);
  }
  function sourceRef(value) {
    try {
      const url=new URL(value);
      if(url.protocol==='https:' || url.protocol==='http:') {
        return '<a href="'+h(url.href)+'" target="_blank" rel="noopener noreferrer">Открыть источник ↗</a>';
      }
    } catch { /* A page number or chapter title is a valid reference. */ }
    return h(value);
  }
  function excerpt(quote,source) {
    if(!quote)return '';
    return '<details data-shelf-excerpt><summary>Перечитать отрывок</summary><div>'+
      '<blockquote class="ew-note">'+h(quote)+'</blockquote><p class="ew-small">Источник · '+sourceRef(source)+'</p></div></details>';
  }
  const btn = (action,label,primary=false) => '<button type="button" data-shelf-action="'+action+'"'+(primary?' class="ew-primary"':'')+'>'+h(label)+'</button>';
  function cardMarkup(card,topics,active) {
    const opts=topics.map(t=>'<option value="'+h(t.id)+'"'+(t.id===active?' selected':'')+'>'+h(t.title)+'</option>').join('');
    const key=h(card.id);
    return '<article class="ew-text-card" data-shelf-card="'+key+'"><h3>'+h(card.title)+'</h3>'+
      '<p class="ew-note">'+h(card.observation)+'</p>'+EssayReadingLens.detail('shelf')+
      (card.quote?excerpt(card.quote,card.source):'<p class="ew-small">Источник · '+sourceRef(card.source)+'</p>')+
      '<div class="ew-actions">'+btn('choose','Взять для темы',true)+btn('remove','Убрать с полки')+'</div>'+
      '<form data-shelf-use hidden><div class="ew-field"><label for="ew-shelf-topic-'+key+'">К какой теме подходит эта сцена?</label>'+
      '<select id="ew-shelf-topic-'+key+'" name="topic">'+opts+'<option value="!new">Ввести свою тему…</option></select></div>'+
      '<div data-new-topic hidden><label for="ew-shelf-new-'+key+'">Моя тема</label><input name="newTopic" id="ew-shelf-new-'+key+'" maxlength="500" disabled></div>'+
      '<button class="ew-primary" type="submit" data-shelf-action="apply">Объяснить связь с темой</button></form>'+
      '<div data-shelf-confirm hidden><p>Убрать эту карточку? Записи в начатых сочинениях сохранятся.</p>'+
      '<div class="ew-actions">'+btn('delete','Да, убрать')+btn('keep','Оставить')+'</div></div></article>';
  }
  function render({topics,active}) {
    const cards=list();
    return '<section id="ew-shelf"><h2 id="ew-title" tabindex="-1">Моя полка</h2>'+
      '<p class="ew-sub">Сохрани поступок, реплику или деталь из книги. Позже можно взять ту же сцену для другой темы и объяснить её по-новому.</p>'+
      '<p data-shelf-status role="status" class="ew-small"></p>'+
      (!cards.length?'<p>Пока здесь пусто. Можно добавить сцену из своей книги или выбрать занятие на книжной полке.</p>':'')+
      '<details data-shelf-add><summary>Добавить сцену из своей книги</summary><div><form data-new-scene>'+
      '<label for="ew-shelf-book">Книга и автор</label><input name="book" id="ew-shelf-book" required>'+
      '<label for="ew-shelf-observation">Какую сцену я хочу запомнить?</label><textarea name="observation" id="ew-shelf-observation" required rows="3"></textarea>'+
      '<label for="ew-shelf-quote">Короткая цитата из книги (по желанию)</label><textarea name="quote" id="ew-shelf-quote" rows="2"></textarea>'+
      '<label for="ew-shelf-source">Где найти эту сцену?</label><input name="source" id="ew-shelf-source" placeholder="Глава, страница, издание или ссылка" required>'+
      '<div class="ew-actions"><button class="ew-primary" type="submit">Сохранить сцену</button></div></form></div></details>'+
      (cards.length?'<div class="ew-actions">'+btn('export','Скачать карточки (.txt)')+'</div>':'<div class="ew-actions"><button type="button" data-act="page-library">Открыть книжную полку</button></div>')+
      '<div data-shelf-list>'+cards.map(c=>cardMarkup(c,topics,active)).join('')+'</div>'+
      '<div class="ew-actions"><button type="button" data-act="page-paragraphTrial">Абзац на новую тему</button></div></section>';
  }
  function mount(panel,context) {
    const shelf=panel.querySelector('#ew-shelf');
    if(!shelf) return;
    const announce=text=>{shelf.querySelector('[data-shelf-status]').textContent=text;};
    const cardNode=el=>el.closest('[data-shelf-card]');
    function show(message) {
      panel.innerHTML=render(context);
      mount(panel,context);
      const status=panel.querySelector('[data-shelf-status]');
      status.textContent=message;
      panel.querySelector('#ew-title').focus({preventScroll:true});
    }
    shelf.addEventListener('change',event=>{
      const el=event.target;
      if(el.name!=='topic')return;
      const box=el.form.querySelector('[data-new-topic]'),input=box.querySelector('input'),custom=el.value==='!new';
      box.hidden=!custom;input.disabled=!custom;input.required=custom;
      if(custom)input.focus();
    });
    shelf.addEventListener('submit',event=>{
      event.preventDefault();
      const form=event.target;
      if(form.matches('[data-new-scene]')){
        const result=add({bookId:'own',title:form.elements.book.value,source:form.elements.source.value,
          observation:form.elements.observation.value,quote:form.elements.quote.value});
        if(result.card)show(result.message);else announce(result.message);
        return;
      }
      if(!form.matches('[data-shelf-use]'))return;
      const card=list().find(c=>c.id===cardNode(form)?.dataset.shelfCard);
      if(!card){show('Эту сцену уже убрали с полки.');return;}
      const value=form.elements.topic.value;
      if(value==='!new' && !form.elements.newTopic.value.trim()){
        form.elements.newTopic.setCustomValidity('Напиши формулировку темы.');
        form.elements.newTopic.reportValidity();
        form.elements.newTopic.setCustomValidity('');return;
      }
      context.use(card,value==='!new'?{title:form.elements.newTopic.value.trim()}:{id:value});
    });
    shelf.addEventListener('click',event=>{
      const button=event.target.closest('[data-shelf-action]');
      if(!button || button.type==='submit')return;
      const action=button.dataset.shelfAction, node=cardNode(button);
      if(action==='choose') {
        const form=node.querySelector('[data-shelf-use]');
        form.hidden=false;node.querySelector('[data-shelf-confirm]').hidden=true;
        form.elements.topic.focus();
      } else if(action==='remove'||action==='keep') {
        const box=node.querySelector('[data-shelf-confirm]');
        box.hidden=action==='keep';node.querySelector('[data-shelf-use]').hidden=true;
        (box.hidden?node.querySelector('[data-shelf-action=remove]'):box.querySelector('[data-shelf-action=keep]')).focus();
      } else if(action==='delete') {
        const ok=remove(node.dataset.shelfCard);
        show(ok?'Карточка убрана с полки.':'Карточка убрана только на этой странице: браузер не разрешил изменить сохранение.');
      } else if(action==='export') {
        const text=list().map(c=>[c.title,'Моё наблюдение: '+c.observation,
          c.quote?'Отрывок: '+c.quote:'','Источник: '+c.source].filter(Boolean).join('\n')).join('\n\n');
        const url=URL.createObjectURL(new Blob(['\uFEFFМоя полка\n\n'+text],{type:'text/plain;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download='moya-polka.txt';a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Файл с карточками подготовлен.');
      }
    });
  }
  return Object.freeze({add,render,mount,sourceRef,excerpt});
})();
