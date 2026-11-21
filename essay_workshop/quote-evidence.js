/* Exact quotation evidence shared by the offline editor and its demonstration. */
(function (root) {
  'use strict';
  const ids = ['K1', 'K2', 'K3', 'K4', 'K5'];
  function findAll(text, quote) {
    if (typeof text !== 'string' || typeof quote !== 'string' || !quote.length) return [];
    const matches = [];
    let start = text.indexOf(quote);
    while (start !== -1) {
      matches.push(start);
      start = text.indexOf(quote, start + 1);
    }
    return matches;
  }
  function checkReview(review, text, reportedUnverified = []) {
    const rows = review?.criteria;
    if (typeof text !== 'string' || typeof review?.priority !== 'string' ||
        !Array.isArray(rows) || rows.length !== ids.length ||
        new Set(rows.map(row => row?.id)).size !== ids.length ||
        !rows.every(row => ids.includes(row?.id) &&
          ['quote', 'comment', 'action'].every(key => typeof row[key] === 'string'))) return null;
    const dropped = new Set(Array.isArray(reportedUnverified) ? reportedUnverified.filter(id => ids.includes(id)) : []);
    const criteria = rows.map(row => {
      if (row.quote && !findAll(text, row.quote).length) dropped.add(row.id);
      if (dropped.has(row.id)) return {id: row.id, quote: '', comment: '', action: ''};
      return {id: row.id, quote: row.quote, comment: row.comment, action: row.action};
    });
    // A global priority may depend on a rejected quotation. Only keep a step
    // attached to remaining evidence, or invite the writer to choose a phrase.
    const priority = dropped.size
      ? (criteria.find(row => row.quote && row.action)?.action || 'Выбери в своей работе фразу, которую хочешь обсудить.')
      : review.priority;
    return {...review, criteria, priority, unverified: ids.filter(id => dropped.has(id))};
  }
  const api = Object.freeze({findAll, checkReview});
  root.EssayQuoteEvidence = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);
