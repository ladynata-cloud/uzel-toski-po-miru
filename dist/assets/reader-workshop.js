/* A local reading route: static source fragments, explicit choices, one step at a time. */
(function () {
  'use strict';
  const MODES = ['before', 'during', 'after'];
  const MAX_NOTE = 4000;

  function validatePacket(packet, workId, mode) {
    if (!packet || packet.version !== 1 || packet.kind !== 'local_reader_workshop' ||
        packet.work_id !== workId || packet.mode !== mode || !MODES.includes(mode)) return false;
    const source = packet.source;
    if (!source || !['title', 'author', 'text', 'scope', 'url'].every(k => typeof source[k] === 'string' && source[k].trim())) return false;
    try { if (new URL(source.url).protocol !== 'https:') return false; } catch { return false; }
    if (packet.lenses && !['secular', 'orthodox'].every(lens =>
      ['question', 'check'].every(k => typeof packet.lenses[lens]?.[k] === 'string' && packet.lenses[lens][k].trim()))) return false;
    const branches = packet.task?.branches;
    if (typeof packet.task?.goal !== 'string' || !Array.isArray(branches) || !branches.length || branches.length > 8) return false;
    const ids = new Set();
    return branches.every(branch => {
      if (!branch || !/^[a-z0-9-]+$/.test(branch.id) || ids.has(branch.id)) return false;
      ids.add(branch.id);
      return ['label', 'explanation', 'check'].every(k => typeof branch[k] === 'string' && branch[k].trim()) &&
        Array.isArray(branch.steps) && branch.steps.length === 4 && branch.steps.every(x => typeof x === 'string' && x.trim());
    });
  }

  function normalizeProgress(value, packet) {
    const branchId = packet.task.branches.some(b => b.id === value?.branchId) ? value.branchId : null;
    return {version: 1, branchId, step: branchId && Number.isInteger(value?.step) ? Math.max(0, Math.min(4, value.step)) : 0,
      note: typeof value?.note === 'string' ? value.note.slice(0, MAX_NOTE) : ''};
  }

  function currentStep(packet, state) {
    const clean = normalizeProgress(state, packet);
    const branch = packet.task.branches.find(b => b.id === clean.branchId);
    if (!branch) return null;
    return {text: clean.step === 4 ? branch.check : branch.steps[clean.step], step: clean.step,
      explanation: branch.explanation, isCheck: clean.step === 4};
  }

  function progressKey(workId, mode) { return 'uzel-reading-v1:' + workId + ':' + mode; }
  function readProgress(storage, key, packet) {
    try { return {state: normalizeProgress(JSON.parse(storage.getItem(key)), packet), available: true}; }
    catch { return {state: normalizeProgress(null, packet), available: false}; }
  }
  function writeProgress(storage, key, state, packet) {
    try { storage.setItem(key, JSON.stringify(normalizeProgress(state, packet))); return true; }
    catch { return false; }
  }
  function removeProgress(storage, key) {
    try { storage.removeItem(key); return true; } catch { return false; }
  }

  function createLoader(fetcher) {
    let revision = 0;
    const cache = new Map();
    return {
      cancel() { revision++; },
      async select(url, workId, mode) {
        const token = ++revision;
        try {
          let packet = cache.get(url);
          if (!packet) {
            const response = await fetcher(url, {credentials: 'same-origin', redirect: 'error'});
            if (!response.ok) throw new Error('unavailable');
            packet = await response.json();
            if (!validatePacket(packet, workId, mode)) throw new Error('invalid packet');
            cache.set(url, packet);
          }
          if (!validatePacket(packet, workId, mode)) throw new Error('wrong cached packet');
          return token === revision ? packet : null;
        } catch (error) {
          if (token !== revision) return null;
          throw error;
        }
      },
    };
  }

  const api = {validatePacket, normalizeProgress, currentStep, progressKey, readProgress, writeProgress, removeProgress, createLoader};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  const panel = document.getElementById('reader-workshop');
  if (!panel) return;
  const element = name => document.getElementById('reading-' + name);
  const loader = createLoader((url, options) => fetch(url, options));
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  let lens = 'secular';
  try { if (storage?.getItem('uzel-reading-lens-v1') === 'orthodox') lens = 'orthodox'; } catch {}
  let selected = null;
  let packet = null;
  let state = null;
  let key = null;
  const modeButtons = [...element('modes').querySelectorAll('button[data-mode]')];

  function save() {
    const ok = writeProgress(storage, key, state, packet);
    element('saved').textContent = ok ? 'Заметка и шаг сохранены только в этом браузере.' :
      'Браузер не разрешил сохранение. Можно продолжать; скопируйте заметку перед уходом.';
  }

  function showStep() {
    const step = currentStep(packet, state);
    element('goal').hidden = Boolean(step);
    element('step').hidden = !step;
    if (!step) return;
    element('step-title').textContent = step.isCheck ? 'Проверьте свою мысль' : 'Шаг ' + (step.step + 1) + ' из 4';
    element('prompt').textContent = step.text;
    element('explanation').textContent = step.explanation;
    element('why').open = false;
    element('previous').disabled = state.step === 0;
    element('next').disabled = state.step === 4;
    element('next').textContent = state.step === 3 ? 'Перейти к проверке' : 'Следующий шаг';
    element('step-title').focus();
  }

  function showLens() {
    const task = packet?.lenses?.[lens];
    element('lens-question').textContent = task?.question || '';
    element('lens-check').hidden = !task;
    element('lens-check').open = false;
    element('lens-feedback').textContent = task?.check || '';
  }
  window.addEventListener?.('uzel-reading-lens', event => {
    if (!['secular', 'orthodox'].includes(event.detail?.mode)) return;
    lens = event.detail.mode;
    showLens();
  });

  function showPacket() {
    showLens();
    element('content').hidden = false;
    element('scope').textContent = packet.source.scope;
    element('source-text').textContent = packet.source.text;
    element('source-credit').textContent = packet.source.author + '. «' + packet.source.title + '». Текст произведения.';
    element('source-link').href = packet.source.url;
    element('goal').textContent = packet.task.goal;
    element('branches').replaceChildren();
    for (const branch of packet.task.branches) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'button secondary';
      button.textContent = branch.label;
      button.setAttribute('aria-pressed', String(state.branchId === branch.id));
      button.addEventListener('click', () => {
        state.branchId = branch.id; state.step = 0; save();
        for (const peer of element('branches').children) peer.setAttribute('aria-pressed', String(peer === button));
        showStep();
      });
      element('branches').appendChild(button);
    }
    element('note').value = state.note;
    element('saved').textContent = state.note || state.branchId ? 'Восстановлена ваша заметка и шаг для этого режима.' :
      'Заметка остаётся в этом браузере. Сайт не оценивает ваш ответ автоматически.';
    showStep();
  }

  async function selectMode(mode) {
    if (!selected || !MODES.includes(mode)) return;
    packet = null; state = null;
    element('content').hidden = true;
    showLens();
    for (const name of ['source-text', 'scope', 'source-credit', 'goal', 'prompt', 'explanation', 'saved']) element(name).textContent = '';
    element('branches').replaceChildren(); element('note').value = '';
    element('source-link').removeAttribute('href');
    element('status').textContent = 'Открываем выбранный фрагмент…';
    for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    const url = new URL('../assistant/v1/workshop/' + selected.id + '/' + mode + '.json', document.baseURI);
    if (url.origin !== location.origin) { element('status').textContent = 'Адрес фрагмента не относится к этому сайту.'; return; }
    try {
      const loaded = await loader.select(url.href, selected.id, mode);
      if (!loaded) return;
      packet = loaded;
      key = progressKey(packet.work_id, packet.mode);
      const restored = readProgress(storage, key, packet);
      state = restored.state;
      showPacket();
      if (!restored.available) element('saved').textContent = 'Локальное сохранение недоступно. Можно продолжать и скопировать заметку вручную.';
      element('status').textContent = 'Открыт только выбранный фрагмент. Выберите подходящую вам ситуацию.';
    } catch {
      element('status').textContent = 'Не удалось открыть фрагмент. Выберите режим ещё раз или вернитесь к карточкам.';
    }
  }

  function close() {
    loader.cancel(); selected = packet = state = null;
    panel.hidden = true;
    element('content').hidden = true;
    showLens();
    // Old text is removed as well as hidden, including on a return to first reading.
    for (const name of ['source-text', 'scope', 'source-credit', 'goal', 'prompt', 'explanation', 'saved', 'status']) element(name).textContent = '';
    element('branches').replaceChildren(); element('note').value = '';
    element('source-link').removeAttribute('href');
  }
  function open(work) {
    close();
    if (!/^work-[a-z0-9-]+$/.test(work.id)) return;
    selected = work;
    element('title').textContent = 'Читаем «' + work.title + '»';
    panel.hidden = false;
    for (const button of modeButtons) button.setAttribute('aria-pressed', 'false');
    element('status').textContent = 'Выберите объём чтения. Сохранённый фрагмент сам не откроется.';
    element('title').focus();
  }
  for (const button of modeButtons) button.addEventListener('click', () => selectMode(button.dataset.mode));
  element('previous').addEventListener('click', () => { if (packet && state.step > 0) { state.step--; save(); showStep(); } });
  element('next').addEventListener('click', () => { if (packet && state.branchId && state.step < 4) { state.step++; save(); showStep(); } });
  element('note').addEventListener('input', () => { if (packet) { state.note = element('note').value.slice(0, MAX_NOTE); save(); } });
  element('forget').addEventListener('click', () => {
    if (!packet) return;
    const removed = removeProgress(storage, key);
    state = normalizeProgress(null, packet); showPacket();
    element('saved').textContent = removed ? 'Заметка и шаг этого режима удалены.' : 'Заметка очищена на экране; браузер не дал удалить сохранённую копию.';
    element('note').focus();
  });
  element('exit').addEventListener('click', () => {
    close(); document.dispatchEvent(new CustomEvent('reader-workshop:exit'));
  });
  window.ReaderWorkshop = {open, close};
})();
