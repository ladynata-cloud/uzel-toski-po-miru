/* Topic-scoped records. Each source remains immutable once its reading starts. */
const EssayDraftReader = (() => {
  'use strict';
  const markNames={deed:'Поступок или деталь из книги',idea:'Моя собственная мысль'};
  const work = {
    repeat:{label:'Сократить повтор',question:'Какие две фразы говорят почти одно и то же?',task:'Убери одну из них. Прочитай переход вслух и верни нужную деталь, если без неё мысль стала беднее.'},
    retell:{label:'Перейти от пересказа к объяснению',question:'Какое одно событие нужно читателю, чтобы понять твой вывод?',task:'Оставь это событие и добавь своё объяснение. Что именно в поступке подтверждает ответ на тему?'},
    reading:{label:'Развить мою трактовку',question:'Какое слово или действие в сцене читатель мог бы понять иначе?',task:'Покажи, как выбранная деталь поддерживает твоё прочтение. Если возможна другая трактовка, объясни, почему ты выбираешь свою.'},
    guess:{label:'Проверить догадку о герое',question:'Где ты переходишь от того, что герой сделал, к догадке о том, чего он хотел?',task:'Найди в эпизоде опору для догадки или уточни степень своей уверенности. Дай читателю увидеть, что известно из текста и что предполагаешь ты.'}
  };
  const titles={source:'Мой черновик',mark:'Где в тексте поступок, а где моя мысль?',choose:'Какое место я хочу доработать?',revise:'Как я изменю текст?',compare:'Что изменилось после моей правки?'};
  const hints={source:'Вставь весь текст или один абзац. Ты можешь взять черновик, который уже написал по этой теме.',mark:'Отметь две фразы в своей исходной версии. Можно выделить слова или ввести их с клавиатуры.',choose:'Прочитай свои отметки рядом. Выбери, с чем хочешь поработать.', revise:'Перепиши выбранное место прямо в тексте. Исходная версия остаётся доступной для сравнения.', compare:'Прочитай обе версии и реши, в какой читателю легче проследить твою мысль.'};
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=s=>String(s??'').trim();
  const button=(action,label,primary=false)=>'<button type="button" data-dr-action="'+h(action)+'"'+(primary?' class="ew-primary"':'')+'>'+h(label)+'</button>';
  const actions=(...items)=>'<div class="ew-actions">'+items.join('')+'</div>';
  const field=(id,label,value,rows=3,readonly=false)=>'<div class="ew-field"><label for="dr-'+id+'">'+h(label)+'</label><textarea data-dr-field="'+id+'" id="dr-'+id+'" rows="'+rows+'"'+(readonly?' readonly':'')+'>\n'+h(value)+'</textarea></div>';
  const markCurrent=(c,m)=>m && (m.missing===true || (Number.isInteger(m.start) && Number.isInteger(m.end) && m.start>=0 && m.end>m.start && c.source.slice(m.start,m.end)===m.quote));
  const shared=ctx=>String(typeof ctx.getDraft==='function'?ctx.getDraft():ctx.draft??'');
  function prepare(ctx) {
    const r=ctx.record;
    if(!r.topicId) Object.assign(r,{topicId:ctx.topicId,step:'source',entry:shared(ctx),linked:shared(ctx),cycles:[],at:-1});
    return r;
  }
  function archiveEntry(r) {
    if(!clean(r.entry)) return;
    const active=r.cycles[r.at];
    if(active?.source===r.entry) return;
    const cycle={source:r.entry,marks:{},step:'mark',branch:'',reason:'',disagree:false,revision:r.entry,pairs:[],fields:{}};
    r.cycles.push(cycle);
    r.at=r.cycles.length-1;
  }
  function recap(c) {
    return '<div class="ew-text-card">'+Object.entries(markNames).map(([key,name])=>{
      const mark=c.marks[key];
      const value=!mark?'Пока не отмечено.':mark.missing?'В исходной версии такого места пока не нашлось.':markCurrent(c,mark)?mark.quote:'Эту отметку нужно проверить заново.';
      return '<p><strong>'+h(name)+'</strong><br><span class="ew-note" data-dr-mark="'+key+'">'+h(value)+'</span></p>';
    }).join('')+'</div>';
  }
  function markPanel(c,key) {
    const title=markNames[key];
    return '<section><h3>'+h(title)+'</h3>'+
      actions(button('mark-'+key,'Отметить выделенное'),button('missing-'+key,'В тексте пока не нашёл'))+
      '<details><summary>Ввести слова без выделения</summary><div>'+field('exact-'+key,'Слова из исходного текста',c.fields['exact-'+key],2)+
      '<label for="dr-occ-'+key+'">Какое совпадение по счёту?</label><input id="dr-occ-'+key+'" data-dr-field="occ-'+key+'" type="number" min="1" step="1" value="'+h(c.fields['occ-'+key]||'1')+'">'+
      actions(button('exact-'+key,'Отметить введённую фразу'))+'</div></details></section>';
  }
  function markedHtml(c) {
    const marks=Object.entries(c.marks).filter(([,m])=>markCurrent(c,m) && !m.missing);
    const points=[...new Set([0,c.source.length,...marks.flatMap(([,m])=>[m.start,m.end])])].sort((a,b)=>a-b);
    return points.slice(0,-1).map((a,i)=>{
      const b=points[i+1],inside=marks.filter(([,m])=>m.start<=a && m.end>=b);
      const text=h(c.source.slice(a,b));
      return inside.length?'<mark title="'+h(inside.map(([key])=>markNames[key]).join(' • '))+'">'+text+'</mark>':text;
    }).join('');
  }
  function marked(c) {
    return '<details><summary>Мой исходный текст с отметками</summary><div><p class="ew-note">'+markedHtml(c)+'</p>'+recap(c)+'</div></details>';
  }
  function formBranch(c,mode) {
    const choice=work[c.branch];
    let result='<fieldset><legend>Мой следующий шаг</legend>'+Object.entries(work).map(([key,o])=>'<label class="ew-check"><input type="radio" name="dr-branch" data-dr-field="branch" value="'+key+'"'+(key===c.branch?' checked':'')+'><span>'+h(o.label)+'</span></label>').join('')+'</fieldset>';
    if(choice) result+='<section class="ew-coach" data-dr-branch="'+h(c.branch)+'"><p>'+h(choice.question)+'</p>'+
      EssayReadingLens.detail(c.branch==='reading'?'alternative':'link')+
      '<label class="ew-check"><input type="checkbox" data-dr-field="disagree"'+(c.disagree?' checked':'')+'><span>Я вижу это место иначе и хочу предложить свой ход.</span></label>'+
      field('reason',c.disagree?'Почему я не согласен и что предлагаю проверить?':'На какие слова текста я опираюсь? Можно добавить своё основание.',c.reason)+'</section>';
    return result;
  }
  function task(c) {
    return '<div class="ew-coach"><strong>'+h(work[c.branch].label)+'</strong><p>'+h(c.disagree?'Ты предложил свой ход. Испытай его на выбранной фразе и проверь, подтверждает ли она твою мысль.':work[c.branch].task)+'</p>'+
      (clean(c.reason)?'<p class="ew-note"><strong>Моё основание</strong><br>'+h(c.reason)+'</p>':'')+'</div>';
  }
  function lastPair(c) {return c.pairs[c.pairs.length-1];}
  function comparison(c,pair) {
    return '<div data-dr-comparison><div class="ew-text-card"><strong>До правки</strong><p class="ew-note" data-dr-before>'+h(c.source)+'</p></div>'+
    '<div class="ew-text-card"><strong>После правки</strong><p class="ew-note" data-dr-after>'+h(pair.after)+'</p></div>'+
    '<p>'+h(work[pair.branch]?.label||'')+'</p>'+(pair.reason?'<p class="ew-note"><strong>'+(pair.disagree?'Моё возражение':'Моё основание')+'</strong><br>'+h(pair.reason)+'</p>':'')+
    (pair.kept?'<p class="ew-note"><strong>Почему я оставил исходную формулировку</strong><br>'+h(pair.defence)+'</p>':'')+'</div>';
  }
  function snapshots(c) {
    return c.pairs.length>1?'<details><summary>Предыдущие сохранённые сравнения ('+(c.pairs.length-1)+')</summary><div>'+c.pairs.slice(0,-1).map((p,i)=>'<details><summary>Сравнение '+(i+1)+'</summary>'+comparison(c,p)+'</details>').join('')+'</div></details>':'';
  }
  function history(r) {
    const other=r.cycles.map((c,i)=>i===r.at && (r.step!=='source'||c.source===r.entry)?'':button('open-'+i,'Текст '+(i+1)+' · '+c.source.slice(0,70)+(c.source.length>70?'…':''))).join('');
    return other?'<details><summary>Другие тексты по этой теме</summary>'+actions(other)+'</details>':'';
  }
  function conflict(r,ctx) {
    if(shared(ctx)===r.linked) return '';
    return '<div class="ew-text-card" data-dr-conflict><strong>Черновик в общем редакторе изменился</strong><details><summary>Посмотреть текст в редакторе</summary><div class="ew-note">'+h(shared(ctx)||'Текст очищен.')+'</div></details>'+
      actions(button('use-shared','Разобрать текст из редактора'),button('keep-local','Продолжить с моей версией'))+'</div>';
  }
  function screen(r,ctx) {
    if(r.topicId!==ctx.topicId) return '<p role="alert">Эта запись относится к другой теме. Вернись к выбору темы.</p>'+actions(button('topic','К выбору темы'));
    const c=r.cycles[r.at],step=c&&Object.hasOwn(titles,r.step)?r.step:'source';
    let body='';
    if(step==='source') body=field('source','Мой исходный текст',r.entry,9)+actions(button('next','Перейти к отметкам',true),button('topic','Выбрать другую тему'));
    if(step==='mark') body=field('original','Моя исходная версия',c.source,8,true)+markPanel(c,'deed')+markPanel(c,'idea')+recap(c)+actions(button('back','Вернуться к исходному тексту'),button('next','Выбрать следующую правку',true));
    if(step==='choose') body=recap(c)+formBranch(c,ctx.mode)+actions(button('back','К отметкам'),button('next','Перейти к моей правке',true));
    if(step==='revise') body=task(c)+marked(c)+field('revision','Моя версия после правки',c.revision,9)+
      '<label class="ew-check"><input type="checkbox" data-dr-field="keep"'+(c.keep?' checked':'')+'><span>Хочу сохранить исходную формулировку и объяснить свой выбор.</span></label>'+
      (c.keep?field('defence','Чем подходит исходный вариант?',c.defence):'')+
      actions(button('back','К выбранному ходу'),button('finish','Сохранить и сравнить две версии',true));
    if(step==='compare') {
      const pair=lastPair(c);
      body=comparison(c,pair)+marked({...c,marks:pair.marks})+snapshots(c)+
        actions(button('back','Ещё раз поработать с фразой'),button('download','Скачать размеченный черновик (.txt)'))+
        (shared(ctx)===r.linked?actions(button('apply','Открыть эту версию в редакторе сочинения')):'')+
        actions(button('trial','Самостоятельная проба · абзац на новую тему',true),button('rehearsal','Перейти к полной самостоятельной репетиции'),button('topic','Поработать над другой темой'));
    }
    return '<section data-dr-step="'+step+'"><h2 id="ew-title" tabindex="-1">'+h(titles[step])+'</h2><p class="ew-sub">'+h(hints[step])+'</p>'+
      '<p class="ew-topic">'+h(ctx.topicTitle)+'</p>'+conflict(r,ctx)+body+history(r)+'<p class="ew-small" data-dr-status role="status"></p></section>';
  }
  function render(ctx) { return '<div data-draft-reader>'+screen(prepare(ctx),ctx)+'</div>'; }
  function download(r,ctx,c) {
    const pair=lastPair(c);
    const lines=['Узел тоски по миру · Разбор черновика',ctx.topicTitle,'Исходная версия',c.source];
    for(const [key,name] of Object.entries(markNames)) {
      const m=pair.marks[key];
      const pos=m && !m.missing?' (с символа '+(m.start+1)+' по '+m.end+')':'';
      lines.push(name+pos, m?.missing?'Пока не нашёл':m?.quote||'');
    }
    lines.push('Мой ход',work[pair.branch].label);
    if(pair.reason) lines.push(pair.disagree?'Моё возражение':'Моё основание',pair.reason);
    if(pair.kept) lines.push('Почему я оставил формулировку',pair.defence);
    lines.push('Версия после правки',pair.after);
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\n\n')],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='razbor-chernovika-'+(r.at+1)+'.txt';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function mount(host,ctx) {
    const root=host.querySelector('[data-draft-reader]'),r=prepare(ctx);
    const fieldNode=id=>root.querySelector('[data-dr-field="'+id+'"]');
    const status=msg=>{root.querySelector('[data-dr-status]').textContent=msg;};
    function warn(msg,key) {
      if(key) fieldNode(key)?.focus();
      status(msg);
    }
    function draw(focus,notice) {
      root.innerHTML=screen(r,ctx);ctx.save();
      root.querySelector(focus||'#ew-title')?.focus({preventScroll:true});
      if(notice) status(notice);
    }
    function page(step) {
      r.step=step;
      if(step!=='source') r.cycles[r.at].step=step;
      draw();
    }
    function storeMark(key,method,c) {
      let m;
      if(method==='missing') m={missing:true};
      else {
        let start,end;
        if(method==='mark') {
          const input=fieldNode('original');
          const selection=input.value.slice(input.selectionStart,input.selectionEnd);
          const quote=selection.trim();
          if(!quote) return warn('Сначала выдели слова или открой «Ввести слова без выделения».','original');
          start=input.selectionStart+selection.length-selection.trimStart().length;
          end=start+quote.length;
        } else {
          const quote=clean(c.fields['exact-'+key]);
          if(!quote) return warn('Впиши в поле слова из своего текста.','exact-'+key);
          const occurrence=Number(c.fields['occ-'+key]||1);
          if(!Number.isSafeInteger(occurrence)||occurrence<1) return warn('Номер совпадения должен быть целым числом от одного.','occ-'+key);
          start=-1;
          for(let i=0;i<occurrence;i++) {
            start=c.source.indexOf(quote,i===0?0:start+quote.length);
            if(start===-1) return warn(i===0?'Такой фразы не нашлось. Сверь слова и знаки препинания с исходником.':'Указанного совпадения в исходной версии нет.',i===0?'exact-'+key:'occ-'+key);
          }
          end=start+quote.length;
        }
        m={start,end,quote:c.source.slice(start,end)};
      }
      c.marks[key]=m;
      const next=key==='deed'&&!c.marks.idea?'[data-dr-action="mark-idea"]':'[data-dr-action="next"]';
      draw(next,markNames[key]+(m.missing?' — отмечено, что этого места пока нет.':' — отметка добавлена.'));
    }
    function chooseNext(c) {
      if(r.step==='source'){
        if(!clean(r.entry)) return warn('Вставь хотя бы один свой абзац.','source');
        archiveEntry(r);
        return page('mark');
      }
      if(r.step==='mark'){
        for(const key of Object.keys(markNames)) if(!markCurrent(c,c.marks[key])) {
          root.querySelector('[data-dr-action="mark-'+key+'"]').focus();
          return status('Отметь «'+markNames[key]+'» или выбери «В тексте пока не нашёл».');
        }
        return page('choose');
      }
      if(r.step==='choose'){
        if(!Object.hasOwn(work,c.branch)) return warn('Выбери один шаг, который хочешь испытать.','branch');
        if(c.disagree&&!clean(c.reason))return warn('Запиши свой ход или коротко объясни своё возражение.','reason');
        return page('revise');
      }
    }
    function finish(c) {
      if(!clean(c.revision)) return warn('Внеси свою новую формулировку.','revision');
      const unchanged=c.source.trim()===c.revision.trim();
      if(unchanged&&!c.keep) return warn('Совпадают обе версии. Измени нужное место или отметь, что хочешь оставить исходную формулировку.','revision');
      if(c.keep && !clean(c.defence)) return warn('Объясни, почему твой вариант подходит.','defence');
      if(c.keep && !unchanged) return warn('Ты уже изменил текст. Сними отметку о сохранении исходной формулировки или верни её в поле.','keep');
      const pair={after:c.revision,branch:c.branch,reason:c.reason,disagree:c.disagree,kept:!!c.keep,defence:c.keep?c.defence:'',marks:{...c.marks}};
      if(JSON.stringify(pair)!==JSON.stringify(lastPair(c))) c.pairs.push(pair);
      page('compare');
    }
    root.addEventListener('input',event=>{
      const el=event.target,key=el.dataset.drField,c=r.cycles[r.at];
      if(r.topicId!==ctx.topicId||!key||key==='original') return;
      if(key==='source') r.entry=el.value;
      else if(c) {
        if(key==='branch') {
          if(!Object.hasOwn(work,el.value)) return;
          c.grounds ||= {};
          if(c.branch) c.grounds[c.branch]={reason:c.reason,disagree:c.disagree};
          c.branch=el.value;
          c.reason=c.grounds[c.branch]?.reason||'';
          c.disagree=!!c.grounds[c.branch]?.disagree;
          return draw('[data-dr-field="branch"][value="'+c.branch+'"]');
        }
        if(key==='disagree'||key==='keep') {
          c[key]=el.checked;
          return draw('[data-dr-field="'+key+'"]');
        }
        if(['reason','revision','defence'].includes(key)) c[key]=el.value;
        if(/^(exact|occ)-(deed|idea)$/.test(key)) c.fields[key]=el.value;
      }
      ctx.save();
    });
    root.addEventListener('click',event=>{
      const el=event.target.closest('[data-dr-action]');if(!el)return;
      const action=el.dataset.drAction,c=r.cycles[r.at];
      if(action==='topic') {ctx.save();return ctx.go('topic');}
      if(r.topicId!==ctx.topicId)return;
      if(action==='next') return chooseNext(c);
      if(action==='back' && c) {
        if(r.step==='mark')r.entry=c.source;
        return page(({mark:'source',choose:'mark',revise:'choose',compare:'revise'})[r.step]||'source');
      }
      if(action==='use-shared'||action==='keep-local') {
        const text=shared(ctx);
        r.linked=text;
        if(action==='use-shared'){
          if(r.step==='source') archiveEntry(r);
          r.entry=text;r.step='source';
        }
        return draw(null,action==='use-shared'?'Открыт текст из редактора.':'Продолжаем с твоей версией.');
      }
      if(action.startsWith('open-')){
        const i=Number(action.slice(5)),saved=r.cycles[i];
        if(!saved) return;
        if(r.step==='source')archiveEntry(r);
        r.at=i;r.entry=saved.source;return page(saved.step);
      }
      const markAction=/^(mark|missing|exact)-(deed|idea)$/.exec(action);
      if(markAction&&r.step==='mark')return storeMark(markAction[2],markAction[1],c);
      if(action==='finish'&&r.step==='revise')return finish(c);
      if(r.step!=='compare')return;
      if(action==='download')return download(r,ctx,c);
      if(action==='apply'){
        if(shared(ctx)!==r.linked)return draw(null,'Сначала прочитай изменения в редакторе и выбери, с каким текстом продолжить.');
        const after=lastPair(c).after;
        ctx.applyDraft(after);r.linked=after;ctx.draft=after;ctx.save();
        return ctx.go('draft');
      }
      if(action==='trial'||action==='rehearsal') {ctx.save();ctx.go(action==='trial'?'paragraphTrial':'rehearsal');}
    });
  }
  const helpChoices=Object.freeze(Object.entries(work).map(([id,o])=>Object.freeze({id,label:o.label,hint:o.task})));
  return Object.freeze({render,mount,helpChoices});
})();
