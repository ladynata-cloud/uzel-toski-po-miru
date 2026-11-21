const EssayParagraphTrial = (() => {
  'use strict';
  const scene = 'В школьной газете напечатали заметку Миши под чужой фамилией. Редактор принёс ручку к стенду: «Давай зачеркнём и подпишем как надо». Миша надел на ручку колпачок. «Лучше напечатай поправку в следующем номере», — сказал он.';
  const question = 'Что для Миши важно в том, как будет исправлена ошибка?';
  const prompts = [
    'Какую мысль читатель сможет вынести из твоего абзаца?',
    'Какая деталь миниатюры поддерживает твою мысль? Как ты объясняешь эту связь?',
    'Как ещё можно понять просьбу Миши? Что в тексте помогло тебе выбрать своё прочтение?'
  ];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rehearsal = '<button type="button" data-pt-action="rehearsal">Перейти к полной репетиции</button>';

  function screen(r) {
    const intro = '<h2 id="ew-title" tabindex="-1">Новая тема</h2><p class="ew-small">Редакционная учебная миниатюра. Создана для этой мастерской и не входит в экзаменационные материалы.</p>'+
      '<blockquote>'+escape(scene)+'</blockquote><h3>'+escape(question)+'</h3>';
    if (typeof r.first !== 'string') {
      return intro+'<div class="ew-field"><label for="pt-draft">Ответь одним абзацем своими словами</label>'+
        '<textarea id="pt-draft" data-pt="draft" rows="6">\n'+escape(r.draft)+'</textarea></div>'+
        '<p class="ew-small">После фиксации ты сможешь перечитать свою первую запись и обсудить её.</p>'+
        '<div class="ew-actions"><button type="button" class="ew-primary" data-pt-action="submit">Зафиксировать первую попытку</button>'+rehearsal+'</div>'+
        '<p class="ew-small" role="status" data-pt-status></p>';
    }
    return intro+'<h3 tabindex="-1" data-pt-result>Моя первая попытка</h3><div class="ew-text-card"><p class="ew-note" data-pt-first>'+escape(r.first)+'</p></div>'+
      EssayReadingLens.detail('paragraphTrial')+'<details><summary>Вопросы для самопроверки или обсуждения</summary><ul>'+prompts.map(q=>'<li>'+escape(q)+'</li>').join('')+'</ul></details>'+
      '<div class="ew-field"><label for="pt-notes">Что я хочу уточнить после перечитывания (по желанию)</label>'+
      '<textarea id="pt-notes" data-pt="notes" rows="3">\n'+escape(r.notes)+'</textarea></div><div class="ew-actions">'+
      '<button type="button" data-pt-action="download">Скачать для обсуждения (.txt)</button>'+rehearsal+'</div>';
  }

  function download(r) {
    const parts = ['Новая тема · Редакционная учебная миниатюра',scene,question,'Моя первая попытка',r.first,'Вопросы для обсуждения',...prompts];
    if (r.notes?.trim()) parts.push('После перечитывания',r.notes);
    const url = URL.createObjectURL(new Blob(['\uFEFF'+parts.join('\n\n')],{type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'novaya-tema-abzats.txt';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function render({record}) {
    return '<section data-paragraph-trial>'+screen(record)+'</section>';
  }

  function mount(host,{record,save,go}) {
    const root = host.querySelector('[data-paragraph-trial]');
    root.addEventListener('input',event=>{
      const key = event.target.dataset.pt;
      if (key !== 'draft' && key !== 'notes') return;
      record[key] = event.target.value;
      save();
    });
    root.addEventListener('click',event=>{
      const action = event.target.closest('[data-pt-action]')?.dataset.ptAction;
      if (action === 'rehearsal') return go('rehearsal');
      if (action === 'download' && typeof record.first === 'string') return download(record);
      if (action !== 'submit' || typeof record.first === 'string') return;
      const input = root.querySelector('[data-pt="draft"]');
      if (!input.value.trim()) {
        root.querySelector('[data-pt-status]').textContent = 'Сначала запиши свой ответ на вопрос.';
        input.focus();
        return;
      }
      record.first = input.value;
      delete record.draft;
      save();
      root.innerHTML = screen(record);
      root.querySelector('[data-pt-result]').focus();
    });
  }
  return Object.freeze({render,mount});
})();
