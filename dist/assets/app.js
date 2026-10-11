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
  let changed = false;
  const refresh = () => {
    const count = countWords(area.value);
    practice.querySelector('.word-count').textContent = 'Слов в черновике: ' + count;
    practice.querySelector('.print-draft').textContent = area.value;
    download.disabled = !area.value.trim();
  };
  const updatePrompt = () => { prompt.textContent = select.selectedOptions[0].dataset.prompt; };
  select.addEventListener('change', updatePrompt);
  area.addEventListener('input', () => { changed = true; status.textContent = ''; refresh(); });
  download.addEventListener('click', () => {
    if (!area.value.trim()) return;
    const content = document.querySelector('h1').textContent.trim() + '\n\n' + select.selectedOptions[0].textContent + '\n' + prompt.textContent + '\n\n' + area.value + '\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'uzel-' + practice.dataset.lesson + '-chernovik.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    changed = false;
    status.textContent = 'Черновик подготовлен к скачиванию. Проверьте папку загрузок.';
  });
  window.addEventListener('beforeunload', event => {
    if (changed && area.value.trim()) { event.preventDefault(); event.returnValue = ''; }
  });
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
      return {lesson:document.querySelector('h1').textContent.trim(),prompt:prompt.textContent,draft:area.value,words:countWords(area.value)};
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
