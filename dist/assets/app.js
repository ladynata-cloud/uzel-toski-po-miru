(() => {
  'use strict';
  const countWords = text => (text.trim().match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) || []).length;
  const practice = document.querySelector('.practice');
  if (!practice) return;
  const area = practice.querySelector('textarea');
  const select = practice.querySelector('select');
  const prompt = practice.querySelector('.writing-prompt');
  const status = practice.querySelector('.draft-status');
  const download = practice.querySelector('[data-download]');
  const email = practice.querySelector('[data-email-draft]');
  const save = practice.querySelector('[data-save-draft]');
  const taskSource = practice.querySelector('[data-draft-source]');
  const sourceText = () => taskSource?.value.trim() || '';
  const sourceLine = () => sourceText() ? 'Источник задания: ' + sourceText() + '\n' : '';
  const storageKey = 'uzel-workshop-draft-v1:' + practice.dataset.lesson;
  let changed = false;
  const refresh = () => {
    const count = countWords(area.value);
    practice.querySelector('.word-count').textContent = 'Слов в черновике: ' + count;
    practice.querySelector('.print-draft').textContent = sourceLine() + (sourceText() ? '\n' : '') + area.value;
    download.disabled = !area.value.trim();
    if (save) save.disabled = !area.value.trim();
    if (email) {
      const title = document.querySelector('h1').textContent.trim();
      const intro = title + '\n' + select.selectedOptions[0].textContent + '\n' + window.location.href + '\n\n';
      const full = intro + sourceLine() + (sourceText() ? '\n' : '') + area.value;
      const longDraft = encodeURIComponent(full).length > 1600;
      const body = longDraft ? intro + 'Здравствуйте! Мой ответ и источник задания — в приложенном файле.\n\n' : full;
      email.href = 'mailto:ladynata3000@gmail.com?subject=' + encodeURIComponent('Литературная мастерская: ' + title.slice(0, 80)) + '&body=' + encodeURIComponent(body);
      email.dataset.attachFile = String(longDraft);
    }
  };
  const updatePrompt = () => { prompt.textContent = select.selectedOptions[0].dataset.prompt; refresh(); };
  select.addEventListener('change', updatePrompt);
  area.addEventListener('input', () => { changed = true; status.textContent = ''; refresh(); });
  taskSource?.addEventListener('input', () => { changed = true; status.textContent = ''; refresh(); });
  save?.addEventListener('click', () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({text: area.value, mode: select.selectedIndex, source: sourceText()}));
      changed = false;
      status.textContent = 'Ответ сохранён в этом браузере. Срок хранения не гарантируется: данные могут исчезнуть. Для надёжной копии скачайте файл.';
    } catch (_) {
      status.textContent = 'Браузер не разрешил сохранение. Скачайте ответ файлом, чтобы не потерять его.';
    }
  });
  download.addEventListener('click', () => {
    if (!area.value.trim()) return;
    const content = document.querySelector('h1').textContent.trim() + '\n\n' + select.selectedOptions[0].textContent + '\n' + prompt.textContent + '\n\n' + sourceLine() + (sourceText() ? '\n' : '') + area.value + '\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'uzel-' + practice.dataset.lesson + '-chernovik.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    changed = false;
    status.textContent = 'Черновик подготовлен к скачиванию. Проверьте папку загрузок.';
  });
  email?.addEventListener('click', event => {
    if (taskSource && select.selectedOptions[0].hasAttribute('data-external-practice') && !sourceText()) {
      event.preventDefault();
      status.textContent = 'Добавьте ссылку на задание или укажите ФИПИ, предмет, год и номер. Так учитель сможет проверить ответ по нужным условиям.';
      taskSource.focus();
      return;
    }
    if (email.dataset.attachFile === 'true') {
      download.click();
      status.textContent = 'Скачайте файл и приложите его к письму на ladynata3000@gmail.com. Вложение не добавляется автоматически. Отправьте письмо из своей почты.';
    } else {
      status.textContent = 'Откройте письмо в своей почте, проверьте текст и нажмите «Отправить». Сам сайт письмо не отправляет. Если почтовая программа не открылась, напишите на ladynata3000@gmail.com вручную.';
    }
  });
  window.addEventListener('beforeunload', event => {
    if (changed && area.value.trim()) { event.preventDefault(); event.returnValue = ''; }
  });
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved.text === 'string' && saved.text.length <= 50000) {
      area.value = saved.text;
      if (taskSource && typeof saved.source === 'string' && saved.source.length <= 1000) taskSource.value = saved.source;
      if (Number.isInteger(saved.mode) && saved.mode >= 0 && saved.mode < select.options.length) select.selectedIndex = saved.mode;
      status.textContent = 'Восстановлен ответ, сохранённый в этом браузере. После правок сохраните его снова или скачайте файл.';
    }
  } catch (_) { /* Storage may be unavailable or contain an outdated draft. */ }
  refresh(); updatePrompt();
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const register = tool => {
    try { Promise.resolve(context.registerTool(tool, {signal:lifecycle.signal})).catch(() => {}); } catch (_) {}
  };
  register({
    name:'read_lesson_draft', title:'Прочитать задание и черновик',
    description:'Read the current literature workshop title, selected writing prompt, and the learner draft visible in this page.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,untrustedContentHint:true},
    execute(input){
      if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object');
      return {lesson:document.querySelector('h1').textContent.trim(),prompt:prompt.textContent,taskSource:sourceText(),draft:area.value,words:countWords(area.value)};
    }
  });
  register({
    name:'replace_lesson_draft',title:'Обновить черновик',
    description:'Replace the text in the visible learner draft editor. Use only when the learner requests drafting or editing; this does not submit or publish the text.',
    inputSchema:{type:'object',properties:{text:{type:'string',maxLength:50000}},required:['text'],additionalProperties:false},
    annotations:{readOnlyHint:false,untrustedContentHint:true},
    execute(input){
      if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(k=>k!=='text') || typeof input.text!=='string' || input.text.length>50000) throw new Error('Expected text up to 50000 characters');
      area.value=input.text;area.dispatchEvent(new Event('input',{bubbles:true}));
      return {updated:true,words:countWords(area.value)};
    }
  });
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
})();
