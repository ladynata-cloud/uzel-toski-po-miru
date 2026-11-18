/* Search the editorial first-reading cards already on this page. */
(function () {
  'use strict';

  const stopWords = new Set(('а и или в во на не но о об от за из по у к ко со с про без до для что где как ' +
    'кто это этот эта там тот его ее их он она они я мне у нас вы был была было были есть какой каком ' +
    'какую какого какойто какомто помню помните вспомнить найти ищу хочу помогите вроде кажется ' +
    'название названия книга книгу книге книги произведение произведении произведения рассказ рассказе ' +
    'рассказа автор автора герой героя герои историю человек человека который которая которым чем только').split(' '));

  // Common endings in the short clue phrases. Strip at most one ending.
  const endings = [
    /(?:ившими|ывшими|авшими|ивший|ывший|авший|ившие|ывшие|авшие|ющего|ущего)$/u,
    /(?:иями|ьями|ами|ями|ими|ыми|ого|его|ому|ему|ая|яя|ое|ее|ые|ие|ый|ий|ой|ую|юю|ых|их|ою|ею)$/u,
    /(?:ала|яла|али|яли|или|ила|ило|ать|ять|ить|еть|ает|яет|ают|яют|ит|ил|ал)$/u,
    /(?:ов|ев|ей|ам|ям|ом|ем|ах|ях|ью|ия|ья|ию|ы|и|у|ю|а|я|е|о|ь)$/u,
  ];

  function terms(value) {
    const words = value.toLocaleLowerCase('ru').replace(/ё/g, 'е').match(/[а-яa-z0-9]+/gu) || [];
    const distinct = new Set();
    for (const word of words) {
      if (word.length < 2 || stopWords.has(word)) continue;
      let stem = word;
      // As in Russian stemming, preserve the prefix ending at the first vowel.
      const vowel = word.search(/[аеиоуыэюя]/u);
      if (vowel >= 0 && word.length >= 4) {
        const prefix = word.slice(0, vowel + 1);
        const suffix = word.slice(vowel + 1);
        for (const ending of endings) {
          const shorter = suffix.replace(ending, '');
          if (shorter !== suffix) {
            if ((prefix + shorter).length >= 3) stem = prefix + shorter;
            break;
          }
        }
      }
      distinct.add(stem);
    }
    return distinct;
  }

  function indexCard(card) {
    const weights = new Map();
    // The noun ending -ов is also part of many surnames («Чехов», «Чехова»).
    const surname = card.author.trim().split(/\s+/u).at(-1);
    const author = /(?:ов|ев|ёв|ин|ын)$/iu.test(surname)
      ? card.author + ' ' + surname + 'а'
      : card.author;
    for (const [text, weight] of [[card.teaser, 1], [card.cues, 3], [author, 5], [card.title, 7]]) {
      for (const word of terms(text)) weights.set(word, Math.max(weight, weights.get(word) || 0));
    }
    return weights;
  }

  function search(indexes, query) {
    const words = terms(query);
    if (!words.size) return [];
    const hits = indexes.map(() => ({score: 0, count: 0}));
    for (const word of words) {
      const frequency = indexes.filter(index => index.has(word)).length;
      if (!frequency) continue;
      const rarity = 1 + Math.log((indexes.length + 1) / (frequency + 1));
      indexes.forEach((index, i) => {
        if (index.has(word)) {
          hits[i].score += rarity * index.get(word);
          hits[i].count++;
        }
      });
    }
    const mostMatches = Math.max(0, ...hits.map(hit => hit.count));
    // Prefer agreement on several details when available. Single distinctive clues
    // remain useful when a reader supplies additional words absent from the catalogue.
    return hits.map((hit, i) => ({...hit, i}))
      .filter(hit => hit.count && (mostMatches <= 1 || hit.count >= Math.max(2, mostMatches - 1)))
      .sort((a, b) => b.count - a.count || b.score - a.score || a.i - b.i)
      .map(hit => hit.i);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {indexCard, search};
  if (typeof document === 'undefined') return;

  const form = document.getElementById('memory-form');
  if (!form) return;
  const field = document.getElementById('memory-query');
  const list = document.getElementById('memory-results');
  const status = document.getElementById('memory-status');
  const rows = Array.from(list.children);
  const indexes = rows.map(row => indexCard({
    title: row.querySelector('h2').textContent,
    author: row.querySelector('.memory-author').textContent,
    teaser: row.querySelector('.memory-teaser').textContent,
    cues: row.dataset.cues,
  }));

  function showResults() {
    const query = field.value.trim();
    const visible = query ? search(indexes, query) : rows.map((row, i) => i);
    const selected = new Set(visible);
    rows.forEach((row, i) => { row.hidden = !selected.has(i); });
    for (const i of visible) list.appendChild(rows[i]);
    if (!query) status.textContent = 'Произведений в подборке: ' + rows.length + '.';
    else if (visible.length) status.textContent = 'Подходящих карточек: ' + visible.length + '.';
    else status.textContent = 'В этой подборке совпадений нет. Попробуйте другую деталь, фамилию или название.';
  }

  let debounce;
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearTimeout(debounce);
    showResults();
  });
  field.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(showResults, 180);
  });
  form.addEventListener('reset', event => {
    event.preventDefault();
    clearTimeout(debounce);
    field.value = '';
    showResults();
    field.focus();
  });
  form.hidden = false;
  showResults();
})();
