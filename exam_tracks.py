"""Six practical exam branches, built on separately sourced requirements."""
import json
import os
import re
from pathlib import Path
from html import escape as e
from site_config import assistant_origin
from reading_lens import lens_picker, lens_questions
from quote_sources import quote_block
from essay_workshop.catalogue import load_catalog
from essay_workshop.writing_practice import render_writing_practice
from essay_workshop.theme_practice.bundle import planner_script
from exam_cases import exam_case
from exam_argumentation import PATH as GUIDE, body as guide_body
from exam_resources import PATH as RESOURCES, route_box, hub_callout, publish as publish_resources

BASE = Path(__file__).parent
DATA = [r for name in ('exam_track_9.json', 'exam_track_literature.json', 'exam_track_11.json')
        for r in json.loads((BASE / name).read_text())['routes']]
for item in DATA:
    for lesson in item['lessons']:
        lesson['title'] = re.sub(r'^\d+\.\s*', '', lesson['title'])
TRACKS = {r['slug']: r for r in DATA}
ESSAY_WORKSHOP = '/k-sochineniyu/itogovoe/pomoshchnik/'
ORDER = ['sobesedovanie', 'oge-russkiy', 'oge-literatura', 'itogovoe', 'ege-russkiy', 'ege-literatura']
LABELS = dict(zip(ORDER, ['Собеседование', 'ОГЭ · русский', 'ОГЭ · литература', 'Итоговое сочинение', 'ЕГЭ · русский', 'ЕГЭ · литература']))
EXAM_QUESTIONS = json.loads((BASE / 'exam_reading_questions.json').read_text(encoding='utf-8'))
LITERARY_METHOD = {
    'sobesedovanie': 'При чтении вслух отметьте паузу между двумя мыслями. Когда отвечаете на вопрос о человеке, назовите факт из текста. В описание фотографии включайте то, что можно увидеть на снимке.',
    'oge-russkiy': 'В изложении восстановите, как одна мысль исходного текста ведёт к следующей. Для сочинения выберите два примера и поясните, как каждый отвечает на ваш вопрос.',
    'oge-literatura': 'Выберите реплику, жест или повторяющийся образ. Сначала опишите, что меняется в эпизоде, затем поясните, почему эта перемена важна для вашего ответа.',
    'ege-russkiy': 'Отметьте, какие слова исходного текста помогают установить позицию автора. Поясните каждый из двух примеров и проверьте, что именно их сопоставление прибавляет к вашему выводу.',
    'ege-literatura': 'Проверьте, как действует выбранный приём в конкретной сцене или строке. При сопоставлении произведений сохраните один вопрос и найдите в каждом тексте своё основание для ответа.',
    'itogovoe': 'Запишите вопрос темы своими словами. Вспомните поступок, который помогает ответить, и проверьте, какая подробность сцены уточняет ваш первый вывод.',
}
READING = dict(zip(ORDER, ['sobesedovanie', 'russkiy-yazyk', 'oge-literatura', 'itogovoe', 'russkiy-yazyk', 'ege-literatura']))


def essay_workshop_body(personal=False):
    directory = BASE / 'essay_workshop'

    def read(name):
        return (directory / name).read_text(encoding='utf-8')

    def script_json(value):
        return json.dumps(value, ensure_ascii=False).replace('<', r'\u003c')

    catalog = load_catalog()
    catalog['drills'] = json.loads(read('drills.json'))
    assets = {
        'CSS': read('workshop.css') + '\n' + read('rehearsal.css'),
        'CATALOG': script_json(catalog),
        'SYSTEM': script_json(read('assistant/system.ru.md')),
        'COACH': read('coach.js'),
        'ORIGIN': 'personal' if personal else e(assistant_origin(os.environ.get('ESSAY_ASSISTANT_ORIGIN', '')), quote=True),
        'REVISION': read('revision.js'),
        'MODELC': read('model-client.js'),
        'ENTRY_ROUTER': read('entry_router/router.js').replace(
            '__ENTRY_PARAMETERS__', read('entry_router/weights.json').strip()
        ),
        'GIGA_NAVIGATOR': read('giga-navigator.js').replace(
            '/*__NAVIGATION_STEPS__*/ []', script_json(json.loads(read('personal-gigachat/navigation-steps.json')))),
        'REHEARSAL': read('rehearsal.js'),
        'ANSWER_FEEDBACK': read('answer-feedback.js'),
        'DRILL_CONTRAST': read('drill-contrast.js'),
        'THESIS_LAB': read('thesis-lab.js'),
        'SHELF': read('shelf.js'),
        'STUDY_URL': ('https://usel-toski-po-miru.art' if personal else '') + ESSAY_WORKSHOP + 'kak-proveryali/',
        'THEME_ATLAS': planner_script(catalog) + '\n' + read('theme-atlas.js'),
        'WRITING_PRACTICE': render_writing_practice(),
        'DRAFT_READER': read('draft-reader.js'),
        'PARAGRAPH_TRIAL': read('paragraph-trial.js'),
        'INTENTS': read('intent-model.js'),
        'LENS': read('reading-lens.js'),
        'APP': read('workshop.js'),
    }
    return re.sub(r'\{\{ESSAY_(\w+)\}\}', lambda m: assets[m[1]], read('fragment.html'))


def links(items):
    return ''.join(f'<li><a href="{e(s["url"], quote=True)}">{e(s["label"])}</a></li>' for s in items)


def nav(current=None):
    return '<nav class="reading-list-nav" aria-label="Экзаменационные ветки">' + ''.join(
        f'<a href="/k-sochineniyu/{slug}/"' + (' aria-current="page"' if slug == current else '') + f'>{LABELS[slug]}</a>' for slug in ORDER) + '</nav>'


def cards():
    return '<div class="exam-grid">' + ''.join(
        f'<article class="exam-card"><p class="eyebrow">{"9 класс" if slug in ORDER[:3] else "11 класс"} · 6 занятий</p><h2><a href="/k-sochineniyu/{slug}/">{LABELS[slug]}</a></h2><p>{e(TRACKS[slug]["summary"])}</p><a class="text-link" href="/k-sochineniyu/{slug}/#lessons">Начать подготовку →</a></article>' for slug in ORDER) + '</div>'


def home_section():
    groups = []
    for grade, slugs in [(9, ORDER[:3]), (11, ORDER[3:])]:
        entries = ''.join(f'<li><a href="/k-sochineniyu/{slug}/#lessons">{LABELS[slug]}</a></li>' for slug in slugs)
        groups.append(f'<div><h3>{grade} класс</h3><ul>{entries}</ul></div>')
    return f'''<section class="home-exams home-section">
    <h2>Подготовка к экзаменам</h2>
    <p><a class="button" href="{ESSAY_WORKSHOP}">Открыть тренажёр итогового сочинения</a> Выбери книгу, поправь абзац или начни писать свою работу.</p>
    <div class="home-exam-routes">{''.join(groups)}</div>
    <ul class="home-index-links">
      <li><a href="/k-sochineniyu/">Обзор экзаменационных маршрутов</a></li>
      <li><a href="{RESOURCES}">Материалы ФИПИ и задания «Решу»</a></li>
      <li><a href="{GUIDE}">Как православное прочтение помогает аргументации</a></li>
    </ul></section>'''


def lessons_html(track):
    parts = ['<section id="lessons"><h2>Шесть занятий: от первого ответа к целой работе</h2><p>Проходите по порядку или начните с трудного для вас шага. Сначала выполните задание, затем откройте подсказку. Одна попытка и её редактура полезнее нескольких переписанных образцов.</p><div class="exam-lessons">']
    for i, lesson in enumerate(track['lessons']):
        steps = ''.join('<li>'+e(x)+'</li>' for x in lesson['steps'])
        reading = '<ul class="sources">'+links(lesson['reading'])+'</ul>' if lesson['reading'] else ''
        note = (lens_questions(lesson['answer_note'], lesson['answer_note_orthodox'])
                if 'answer_note_orthodox' in lesson else f"<p>{e(lesson['answer_note'])}</p>")
        parts.append(f'''<details class="exam-lesson" id="lesson-{i+1}"{' open' if i == 0 else ''}><summary><span class="exam-step">{i+1:02d}</span>{e(lesson['title'])}</summary><div class="exam-lesson-body"><p>{e(lesson['goal'])}</p><ol>{steps}</ol>{reading}<div class="prompt-box"><h3>Попробуйте сами</h3><p>{e(lesson['task'])}</p>{lens_questions(*EXAM_QUESTIONS[track['slug']][i])}<button type="button" class="button secondary" data-exam-open="{i}">Открыть задание в черновике</button></div><p><strong>Получилось, если:</strong> {e(lesson['ready'])}</p><details><summary>Подсказка после своей попытки</summary>{note}</details></div></details>''')
    return ''.join(parts)+'</div></section>'


def timer():
    return '''<section class="exam-timer" data-exam-timer aria-labelledby="timer-title"><h2 id="timer-title">Потренируйтесь с таймером</h2><p>Он помогает держать время и не оценивает содержание речи. Для повторного прослушивания можно записать себя на свой телефон.</p><label for="timer-mode">Этап</label><select id="timer-mode"><option value="300">Подготовка к чтению и беседе · 5 минут</option><option value="120">Подготовка к монологу · 2 минуты</option><option value="180">Монолог · до 3 минут</option></select><div class="exam-timer-controls"><output class="exam-clock" aria-label="Осталось времени" aria-live="off">05:00</output><button class="button secondary" type="button" data-timer-toggle>Начать</button><button class="button secondary" type="button" data-timer-reset>Сбросить</button></div><p class="fine" data-timer-status role="status">Выберите этап и начинайте, когда будете готовы.</p></section>'''


def practice(track):
    prompts = [(x['title'], x['task']) for x in track['lessons']] + [(track['final_practice']['title'], track['final_practice']['task'])]
    prompts.append(('Задание из ФИПИ или с другого сайта', 'Откройте выбранное задание в соседней вкладке. В поле источника укажите ссылку или экзамен, год и номер задания. Ниже напишите свой ответ. Для проверки нужны условия именно этого задания; требования учебного примера мастерской могут отличаться.'))
    options = ''.join(f'<option value="{i}"' + (' data-external-practice' if i == 7 else '') + f' data-prompt="{e(task, quote=True)}">{i+1}. {e(title)}</option>' for i, (title, task) in enumerate(prompts))
    practice_questions = ''.join(
        f'<div data-exam-lens-task="{index}"' + (' hidden' if index else '') + '>' + lens_questions(*pair) + '</div>'
        for index, pair in enumerate(EXAM_QUESTIONS[track['slug']]))
    checks = ''.join(f'<li><label><input type="checkbox"><span>{e(c)}</span></label></li>' for c in track['final_practice']['checks'])
    return f'''<section id="practice"><h2>Ваш черновик</h2><p>Выберите занятие, итоговую тренировку или задание с другого сайта. При смене задания текст в поле остаётся; скачайте законченную работу перед переходом к следующей.</p><div class="practice" data-lesson="{e(track['slug'])}"><label for="writing-mode">Над чем работаем</label><select id="writing-mode">{options}</select><p class="writing-prompt">{e(prompts[0][1])}</p>{practice_questions}<label for="draft-source">Источник и номер задания <span class="fine">· для задания с другого сайта</span></label><input id="draft-source" type="text" data-draft-source maxlength="1000" autocomplete="off" aria-describedby="draft-source-note" placeholder="Ссылка на задание или ФИПИ, предмет, год и номер"><p class="fine" id="draft-source-note">Источник сохранится вместе с ответом и попадёт в письмо. В число слов он не входит.</p><label for="draft">Ответ, план выступления или сочинение</label><textarea id="draft" maxlength="50000" spellcheck="true" aria-describedby="draft-note" placeholder="Начните с точного ответа на вопрос. Затем найдите подтверждение…"></textarea><div class="print-draft"></div><div class="draft-bar"><span class="word-count">Слов в черновике: 0</span><button class="button secondary" type="button" data-download disabled>Скачать черновик .txt</button><a class="button secondary" data-email-draft href="mailto:ladynata3000@gmail.com">Отправить на проверку в литературную мастерскую</a><button class="button secondary" type="button" data-save-draft disabled>Сохранить в браузере</button><button class="button secondary" type="button" data-delete-draft disabled>Удалить сохранённый черновик</button></div><p class="fine" id="draft-note">Пользование сайтом и проверка работ сейчас бесплатны. Черновик не публикуется. Сохранённый ответ доступен тому, кто пользуется этим браузером на этом устройстве. Кнопка «Сохранить в браузере» сохраняет ответ только в этом браузере на этом устройстве. Срок хранения не гарантируется: запись может исчезнуть после очистки данных, а в приватном режиме — после закрытия окна. Надёжнее скачать файл. После работы на общем устройстве удалите сохранённый черновик и закройте страницу. Кнопка удаления убирает сохранённую копию, оставляя текст в открытом поле. Кнопка отправки на проверку откроет письмо на ladynata3000@gmail.com. Проверьте его и нажмите «Отправить» в своей почте. Длинный ответ скачайте и приложите файлом. Учитель ответит на ваш адрес. Перед закрытием сохраните работу. Счётчик слов приблизительный; в экзамене применяются правила ФИПИ.</p><p class="fine draft-status" role="status" aria-live="polite"></p></div><details><summary>Самопроверка итоговой тренировки мастерской</summary><ul class="checklist">{checks}</ul><p>Для задания из внешнего источника используйте критерии именно этого задания. Окончательную проверку содержания проводите вместе с учителем по официальным критериям. Отмеченная галочка и число слов не являются экзаменационным баллом.</p></details><noscript><p>Все занятия доступны без JavaScript. Пишите в тетради, время отсчитывайте по часам.</p></noscript></section>'''


def route_body(route, track):
    slug = track['slug']
    facts = ''.join(f'<dt>{e(f["label"])}</dt><dd>{e(f["value"])}</dd>' for f in track['facts'])
    reading = ''.join(f'<li><a href="/masterskaya/{s}/">{e(label)}</a></li>' for s, label in route['reading'])
    pitfalls = ''.join(f'<li>{e(x)}</li>' for x in track['pitfalls'])
    lens, repair = track['lens'], track['repair']
    weak = (lens_questions(repair['weak'], repair['weak_orthodox'])
            if 'weak_orthodox' in repair else f"<p>{e(repair['weak'])}</p>")
    prayer_note = '<p class="fine">Слова святителя относятся к молитве. С вниманием к тексту мы сопоставляем их по аналогии; это толкование мастерской.</p>' if route['quote'] == 'vnimanie' else ''
    workshop_link = (f'<p><a class="button" href="{ESSAY_WORKSHOP}">Открыть тренажёр итогового сочинения</a></p>'
                     if slug == 'itogovoe' else '')
    return f'''<div class="wrap"><div class="breadcrumb"><a href="/k-sochineniyu/">К экзаменам</a><span>/</span>{e(route['stage'])}</div><header class="page-title"><p class="eyebrow">{e(route['stage'])} · 6 занятий и итоговая тренировка</p><h1>{e(route['title'])}</h1><p class="lead">{e(track['summary'])}</p>{lens_picker()}{workshop_link}</header>{nav(slug)}<div class="reading-layout"><nav class="reading-nav" aria-label="В этой ветке"><p class="eyebrow">Подготовка</p><a href="#format">Что требуется</a><a href="#materials">Документы и задания</a><a href="#lessons">Шесть занятий</a><a href="#lens">Как читать в выбранном ракурсе</a><a href="#repair">Как улучшить ответ</a><a href="#worked-case">Развёрнутый пример</a><a href="#practice">Мой черновик</a><a href="#sources">Источники</a></nav><article class="article exam-article">
<section id="format"><h2>Что предстоит сделать</h2><p>{e(track['format'])}</p><div class="context-note">{e(track['version_note'])}</div><dl class="exam-facts">{facts}</dl><p><strong>Начните с короткой попытки:</strong> {e(track['lessons'][0]['task'])} Сохраните её и сравните со своей работой после шестого занятия.</p></section>
{route_box(slug)}
{lessons_html(track)}
<section id="lens"><div data-reading-lens-only="secular"><h2>Как обосновать своё прочтение</h2><p>{e(LITERARY_METHOD[slug])}</p></div><div data-reading-lens-only="orthodox" hidden><h2>Как здесь помогает православное прочтение</h2><p>{e(lens['use'])}</p>{quote_block(route['quote'])}{prayer_note}<p><strong>Комментарий мастерской.</strong> {e(lens['example'])}</p><p>{e(lens['avoid'])}</p><p><a href="{GUIDE}">Пять шагов от нравственного понятия к доказательству</a></p></div></section>
<section id="repair"><h2>Один ответ до и после редактирования</h2><div class="exam-repair"><div><h3>Пока слабо</h3>{weak}</div><div><h3>Точнее</h3><p>{e(repair['strong'])}</p></div></div><p>{e(repair['why'])}</p><h3>Что проверить особенно внимательно</h3><ul>{pitfalls}</ul></section>
<section><h2>Книги, к которым можно вернуться</h2><ul>{reading}</ul><p><a href="/chtenie/{READING[slug]}/">Перечни и рекомендации для этой ветки</a>. В русском языке наш список книг — помощь в подготовке, а не обязательный перечень ФИПИ.</p></section>
{exam_case(slug)}
<section id="final-training"><h2>Итоговая тренировка</h2><h3>{e(track['final_practice']['title'])}</h3><p>{e(track['final_practice']['task'])}</p>{lens_questions(*EXAM_QUESTIONS[slug][6])}<button class="button secondary" type="button" data-exam-open="6">Перейти к итоговой работе</button><p>После проверки выберите одну содержательную ошибку и перепишите соответствующий абзац. В следующей попытке проверьте это место первым.</p></section>
{timer() if slug == 'sobesedovanie' else ''}{practice(track)}
<section id="sources"><h2>Проверить требования у ФИПИ</h2><ul class="sources">{links(track['sources'])}</ul><p class="fine">Проверено 9 октября 2026 года. Упражнения и образцы созданы мастерской; это не задания ФИПИ и не обещание тем экзамена. Религиозное согласие не оценивается. Раздел посвящён устной и письменной творческой работе; тестовая часть русского языка в него не входит.</p></section><p><a href="/k-sochineniyu/">Все шесть веток подготовки</a></p></article></div></div><script src="/assets/exam-practice.js" defer></script>'''


def publish(page, routes):
    by_slug = {r['slug']: r for r in routes}
    page('/k-sochineniyu/', 'Подготовка к экзаменам: шесть веток', 'Собеседование, ОГЭ по русскому и литературе, итоговое сочинение, ЕГЭ по русскому и литературе: 36 занятий с практикой и разбором.', hub(), active='exam')
    page(ESSAY_WORKSHOP, 'Тренажёр итогового сочинения для 11 класса',
         'Упражнения для 11 класса. Начните с одного абзаца, выберите литературный пример или напишите сочинение целиком. Есть самопроверка, сохранение черновика и версия для скачивания.',
         essay_workshop_body(), active='exam')
    study_path = ESSAY_WORKSHOP + 'kak-proveryali/'
    study_body = (BASE / 'essay_workshop/about-practice.html').read_text(encoding='utf-8')
    quote_demo = (BASE / 'essay_workshop/quote-evidence-demo.html').read_text(encoding='utf-8')
    quote_script = (BASE / 'essay_workshop/quote-evidence.js').read_text(encoding='utf-8')
    if study_body.count('{{QUOTE_EVIDENCE_DEMO}}') != 1:
        raise ValueError('Missing or ambiguous quote evidence demonstration marker')
    study_body = study_body.replace('{{QUOTE_EVIDENCE_DEMO}}', '<script>' + quote_script + '</script>' + quote_demo)
    page(study_path, 'Как проверяли помощника по итоговому сочинению',
         'Проверка подсказок на учебных черновиках и пример правки по «Ревизору».',
         study_body, active='exam')
    paths = [GUIDE, ESSAY_WORKSHOP, study_path] + publish_resources(page)
    for slug in ORDER:
        route = by_slug[slug]
        path = f'/k-sochineniyu/{slug}/'
        page(path, route['title'], TRACKS[slug]['summary'], route_body(route, TRACKS[slug]), active='exam')
        paths.append(path)
    page(GUIDE, 'Православное прочтение и экзаменационная аргументация', 'Как превратить нравственный вопрос в доказательное рассуждение: эпизод, пояснение, художественный приём и точная духовная цитата.', guide_body(), active='exam')
    return paths


def hub():
    return '''<div class="wrap"><header class="page-title"><p class="eyebrow">9 и 11 классы · Устная речь и письменная работа</p><h1>К экзаменам —<br>через понимание текста</h1><p class="lead">Научиться отвечать по существу, находить доказательства, говорить понятно и редактировать написанное. Выберите свой экзамен: у каждого свой порядок подготовки.</p></header><div class="catalogue-intro"><p>Не нужно начинать с большого сочинения. Сначала попробуем ответить на один вопрос, потом объясним один эпизод и свяжем два наблюдения. Так постепенно появится целая работа, которую вы умеете написать самостоятельно.</p><div class="context-note"><strong>Требования проверены 9 октября 2026 года.</strong> ОГЭ, ЕГЭ и собеседование — по опубликованным ФИПИ проектам 2027 года. Итоговое сочинение — по материалам 2026/27 учебного года. Статус проекта сохранён; после утверждения инструкции могут уточняться.</div></div>''' + f'<p><a class="button" href="{ESSAY_WORKSHOP}">Начать тренировку итогового сочинения</a></p>' + hub_callout() + cards() + '''<article class="prose"><section><h2>Где нужно писать сочинение?</h2><div class="table-scroll"><table class="comparison-table"><thead><tr><th>Испытание</th><th>Устная или письменная работа</th></tr></thead><tbody>
<tr><th>Собеседование</th><td>Устно: чтение, беседа по тексту и самостоятельный монолог.</td></tr><tr><th>ОГЭ по русскому</th><td>Сжатое изложение и одно сочинение из трёх предложенных вариантов. Здесь готовимся к этим двум частям.</td></tr><tr><th>ОГЭ по литературе</th><td>Развёрнутые ответы, сопоставление и сочинение на выбранную литературную тему.</td></tr><tr><th>Итоговое сочинение</th><td>Самостоятельное рассуждение с литературной аргументацией. Это отдельная работа, не задание ЕГЭ.</td></tr><tr><th>ЕГЭ по русскому</th><td>Сочинение по исходному тексту: позиция автора, комментарий, своё обоснованное отношение.</td></tr><tr><th>ЕГЭ по литературе</th><td>Анализ, сопоставительные ответы и большое сочинение на литературную тему.</td></tr></tbody></table></div></section>
<section><h2>Как мы помогаем пройти этот путь</h2><ol><li><strong>Короткая первая попытка.</strong> Она покажет конкретную трудность: найти мысль, выбрать пример, объяснить связь или связно произнести ответ.</li><li><strong>Шесть занятий.</strong> У каждого — задача, материал, подсказка и понятный признак готовности. Можно остановиться на трудном шаге.</li><li><strong>Разбор и редактура.</strong> Сравниваем слабый и улучшенный ответ, затем проверяем развёрнутый пример. Переписываем собственный неудачный фрагмент.</li><li><strong>Целая работа.</strong> Выполняем итоговую тренировку и проверяем её вместе с учителем. Сохраняем черновик, чтобы видеть своё продвижение.</li></ol><p>За один подход достаточно одного занятия. Когда основные действия станут понятны, переходите к полной официальной демоверсии своей дисциплины. Эта мастерская не обещает автоматического балла и не заменяет тестовую подготовку по русскому языку.</p></section>
<section id="tradition"><h2>Где здесь православная мысль?</h2><p>Она помогает задавать вопросы о совести, свободе, милосердии и ответственности. Экзаменационное доказательство строится на тексте: что человек сделал, как это показано, почему эпизод подтверждает наш вывод. В изложение нельзя добавлять собственное толкование; в сочинении важно понимать, где говорит автор, а где вы.</p><p><a class="button secondary" href="''' + GUIDE + '''">Как обосновать вывод через православное прочтение</a></p><p>Духовную цитату не требуется вставлять в каждый ответ. Религиозное согласие не является критерием оценки. Уместная, точная и объяснённая мысль ценнее формулы, которой пытаются закрыть любой вопрос.</p></section>
<section><h2>Если вы занимаетесь с учителем или родителями</h2><p>Сначала выслушайте ответ до конца. Попросите показать, где в тексте его основание. Отделите ошибку понимания от речевой неточности: переписать красивее ещё не значит исправить мысль. После обсуждения ученик сам создаёт второй вариант. Проверяйте его по критериям нужного формата, не требуя совпадения с мировоззрением взрослого.</p><p><a href="/chtenie/">Что читать для каждого экзамена</a> · <a href="/filosofiya/">Темы для размышления</a> · <a href="/tsitaty/">Точные духовные цитаты</a></p></section>
<section id="sources"><h2>Официальные материалы</h2><ul class="sources"><li><a href="https://fipi.ru/itogovoye-sobesedovaniye">ФИПИ: итоговое собеседование</a></li><li><a href="https://fipi.ru/oge/demoversii-specifikacii-kodifikatory">ФИПИ: ОГЭ</a></li><li><a href="https://fipi.ru/itogovoe-sochinenie">ФИПИ: итоговое сочинение</a></li><li><a href="https://fipi.ru/ege/demoversii-specifikacii-kodifikatory">ФИПИ: ЕГЭ</a></li></ul><p>Документы каждой дисциплины и подборки «Решу ЕГЭ / ОГЭ» собраны на <a href="/k-sochineniyu/materialy/">странице материалов</a>. Собственные учебные темы и примеры на сайте обозначены отдельно.</p></section></article></div>'''
