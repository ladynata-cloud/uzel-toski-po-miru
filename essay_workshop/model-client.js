(() => {
  'use strict';
  const root = document.getElementById('essay-workshop');
  const origin = root.dataset.essayAssistantOrigin;
  if (!origin || location.protocol === 'file:') return;

  let request = null;
  function cancel() {
    request?.abort();
    request = null;
  }
  root.addEventListener('ew-revision-close', cancel);
  root.addEventListener('ew-revision-open', event => {
    cancel();
    const mount = root.querySelector('#ew-model-help');
    if (!mount) return;
    const {stage,mode,topic,workId,workTitle,passage} = event.detail;
    if (!passage || passage.length > 1200) return;
    const turn = {version:1, stage, mode, topic:topic.slice(0,500), workId:(workId||'').slice(0,80), workTitle:(workTitle||'').slice(0,240), passage};
    const details = document.createElement('details');
    details.innerHTML = '<summary>Задать дополнительный вопрос модели</summary><p class="ew-small">В сервис помощника уйдут выбранный фрагмент, тема, название книги, этап, ракурс и твой вопрос. Остальной черновик останется здесь.</p><form class="ew-model-form"><label>Твой вопрос о фрагменте<textarea class="ew-model-question" maxlength="1000" rows="2" required></textarea></label><button type="submit">Отправить фрагмент и вопрос</button></form><p class="ew-model-answer" role="status"></p>';
    mount.replaceChildren(details);
    const form = details.querySelector('form');
    const button = form.querySelector('button');
    const output = details.querySelector('.ew-model-answer');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const message = form.querySelector('textarea').value.trim();
      if (!message || button.disabled) return;
      cancel();
      const current = new AbortController();
      request = current;
      button.disabled = true;
      output.textContent = 'Готовится подсказка…';
      const timer = setTimeout(() => current.abort(), 10000);
      try {
        const response = await fetch(origin + '/v1/essay/turn', {
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit',
          cache:'no-store', referrerPolicy:'no-referrer', signal:current.signal,
          body:JSON.stringify({...turn, message})
        });
        if (!response.ok) throw Error('Response unavailable');
        const data = await response.json();
        if (data.version !== 1 || typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 2500) throw Error('Unexpected response');
        if (request === current && mount.isConnected) output.textContent = data.reply.trim();
      } catch {
        if (request === current && mount.isConnected) output.textContent = 'Сервис сейчас недоступен. Вопрос встроенного помощника и поле для правки остаются доступны.';
      } finally {
        clearTimeout(timer);
        if (request === current) {request = null; button.disabled = false;}
      }
    });
  });
})();
