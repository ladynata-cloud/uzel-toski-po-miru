(() => {
  'use strict';
  const root = document.getElementById('ot-temy-do-vyvoda');
  const {skills, cards, method} = JSON.parse(document.getElementById('wp-cards').textContent);
  const byId = new Map(cards.map(card => [card.id, card]));
  const el = name => root.querySelector('#wp-' + name);
  const prefix = 'uzel-writing-practice-v1:';
  const memory = new Map();
  let storageAvailable = true;
  function read(key) {
    if (storageAvailable) {
      let raw;
      try { raw = localStorage.getItem(prefix + key); }
      catch { storageAvailable = false; }
      if (raw) {
        try {
          const record = JSON.parse(raw);
          if (record && typeof record === 'object' && !Array.isArray(record)) memory.set(key, record);
        } catch { /* A damaged card should not prevent work on the other cards. */ }
      }
    }
    return memory.get(key) || {};
  }
  function update(key, changes) {
    const record = Object.assign({}, read(key), changes);
    memory.set(key, record);
    if (storageAvailable) {
      try { localStorage.setItem(prefix + key, JSON.stringify(record)); }
      catch { storageAvailable = false; }
    }
    el('save').textContent = storageAvailable ? 'Записи сохраняются в этом браузере.' : 'В этом браузере сохранение недоступно. До закрытия скачай свои записи.';
    return record;
  }
  const text = (name, value) => { el(name).textContent = value; };
  const option = (value, label) => new Option(label, value);
  const active = () => byId.get(el('exercise').value);
  const current = () => read(active().id);
  const response = rec => rec.keep ? (rec.reason || '') : (rec.answer || '');
  const hasWriting = rec => [rec.answer, rec.reason, rec.transfer].some(value => typeof value === 'string' && value.trim());
  function toggleActions() {
    const rec = current();
    const written = Boolean(el('response').value.trim());
    el('compare').disabled = !written;
    el('pin').disabled = !written || Boolean(rec.first);
    el('pin').hidden = Boolean(rec.first);
    el('transfer-check').disabled = !el('transfer-text').value.trim();
  }
  function labelResponse() {
    text('response-label', el('keep').checked ? 'Почему я сохраняю эту фразу' : 'Моя версия');
  }
  function reviewQuestion(card, rec) {
    if (!['retell','motive','quote'].includes(card.skill)) return card.self_check;
    const answer = response(rec).trim();
    if (rec.keep) return card.self_check;
    const norm = value => value.toLowerCase().replaceAll('ё','е').replace(/[^а-яa-z0-9]+/gu,' ').trim();
    if (norm(answer) === norm(card.draft)) return card.question;
    // Inspect the learner's narration, excluding words presented as a quotation.
    const unquoted = answer.replace(/«[^»]*»|"[^"]*"/gu,' ');
    const narration = norm(unquoted);
    if (card.skill === 'quote' && /[«"]/u.test(answer) &&
        /по памяти|не помню|не уверен|кажется|вроде|примерно|не сверил/u.test(narration)) {
      return 'Какие слова из твоей записи в кавычках ты можешь подтвердить по книге?';
    }
    if (card.skill === 'motive') {
      const sentences = unquoted.split(/[.!?…\n]+/u);
      for (const sentence of sentences) {
        const words = norm(sentence);
        const certainty = words.match(/(?:^| )(наверняка|точно|несомненно)(?= |$)/u);
        const motive = /(?:^| )(боял|побоял|мечтал|хотел|стыдил|надеял)[а-я]*(?= |$)/u.exec(words);
        const tentative = /(?:^| )(?:не (?:дума[а-я]*|зна[а-я]*|могу|уверен[а-я]*|сказа[а-я]*)|если бы|может быть|возможно)(?: |$)/u.test(words);
        if (certainty && motive && !tentative && !words.slice(0, motive.index).endsWith(' не')) {
          return 'Какой поступок или реплика героя даёт тебе основание написать «'+certainty[1]+'»?';
        }
      }
    }
    if (card.skill === 'retell' && /(?:^| )сначала /u.test(narration) &&
        / (?:потом|затем|после этого) /u.test(narration) &&
        !/потому что|это (?:показывает|значит|важно)|поэтому|я (?:думаю|считаю|вижу)|для меня/u.test(narration)) {
      return card.question;
    }
    return card.self_check;
  }
  function lensQuestion(card) {
    const mode = EssayReadingLens.current();
    return mode === 'orthodox' && card.orthodox_question
      ? card.orthodox_question : EssayReadingLens.question(card.skill, mode);
  }
  function showReview(visible) {
    const card = active(), rec = current();
    el('review').hidden = !visible;
    el('prompt-wrap').hidden = !visible;
    el('prompt-wrap').open = false;
    text('copy-status', '');
    el('transfer').hidden = !visible || !card.transfer;
    if (!visible) return;
    const first = rec.first && (rec.first.value !== response(rec) || Boolean(rec.first.keep) !== Boolean(rec.keep)) ? rec.first : null;
    const before = first ? first.value : card.draft;
    text('before-label', first ? (first.keep ? 'Моё первое обоснование' : 'Моя первая версия') : 'Было в черновике');
    text('before', before);
    el('before-box').hidden = !before;
    text('after-label', rec.keep ? 'Моё решение' : 'Моя новая версия');
    text('after', rec.keep ? card.draft : rec.answer);
    text('why', rec.keep ? 'Почему я оставляю эту фразу. ' + rec.reason : '');
    el('why').hidden = !rec.keep;
    text('self-check', reviewQuestion(card, rec));
    const literature = {
      retell: 'Попроси объяснить, что именно деталь действия помогает понять в теме.',
      motive: 'Попроси разделить наблюдаемый поступок и предположение о намерениях героя.',
      quote: 'Помоги различить цитату, пересказ и собственный вывод. Для дословной цитаты нужна возможность сверить слова и их автора по источнику.'
    };
    el('prompt').value = [
      method.instructions, 'Ракурс вопросов: ' + EssayReadingLens.label(EssayReadingLens.current()) + '. ' + lensQuestion(card),
      method.sections[card.skill] || literature[card.skill],
      'Учебный навык: ' + skills[card.skill], 'Тема: ' + card.topic, 'Материал для сверки: ' + card.context,
      card.draft && 'Учебный черновик: ' + card.draft,
      rec.keep ? 'Моё обоснование сохранённой фразы: ' + rec.reason : 'Моя собственная версия: ' + rec.answer
    ].filter(Boolean).join('\n\n');
  }
  function refreshLens() {
    const card = active();
    const lens = EssayReadingLens.label(EssayReadingLens.current());
    text('lens-question', lens + '. ' + lensQuestion(card));
    if (!el('review').hidden) {
      const open = el('prompt-wrap').open;
      showReview(true);
      el('prompt-wrap').open = open;
    }
  }
  window.addEventListener('essay-practice-lens', refreshLens);
  function markSelection() {
    const card = active();
    const listOption = el('exercise').selectedOptions[0];
    if (listOption) listOption.textContent = card.title + (current().reviewed ? ' · сверено' : '');
  }
  function showCard() {
    const card = active();
    const rec = read(card.id);
    update('selection', {id: card.id, [card.skill]: card.id});
    text('topic', card.topic);
    const titlePrefix = card.book ? card.book + '. ' : '';
    const scene = titlePrefix && card.context.startsWith(titlePrefix) ? card.context.slice(titlePrefix.length) : card.context;
    text('context', scene);
    text('book', '');
    el('book').hidden = !card.book;
    if (card.book) {
      el('book').append(document.createTextNode(card.book));
      if (card.source) {
        const link = document.createElement('a');
        link.href = card.source; link.textContent = 'Открыть текст книги';
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        el('book').append(document.createTextNode(' · '), link);
      }
    }
    text('draft', card.draft);
    el('manuscript').hidden = !card.draft;
    el('blank').hidden = Boolean(card.draft);
    el('keep-wrap').hidden = !card.draft;
    el('keep').checked = Boolean(rec.keep && card.draft);
    el('response').value = response(rec);
    labelResponse();
    text('question', card.question);
    text('lens-question', EssayReadingLens.label(EssayReadingLens.current()) + '. ' + lensQuestion(card));
    el('hint').open = false;
    el('transfer').open = false;
    text('transfer-task', card.transfer ? card.transfer.task : '');
    text('transfer-rule', card.transfer ? card.transfer.teacher_check : '');
    el('transfer-text').value = rec.transfer || '';
    el('transfer-rule').hidden = !(rec.transferChecked && rec.transfer && rec.transfer.trim());
    text('action-status', rec.first ? 'Первая версия сохранена для сравнения.' : '');
    showReview(Boolean(rec.reviewed && response(rec).trim()));
    toggleActions();
    el('export').disabled = !cards.some(item => hasWriting(read(item.id)));
  }
  function showSkill(skill, preferredId) {
    const available = cards.filter(card => card.skill === skill);
    el('skill').value = skill;
    el('exercise').replaceChildren(...available.map(card =>
      option(card.id, card.title + (read(card.id).reviewed ? ' · сверено' : ''))));
    if (available.some(card => card.id === preferredId)) el('exercise').value = preferredId;
    showCard();
  }
  function editResponse(changes) {
    const rec = current();
    if (rec.reviewed && !rec.first && response(rec).trim()) {
      changes.first = {value: response(rec), keep: Boolean(rec.keep)};
    }
    return update(active().id, {...changes, reviewed:false});
  }
  function editsInvalidateReview() {
    text('action-status', '');
    showReview(false);
    toggleActions();
    markSelection();
  }
  el('skill').replaceChildren(...Object.entries(skills).map(([key, title]) => option(key, title)));
  const last = byId.get(read('selection').id);
  showSkill(last ? last.skill : 'topic', last && last.id);
  el('skill').addEventListener('change', () => {
    const skill = el('skill').value;
    showSkill(skill, read('selection')[skill]);
  });
  el('exercise').addEventListener('change', showCard);
  el('keep').addEventListener('change', () => {
    const rec = editResponse({keep: el('keep').checked});
    el('response').value = response(rec);
    labelResponse();
    editsInvalidateReview();
    el('response').focus();
  });
  el('response').addEventListener('input', () => {
    const field = el('keep').checked ? 'reason' : 'answer';
    editResponse({[field]: el('response').value});
    editsInvalidateReview();
    el('export').disabled = !el('response').value.trim() && !cards.some(item => hasWriting(read(item.id)));
  });
  el('pin').addEventListener('click', () => {
    if (!el('response').value.trim() || current().first) return;
    update(active().id, {first: {value: el('response').value, keep: el('keep').checked}});
    toggleActions();
    text('action-status', 'Первая версия сохранена. Можешь изменить запись и сравнить обе версии.');
    el('response').focus();
  });
  el('compare').addEventListener('click', () => {
    if (!el('response').value.trim()) return;
    update(active().id, {reviewed: true});
    markSelection();
    showReview(true);
    text('action-status', '');
    el('review-title').focus();
  });
  el('revise').addEventListener('click', () => {
    editResponse({});
    showReview(false);
    toggleActions();
    markSelection();
    el('response').focus();
  });
  el('next').addEventListener('click', () => {
    const select = el('exercise');
    select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
    showCard();
    el('topic').focus();
  });
  el('transfer-text').addEventListener('input', () => {
    update(active().id, {transfer: el('transfer-text').value, transferChecked: false});
    el('transfer-rule').hidden = true;
    toggleActions();
  });
  el('transfer-check').addEventListener('click', () => {
    if (!el('transfer-text').value.trim()) return;
    update(active().id, {transferChecked: true});
    el('transfer-rule').hidden = false;
    el('transfer-rule').focus();
  });
  el('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el('prompt').value);
      text('copy-status', 'Запрос скопирован.');
    } catch {
      el('prompt').focus();
      el('prompt').select();
      text('copy-status', 'Текст выделен. Выбери «Копировать» в меню или нажми Ctrl+C.');
    }
  });
  el('export').addEventListener('click', () => {
    const lines = ['Мои записи. Мастерская «От темы до вывода»'];
    for (const card of cards) {
      const rec = read(card.id);
      if (!hasWriting(rec)) continue;
      lines.push('', skills[card.skill] + ' · ' + card.title, 'Тема: ' + card.topic);
      if (card.draft) lines.push('Учебный черновик: ' + card.draft);
      if (rec.first) lines.push((rec.first.keep ? 'Моё первое обоснование: ' : 'Моя первая версия: ') + rec.first.value);
      if (rec.answer) lines.push('Моя версия: ' + rec.answer);
      if (rec.reason) lines.push('Почему я сохраняю исходную фразу: ' + rec.reason);
      if (rec.transfer && card.transfer) lines.push('Другой эпизод: ' + card.transfer.task, 'Мой самостоятельный ответ: ' + rec.transfer);
    }
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'}));
    link.href = url; link.download = 'moi-zapisi-k-sochineniyu.txt';
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
