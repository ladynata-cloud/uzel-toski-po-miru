"""Fit the small, offline intent classifier. Run with Python 3.10+ (standard library)."""
import argparse
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import random
import re

HERE = Path(__file__).resolve().parent
INTENTS = ["thesis", "scene", "explain", "wording", "counter"]
LABELS = [*INTENTS, "other"]
# Stop words apply to individual tokens. Phrase patterns still see the whole message,
# including negation, word order and comparative constructions.
STOP = set("""а без бы был была были было в вам вас ваш ваша ваше ваши ведь во вот всё все всего всю вы где да даже для до его ее если есть ещё еще за зачем здесь и из или им их к как какая какие каким какую когда которое которую который кто ли либо мне мной много могу может можно мой моя мою мое мы на над надо нас наш не него нельзя нет ни него ним но ну нужно о об один она они оно он от очень по под пожалуйста пока почему при просто пусть раз разве с сам сама свое свою свои сейчас себя так такая такие такой такую там твой тем тех то того тоже только том тот ту тут ты у уже уж хоть чем чего что чтобы чья эта эти этим этих это этой эту я меня тебе подскажи помоги скажите""".replace("ё","е").split())
WORD = re.compile(r"[а-яa-z]+")
# Shared linguistic features normalize common school vocabulary and question
# constructions. The training examples alone determine their class weights.
CUES = {
    "position": r"тезис|позици|отстаив|отстаят|утвержд|защища|стержн|основн.{0,6}мысл|главн.{0,6}мысл|собственн.{0,8}мнени",
    "scope": r"сузи|сужа|рамк|границ|ориентир|конкретиз|сосредоточ|замах|за.{0,5}основ|слишком.{0,9}общ|ограничи",
    "central": r"о чем (?:писа|поговор|спор|рассуж)|ответ.{0,15}тем|смысл.{0,7}тем|выбр.{0,12}мысл|одну.{0,12}мысл|мысл.{0,13}доказ|хочу (?:сказа|утвержд)|хочет.{0,8}сказать|тему|теме|темы",
    "argument": r"рассужд|аргумент|доказ|обоснов|подкреп|подтвер|подтверж|довод",
    "link": r"связ|свяж|увяз|переход|перейти|при ч[е]м|отношени.{0,12}к |почему.{0,20}важ|что (?:из|это|тут|дает)|каким образом",
    "logic": r"поясн|объясн|обьясн|вывод|следует|следова|следств|вытека|означа|раскры|толков|смысл|скачок",
    "retelling": r"пересказ|пересказыв|излож|сюжет|описал|описан|описыв|рассказал|рассказываю|что (?:происход|случи)|событи",
    "evidence": r"сцен|эпизод|пример|геро|поступ|детал|момент|встреч|действ|произведен",
    "recall": r"вспом|вспомин|напом|перепут|путаниц|помн|помню|освеж|свер[ик]|верно ли|правильно ли|не ошиб|памят[ьи]",
    "locate": r"в как.{0,8}(глав|книг|момент|произведен)|второй раз|впервые|перед |после |сначала|где в |где.{0,14}(най|искать)|конце|зовут|звали|имя |чем заканч|какую из|какой (?:поступок|эпизод|момент)|кто (?:еще|перв|потом|произнос|принос|спас|сказ)",
    "select": r"подобра|подбер|подойд|найти|найду|выбрать|выбер|выбра|брать|взять",
    "style": r"слов[оауы]|формулиров|формулир|предложени|фраз|выражен|вырази|оборот|звуч|стил|речев|речь|сказат|сказать",
    "repeat": r"повтор|однокоренн|тавтолог|лишн|дважды|три раза|два раза|по два|канцеляр|пафос|громозд|коряв|режет слух",
    "edit": r"замени|заменя|разби|упрости|попроще|исправ|перестро|вычерк|отредакт|перепис|убра|уберу|избави|точнее|поточнее|короче|сократ|уточни|проще|понятнее|перефраз",
    "alternative": r"по.другому|альтернат|прочтени|друг.{0,9}(сторон|взгляд|смысл|толкован|объяснен|верси)|под другим|иначе|а не |не.{1,24},? а |обе.{0,7}верс|верси[июя]|с иной",
    "counter": r"возраж|возраз|контраргумент|контрпример|оппонент|оспор|поспор|противополож|учесть|учитыва|оговорк|исключени|отчасти|обратн.{0,8}(пример|сторон)",
    "find_stance": r"сво[ейю].{0,9}(?:ответ|точк|позици|мнен)|сам.{0,11}(?:дума|счита|реши|отвеч)|в чем.{0,15}(?:моя|мой)|(?:соглас|настаива|определит|оттолкнуть)|(?:главн|ведущ|центральн).{0,12}(?:иде|работ|мысл|вопрос)|(?:писать|начать|начну).{0,8}про|повтори.{0,12}(?:тем|вопрос)",
    "find_material": r"из (?:книг|прочитанн|литератур)|литературн.{0,7}материал|(?:что|кого|где).{0,15}(?:вспомни|взят|найти)|отрывок|отобра|отбор|искать|выделить.{0,12}(?:один|мест)|(?:выбрать|выбрал|назвать).{0,12}(?:эпизод|сцен)|(?:кто|кому|куда).{0,12}(?:отдал|передал|помог|уехал|встретил)",
    "already_example": r"(?:пример|эпизод|сцен|ситуаци|поступок|деталь).{0,12}(?:наш|подобр|прив[её]л|привед|опис|назв|выбр|пересказ|есть)|(?:привел|нашел|выбрал|уже есть|уже привела|записал|описал|пересказал).{0,12}(?:пример|эпизод|сцен|ситуац|поступок|детал)|(?:а|но) (?:как|чем|зачем|почему).{0,15}(?:доказыв|связ|объясн)|анализ|на каком основании|при чем|при чём|это говорит|это показыва",
    "line_edit": r"тавтологи|канцеляр|громозд|масло масляно|косноязы|штамп|обороты|книжно|чита.{1,6}вслух|читат.{0,6}тяжело|порядок слов|звучит|не звуч|вводн.{0,7}слов|нагроможд",
    "challenge": r"усомни|сомнени.{0,6}в (?:моем|вывод)|другая точка|другую точку|еще одна точка|иначе|исключени|читатель.{0,12}(?:скажет|возраз|не соглас)|справедлив.{0,4}ли|всегда|во всех ли|взгляд.{0,8}измен|две версии|оспар|соперн|опроверг|друг.{0,12}трактов|спорн",
    "exam_admin": r"сколько слов|словари|словарь|аудитори|на экзамен|минут|балл|зачет|рас[пп]исани|пересда|запасн.{0,8}дат|справк|срок|правил.{0,9}проведен|организатор|бланк|обязательн.{0,9}критер|проверяющ|регистрац",
    "external_help": r"на комп|смартфон|браузер|кнопк|дневник|парол|вайфа|телефон|скачать|запуст|гигачат|маршрут|настроить|починить|виндов|страниц.{0,8}не|в личном кабинет|сохрани.{0,5}файл|отправ.{0,5}файл|нажать",
    "conditional": r"а (?:что )?если|а вдруг|но ведь|всегда ли|кажд.{0,8}ли |верна ли|когда.{0,15}(меша|не |отказ)|бывает|возможно ли|при каких|не всегда|лишь|случай|случае",
}
# Character fragments share evidence between inflected forms. Weight stems
# separately, so four similar fragments of a word do not swamp a whole phrase.
WEIGHT = {"p": 1.25, "c": .42, "b": 1.0, "s": 4.1, "q": 2.7}
# A pupil often first reports success and only then names the obstacle.
# Keep the whole message, and give the new request after a contrast its own features.
FOCUS_BREAK = r"[.!?;:]+\s*|,?\s+(?:а|но|зато)\s+"
MAX_FEATURES = 1800
DEFAULT_GAP = .3
MIN_SIGNAL = .115


def features(text):
    normalized=text.lower().replace("ё","е")
    words = [w for w in WORD.findall(normalized) if len(w)>2 and w not in STOP]
    keys = {"s"+name for name,pattern in CUES.items() if re.search(pattern, normalized)}
    parts = [part.strip() for part in re.split(FOCUS_BREAK, normalized) if part.strip()]
    if len(parts)>1:
        keys.update("q"+name for name,pattern in CUES.items() if re.search(pattern, parts[-1]))
    for word in words:
        if len(word)>=3:
            keys.add("p"+word[:4])
        if len(word)>=6:
            keys.add("p"+word[:6])
        if len(word)>=4:
            for i in range(min(len(word)-3,8)):
                keys.add("c"+word[i:i+4])
    keys.update("b"+a[:4]+"_"+b[:4] for a,b in zip(words,words[1:]))
    return keys


def prepare(rows):
    counts = {}
    for row in rows:
        index = LABELS.index(row["label"])
        for key in row["features"]:
            counts.setdefault(key, [0]*len(LABELS))[index] += 1
    def rank(key):
        arr=counts[key]
        freq=sum(arr)
        # Select recurrent, class-specific evidence.
        return (max(arr)/freq - 1/len(LABELS))*math.log1p(freq)*WEIGHT[key[0]]
    names = sorted((k for k,a in counts.items() if sum(a)>=2),key=lambda k:(-rank(k),k))[:MAX_FEATURES]
    names.sort()
    weights = {k:WEIGHT[k[0]]*(1+math.log((1+len(rows))/(1+sum(counts[k])))) for k in names}
    return names,weights


def vector(keys, weights):
    result = [(k,weights[k]) for k in sorted(keys) if k in weights]
    length = math.sqrt(sum(v*v for _,v in result)) or 1
    return [(k,v/length) for k,v in result]


def train(rows):
    names,idfs=prepare(rows)
    xs=[(vector(row["features"],idfs), LABELS.index(row["label"])) for row in rows]
    coefs={k:[0.0]*len(LABELS) for k in names}
    # Batch gradient descent for L2-regularized multinomial logistic loss;
    # equal class priors, zero intercept and deterministic feature order.
    for epoch in range(115):
        grad={k:[0.0]*len(LABELS) for k in names}
        for x,label in xs:
            scores=[0.0]*len(LABELS)
            for k,v in x:
                for j,c in enumerate(coefs[k]): scores[j]+=v*c
            maximum=max(scores)
            exps=[math.exp(s-maximum) for s in scores]
            total=sum(exps)
            residual=[(1.0 if j==label else 0.0)-p/total for j,p in enumerate(exps)]
            for k,v in x:
                for j,r in enumerate(residual): grad[k][j]+=v*r
        rate=1.25/(1+.012*epoch)
        for k,c in coefs.items():
            for j in range(len(c)): c[j]+=rate*(grad[k][j]-.18*c[j])
    # Feature IDF is absorbed into coefficients. Store only rounded integers.
    return {k:[round(idfs[k]*100)]+[round(c*idfs[k]*100) for c in coefs[k]] for k in names}


def score(keys,model):
    matches=[model[k] for k in sorted(keys) if k in model]
    if not matches: return None,0,0
    known_stems = {k[1:5] for k in keys if k.startswith("p") and k in model}
    if not any(k.startswith("s") and k in model for k in keys) and len(known_stems)<2:
        return None,0,0
    norm=math.sqrt(sum(v[0]**2 for v in matches))
    scores=[sum(v[j+1] for v in matches)/norm for j in range(len(LABELS))]
    order=sorted(range(len(scores)),key=lambda j:-scores[j])
    largest=max(scores)
    probs=[math.exp(v-largest) for v in scores]
    # Penalize low vocabulary coverage, even if a single fragment fits well.
    coverage=min(1,math.sqrt(len(matches)/max(1,len(keys)))*1.65)
    gap=(probs[order[0]]-probs[order[1]])/sum(probs)*coverage
    return LABELS[order[0]],gap,coverage


JS = r"""// Generated by assistant/train_intents.py. Do not edit weights by hand.
const EssayIntent = (() => {
  const labels = LABELS_VALUE;
  const stop = new Set(STOP_VALUE.split(' '));
  const model = MODEL_VALUE;
  const focusBreak = new RegExp(FOCUS_VALUE, 'u');
  const cues = Object.entries(CUES_VALUE).map(([name, pattern]) => ['s'+name, new RegExp(pattern,'u')]);
  function classify(message) {
    const normalized = String(message || '').slice(0, 2000).toLowerCase().replace(/ё/g, 'е');
    const tokens = normalized.match(/[а-яa-z]+/g) || [];
    const words = tokens.filter(w => w.length > 2 && !stop.has(w));
    const keys = new Set(cues.filter(([,pattern]) => pattern.test(normalized)).map(([key]) => key));
    const parts = normalized.split(focusBreak).map(part => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      const focus = parts[parts.length - 1];
      for (const [key, pattern] of cues) {
        if (pattern.test(focus)) keys.add('q' + key.slice(1));
      }
    }
    for (let idx = 0; idx < words.length; idx++) {
      const word = words[idx];
      keys.add('p' + word.slice(0, 4));
      if (word.length >= 6) keys.add('p' + word.slice(0, 6));
      for (let i = 0; i < Math.min(word.length - 3, 8); i++) keys.add('c' + word.slice(i, i + 4));
      if (idx) keys.add('b' + words[idx - 1].slice(0, 4) + '_' + word.slice(0, 4));
    }
    const rows = Array.from(keys, key => model[key]).filter(Boolean);
    const knownKeys = Array.from(keys).filter(key => Object.hasOwn(model, key));
    const knownStems = new Set(knownKeys.filter(k => k[0] === 'p').map(k => k.slice(1, 5)));
    if (!rows.length || (!knownKeys.some(k => k[0] === 's') && knownStems.size < 2)) {
      return {label: null, confidence: 0};
    }
    const scale = Math.sqrt(rows.reduce((s, row) => s + row[0] ** 2, 0));
    const scores = labels.map((_, i) => rows.reduce((s, row) => s + row[i + 1], 0) / scale);
    const max = Math.max(...scores);
    const probs = scores.map(v => Math.exp(v - max));
    const ranked = Array.from(labels.keys()).sort((a, b) => probs[b] - probs[a]);
    const coverage = Math.min(1, Math.sqrt(rows.length / keys.size) * 1.65);
    const confidence = (probs[ranked[0]] - probs[ranked[1]]) / probs.reduce((a, b) => a + b, 0) * coverage;
    const best = labels[ranked[0]];
    const accepted = best !== 'other' && coverage >= MIN_SIGNAL_VALUE && confidence >= GAP_VALUE;
    return {label: accepted ? best : null, confidence};
  }
  return Object.freeze({classify});
})();
"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input",type=Path,default=HERE/"intent-training.json")
    parser.add_argument("--out",type=Path,default=HERE.parent/"intent-model.js")
    args=parser.parse_args()
    data=json.loads(args.input.read_text())
    texts=set()
    rows=[]
    for row in data:
        text=row["text"].strip()
        if not text or not features(text) or row["label"] not in LABELS or text.casefold() in texts:
            raise ValueError("Invalid or duplicate training example")
        texts.add(text.casefold())
        rows.append({"features":features(text),"label":row["label"]})
    if len(set(Counter(row["label"] for row in rows).values()))!=1 or set(r["label"] for r in rows)!=set(LABELS):
        raise ValueError("Training input must contain five equally represented intents and an equally represented fallback class")
    folds=[[] for _ in range(5)]
    for label in LABELS:
        group=[r for r in rows if r["label"]==label]
        random.Random(731).shuffle(group)
        for i,row in enumerate(group): folds[i%5].append(row)
    predictions=[]
    for f,validation in enumerate(folds):
        model=train([r for k,fold in enumerate(folds) if k!=f for r in fold])
        predictions.extend((r["label"],*score(r["features"],model)) for r in validation)
    # The fallback class competes with all five intents but never selects a hint.
    # Optimize recall subject to precision on accepted hints, including false
    # acceptances of negative examples. All calibration uses training folds.
    n_intents = sum(row["label"] in INTENTS for row in rows)
    candidates = []
    for threshold in [.12, .16, .2, .24, .28, .32, .36, .4, .45, .5, .55]:
        accepted = [(actual, predicted) for actual, predicted, margin, coverage in predictions
                    if predicted in INTENTS and margin >= threshold and coverage >= MIN_SIGNAL]
        if not accepted:
            continue
        correct = sum(actual == predicted for actual, predicted in accepted)
        precision = correct / len(accepted)
        recall = correct / n_intents
        candidates.append((threshold, correct, len(accepted), precision, recall))
    strong = [row for row in candidates if row[3] >= .9]
    if strong:
        best = max(strong, key=lambda row: (row[4], row[3]))
    elif candidates:
        best = max(candidates, key=lambda row: 2*row[3]*row[4]/max(row[3]+row[4], 1e-12))
    else:
        best = (DEFAULT_GAP, 0, 0, 0, 0)
    gap, right, n, precision, recall = best
    model=train(rows)
    encode=lambda x: json.dumps(x,ensure_ascii=False,separators=(",",":"))
    output=JS.replace("FOCUS_VALUE",encode(FOCUS_BREAK)).replace("LABELS_VALUE",encode(LABELS)).replace("STOP_VALUE",encode(" ".join(sorted(STOP)))).replace("MODEL_VALUE",encode(model)).replace("CUES_VALUE",encode(CUES)).replace("MIN_SIGNAL_VALUE",str(MIN_SIGNAL)).replace("GAP_VALUE",str(gap))
    args.out.write_text(output)
    print(f"examples={len(rows)} features={len(model)} bytes={len(output.encode())} margin={gap}")
    print(f"stratified 5-fold, margin selected here: {right}/{n} accepted correct, {right}/{n_intents} relevant detected")
    print("SHA256",sha256(output.encode()).hexdigest())

if __name__=="__main__":
    main()
