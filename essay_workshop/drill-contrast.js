const EssayDrillContrast = (() => {
  'use strict';

  function text(value) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  function render(drill, selected) {
    const contrast = drill.contrast;
    if (!contrast) return '';
    const choice = Number.isInteger(selected) ? contrast.choices[selected] : null;
    const correct = selected === contrast.answer;
    const buttons = contrast.choices.map((item, index) => {
      const pressed = index === selected;
      return '<button type="button" data-act="drill-contrast-' + index + '" aria-pressed="' +
        pressed + '"' + (pressed ? ' class="ew-primary"' : '') + '>' + text(item.text) + '</button>';
    });
    const explanation = choice
      ? '<p><strong>' + (correct ? 'Верно.' : 'Попробуй ещё раз.') + '</strong> ' +
        text(choice.feedback) + '</p>' + (correct ? '<p>' + text(contrast.transfer) + '</p>' : '')
      : '';
    return '<section class="ew-text-card" data-drill-contrast aria-labelledby="ew-contrast-title">' +
      '<h3 id="ew-contrast-title">Сравни две фразы</h3><p>' + text(contrast.question) + '</p>' +
      '<div class="ew-actions">' + buttons.join('') + '</div>' +
      '<div id="ew-contrast-feedback" tabindex="-1" role="status"' +
      (choice ? ' data-correct="' + correct + '"' : '') + '>' + explanation + '</div></section>';
  }

  return Object.freeze({render});
})();
