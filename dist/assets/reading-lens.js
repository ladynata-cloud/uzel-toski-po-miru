(() => {
  'use strict';
  const selectors = [...document.querySelectorAll('[data-reading-lens-picker]')];
  if (!selectors.length) return;
  const key = 'uzel-reading-lens-v1';
  function render(mode) {
    selectors.forEach(select => { select.value = mode; });
    document.querySelectorAll('[data-reading-lens-only]').forEach(node => {
      node.hidden = node.dataset.readingLensOnly !== mode;
    });
  }
  function apply(mode) {
    render(mode);
    window.dispatchEvent(new CustomEvent('uzel-reading-lens', {detail: {mode}}));
  }
  let initial = 'secular';
  try { if (localStorage.getItem(key) === 'orthodox') initial = 'orthodox'; } catch {}
  selectors.forEach(select => select.addEventListener('change', () => {
    const mode = select.value;
    try { localStorage.setItem(key, mode); } catch {}
    apply(mode);
  }));
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue === 'orthodox' ? 'orthodox' : 'secular');
  });
  apply(initial);
})();
