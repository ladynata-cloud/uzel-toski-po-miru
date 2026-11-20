/* A reading aid for the learner. Each finding names something visible in the
   writing. A local pattern cannot certify an interpretation or a literary fact. */
const EssayAnswerFeedback = (() => {
  'use strict';

  const nextStep = {
    reading:'Назови один предмет, жест или звук в этой сцене, который привлёк твоё внимание.',
    thesis:'Ответь на вопрос темы так, как ответил бы собеседнику одним предложением.',
    episode:'Назови героя и одно его действие, которое читатель может найти в книге.',
    link:'Возьми одну деталь своего эпизода и объясни, что по ней можно понять о твоей мысли.',
    draft:'Напиши одну фразу, в которой ты отвечаешь на вопрос темы.',
    exercise:'Попробуй своими словами изменить одно место в предложенном черновике.'
  };

  function norm(value) {
    return String(value ?? '').toLowerCase().replaceAll('ё','е')
      .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }
  function finding(kind,observation,next,passage='') {
    return {kind,observation,next,excerpt:passage.trim().slice(0,210).trimEnd()};
  }
  function topicQuestion(title) {
    if (/^когда /u.test(norm(title))) return 'В каком случае это происходит? Закончи фразу своим ответом на слово «когда».';
    if (/^почему /u.test(norm(title))) return 'Назови одну причину, которой ты объясняешь то, о чём спрашивает тема.';
    if (/^как помочь /u.test(norm(title))) return 'Что именно может сделать человек? Предложи один ответ на слово «как».';
    if (/^как /u.test(norm(title))) return 'Объясни, как именно это происходит в случае, который ты имеешь в виду.';
    return nextStep.thesis;
  }
  function sourceContains(source,words,minWords=4) {
    return words.split(' ').length>=minWords && (' '+norm(source)+' ').includes(' '+words+' ');
  }
  // Here the originals are deliberately supplied by the editor as teaching
  // material. Overlap with any other work is not treated as a copying signal.
  function drillFeedback(drill,text,words,last) {
    if (words===norm(drill.task)) {
      return finding('task-echo','Здесь снова стоит инструкция к упражнению.',drill.hint,text);
    }
    if (sourceContains(drill.example,words)) {
      return finding('example-echo','Эти слова уже стоят в учебном черновике в том же порядке.',drill.hint,text);
    }
    if (drill.id==='thesis' && /^(?:каждому |всем )?(?:надо|нужно|важно) (?:быть добр(?:ым|ее)|помогать людям)$/u.test(words)) {
      return finding('general-claim','Ты назвал ценность доброты. В задании просят указать момент, когда сочувствие превращается в дело.',drill.hint,text);
    }
    if (drill.id==='observation' && /(?:^| )(?:василиса |она )?(?:наверняка |точно |несомненно )(?:подумала|вспомнила|решила|почувствовала)(?: |$)/u.test(words)) {
      return finding('interpretation','О внутреннем состоянии героини в этой записи говорится с уверенностью.','Найди жест Василисы, который может увидеть рассказчик, а своё объяснение этого жеста обозначь как догадку.',text);
    }
    if (drill.id==='retelling' && /(?:^| )сначала /u.test(words) && / (?:потом|затем|после этого) /u.test(words)) {
      return finding('sequence','В редакции по-прежнему обозначена последовательность действий.','Выбери одно действие домашних и объясни, что в них переменилось с приходом врача.',text);
    }
    if (drill.id==='evidence' && /(?:разговор|конце беседы|последней сцене)/u.test(words) && !/оброк|крестьян|мужик|односельчан|подат/u.test(words)) {
      return finding('locate-detail','Ты указываешь читателю, в каком месте искать пример.','Что именно Лукерья просит передать? Впиши в свою фразу содержание просьбы.',text);
    }
    if (drill.id==='repetition') {
      const repeats=text.match(/(?:^|[.!?]\s+)Грин[её]в\s/giu);
      if (repeats?.length>1) return finding('sentence-openings','Несколько предложений начинаются с имени Гринёва.','Прочти второе из них без имени и проверь, осталось ли ясно, кто действует.',last);
    }
    if (drill.id==='conclusion' && /(?:^| )(?:всегда|при любых обстоятельствах)(?: |$)/u.test(words.replace(/(?:далеко )?не всегда/gu,''))) {
      return finding('scope','В выводе ты распространил мысль на другие возможные случаи.','Останови рассказ до решения Пугачёва. Какой вывод о Гринёве к этому моменту уже можно сделать?',last);
    }
    return finding('drill-review','Сверь эту часть своей редакции с задачей упражнения.',drill.check || nextStep.exercise,last);
  }
  function inspect(context={}) {
    const {work,reading,drill}=context;
    const stage=({read:'reading',drill:'exercise',review:'draft'})[context.stage] || context.stage || 'draft';
    const paraphrase=stage==='reading' && reading && (reading.kind==='scene'||!reading.quote?.trim());
    const topic=typeof context.topic==='string'?context.topic:context.topic?.title;
    const text=String(context.text ?? '').trim();
    const words=norm(text);
    const next=stage==='thesis'?topicQuestion(topic):nextStep[stage] || nextStep.draft;
    if (!words || !/\p{L}/u.test(text)) return finding('empty',text?'В поле пока только числа или знаки.':'В этом поле пока пусто.',next,text);
    if (/^(?:(?:я|пока|я пока) )?(?:не знаю|не помню|не понимаю|не могу придумать|не знаю что (?:написать|сказать))$/u.test(words)) {
      return finding('stuck','Ты указал, где работа остановилась.',stage==='reading' || stage==='episode'?'Вспомни, что происходит в этой сцене. Какую подробность ты мог бы описать своими словами?':next,text);
    }
    if (/^(?:я (?:считаю|думаю|полагаю)(?: что)?|мне кажется(?: что)?|на мой взгляд|по моему мнению|потому что|так как|этот пример (?:показывает|доказывает)(?: что)?|таким образом)$/u.test(words)) {
      return finding('unfinished','Вся запись занимает только вводные слова. Мысль после них ещё можно дописать.',next,text);
    }
    const claim=words.replace(/^(?:я (?:считаю|думаю|полагаю) что|по моему мнению) /u,'');
    if (topic && claim===norm(topic)) return finding('topic-echo','В поле повторена формулировка выбранной темы.',topicQuestion(topic),text);
    if (stage==='link' && context.episode && words===norm(context.episode)) {
      return finding('episode-echo','В полях эпизода и объяснения стоят одни и те же слова.','Оставь событие в поле эпизода. Здесь ответь, что это событие позволяет понять о герое или теме.',text);
    }
    if ((stage==='link' || stage==='episode') && context.thesis && words===norm(context.thesis)) {
      return finding('thesis-echo','Эта запись целиком повторяет твой тезис.',next,text);
    }
    const parts=text.match(/[^.!?…\n]+[.!?…]*/gu)?.map(s=>s.trim()).filter(Boolean) || [text];
    const last=parts[parts.length-1];
    if (paraphrase && words===norm(reading.context)) {
      return finding('summary-echo','В записи повторён пересказ мастерской.','Какую деталь ты выбрал бы сам? Запиши своими словами, почему она оказалась важной.',text);
    }
    if (stage==='reading' && !paraphrase && reading && sourceContains(reading.quote,words,2)) {
      if (words===norm(reading.quote)) return finding('source-echo','Ты перенёс весь показанный отрывок.','Выбери один предмет, жест или два-три слова и напиши, почему ты их заметил.',text);
      return finding('source-detail','Эти слова есть в показанном отрывке. Ты выбрал деталь для наблюдения.','Допиши своими словами, почему ты выделил именно эту деталь.',text);
    }
    if (stage==='exercise' && drill) return drillFeedback(drill,text,words,last);
    const formula=parts.find(s=>/^(?:(?:таким образом|значит|поэтому) )?(?:(?:это|пример|этот (?:пример|эпизод|поступок)) (?:еще раз )?(?:подтверждает|доказывает|иллюстрирует|показывает) (?:мою (?:мысль|позицию|правоту)|мой тезис|это)|(?:это|так) (?:доказывает|подтверждает) тезис)(?: потому что (?:поступок героя|этот пример|эпизод|он) (?:его |ее |это )?(?:доказывает|подтверждает))?$/u.test(norm(s)));
    if (formula) return finding('empty-link','Здесь есть ссылка на доказательство. Что именно в эпизоде служит доказательством, в этой фразе пока не названо.','Замени общую связку своим объяснением того, что мы поняли по конкретному поступку героя.',formula);
    const broad=parts.find(s=>/^(?:(?:я считаю что|поэтому|значит|в жизни|автор показывает что) )?(?:(?:очень )?важно быть добрым(?: человеком)?|нужно (?:быть добрым|помогать (?:людям|другим))|(?:доктор|герой|он|она) (?:был[аи]? |оказал(?:ся|ась) )?(?:очень )?(?:добры[йм]|хорош(?:ий|им)|добрая|милосердны[йм])(?: (?:человек|человеком))?)$/u.test(norm(s)));
    if (broad) {
      const hint=work?.id==='doctor'?'По какому поступку врача Мерцалов мог судить о его отношении к семье?':'Назови поступок, по которому читатель поймёт, что ты вкладываешь в эту оценку.';
      return finding('general-claim','В этой фразе есть общая оценка. Проверь, виден ли читателю поступок, на котором она основана.',hint,broad);
    }
    if (stage==='episode' && work?.id==='doctor' && /деньг|купюр|кредитн/u.test(words) &&
        /(?:^| )(?:лично|в руки|из рук)(?: |$)/u.test(words) && /вруч|переда|отда/u.test(words) &&
        !/(?:^| )(?:не|если|бы)(?: |$)|блюдц|после уход/u.test(words)) {
      return finding('check-source','В твоей записи описано, как деньги переходят к Мерцалову. В карточке книги он находит их под чайным блюдцем после ухода врача.','Перечитай момент возвращения Мерцалова в комнату и уточни в своей фразе, когда он увидел деньги.',text);
    }
    if (stage==='thesis' || stage==='link' || stage==='draft') {
      const absolute=parts.find(s=>/(?:^| )(?:всегда|все люди|каждый человек)(?: |$)/u.test(norm(s).replace(/(?:далеко )?не (?:всегда|все люди|каждый человек)/gu,'')) && !/[«»"]/u.test(s));
      if (absolute) return finding('scope','Здесь вывод сформулирован сразу для целого ряда случаев.','Если исходить только из выбранной сцены, для каких случаев ты можешь обосновать свой вывод?',absolute);
    }
    const quotedWords=parts.map(norm);
    if (stage==='draft') {
      const seen=new Set();
      for (let i=0;i<parts.length;i++) {
        const sentence=quotedWords[i];
        if (sentence.split(' ').length>=4 && seen.has(sentence)) {
          return finding('repeated-sentence','Та же фраза встречается в черновике ещё раз.','Прочти текст без второго вхождения. Если потеряется важный оттенок, вырази его в этом месте.',parts[i]);
        }
        seen.add(sentence);
      }
    }
    if ((stage==='episode' || stage==='link' || stage==='draft') &&
        /(?:^| )сначала /u.test(words) && / (?:потом|затем|после этого) /u.test(words)) {
      return finding('sequence','В записи отмечен порядок событий, от первого действия к следующему.','Выбери одно действие из этой последовательности. Что изменится в твоём рассуждении, если его убрать?',parts.find(s=>/(?:^| )(?:потом|затем|после этого) /u.test(norm(s))) || last);
    }
    if (paraphrase) return finding('reader-check','Сравни своё наблюдение с эпизодом на карточке.','Как выбранная деталь помогает тебе ответить на вопрос к этой сцене? Слова автора при необходимости можно сверить по ссылке на источник.',last);
    if (stage==='reading') return finding('reader-check','Сопоставь свою запись со строками над ней.','Какое слово из отрывка поможет другому читателю увидеть то, что заметил ты?',last);
    if (stage==='episode') return finding('reader-check','Эту часть твоей записи читатель может попробовать найти в книге.','Какую подробность из этой фразы можно сверить с текстом произведения?',last);
    if (stage==='link') {
      const thesis=String(context.thesis||'').trim().slice(0,130);
      return finding('reader-check','Прочти свою запись рядом с тезисом.',thesis?'Какая деталь из эпизода помогает тебе обосновать мысль «'+thesis+'»?':'Что в твоём выводе потеряет основание, если убрать деталь из эпизода?',last);
    }
    if (stage==='thesis') return finding('reader-check','Эту фразу можно испытать как ответ на тему.',topic?'Что в этой фразе отвечает именно на вопрос «'+topic+'»?':'Какой вопрос ты решаешь этой фразой?',last);
    return finding('reader-check','Посмотри на эту фразу в конце своей записи.','Какое место выше подготавливает эту мысль? Если его трудно найти, добавь переход.',last);
  }
  return Object.freeze({inspect});
})();
