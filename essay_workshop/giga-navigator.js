(() => {
  'use strict';
  const root = document.getElementById('essay-workshop');
  const steps = /*__NAVIGATION_STEPS__*/ [];
  const personal = root.dataset.essayAssistantOrigin === 'personal' &&
    location.protocol === 'http:' && location.hostname === '127.0.0.1';
  const lens = {secular:'Литературный разбор', orthodox:'Православный ракурс'};
  const errors = {
    authorization_failed:'ГигаЧат отклонил ключ. Взрослый может проверить его при перезапуске программы.',
    access_denied:'ГигаЧат отказал в доступе к модели.',
    quota_unavailable:'Для этого личного проекта закончился доступный объём.',
    rate_limit:'ГигаЧат просит немного подождать.',
    request_in_progress:'Предыдущий вопрос ещё обрабатывается.',
    tls_certificate:'Личная программа не смогла проверить сертификат ГигаЧата.'
  };
  let request = null;
  let situationDraft = '';
  let keepOpen = false;

  function text(value) {
    return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }

  function assignment(situation, mode) {
    const menu = steps.map((step,index) => (index+1)+'. '+step.title+' — '+step.action);
    return ['Помоги выбрать следующий шаг в тренажёре итогового сочинения.',
      'Мой ракурс — «'+lens[mode]+'».',
      'Моя ситуация: '+(situation || '[впиши, что уже есть и где остановился]'),
      ...menu, 'Назови номер одного подходящего шага и коротко объясни выбор. Формулировки сочинения я напишу самостоятельно.'
    ].join('\n');
  }

  function panel(mode) {
    mode = mode === 'orthodox' ? mode : 'secular';
    const options = steps.map((step,index) => '<option value="'+(index+1)+'">'+(index+1)+'. '+step.title+'</option>').join('');
    return '<details id="ew-ai-entry" data-mode="'+mode+'"'+(keepOpen?' open':'')+'><summary>Не знаю, с чего начать</summary>'+
      '<div class="ew-field"><label for="ew-ai-situation">Что у тебя уже есть и где возникла трудность?</label>'+
      '<textarea id="ew-ai-situation" maxlength="600" rows="2" placeholder="Например, тему уже выбрал, но не могу начать абзац">'+text(situationDraft)+'</textarea></div>'+
      '<button type="button" id="ew-ai-local">Подобрать шаг без интернета</button>'+
      '<p id="ew-ai-status" class="ew-small" role="status"></p>'+
      '<label for="ew-ai-choice">Следующий шаг</label><select id="ew-ai-choice"><option value="">Выбери шаг</option>'+options+'</select>'+
      '<button id="ew-ai-go" type="button" disabled>Перейти к этому шагу</button>'+
      '<details id="ew-ai-optional"><summary>Спросить в ГигаЧате</summary>'+
      '<p class="ew-small">Для ГигаЧата нужен интернет. В запросе будут твоё описание и выбранный ракурс. При желании поменяй ракурс в мастерской.</p>'+
      '<details><summary>Посмотреть задание для чата</summary><label for="ew-ai-prompt">Текст для копирования</label>'+
      '<textarea id="ew-ai-prompt" rows="6" readonly>'+text(assignment(situationDraft.trim(),mode))+'</textarea></details>'+
      '<div class="ew-actions"><button type="button" id="ew-ai-copy">Скопировать задание</button>'+
      '<a id="ew-ai-chat" href="https://giga.chat/" target="_blank" rel="noopener noreferrer">Открыть ГигаЧат ↗</a></div>'+
      '<p class="ew-small">Вставь задание в чат и вернись сюда с номером шага. До 18 лет пользуйся чатом с согласия и под контролем родителя. '+
      '<a href="https://developers.sber.ru/docs/ru/policies/gigachat/agreement" target="_blank" rel="noopener noreferrer">Условия ГигаЧата</a></p>'+
      (personal ? '<button id="ew-ai-ask" type="button">Спросить через мой личный ГигаЧат</button><p class="ew-small">Взрослый может отправить описание трудности и ракурс через свою локальную программу. Номер шага появится здесь.</p>' : '')+
      '</details></details>';
  }

  function resetChoice(box) {
    box.querySelector('#ew-ai-choice').value = '';
    box.querySelector('#ew-ai-go').disabled = true;
  }

  function offer(box,number,message) {
    box.querySelector('#ew-ai-choice').value = String(number);
    box.querySelector('#ew-ai-go').disabled = false;
    box.querySelector('#ew-ai-status').textContent = message+' '+number+' — «'+steps[number-1].title+'».';
  }

  root.addEventListener('toggle', event => {
    if (event.target.id === 'ew-ai-entry' && event.target.isConnected) keepOpen = event.target.open;
  },true);

  root.addEventListener('input', event => {
    if (event.target.id !== 'ew-ai-situation') return;
    const box = event.target.closest('#ew-ai-entry');
    situationDraft = event.target.value;
    request?.abort();
    box.querySelector('#ew-ai-prompt').value = assignment(event.target.value.trim(),box.dataset.mode);
    box.querySelector('#ew-ai-status').textContent = '';
    resetChoice(box);
  });
  root.addEventListener('change', event => {
    if (event.target.id !== 'ew-ai-choice') return;
    request?.abort();
    const box = event.target.closest('#ew-ai-entry');
    box.querySelector('#ew-ai-go').disabled = !event.target.value;
    box.querySelector('#ew-ai-status').textContent = '';
  });

  async function ask(box, situation) {
    request?.abort();
    const current = new AbortController();
    request = current;
    const askButton = box.querySelector('#ew-ai-ask');
    const status = box.querySelector('#ew-ai-status');
    askButton.disabled = true;
    resetChoice(box);
    status.textContent = 'ГигаЧат подбирает шаг…';
    const timer = setTimeout(() => current.abort(),75000);
    try {
      const response = await fetch('/v1/essay/navigate',{method:'POST',headers:{'Content-Type':'application/json'},
        credentials:'omit',cache:'no-store',referrerPolicy:'same-origin',signal:current.signal,
        body:JSON.stringify({version:1,situation,mode:box.dataset.mode})});
      const data = await response.json();
      if (!box.isConnected || request !== current || current.signal.aborted) return;
      if (!response.ok) {
        status.textContent = Object.hasOwn(errors,data.error) ? errors[data.error] : 'ГигаЧат сейчас недоступен. Можно выбрать шаг самостоятельно.';
        return;
      }
      if (data.version !== 1 || !Number.isInteger(data.step) || !steps[data.step-1]) throw Error('invalid step');
      offer(box,data.step,'ГигаЧат предложил шаг');
    } catch {
      if (box.isConnected && request === current && status.textContent === 'ГигаЧат подбирает шаг…')
        status.textContent = 'Не удалось получить ответ. Можно выбрать шаг самостоятельно.';
    } finally {
      clearTimeout(timer);
      if (request === current) request = null;
      if (box.isConnected) askButton.disabled = false;
    }
  }

  root.addEventListener('click', async event => {
    const box = event.target.closest('#ew-ai-entry');
    if (!box) return;
    const id = event.target.id;
    const status = box.querySelector('#ew-ai-status');
    if (id === 'ew-ai-go') {
      const step = steps[Number(box.querySelector('#ew-ai-choice').value)-1];
      if (step) root.querySelector('[data-entry-situation="'+step.id+'"]')?.click();
      return;
    }
    if (id !== 'ew-ai-copy' && id !== 'ew-ai-ask' && id !== 'ew-ai-local') return;
    const field = box.querySelector('#ew-ai-situation');
    if (!field.value.trim()) {
      status.textContent = 'Напиши в двух словах, где ты остановился.';
      field.focus();
      return;
    }
    if (id === 'ew-ai-local') {
      request?.abort();
      const number = window.EssayLocalNavigator?.suggest(field.value.trim());
      if (Number.isInteger(number) && steps[number-1]) {
        offer(box,number,'Попробуй шаг');
      } else {
        resetChoice(box);
        status.textContent = 'Что у тебя уже есть — тема, сцена из книги или написанный текст?';
        field.focus();
      }
      return;
    }
    if (id === 'ew-ai-ask' && personal) return ask(box,field.value.trim());
    const prompt = box.querySelector('#ew-ai-prompt');
    try {
      await navigator.clipboard.writeText(prompt.value);
      status.textContent = 'Задание скопировано. Вставь его в ГигаЧат.';
    } catch {
      prompt.closest('details').open = true;
      prompt.focus(); prompt.select();
      status.textContent = 'Текст задания выделен. Скопируй его обычной командой браузера.';
    }
  });
  window.EssayGigaNavigator = Object.freeze({panel});
})();
