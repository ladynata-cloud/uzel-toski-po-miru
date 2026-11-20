/* Editable training notes and the first independent answer live in different fields. */
const EssayThesisLab = (() => {
  'use strict';
  const scene='Пока класс ждал, Лена пересела ближе к новичку, стоявшему у доски. Он наконец начал говорить.';
  const doctor={
    id:'doctor',title:'А. И. Куприн. «Чудесный доктор»',
    fact:'Мерцалов нашёл под чайным блюдцем деньги вместе с рецептом, когда доктор уже ушёл.',
    url:'https://www.lib.ru/LITRA/KUPRIN/doctor.txt'
  };
  const example='Доктор был добрым человеком.';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const words=value=>String(value??'').trim().toLowerCase().replaceAll('ё','е');
  const lexical=value=>words(value).match(/[\p{L}\p{N}]+/gu)?.join(' ')||'';
  const includesWords=(phrase,part)=>Boolean(lexical(part)) && (' '+lexical(phrase)+' ').includes(' '+lexical(part)+' ');
  const button=(id,label,primary=false)=>'<button type="button" data-tl-action="'+id+'"'+(primary?' class="ew-primary"':'')+'>'+escape(label)+'</button>';
  const actions=(...buttons)=>'<div class="ew-actions">'+buttons.join('')+'</div>';
  const field=(id,label,value,rows=3)=>'<div class="ew-field"><label for="tl-'+id+'">'+escape(label)+'</label><textarea id="tl-'+id+'" data-tl="'+id+'" rows="'+rows+'">\n'+escape(value)+'</textarea></div>';
  const panel=(label,value,attr='')=>'<div class="ew-text-card" '+attr+'><strong>'+escape(label)+'</strong><p class="ew-note">'+escape(value)+'</p></div>';
  const heading=(title,intro)=>'<h2 id="ew-title" tabindex="-1">'+escape(title)+'</h2><p class="ew-sub">'+escape(intro)+'</p>';
  const hasText=value=>Boolean(String(value??'').trim());
  const takeBook=work=>({id:work.id||'',title:work.title||'',fact:work.fact||'',url:/^https?:\/\//u.test(work.url||'')?work.url:''});

  function render({record,initial='',work,ownTitle=''}) {
    if (typeof record.phrase!=='string') {
      Object.assign(record,{step:'claim',phrase:initial,word:'',concrete:false,book:takeBook(work||doctor),ownBook:!work && Boolean(ownTitle),ownTitle});
    }
    return '<div data-thesis-lab>'+screen(record)+'</div>';
  }
  function bookDetails(r) {
    if (r.ownBook) return field('ownTitle','Как называется твоё произведение?',r.ownTitle,1)+
      '<p class="ew-small">Открой выбранную сцену и сверь действие с текстом.</p>';
    const book=r.book;
    return '<p><strong>'+escape(book.title)+'</strong></p>'+(book.fact?'<details><summary>Сверить со сценой</summary><p>'+escape(book.fact)+'</p>'+
      (book.url?'<a href="'+escape(book.url)+'" target="_blank" rel="noopener noreferrer">Открыть произведение ↗</a>':'')+'</details>':'');
  }
  function insight(r,stage) {
    const res=EssayAnswerFeedback.inspect({stage,text:stage==='link'?r.meaning:r.deed,thesis:r.phrase,episode:r.deed,work:r.ownBook?{title:r.ownTitle}:r.book});
    if (res.kind!=='reader-check') return '<p>'+escape(res.observation)+' '+escape(res.next)+'</p>';
    return stage==='link'?'<p>Перечитай исходную мысль рядом со своим объяснением. Что в ней теперь можно подтвердить именно этой деталью? Можно сохранить свою трактовку или уточнить её.</p>':
      '<p>Проверь, можно ли найти этот поступок в тексте. Если ты написал о чувствах или намерениях героя, реши, откуда читатель может об этом узнать.</p>';
  }
  function screen(r) {
    let body='';
    if (r.step==='claim') {
      body=heading('Уточни свой тезис','Запиши свою мысль о герое. Какое слово в ней захочется обосновать читателю?')+
        field('phrase','Моя исходная мысль',r.phrase)+
        '<div class="ew-actions"><button type="button" data-tl-action="sample"'+(hasText(r.phrase)?' disabled':'')+'>Попробовать на фразе о докторе</button></div>'+
        field('word','Слово или слова из моей фразы, которые я хочу обосновать',r.word,1)+
        actions(button('pick','Взять выделенное в моей фразе'),button('concrete',r.concrete?'Выбран вариант «В мысли уже есть поступок»':'В моей мысли уже есть поступок'))+
        actions(button('next','Подобрать поступок героя',true));
    } else if (r.step==='deed') {
      body=heading('Какой поступок ты можешь показать?',r.concrete?'Вернись к одному моменту. Как читатель узнает, что произошло?':'Что герой сделал или сказал, по чему можно судить о словах «'+r.word.trim()+'»?')+
        panel('Моя исходная мысль',r.phrase)+bookDetails(r)+actions(button('book',r.ownBook?'Вернуться к книге из карточки':'Взять свою книгу'))+
        field('deed','Один поступок или деталь, которую можно проверить в книге',r.deed)+
        actions(button('back','К моей мысли'),button('next','Объяснить, что это меняет',true));
    } else if (r.step==='meaning') {
      body=heading('Что эта деталь помогает понять?','Представь, что в сцене герой поступил иначе. Что читатель тогда понял бы по-другому?')+
        panel('Моя деталь',r.deed)+insight(r,'episode')+
        field('meaning','Как я связываю поступок со своей мыслью',r.meaning)+
        actions(button('back','К детали'),button('compare','Сравнить с первой фразой',true))+
        (r.comparing?insight(r,'link')+panel('Вначале я написал',r.phrase)+field('revision','Как я сформулирую мысль теперь',r.revision)+
          actions(button('next',r.first===undefined?'Попробовать на другой сцене':'Вернуться к самостоятельной попытке',true)):'');
    } else if (r.step==='transfer' && r.first===undefined) {
      body=heading('Новая сцена · самостоятельно','Прочитай эту учебную миниатюру. Что можно понять об отношениях героев? Какая деталь поддерживает твой вывод?')+
        panel('Учебная сцена',scene)+field('transfer','Мой самостоятельный ответ',r.transfer,5)+
        '<label class="ew-check"><input type="checkbox" data-tl="seen"'+(r.seen?' checked':'')+'><span>Я уже разбирал эту сцену. Для меня это повторная тренировка.</span></label>'+
        actions(button('back','Вернуться к тренировке'),button('submit','Сохранить ответ и открыть разбор',true));
    } else {
      body=heading('Разбор самостоятельной попытки','Перечитай миниатюру и свою первую запись. Эти вопросы помогут тебе или преподавателю обсудить, что удалось доказать.')+
        panel('Учебная сцена',scene)+panel(r.seen?'Мой ответ в повторной тренировке':'Мой ответ в этой попытке до разбора',r.first,'data-tl-original-transfer')+
        '<ol><li>Какую деталь сцены я привёл точно?</li><li>Что, по-моему, она означает?</li><li>Где я объяснил, как из этой детали пришёл к своему выводу?</li></ol>'+
        '<details><summary>Какие прочтения можно обсудить?</summary><p>Лена пересаживается ближе. Новичок затем начинает говорить. Можно рассмотреть этот поступок как поддержку и объяснить, почему близость одноклассницы могла помочь. Можно обратить внимание и на то, что весь класс ждал, пока новичок заговорит.</p><p>«Она хотела быть рядом» — догадка о намерении. Чем её можно подкрепить? Слова «наконец начал говорить» сообщают о последовательности событий. Почему заговорил новичок и что именно думала Лена, рассказчик прямо не объясняет.</p></details>'+
        (r.editing?field('after','Мой вариант после разбора',r.after,5):actions(button('revise','Попробовать другую формулировку')))+
        actions(button('back','К тренировочной фразе'),button('download','Скачать для обсуждения (.txt)'));
    }
    return '<section data-tl-step="'+escape(r.step)+'">'+body+'<p role="status" class="ew-small" data-tl-status></p></section>';
  }
  function download(r) {
    const parts=['Уточни свой тезис · Узел тоски по миру','Книга: '+(r.ownBook?r.ownTitle:r.book.title),
      'Исходная мысль',r.phrase,'Выбранная деталь',r.deed,'Моё объяснение',r.meaning,'Тезис после уточнения',r.revision,
      'Самостоятельная учебная сцена',scene,r.seen?'Ученик отметил, что уже разбирал сцену.':'Повторное знакомство со сценой не отмечено.','Первая запись этой попытки до разбора',r.first];
    if(r.editing) parts.push('Мой вариант после разбора',r.after);
    const url=URL.createObjectURL(new Blob(['\uFEFF'+parts.join('\n\n')],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='moy-tezis-i-samostoyatelnaya-rabota.txt';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function mount(host,{record:r,save}) {
    const root=host.querySelector('[data-thesis-lab]');
    function draw(focus) {
      root.innerHTML=screen(r);
      save();
      (root.querySelector(focus||'#ew-title'))?.focus({preventScroll:true});
      if (!focus) root.scrollIntoView({block:'nearest'});
    }
    function warn(message,key) {
      root.querySelector('[data-tl-status]').textContent=message;
      root.querySelector('[data-tl="'+key+'"]')?.focus();
    }
    function advance() {
      if(r.step==='claim') {
        if(!hasText(r.phrase)) return warn('Впиши свою фразу или возьми учебный пример.','phrase');
        if(!r.concrete && !includesWords(r.phrase,r.word)) return warn('Перенеси сюда целое слово или несколько слов из своей фразы.','word');
        if(lexical(r.phrase)===lexical(example) && (r.concrete || !lexical(r.word).split(' ').includes('добрым'))) {
          if(r.concrete) {
            r.concrete=false;
            draw('[data-tl="word"]');
            return warn('«Был добрым» описывает качество врача. Какое слово в этой фразе нужно подтвердить поступком?','word');
          }
          return warn('Каким словом автор этой фразы оценивает доктора? Выбери его, чтобы затем найти подтверждение в сцене.','word');
        }
        r.step='deed';
      } else if(r.step==='deed') {
        if(r.ownBook && !hasText(r.ownTitle)) return warn('Запиши название произведения, к которому ты обращаешься.','ownTitle');
        if(!hasText(r.deed)) return warn('Назови одно действие или деталь своей сцены.','deed');
        r.step='meaning';
      } else if(r.step==='meaning') {
        if(!hasText(r.meaning)) return warn('Запиши своё объяснение детали.','meaning');
        if(!hasText(r.revision)) return warn('Сохрани мысль своими словами.','revision');
        r.step=r.first===undefined?'transfer':'review';
      }
      draw();
    }
    root.addEventListener('input',event=>{
      const key=event.target.dataset.tl;
      if(!key) return;
      r[key]=event.target.type==='checkbox'?event.target.checked:event.target.value;
      if(['phrase','word','deed','ownTitle'].includes(key)) r.comparing=false;
      if(key==='word' && r.concrete && hasText(r.word)) {
        r.concrete=false;
        root.querySelector('[data-tl-action="concrete"]').textContent='В моей мысли уже есть поступок';
      }
      if(key==='phrase') {
        const sample=root.querySelector('[data-tl-action="sample"]');if(sample) sample.disabled=hasText(r.phrase);
      }
      if(key==='meaning' && r.comparing) {
        r.comparing=false;
        const input=event.target, start=input.selectionStart, end=input.selectionEnd;
        draw('[data-tl="meaning"]');root.querySelector('[data-tl="meaning"]').setSelectionRange(start,end);
      } else save();
    });
    root.addEventListener('click',event=>{
      const btn=event.target.closest('[data-tl-action]'); if(!btn) return;
      const action=btn.dataset.tlAction;
      if(action==='next') return advance();
      if(action==='back') {
        r.step=({deed:'claim',meaning:'deed',transfer:'meaning',review:'meaning'})[r.step]||'claim';
        return draw();
      }
      if(action==='sample') {
        if(hasText(r.phrase))return;
        r.phrase=example;r.book=takeBook(doctor);r.ownBook=false;r.concrete=false;
        return draw('[data-tl="word"]');
      }
      if(action==='pick') {
        const input=root.querySelector('[data-tl="phrase"]');
        const selection=input.value.slice(input.selectionStart,input.selectionEnd).trim();
        if(!selection)return warn('Выдели слова в своей фразе или впиши их в поле ниже.','phrase');
        r.word=selection;r.concrete=false;return draw('[data-tl="word"]');
      }
      if(action==='concrete') {
        r.concrete=!r.concrete;
        if(r.concrete) r.word='';
        return draw('[data-tl-action="next"]');
      }
      if(action==='book') {r.ownBook=!r.ownBook;return draw(r.ownBook?'[data-tl="ownTitle"]':'[data-tl="deed"]');}
      if(action==='compare') {
        if(!hasText(r.meaning))return warn('Запиши, как ты понимаешь выбранную деталь.','meaning');
        if(!hasText(r.revision) || r.revision===r.lastComparedMeaning) r.revision=r.meaning;
        r.lastComparedMeaning=r.meaning;r.comparing=true;return draw('[data-tl="revision"]');
      }
      if(action==='submit' && r.first===undefined && r.step==='transfer') {
        if(!hasText(r.transfer))return warn('Сначала запиши, как ты понимаешь сцену.','transfer');
        r.first=r.transfer;delete r.transfer;r.step='review';return draw();
      }
      if(action==='revise') {r.editing=true;if(r.after===undefined)r.after=r.first;return draw('[data-tl="after"]');}
      if(action==='download' && r.first!==undefined) download(r);
    });
  }
  return Object.freeze({render,mount});
})();
