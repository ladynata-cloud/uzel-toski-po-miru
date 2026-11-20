/* The editor owns the text. The coach can suggest a question and bind a student's
   proposed revision to an exact range, never replace the text by itself. */
const EssayRevision = (() => {
  'use strict';

  function select(source, start, end) {
    if (!source.trim()) return {message:'Сначала напиши хотя бы одну фразу в поле выше.'};
    if (start === end) {
      // Touch and keyboard users can simply place the caret inside a paragraph.
      start = start === 0 ? 0 : source.lastIndexOf('\n', start - 1) + 1;
      const nextBreak = source.indexOf('\n', end);
      end = nextBreak === -1 ? source.length : nextBreak;
    }
    const raw = source.slice(start, end);
    const passage = raw.trim();
    if (!passage) return {message:'Поставь курсор в абзац с текстом или выдели нужное предложение.'};
    if (passage.length > 1200) return {message:'Выдели в этом абзаце одну или две фразы, которые хочешь обсудить (до 1200 знаков).'};
    start += raw.length - raw.trimStart().length;
    return {source, start, end:start + passage.length, passage, proposal:passage};
  }

  function matches(session, source) {
    return !!session && !session.stale && session.source === source &&
      source.slice(session.start, session.end) === session.passage;
  }

  function replace(session, source, proposal) {
    if (!matches(session, source)) return null;
    const revised = proposal.trim();
    if (!revised || revised === session.passage) return null;
    const after = source.slice(0, session.start) + revised + source.slice(session.end);
    return {after, start:session.start, original:session.passage, revised};
  }

  function undo(last, current) {
    if (!last || current !== last.after) return null;
    return current.slice(0, last.start) + last.original + current.slice(last.start + last.revised.length);
  }

  function question({passage, stage, mode, topic, work, thesis}) {
    const words = passage.toLocaleLowerCase('ru').replaceAll('ё','е');
    const norm = text => text.toLocaleLowerCase('ru').replaceAll('ё','е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    if (norm(passage) === norm(topic)) {
      return 'Здесь пока звучит сам вопрос темы. Как бы ты ответил на него однокласснику одной фразой?';
    }
    // These are invitations to test specific claims, not judgements of correctness.
    const broad = words.replace(/(?:далеко\s+)?не\s+(?:всегда|кажд\p{L}*|все|люб\p{L}*)/gu,'');
    const absolute = broad.match(/(?:^|[^а-я])((?:всегда|любой человек|каждый человек|все люди|никто|никогда))(?=[^а-я]|$)/u);
    if (absolute) return 'Проверь слово «'+absolute[1]+'». При каких условиях твой вывод подтверждается именно этой сценой?';
    if (/не помню|не уверен|кажется,? (?:он|она|что)|вроде бы/u.test(words)) {
      return 'Выбери одну подробность, в которой сомневаешься. Какой поступок или чьи слова можно подтвердить по тексту и оставить в своей фразе?';
    }
    if (/автор (?:хотел|требует|считает|призывает)|по мнению автора/u.test(words)) {
      return 'Кому в этой сцене принадлежат слова или поступок, по которым ты судишь об авторе? Укажи эту деталь и объясни своё прочтение.';
    }
    if (work?.id === 'doctor' && /добры|доброт|хорош|милосерд|благород/u.test(words) && !/блюдц|рецепт|деньг|после уход/u.test(words)) {
      return mode === 'orthodox'
        ? 'Деньги под блюдцем Мерцалов замечает после ухода врача. Какая черта тайной помощи видна в этом поступке доктора?'
        : 'Деньги под блюдцем Мерцалов замечает после ухода врача. Как эта деталь помогает объяснить твою оценку доктора?';
    }
    const storyMoves = words.match(/(?:^|[^а-я])(сначала|потом|затем|после этого)(?=[^а-я]|$)/gu) || [];
    if (storyMoves.length > 1) {
      return 'Оставь одно событие из этой цепочки. Что читатель сможет понять о твоём тезисе благодаря именно этому событию?';
    }
    const sceneQuestion = work?.[mode];
    if (sceneQuestion) {
      const opening = stage === 'thesis' ? 'Испытай свой ответ на сцене из книги.' :
        stage === 'episode' ? 'Выбери для своей фразы одну наблюдаемую деталь.' :
        'Проверь объяснение на выбранной сцене.';
      return opening + ' ' + sceneQuestion;
    }
    if (stage === 'link' && thesis?.trim()) {
      return 'Перечитай свой тезис и эту фразу подряд. Какая деталь из эпизода объясняет, почему ты пришёл именно к такому выводу?';
    }
    if (mode === 'orthodox') return 'Если ты читаешь этот эпизод в православном ракурсе, какой поступок героя даёт основание для твоего прочтения?';
    if (stage === 'thesis') return 'Какое слово в вопросе «'+topic+'» ты объясняешь этой фразой? Попробуй уточнить свой ответ.';
    if (stage === 'episode') return 'Кто и что сделал в выбранной сцене? Уточни одно действие, которое читатель сможет найти в книге.';
    return 'Какая деталь из твоей книги поможет читателю понять, почему ты так думаешь? Свяжи её с выделенной фразой.';
  }

  return Object.freeze({select, matches, replace, undo, question});
})();
