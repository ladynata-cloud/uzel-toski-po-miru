/* Browses embedded topics. An example published by FIPI is not an upcoming exam topic. */
const EssayThemeAtlas = (() => {
  'use strict';
  const pageSize=18;
  const publicGroup='@public', authorGroup='@workshop';
  const view={query:'',section:'',subsection:'',source:publicGroup,limit:pageSize,own:''};
  const kinds={sample:'Официальный образец комплекта',history_examples:'Опубликованный пример исторической темы',
    literature_examples:'Пример литературной темы',past:'Тема прошедшего сочинения',training:'Методический материал',secondary_index:'Архив 4ЕГЭ · вторичный источник'};
  const readingIdeas=[
    [/сострадан|милосерд|бескорыст|доброт|чутк|помо[гч]/u,['doctor','yushka','last-leaf','relics']],
    [/совест|раская|покаян|преступлен|прощен/u,['classic-crime-and-punishment','violin','captain']],
    [/музык|искусств|худож|творче|талант/u,['singers','mozart-salieri','last-leaf','violin']],
    [/природ|животн|окружающ.{0,4} мир/u,['meadow','shelf-senior-027','classic-fathers-and-sons']],
    [/семь|семе[йе]|родител|поколен|матер|отцов|детств/u,['classic-fathers-and-sons','doctor','classic-war-and-peace']],
    [/воин|войн|военн|фронт|отечеств|родин|патриот/u,['borodino','classic-war-and-peace','shelf-senior-001']],
    [/честь|честн|верност|предатель|присяг|долг/u,['captain','classic-war-and-peace','ball']],
    [/одиноч|равнодуш|унижен|достоинств/u,['overcoat','yushka','doctor']]
  ];
  const clean=value=>String(value??'').toLocaleLowerCase('ru').replace(/ё/gu,'е').trim();
  const escape=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function options(items,chosen){return items.map(([id,name])=>'<option value="'+escape(id)+'"'+(id===chosen?' selected':'')+'>'+escape(name)+'</option>').join('');}
  function button(act,label){return '<button type="button" data-ta-act="'+act+'">'+escape(label)+'</button>';}
  function preciseTitle(question,known){
    const exact=[];
    for(const match of question.matchAll(/«([^«»]+)»/gu)){
      const prefix=question.slice(Math.max(0,match.index-100),match.index).replace(/[А-ЯЁ]\./gu,'');
      if(!/(?:роман|повест|рассказ|пьес|трагеди|комеди|книг|поэм|басн|произведени|стихотворени)[а-яё]*[^.!?«»]{0,65}$/iu.test(prefix))continue;
      const name=clean(match[1]);
      for(const [id,work] of known){
        const title=work.title.match(/«([^«»]+)»/u)?.[1];
        if(title&&clean(title)===name)exact.push(id);
      }
    }
    return [...new Set(exact)];
  }
  function authorSearch(question,known){
    const restriction=question.match(/(?:[Пп]о (?:одному или нескольким )?(?:произведениям?|произведению|рассказам?|стихотворениям?)|[Тт]ворчеств[оеау]|[Вв] произведениях)\s+((?:[А-ЯЁ]\.\s*){0,2}[А-ЯЁ][а-яё-]{2,})/u);
    if(!restriction)return '';
    const surname=clean(restriction[1].split(/\.\s*/u).at(-1));
    const stem=surname.replace(/([сц])к(?:ого|ой)$/u,'$1к').replace(/([иео][нв])[ауе]$/u,'$1').replace(/(?:ого|а|у)$/u,'');
    if(stem.length<4)return '';
    const authors=[...known.values()].map(w=>w.title.split('«')[0]).flatMap(s=>s.match(/[А-ЯЁ][а-яё-]{2,}/gu)||[]);
    const match=authors.find(name=>clean(name).startsWith(stem));
    return match||'';
  }
  function related(row,known){
    const explicit=row.books.filter(id=>known.has(id));
    if(explicit.length)return {ids:explicit};
    const exact=preciseTitle(row.title,known);
    if(exact.length)return {ids:exact};
    const text=clean(row.title);
    const historical=['history_examples','past','secondary_index'].includes(row.sourceKind)||
      /истори|(?:велик|отечественн|гражданск|миров)[а-я]*\s+войн|\b[ivx]+\s*(?:век|столет)|(?:18|19|20)\d{2}|блокад/iu.test(text);
    const named=/«|[А-ЯЁ]\.\s*[А-ЯЁ]|(?:творчеств|по произведен|в романе|в повести)/u.test(row.title);
    if(historical||named)return {search:authorSearch(row.title,known)};
    const ids=readingIdeas.filter(([expression])=>expression.test(text)).flatMap(([,ids])=>ids);
    return {ids:[...new Set(ids.filter(id=>known.has(id)))].slice(0,6)};
  }
  function sourceLabel(source){
    const year=source.year?String(source.year):'';
    return source.title+(year&&!source.title.includes(year)?' · '+year:'');
  }
  function editorialReading(reading,title){
    return '<div class="ew-text-card" data-editorial-reading><p class="ew-small">Материал к теме по выбору мастерской</p>'+
      '<p><strong>'+escape(title)+'</strong> · '+escape(reading.passage)+'</p><p>'+escape(reading.observation)+'</p>'+
      '<p><strong>Вопрос мастерской</strong> · '+escape(reading.question)+'</p>'+
      '<a target="_blank" rel="noopener noreferrer" href="'+escape(reading.url)+'">Прочитать в источнике</a></div>';
  }
  function render(catalog,sections){
    const pub=catalog.publicTopics||{sources:[],sections:[],topics:[]};
    const sources=[[publicGroup,'Все опубликованные подборки'],[authorGroup,'Учебные темы мастерской'],...pub.sources.map(s=>[s.id,sourceLabel(s)])];
    const sectionChoices=[['','Все разделы'],...sections.map((s,i)=>[String(i+1),String(i+1)+'. '+s]),['?','Раздел не указан']];
    const references=[[pub.directoryUrl,'Материалы ФИПИ'],[pub.structureUrl,'Разделы и подразделы банка'],[pub.archiveUrl,'Архив 4ЕГЭ']].filter(([url])=>/^https?:\/\//u.test(url||''));
    const info='<details><summary>Откуда взяты темы</summary><p>В опубликованных подборках '+pub.topics.length+' позиций. Некоторые вопросы встречаются в нескольких источниках. Отдельно можно выбрать учебные темы «Узла»: '+catalog.topics.length+'.</p>'+
      (pub.scope?'<p>'+escape(pub.scope)+'</p>':'')+'<p>'+references.map(([url,title])=>'<a target="_blank" rel="noopener noreferrer" href="'+escape(url)+'">'+escape(title)+'</a>').join(' · ')+'</p></details>';
    return '<section id="ew-theme-atlas"><h2 id="ew-title" tabindex="-1">Библиотека тем итогового сочинения</h2>'+
      '<p class="ew-sub">Можно взять опубликованную тему, потренироваться на вопросе мастерской или записать свой. Состав предстоящего экзаменационного комплекта заранее неизвестен.</p>'+
      info+
      '<details id="ta-own"><summary>Мой вопрос · ввести свою тему</summary><form data-ta-own-form><label for="ta-own-title">Формулировка моей темы</label>'+
      '<input id="ta-own-title" data-ta-field="own" required maxlength="500" value="'+escape(view.own)+'"><div class="ew-actions"><button type="submit" data-ta-act="own">Писать на свою тему</button></div></form></details>'+
      '<div class="ew-library-filters"><div><label for="ta-search">Найти тему</label><input type="search" id="ta-search" value="'+escape(view.query)+'" placeholder="Слова темы, код, автор или книга" autocomplete="off"></div>'+
      '<div><label for="ta-source">Источник тем</label><select id="ta-source">'+options(sources,view.source)+'</select></div>'+
      '<div><label for="ta-section">Раздел банка</label><select id="ta-section">'+options(sectionChoices,view.section)+'</select></div>'+
      '<div><label for="ta-subsection">Подраздел</label><select id="ta-subsection"></select></div></div>'+
      '<p id="ta-count" class="ew-small ew-library-status" role="status"></p><div id="ta-list"></div>'+
      '<div class="ew-actions"><button type="button" data-ta-act="more" hidden>Показать ещё темы</button><button type="button" data-ta-act="subsection-workshop" hidden>Показать учебные темы этого подраздела</button></div>'+
      '<div id="ta-editorial-examples"></div></section>';
  }
  function mount(panel,catalog,sectionNames,select){
    const host=panel.querySelector('#ew-theme-atlas'),pub=catalog.publicTopics||{sources:[],sections:[],topics:[]};
    const works=new Map(catalog.works.map(w=>[w.id,w]));
    const sources=new Map(pub.sources.map(s=>[s.id,s]));
    const sectionTitles=new Map(pub.sections.map(s=>[String(s.id),s.title]));
    const rows=pub.topics.map(t=>({...t,key:'p:'+t.id,official:true,sourceKind:sources.get(t.source)?.kind,section:String(t.section||''),books:Array.isArray(t.books)?t.books:[]}));
    for(const t of catalog.topics){
      const top=sectionNames.indexOf(t.section)+1;
      rows.push({id:t.id,key:'w:'+t.id,title:t.title,source:authorGroup,section:String(t.subsection||(top?top:'')),books:t.work?[t.work]:[],official:false});
    }
    const byKey=new Map(rows.map(row=>[row.key,row]));
    for(const r of rows){
      const source=sources.get(r.source);
      const readingTitle=r.editorialReading?.ownTitle||works.get(r.editorialReading?.work)?.title||'';
      r.search=clean([r.title,r.code||'',r.section,r.date||'',r.region||'',r.zone||'',source?.year||'',source?.title||'',readingTitle,...r.books.map(id=>works.get(id)?.title||'')].join(' '));
    }
    function subsectionOptions(){
      const choices=pub.sections.filter(s=>String(s.id).includes('.')&&(!view.section||String(s.id).startsWith(view.section+'.')));
      if(!choices.some(s=>String(s.id)===view.subsection))view.subsection='';
      host.querySelector('#ta-subsection').innerHTML=options([['','Все подразделы'],...choices.map(s=>[String(s.id),s.id+' · '+s.title])],view.subsection);
      host.querySelector('#ta-subsection').disabled=!choices.length;
    }
    function card(row){
      const source=sources.get(row.source),book=works.get(row.books[0]),meta=[];
      if(row.official){
        meta.push(kinds[source?.kind]||'Опубликованная тема');
        if(source?.year)meta.push(source.year);
        if(row.date)meta.push(row.date);
        if(row.region)meta.push(row.region);
        if(row.zone)meta.push(row.zone);
        if(row.code)meta.push('№ '+row.code);
      }else meta.push('Учебная тема мастерской');
      if(row.section)meta.push((row.section.includes('.')?'Подраздел ':'Раздел ')+row.section);
      const src=source&&/^https?:\/\//u.test(source.url)?'<p class="ew-small">Источник: <a target="_blank" rel="noopener noreferrer" href="'+escape(source.url)+'">'+escape(source.title)+'</a></p>':'';
      return '<article class="ew-library-book" data-ta-card="'+escape(row.key)+'" data-ta-source="'+escape(row.source)+'"><p class="ew-small">'+escape(meta.join(' · '))+'</p>'+
        '<h3 tabindex="-1">'+escape(row.title)+'</h3>'+src+
        (!row.official&&book?'<p class="ew-small">'+escape(book.title)+'</p>':'')+
        (row.section.includes('.')&&sectionTitles.has(row.section)?'<p class="ew-small">'+(!row.official?'Подбор мастерской по подразделам · ':'')+escape(sectionTitles.get(row.section))+'</p>':'')+
        '<div class="ew-actions">'+button('write','Писать на эту тему')+button('books','Подобрать книги')+button('ownBook','Взять свою книгу')+'</div><div data-ta-book-box hidden></div></article>';
    }
    function fillBookOptions(box){
      const query=clean(box.querySelector('[data-ta-book-search]').value);
      const matches=[...works.values()].filter(w=>query.split(/\s+/u).every(word=>clean(w.title).includes(word)));
      box.querySelector('[data-ta-book-count]').textContent=matches.length?'Найдено книг: '+matches.length+'.':'Книга не найдена. Укажи своё произведение или измени запрос.';
      const field=box.querySelector('[data-ta-book-choice]'),open=box.querySelector('[data-ta-act="book-choice"]');
      const selected=field.value;
      field.innerHTML='<option value="">Выбери книгу</option>'+options(matches.map(w=>[w.id,w.title]),selected);
      field.disabled=!matches.length;
      open.disabled=!field.value;
    }
    function chooseBook(card,row,query){
      const box=card.querySelector('[data-ta-book-box]'),key=card.dataset.taCard;
      if(!box.hidden){box.querySelector('[data-ta-book-search]').focus();return;}
      box.hidden=false;
      const reading=row.editorialReading;
      const suggestion=reading?'<div data-ta-route>'+editorialReading(reading,reading.ownTitle||works.get(reading.work).title)+
        button('use-route',reading.ownTitle?'Взять этот текст как своё произведение':'Взять этот эпизод для своей темы')+'</div>':'';
      box.innerHTML=suggestion+'<p>Проверь, ограничивает ли вопрос выбор произведения, автора или исторической эпохи.</p>'+
        '<label for="'+escape(key+'-find')+'">Найти книгу по автору или названию</label><input type="search" data-ta-book-search id="'+escape(key+'-find')+'" value="'+escape(query)+'">'+
        '<p data-ta-book-count role="status" class="ew-small"></p><label for="'+escape(key+'-book')+'">Мой выбор</label><select data-ta-book-choice id="'+escape(key+'-book')+'"></select>'+
        '<div class="ew-actions">'+button('book-choice','Открыть выбранную книгу')+button('ownBook','Указать другое произведение')+'</div>';
      fillBookOptions(box);
      box.querySelector(reading?'[data-ta-act="use-route"]':'[data-ta-book-search]').focus();
    }
    function show(){
      const terms=clean(view.query).split(/\s+/u).filter(Boolean);
      const matches=rows.filter(r=>(view.source===publicGroup?r.official:r.source===view.source)&&
        (!view.section||(view.section==='?'?!r.section:r.section.split('.')[0]===view.section))&&
        (!view.subsection||r.section===view.subsection)&&terms.every(q=>r.search.includes(q)));
      const list=host.querySelector('#ta-list'),visible=matches.slice(0,view.limit);
      list.innerHTML=visible.map(card).join('');
      host.querySelector('#ta-count').textContent=matches.length?'Найдено: '+matches.length+'. Показано: '+visible.length+'.':
        'Под эти условия темы не найдены. Измени запрос, источник или подраздел.';
      host.querySelector('[data-ta-act="more"]').hidden=visible.length>=matches.length;
      host.querySelector('[data-ta-act="subsection-workshop"]').hidden=!(view.subsection&&view.source!==authorGroup);
      const curated=pub.sections.find(s=>s.id===view.subsection)?.editorialExampleIds||[];
      const examples=curated.map(id=>byKey.get('p:'+id)).filter(r=>r&&r.section!==view.subsection&&
        (view.source===publicGroup||view.source===r.source)&&terms.every(q=>r.search.includes(q)));
      host.querySelector('#ta-editorial-examples').innerHTML=examples.length?'<details><summary>Опубликованные вопросы по выбору мастерской</summary><p>Мастерская предлагает обсудить эти вопросы в подразделе '+escape(view.subsection)+'. В публикациях каждого вопроса такая привязка не указана.</p>'+examples.map(card).join('')+'</details>':'';
    }
    subsectionOptions();show();
    host.addEventListener('input',event=>{
      if(event.target.hasAttribute('data-ta-book-search')){fillBookOptions(event.target.closest('[data-ta-book-box]'));return;}
      if(event.target.id==='ta-own-title'){view.own=event.target.value;return;}
      if(event.target.id!=='ta-search')return;
      view.query=event.target.value;view.limit=pageSize;show();
    });
    host.addEventListener('change',event=>{
      if(event.target.hasAttribute('data-ta-book-choice')){
        const open=event.target.closest('[data-ta-book-box]').querySelector('[data-ta-act="book-choice"]');
        open.disabled=!works.has(event.target.value);
        return;
      }
      const key={'ta-section':'section','ta-subsection':'subsection','ta-source':'source'}[event.target.id];
      if(!key)return;view[key]=event.target.value;
      if(key==='section'){view.subsection='';subsectionOptions();}
      view.limit=pageSize;show();
    });
    host.addEventListener('click',event=>{
      const b=event.target.closest('[data-ta-act]');if(!b||b.type==='submit')return;
      const mode=b.dataset.taAct;
      if(mode==='subsection-workshop'){
        view.source=authorGroup;view.query='';view.limit=pageSize;
        host.querySelector('#ta-source').value=authorGroup;host.querySelector('#ta-search').value='';
        show();host.querySelector('#ta-list h3')?.focus({preventScroll:true});return;
      }
      if(mode==='more'){
        const n=host.querySelectorAll('#ta-list [data-ta-card]').length;
        view.limit+=pageSize;show();
        host.querySelectorAll('#ta-list [data-ta-card] h3')[n]?.focus({preventScroll:true});return;
      }
      const item=b.closest('[data-ta-card]'),row=byKey.get(item?.dataset.taCard);
      if(!row)return;
      if(mode==='use-route'&&row.editorialReading){
        select(row,mode,[]);return;
      }
      if(mode==='book-choice'){
        const id=item.querySelector('[data-ta-book-choice]').value;
        if(works.has(id))select(row,'manual-book',[id]);return;
      }
      if(mode==='books'){
        const next=related(row,works);
        if('search' in next)chooseBook(item,row,next.search);
        else select(row,mode,next.ids);
      }else select(row,mode,[]);
    });
    host.querySelector('[data-ta-own-form]').addEventListener('submit',event=>{
      event.preventDefault();
      const field=host.querySelector('#ta-own-title'),title=field.value.trim();
      if(!title){field.setCustomValidity('Запиши формулировку своей темы.');field.reportValidity();field.setCustomValidity('');return;}
      view.own='';select({title,own:true},'write',[]);
    });
  }
  return Object.freeze({render,mount,editorialReading});
})();
