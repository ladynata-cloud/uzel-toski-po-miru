// Extract the same features in the browser and during offline training.
// Patterns describe words and their context. All route weights are learned.
function entryFeatures(input) {
  const concepts = {
    topic:/тем[а-я]*|вопрос|тезис|формулировк|заголовок|о чем (?:писать|рассуждать)/u,
    book:/книг|книж|произведен|рассказ|повест|прочитан|читала|прочел|прочитал/u,
    scene:/эпизод|сцен[ауые]|пример|поступок|момент|отрывок|героин|героя|развязк/u,
    paragraph:/абзац|фрагмент|кусоч|несколько (?:предложен|строк|строчек)|довод|аргумент/u,
    full:/сочинени|работ[а-я]*|чернови|текст/u,
    finished:/готов[а-я]*|закончи|заверши|допис|написа|сдела|все (?:есть|напис|готов)|на месте/u,
    whole:/целиком|полн[а-я]*|весь|вс[еяюе]|от (?:начала|вступления) до|от вступления до|заключен|вывод/u,
    available:/есть|выбра[нл]|задал|зада[нм]|получил|наш[её]л|определил|дали|знаю|знаком|помн|запомн|прочит/u,
    towardTopic:/(?:к (?:какой|каким) тем|какую тему|(?:тему|вопрос) к (?:мо|эт|книг|роман|рассказ|произвед)|тема для (?:эт|произвед)|тем[ау] (?:под|для книги)|к (?:ней|нему) тему)/u,
    towardBook:/(?:какую (?:книг|кни[жш])|какое произведен|(?:подобра|подбир|подбер)[а-я]* (?:подходящ[а-я]* )?(?:книг|сцен|эпизод|произведен)|книг[а-я]* к .{0,10}тем|что (?:взять|прочитать|почитать) (?:для|к)|искать.{0,9}пример)/u,
    remembered:/запомни|в голове|могу пересказ|помню|вспомни|из прочитанного|люблю «|прочита[лн][а-я]* «/u,
    completedAll:/все (?:уже |сам )?(?:напис|готов)|(?:написал[аи]?|закончил[аи]?) вс[еёю]|работа.{0,8}готова|сочинение (?:уже )?(?:написано|готово|закончено)|весь (?:мой )?черновик|от начала до конца/u,
    together:/(?:и тема.{0,20}и книг|тема.{0,18}книг[а-я]* тоже|книг[а-я]*.{0,15}тем[а-я]* тоже|книг[а-я]* и тем[а-я]*|тем[а-я]* и книг[а-я]*)/u,
    undecided:/(?:еще не реш|не определил|то ли|что именно хочу|не знаю,? с чего|не понима[юл].{0,15}или)/u,
    missing:/нет|без |ничего|никак|не |нечего|пуст|чист.{0,5}лист|ноль|по нулям/u,
    first:/с нуля|впервые|первый раз|ничего(?:шеньки)? (?:нет|не выбрал)|ни (?:темы|книги|книжки),? ни|только начинаю|чист[а-я]* лист|белый лист|по нулям|не приступ|не начал|не начинал/u,
    read:/прочита|почита|чтени|дайте.{0,15}отрывок|дай.{0,15}отрывок/u,
    wish:/хочу|хотел|нуж[а-я]*|мне бы|дава[йт]|можно|планир|буду|дайте|давай/u,
    choose:/выбр|подобр|подб[ео]р|найти|ищу|искать|подходящ/u,
    check:/провери|провер[ку]|замечани|самопровер|перечита|вычита|разобра|редакти|поправи|исправи|передела|доработ|улучш/u,
    exam:/репетиц|репетир|пробни|пробн|генеральн.{0,12}тренировк|комплект|шесть тем|6 тем|экзамен|как в декабре/u,
    clock:/таймер|на время|под часы|успеваю|успею ли|распредел.{0,9}врем|отведенн.{0,8}врем|три часа|3 часа/u,
    quick:/быстр|разминк|разогр|коротк|небольши.{0,9}упражнен|маленьк.{0,9}(?:задан|упражнен)|микрошаг|ненадолго|немного/u,
    minutes:/минут|до звонка|до урока|перемен|некогда|мало времени/u,
    onePhrase:/одн[а-я]* (?:фраз|предложен|строч|мысл)|пару строч|одной строч/u,
    vague:/не (?:знаю|решил[а-я]*|понимаю|могу сказать)|не определил|может.{0,30}может|что выбрать|между |либо|вообще|когда-нибудь/u,
    admin:/сколько слов|срок|дата|дату|расписан|зачет|парол|скач[аи]|погод|сайт|файл/u
  };
  const normalized = String(input || '').slice(0, 500).toLowerCase().replace(/ё/g,'е');
  const features = new Map();
  function add(key, amount) {
    features.set(key, Math.max(features.get(key) || 0, amount));
  }
  const clauses = normalized.split(/[.!?;,\n]+|\s+(?:но|зато|однако|а)\s+/u).map(s=>s.trim()).filter(Boolean);
  const whole = [...Object.entries(concepts)].filter(([,p])=>p.test(normalized)).map(([k])=>k);
  for (const name of whole) add('all/'+name, 1.2);
  for (const clause of clauses) {
    const tokens = clause.match(/[а-яa-z0-9]+/gu) || [];
    for (let i=0;i<tokens.length;i++) {
      const t=tokens[i];
      if (t.length >= 3) add('word/'+t.slice(0,5),.66);
      if (i>0) add('pair/'+tokens[i-1].slice(0,4)+'_'+t.slice(0,4),.70);
    }
    const negative = /(?:^|\s)(?:нет|ни|без|не|ничего|никак[а-я]*)(?:\s|$)/u.test(clause);
    const polarity = negative?'minus/':'plus/';
    const present = Object.entries(concepts).filter(([,p])=>p.test(clause)).map(([k])=>k);
    for (let i=0;i<present.length;i++) {
      const a=present[i];
      add(polarity+a,1.8);
      for(let j=i+1;j<present.length;j++) add(polarity+a+'+'+present[j],1.4);
    }
  }
  return features;
}

function entryScores(features, parameters) {
  const result = Array(parameters.labels.length).fill(0);
  let squares = 0;
  for (const [key, weight] of features) {
    const row = parameters.weights[key];
    if (!row) continue;
    squares += weight * weight;
    for (let j=0;j<result.length;j++) result[j] += weight * row[j] / 1000;
  }
  const length = Math.sqrt(squares) || 1;
  return result.map(s=>s / length);
}
function entryDecision(text, parameters) {
  const scores = entryScores(entryFeatures(text), parameters);
  const order = scores.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]);
  const best=order[0];
  const margin=scores[best]-scores[order[1]];
  return best===parameters.labels.indexOf('unknown') || scores[best]<parameters.minimum || margin<parameters.margin
    ? null : parameters.labels[best];
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports={entryFeatures,entryScores,entryDecision};
} else {
  const parameters=__ENTRY_PARAMETERS__;
  window.EssayLocalNavigator=Object.freeze({
    suggest(text) {
      const chosen=entryDecision(text,parameters);
      return chosen===null?null:parameters.labels.indexOf(chosen)+1;
    }
  });
}
