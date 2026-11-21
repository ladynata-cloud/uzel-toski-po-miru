/* An author-written topic comparison opens a standard workshop draft with the pupil's own notes. */
const EssayThemePlanner = (() => {
  'use strict';
  const lessons = /*LESSONS_JSON*/[];
  const levels = ['Рассмотреть эпизод', 'Сопоставить', 'Обосновать с оговоркой'];
  const esc = value => String(value ?? '').replace(/[&<>"']/gu, ch =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));

  // A saved plan can precede the introduction of per-topic book suggestions.
  const byPlannerKey = new Map();
  const byTitle = new Map();
  for (const group of lessons) {
    group.tasks.forEach((item, index) => {
      byPlannerKey.set('theme-plan-' + group.id + '-' + index, item.bookSuggestions);
      byTitle.set(item.title, item.bookSuggestions);
    });
  }
  function suggestionsFor(topic) {
    return byPlannerKey.get(topic?.plannerKey) || byTitle.get(topic?.title) || [];
  }

  function render() {
    return '<details id="ta-plan"><summary>Сравнить три темы и составить план</summary><div data-tp-content></div></details>';
  }

  function mount(host, catalog, ctx) {
    const box = host.querySelector('#ta-plan');
    if (!box || !ctx) return;
    const content = box.querySelector('[data-tp-content]');
    const record = ctx.record;
    const works = new Map(catalog.works.map(w => [w.id, w]));
    const sections = new Map(catalog.publicTopics.sections.map(s => [s.id, s.title]));
    const alphabetical = [...works.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    record.byTopic ||= {};
    record.group = lessons.some(g => g.id === record.group) ? record.group : lessons[0].id;
    record.levelByGroup ||= {};
    box.open = record.open === true;

    function group() { return lessons.find(g => g.id === record.group); }
    function task() { return group().tasks[record.levelByGroup[record.group]]; }
    function topicKey() { return group().id + '-' + record.levelByGroup[record.group]; }
    function worksheet() {
      const sheet = record.byTopic[topicKey()] ||= {work:'', thesis:''};
      sheet.notesByWork ||= {};
      return sheet;
    }
    function notes() {
      const sheet = worksheet();
      return sheet.notesByWork[sheet.work] ||= {episode:'', link:'', own:''};
    }
    function opt(value, title, current) {
      return '<option value="' + esc(value) + '"' + (value === current ? ' selected' : '') + '>' + esc(title) + '</option>';
    }
    function field(key, label, value) {
      return '<div class="ew-field"><label for="tp-' + key + '">' + esc(label) + '</label>' +
        '<textarea id="tp-' + key + '" data-tp-field="' + key + '" rows="2">\n' + esc(value) + '</textarea></div>';
    }
    function sourceLink(raw) {
      if (!raw) return '';
      try {
        const url = new URL(raw, 'https://usel-toski-po-miru.art');
        if (!['https:', 'http:'].includes(url.protocol)) return '';
        return '<p><a href="' + esc(url.href) + '" target="_blank" rel="noopener noreferrer">Открыть источник</a></p>';
      } catch { return ''; }
    }
    function chooseWork(work) {
      const sheet = worksheet();
      sheet.work = work;
      content.querySelectorAll('[data-tp-pick]').forEach(button => {
        const selected = button.dataset.tpPick === work;
        button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('ew-primary', selected);
      });
      const select = content.querySelector('#tp-book');
      if (select) select.value = work;
      drawBook();
      ctx.save();
      content.querySelector('[data-tp-current-book]')?.focus();
    }
    function drawBook() {
      const sheet = worksheet(), book = works.get(sheet.work), holder = content.querySelector('[data-tp-book-panel]');
      if (!sheet.work) { holder.innerHTML = ''; return; }
      const n = notes();
      const match = task().bookSuggestions.find(item => item.work === sheet.work);
      let head;
      if (book) {
        head = '<details data-tp-scene><summary>Вспомнить сцену из книги</summary><p class="ew-small">Пересказ мастерской</p>' +
          '<p>' + esc(match?.scene || book.fact) + '</p>' + sourceLink(match?.url || book.url) + '</details>';
      } else {
        head = '<div class="ew-field"><label for="tp-own">Автор и название моей книги</label><input id="tp-own" data-tp-field="own" value="' +
          esc(n.own) + '"></div>';
      }
      holder.innerHTML = '<h4 tabindex="-1" data-tp-current-book>' + (book ? 'Моя книга · ' + esc(match?.title || book.title) : 'Моя книга') + '</h4>' + head + field('thesis','Как я отвечу на выбранный вопрос?',sheet.thesis) +
        field('episode','Какой поступок, жест или деталь я возьму из текста?',n.episode) +
        field('link','Как этот эпизод поможет обосновать мой ответ?',n.link) +
        '<div class="ew-actions"><button type="button" class="ew-primary" data-tp-draft>Открыть черновик с моим планом</button><button type="button" data-tp-download>Скачать мои заметки</button></div>' +
        '<p class="ew-small">В черновике раскрой «Мои заметки к сочинению». Там будут твои тезис, эпизод и объяснение.</p>' +
        '<p class="ew-small" data-tp-status role="status"></p>';
    }
    function drawTask() {
      const item = task(), target = content.querySelector('[data-tp-task]');
      if (!item) { target.innerHTML = ''; return; }
      const sheet = worksheet();
      const choices = item.bookSuggestions.map(({work, why, title}, i) => {
        const book = works.get(work);
        return '<div class="ew-topic-book"><button type="button" class="' + (work === sheet.work ? 'ew-primary' : '') + '" data-tp-pick="' + esc(work) +
          '" aria-pressed="' + String(work === sheet.work) + '" aria-describedby="tp-why-' + i + '">' +
          esc(title || book.title) + '</button><p id="tp-why-' + i + '">' + esc(why) + '</p></div>';
      }).join('');
      target.innerHTML = '<h3 tabindex="-1" data-tp-title>' + esc(item.title) + '</h3><p>' + esc(item.move) + '</p>' +
        '<details><summary>Как проверить, что я отвечаю именно на эту тему?</summary><p>' + esc(item.check) + '</p></details>' +
        '<h4 id="tp-shortlist-label">Книги к этой теме</h4><p class="ew-small">Выбери книгу, эпизод из которой ты помнишь.</p>' +
        '<div class="tp-shortlist" role="group" aria-labelledby="tp-shortlist-label">' + choices + '</div>' +
        '<button type="button" data-tp-more aria-expanded="false" aria-controls="tp-more-panel">Выбрать другую книгу</button>' +
        '<div id="tp-more-panel" class="ew-field" hidden></div><div data-tp-book-panel></div>';
      drawBook();
    }
    function toggleOtherBooks(button) {
      const panel = content.querySelector('#tp-more-panel');
      const show = panel.hidden;
      panel.hidden = !show;
      button.setAttribute('aria-expanded', String(show));
      if (!show) { panel.replaceChildren(); return; }
      const sheet = worksheet();
      panel.innerHTML = '<label for="tp-book">Вся полка и своя книга</label><select id="tp-book">' +
        opt('', 'Выбрать произведение', sheet.work) + opt('own', 'Ввести свою книгу', sheet.work) +
        alphabetical.map(book => opt(book.id, book.title, sheet.work)).join('') + '</select>';
      panel.querySelector('select').focus();
    }
    function drawChoices() {
      const g = group();
      const selected = record.levelByGroup[g.id];
      content.querySelector('[data-tp-section]').textContent = 'Подраздел ' + g.subsection + ' · ' + sections.get(g.subsection);
      content.querySelector('[data-tp-choices]').innerHTML = g.tasks.map((t, i) => {
        return '<button type="button"' + (selected === i ? ' class="ew-primary"' : '') + ' data-tp-level="' + i + '" aria-pressed="' + (selected === i) + '">' +
          '<strong>' + esc(levels[i]) + '</strong><br>' + esc(t.title) + '</button>';
      }).join('');
      drawTask();
    }
    function initialize() {
      content.innerHTML = '<p>В каждом занятии три авторские учебные темы «Узла». Выбери одну формулировку и попробуй составить к ней план на материале знакомой книги.</p>' +
        '<div class="ew-field"><label for="tp-group">О чём я хочу писать?</label><select id="tp-group">' +
        lessons.map(g => opt(g.id, g.name, record.group)).join('') + '</select></div>' +
        '<p data-tp-section class="ew-small"></p><p><strong>На какой вопрос ты ответишь?</strong></p>' +
        '<div class="ew-actions" data-tp-choices></div><div data-tp-task></div>';
      drawChoices();
    }
    function downloadNotes() {
      const sheet = worksheet(), n = notes();
      const match = task().bookSuggestions.find(item => item.work === sheet.work);
      const bookTitle = match?.title || works.get(sheet.work)?.title || n.own;
      const fields = [['Тема',task().title],['Книга',bookTitle],['Мой тезис',sheet.thesis],['Эпизод',n.episode],['Обоснование',n.link]];
      const body = fields.filter(([,v]) => String(v || '').trim()).map(([k,v]) => k + '\n' + v).join('\n\n');
      const url = URL.createObjectURL(new Blob([body], {type:'text/plain;charset=utf-8'}));
      const link = document.createElement('a'); link.href = url; link.download = 'moi-plan-sochineniya.txt';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function openDraft() {
      const sheet = worksheet(), n = notes(), book = works.get(sheet.work);
      const required = [
        ...(!book ? [['own', n.own, 'Укажи автора и название книги.']] : []),
        ['thesis', sheet.thesis, 'Запиши свой ответ на вопрос темы.'],
        ['episode', n.episode, 'Назови одну деталь из произведения.'],
        ['link', n.link, 'Запиши, как эпизод связан с твоим ответом.']
      ];
      const missing = required.find(([,value]) => !String(value || '').trim());
      if (missing) {
        content.querySelector('[data-tp-status]').textContent = missing[2];
        content.querySelector('#tp-' + missing[0]).focus();
        return;
      }
      ctx.openDraft({key:topicKey(), title:task().title, work:sheet.work, own:book ? '' : n.own.trim(),
        thesis:sheet.thesis.trim(), episode:n.episode.trim(), link:n.link.trim()});
    }
    initialize();
    box.addEventListener('toggle', () => {
      if (record.open !== box.open) { record.open = box.open; ctx.save(); }
    });
    content.addEventListener('change', event => {
      if (event.target.id === 'tp-group') {
        record.group = event.target.value; drawChoices(); ctx.save();
      } else if (event.target.id === 'tp-book') {
        chooseWork(event.target.value);
      }
    });
    content.addEventListener('input', event => {
      const k = event.target.dataset.tpField;
      if (k === 'thesis') worksheet().thesis = event.target.value;
      else if (['own','episode','link'].includes(k)) notes()[k] = event.target.value;
      else return;
      content.querySelector('[data-tp-status]').textContent = '';
      ctx.save();
    });
    content.addEventListener('click', event => {
      const pick = event.target.closest('[data-tp-pick]');
      if (pick) { chooseWork(pick.dataset.tpPick); return; }
      const more = event.target.closest('[data-tp-more]');
      if (more) { toggleOtherBooks(more); return; }
      const level = event.target.closest('[data-tp-level]');
      if (level) {
        record.levelByGroup[record.group] = Number(level.dataset.tpLevel); drawChoices(); ctx.save();
        content.querySelector('[data-tp-title]').focus(); return;
      }
      if (event.target.closest('[data-tp-draft]')) openDraft();
      if (event.target.closest('[data-tp-download]')) downloadNotes();
    });
  }

  function openDraft(state, plan, go) {
    const prefix = 'theme-plan-' + plan.key;
    const suggestions = suggestionsFor({plannerKey:prefix,title:plan.title});
    const alternate = suggestions.some(route => route.work === plan.work && route.card);
    const previous = state.custom.filter(t => t.plannerKey === prefix);
    const argumentKey = n => n.work && n.sceneBook === n.work ? 'topic:' + n.work : n.work;
    const snapshot = n => {
      const arg = n.args?.[argumentKey(n)] || {};
      return [n.work,n.own || '',n.thesis,arg.episode || '',arg.link || ''];
    };
    const fields = [plan.work,plan.own,plan.thesis,plan.episode,plan.link];
    const same = (a,b) => Array.isArray(a) && a.length === b.length && a.every((s,i) => s === b[i]);
    // Reopening an unchanged plan keeps any edits made later on the ordinary writing pages.
    let topic = previous.find(t => same(t.transferred, fields));
    if (!topic) {
      // A pupil's independently revised outline is retained when a new plan is transferred.
      topic = previous.find(t => {
        const n = state.notes[t.id]; return n && !n.shelfChoice && same(t.transferred,snapshot(n));
      });
      if (!topic) {
        let id = prefix, copy = 1;
        while (state.custom.some(t => t.id === id)) id = prefix + '-' + (++copy);
        topic = {id,title:plan.title,work:plan.work,plannerKey:prefix};
        state.custom.push(topic);
      }
      const n = state.notes[topic.id] ||= {args:{},draft:'',checks:{},turns:{},before:null};
      n.work = topic.work = plan.work; n.own = plan.own; n.thesis = plan.thesis;
      n.sceneBook = alternate ? plan.work : '';
      const arg = n.args[argumentKey(n)] ||= {};
      arg.episode = plan.episode; arg.link = plan.link;
      topic.transferred = fields;
    } else if (alternate) {
      const n = state.notes[topic.id];
      // Earlier plans stored the pupil's notes under the general work.
      if (n && n.sceneBook === undefined && !n.shelfChoice && n.work === plan.work) {
        n.sceneBook = plan.work;
        n.args[argumentKey(n)] ||= {...n.args[plan.work]};
      }
    }
    topic.bookSuggestions = suggestions;
    state.active = topic.id; state.route = 'full';
    go('draft');
  }
  return Object.freeze({render,mount,openDraft,suggestionsFor});
})();
