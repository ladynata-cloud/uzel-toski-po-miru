"""Static, separately loaded reading modes derived only from reviewed public cards."""
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

from reader_lens_tasks import QUESTIONS

SOURCE = Path(__file__).with_name('reader_workshop_cards')
WORKS = {
    'work-student': ('kb-reader-student-opening-before', [
        'Не знаю, с какого слова начать', 'Пока получается пересказ', 'Догадываюсь о продолжении',
        'Выбрал(а) слово, трудно объяснить', 'Ищу «правильное» чувство', 'Хочу попробовать другое прочтение']),
    'work-vorona-i-lisitsa': ('kb-reader-vorona-full-during', [
        'Слышу интонацию, не могу назвать', 'Пока получается пересказ', 'Нужна опора для моей мысли',
        'Мой отклик и голос рассказчика', 'У меня два варианта прочтения', 'Хочу проверить соседние строки']),
    'work-chudesnyy-doktor': ('kb-reader-doctor-opening-after', [
        'Хочу проверить свой вывод', 'Что рассказчик знает сам?', 'Кто произносит реплику?',
        'Можно ли так судить о характере?', 'Что мы знаем о голоде?', 'Почему мальчики приплясывают?']),
    'work-shinel': ('kb-reader-shinel-opening-after', [
        'У меня другое впечатление', 'Как объяснить паузу?', 'Чьи это слова?',
        'Можно ли услышать по-другому?', 'Портрет и характер', 'Хочу сопоставить два места']),
}
MODES = ('before', 'during', 'after')


def opening(text, work_id):
    if work_id == 'work-vorona-i-lisitsa':
        return text.splitlines()[0]
    return re.split(r'(?<=[.!?])\s+(?=[А-ЯЁ—])', text, maxsplit=1)[0]


def general_branches():
    return [
        dict(id='notice', label='Не знаю, с чего начать',
             explanation='Начать можно с видимой детали; пересказывать всё произведение не нужно.',
             steps=['Прочитайте только показанный текст.', 'Выберите одно слово, на котором хочется задержаться.',
                    'Проверьте, что изменится, если произнести это слово без выделения.',
                    'Запишите своё наблюдение: «В этой фразе я заметил(а)…».'],
             check='На какие слова вы опираетесь в своём наблюдении?'),
        dict(id='evidence', label='Хочу отличить слова автора от своей мысли',
             explanation='Дословная цитата повторяет текст. Собственное прочтение можно обозначить словами «мне кажется».',
             steps=['Найдите в показанном тексте слова, на которые хотите сослаться.',
                    'Сверьте выбранные слова с оригиналом, не заменяя их синонимами.',
                    'Отделите цитату от собственного объяснения.',
                    'Проверьте, не говорит ли ваш вывод о событиях вне этого фрагмента.'],
             check='Как вы обозначите границу между цитатой и собственным объяснением?'),
        dict(id='alternative', label='Хочу попробовать другое прочтение',
             explanation='Разные впечатления допустимы. Для сравнения прочтений нужна опора в одном и том же тексте.',
             steps=['Выберите короткую фразу в показанном тексте.',
                    'Прочитайте её с одним смысловым ударением.',
                    'Перенесите ударение на другое слово в той же фразе.',
                    'Запишите одно различие, которое удалось услышать.'],
             check='Какая деталь текста поддерживает второй вариант?'),
    ]


def packets(cards):
    catalogue = {x['id']: x for x in cards}
    provenance = json.loads((SOURCE / 'provenance.json').read_text(encoding='utf-8'))
    hashes = {x['path']: x['sha256'] for x in provenance['files']}
    result = []
    for work_id, (seed_id, labels) in WORKS.items():
        raw = (SOURCE / (seed_id + '.json')).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == hashes[seed_id + '.json']
        seed = json.loads(raw)
        assert set(seed) == {'schema_version', 'card_id', 'site', 'source_ids', 'public_card', 'quotes'}
        assert seed['site'] == 'reader' and seed['card_id'] == seed_id
        public = seed['public_card']
        links = public['links']
        assert len(links) == 1 and urlsplit(links[0]).scheme == 'https'
        assert len(public['branches']) == len(labels) == 6
        for mode in MODES:
            approved_mode = mode == public['read_mode']
            text = opening(public['anchor_text'], work_id) if mode == 'before' else public['anchor_text']
            branches = general_branches()
            if approved_mode:
                branches = [dict(id=b['branch_id'], label=label, explanation=b['brief_explanation'],
                                 steps=[h['text'] for h in b['hints']], check=b['understanding_check']['question'])
                            for b, label in zip(public['branches'], labels)]
            scope = 'Только первая фраза. Дальнейший сюжет здесь не обсуждается.' if mode == 'before' else (
                'Только показанное начало. Это не полный текст произведения и не его развязка.')
            result.append({'version': 1, 'kind': 'local_reader_workshop', 'work_id': work_id, 'mode': mode,
                           'lenses': {lens: {'question': task[0], 'check': task[1]}
                                      for lens, task in QUESTIONS[work_id][mode].items()},
                           'source': {'title': catalogue[work_id]['title'], 'author': catalogue[work_id]['author'],
                                      'text': text, 'url': links[0], 'scope': scope},
                           'task': {'goal': public['learning_goal'] if approved_mode else
                                    'Выберите одну деталь показанного текста и объясните, чем она привлекла внимание.',
                                    'branches': branches},
                           'provenance': {'public_seed_id': seed_id, 'public_seed_sha256': hashes[seed_id + '.json'],
                                          'steps_origin': 'reviewed_public_card' if approved_mode else 'editorial_reading_steps'}})
    return result


def publish_workshop(output, cards):
    directory = output / 'assistant/v1/workshop'
    expected = set()
    for packet in packets(cards):
        path = directory / packet['work_id'] / (packet['mode'] + '.json')
        expected.add(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for old in directory.glob('work-*/*.json'):
        if old not in expected:
            old.unlink()


def workshop_markup():
    return '''<section id="reader-workshop" hidden aria-labelledby="reading-title">
<h2 id="reading-title" tabindex="-1">Читаем фрагмент вместе</h2>
<p>Выберите объём чтения, затем одну подходящую ситуацию. Помощник покажет шаг, а вывод останется вашим.</p>
<div id="reading-modes" class="memory-actions" aria-label="Объём чтения">
<button class="button secondary" type="button" data-mode="before" aria-pressed="false">Начать с одной фразы</button>
<button class="button secondary" type="button" data-mode="during" aria-pressed="false">Читаю начало</button>
<button class="button secondary" type="button" data-mode="after" aria-pressed="false">Начало прочитано. Обсудить</button>
</div>
<p id="reading-status" role="status" aria-live="polite"></p>
<div id="reading-content" hidden>
<p id="reading-scope" class="context-note"></p>
<blockquote class="quote"><p id="reading-source-text"></p><cite id="reading-source-credit"></cite></blockquote>
<a id="reading-source-link" target="_blank" rel="noopener noreferrer">Полный текст у источника — возможны спойлеры</a>
<p id="reading-goal"></p>
<p id="reading-lens-question"></p>
<details id="reading-lens-check"><summary>Как проверить свою заметку?</summary><p id="reading-lens-feedback"></p></details>
<p>Какая ситуация вам подходит? Выбор можно поменять.</p>
<div id="reading-branches" class="memory-actions" aria-label="Выберите ситуацию"></div>
<section id="reading-step" hidden aria-labelledby="reading-step-title">
<h3 id="reading-step-title" tabindex="-1"></h3><p id="reading-prompt"></p>
<details id="reading-why"><summary>Зачем этот шаг?</summary><p id="reading-explanation"></p></details>
<div class="memory-actions"><button class="button secondary" type="button" id="reading-previous">Предыдущий шаг</button>
<button class="button" type="button" id="reading-next">Следующий шаг</button></div>
</section>
<label for="reading-note">Моя заметка к этому фрагменту</label>
<textarea id="reading-note" rows="5" maxlength="4000" aria-describedby="reading-note-help reading-saved"></textarea>
<p id="reading-note-help">Заметка и шаг сохраняются только в этом браузере и не отправляются помощнику. Здесь нет автоматической оценки ответа. На общем устройстве удалите заметку после работы.</p>
<p id="reading-saved" role="status" aria-live="polite"></p>
<button class="button secondary" type="button" id="reading-forget">Удалить заметку и шаг этого режима</button>
</div>
<p><button class="button secondary" type="button" id="reading-exit">Вернуться к поиску без спойлеров</button></p>
</section>'''
