"""Six practical exam branches, built on separately sourced requirements."""
import json
import re
from pathlib import Path
from html import escape as e
from quote_sources import quote_block
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
ORDER = ['sobesedovanie', 'oge-russkiy', 'oge-literatura', 'itogovoe', 'ege-russkiy', 'ege-literatura']
LABELS = dict(zip(ORDER, ['Собеседование', 'ОГЭ · русский', 'ОГЭ · литература', 'Итоговое сочинение', 'ЕГЭ · русский', 'ЕГЭ · литература']))
READING = dict(zip(ORDER, ['sobesedovanie', 'russkiy-yazyk', 'oge-literatura', 'itogovoe', 'russkiy-yazyk', 'ege-literatura']))


def links(items):
    return ''.join(f'<li><a href="{e(s["url"], quote=True)}">{e(s["label"])}</a></li>' for s in items)


def nav(current=None):
    return '<nav class="reading-list-nav" aria-label="Экзаменационные ветки">' + ''.join(
        f'<a href="/k-sochineniyu/{slug}/"' + (' aria-current="page"' if slug == current else '') + f'>{LABELS[slug]}</a>' for slug in ORDER) + '</nav>'


def cards():
    return '<div class="exam-grid">' + ''.join(
        f'<article class="exam-card"><p class="eyebrow">{"9 класс" if slug in ORDER[:3] else "11 класс"} · 6 занятий</p><h2><a href="/k-sochineniyu/{slug}/">{LABELS[slug]}</a></h2><p>{e(TRACKS[slug]["summary"])}</p><a class="text-link" href="/k-sochineniyu/{slug}/#lessons">Начать подготовку →</a></article>' for slug in ORDER) + '</div>'


def home_section():
    return '<section class="section exam-home"><div class="section-top"><div><p class="eyebrow">От чтения к самостоятельному ответу</p><h2>Готовимся к экзаменам</h2></div><p>Шесть веток подготовки: учимся говорить, сжимать текст, разбирать эпизод и доказывать свою мысль. В каждой — шесть занятий и итоговая тренировка.</p></div>' + cards() + f'<p><a class="button secondary" href="{RESOURCES}">Материалы ФИПИ и задания «Решу»</a></p><p><a href="{GUIDE}">Как православное прочтение помогает аргументации</a></p></section>'


def lessons_html(track):
    parts = ['<section id="lessons"><h2>Шесть занятий: от первого ответа к целой работе</h2><p>Проходите по порядку или начните с трудного для вас шага. Сначала выполните задание, затем откройте подсказку. Одна попытка и её редактура полезнее нескольких переписанных образцов.</p><div class="exam-lessons">']
    for i, lesson in enumerate(track['lessons']):
        steps = ''.join('<li>'+e(x)+'</li>' for x in lesson['steps'])
        reading = '<ul class="sources">'+links(lesson['reading'])+'</ul>' if lesson['reading'] else ''
        parts.append(f'''<details class="exam-lesson" id="lesson-{i+1}"{' open' if i == 0 else ''}><summary><span class="exam-step">{i+1:02d}</span>{e(lesson['title'])}</summary><div class="exam-lesson-body"><p>{e(lesson['goal'])}</p><ol>{steps}</ol>{reading}<div class="prompt-box"><h3>Попробуйте сами</h3><p>{e(lesson['task'])}</p><button type="button" class="button secondary" data-exam-open="{i}">Открыть задание в черновике</button></div><p><strong>Получилось, если:</strong> {e(lesson['ready'])}</p><details><summary>Подсказка после своей попытки</summary><p>{e(lesson['answer_note'])}</p></details></div></details>''')
    return ''.join(parts)+'</div></section>'


def timer():
    return '''<section class="exam-timer" data-exam-timer aria-labelledby="timer-title"><h2 id="timer-title">Потренируйтесь с таймером</h2><p>Он помогает держать время и не оценивает содержание речи. Для повторного прослушивания можно записать себя на свой телефон.</p><label for="timer-mode">Этап</label><select id="timer-mode"><option value="300">Подготовка к чтению и беседе · 5 минут</option><option value="120">Подготовка к монологу · 2 минуты</option><option value="180">Монолог · до 3 минут</option></select><div class="exam-timer-controls"><output class="exam-clock" aria-label="Осталось времени" aria-live="off">05:00</output><button class="button secondary" type="button" data-timer-toggle>Начать</button><button class="button secondary" type="button" data-timer-reset>Сбросить</button></div><p class="fine" data-timer-status role="status">Выберите этап и начинайте, когда будете готовы.</p></section>'''


def practice(track):
    prompts = [(x['title'], x['task']) for x in track['lessons']] + [(track['final_practice']['title'], track['final_practice']['task'])]
    prompts.append(('Задание из ФИПИ или с другого сайта', 'Откройте выбранное задание в соседней вкладке. В поле источника укажите ссылку или экзамен, год и номер задания. Ниже напишите свой ответ. Для проверки нужны условия именно этого задания; требования учебного примера мастерской могут отличаться.'))
    options = ''.join(f'<option value="{i}"' + (' data-external-practice' if i == 7 else '') + f' data-prompt="{e(task, quote=True)}">{i+1}. {e(title)}</option>' for i, (title, task) in enumerate(prompts))
    checks = ''.join(f'<li><label><input type="checkbox"><span>{e(c)}</span></label></li>' for c in track['final_practice']['checks'])
    return f'''<section id="practice"><h2>Ваш черновик</h2><p>Выберите занятие, итоговую тренировку или задание с другого сайта. При смене задания текст в поле остаётся; скачайте законченную работу перед переходом к следующей.</p><div class="practice" data-lesson="{e(track['slug'])}"><label for="writing-mode">Над чем работаем</label><select id="writing-mode">{options}</select><p class="writing-prompt">{e(prompts[0][1])}</p><label for="draft-source">Источник и номер задания <span class="fine">· для задания с другого сайта</span></label><input id="draft-source" type="text" data-draft-source maxlength="1000" autocomplete="off" aria-describedby="draft-source-note" placeholder="Ссылка на задание или ФИПИ, предмет, год и номер"><p class="fine" id="draft-source-note">Источник сохранится вместе с ответом и попадёт в письмо. В число слов он не входит.</p><label for="draft">Ответ, план выступления или сочинение</label><textarea id="draft" maxlength="50000" spellcheck="true" aria-describedby="draft-note" placeholder="Начните с точного ответа на вопрос. Затем найдите подтверждение…"></textarea><div class="print-draft"></div><div class="draft-bar"><span class="word-count">Слов в черновике: 0</span><button class="button secondary" type="button" data-download disabled>Скачать черновик .txt</button><a class="button secondary" data-email-draft href="mailto:ladynata3000@gmail.com">Отправить на проверку в литературную мастерскую</a><button class="button secondary" type="button" data-save-draft disabled>Сохранить в браузере</button></div><p class="fine" id="draft-note">Пользование сайтом и проверка работ сейчас бесплатны. Черновик виден только вам, пока вы не отправите письмо. Кнопка «Сохранить в браузере» сохраняет ответ только в этом браузере на этом устройстве. Срок хранения не гарантируется: запись может исчезнуть после очистки данных, а в приватном режиме — после закрытия окна. Надёжнее скачать файл. Кнопка отправки на проверку откроет письмо на ladynata3000@gmail.com. Проверьте его и нажмите «Отправить» в своей почте. Длинный ответ скачайте и приложите файлом. Учитель ответит на ваш адрес. Перед закрытием сохраните работу. Счётчик слов приблизительный; в экзамене применяются правила ФИПИ.</p><p class="fine draft-status" role="status" aria-live="polite"></p></div><details><summary>Самопроверка итоговой тренировки мастерской</summary><ul class="checklist">{checks}</ul><p>Для задания из внешнего источника используйте критерии именно этого задания. Окончательную проверку содержания проводите вместе с учителем по официальным критериям. Отмеченная галочка и число слов не являются экзаменационным баллом.</p></details><noscript><p>Все занятия доступны без JavaScript. Пишите в тетради, время отсчитывайте по часам.</p></noscript></section>'''


def route_body(route, track):
    slug = track['slug']
    facts = ''.join(f'<dt>{e(f["label"])}</dt><dd>{e(f["value"])}</dd>' for f in track['facts'])
    reading = ''.join(f'<li><a href="/masterskaya/{s}/">{e(label)}</a></li>' for s, label in route['reading'])
    pitfalls = ''.join(f'<li>{e(x)}</li>' for x in track['pitfalls'])
    lens, repair = track['lens'], track['repair']
    prayer_note = '<p class="fine">Слова святителя относятся к молитве. С вниманием к тексту мы сопоставляем их по аналогии; это толкование мастерской.</p>' if route['quote'] == 'vnimanie' else ''
    return f'''<div class="wrap"><div class="breadcrumb"><a href="/k-sochineniyu/">К экзаменам</a><span>/</span>{e(route['stage'])}</div><header class="page-title"><p class="eyebrow">{e(route['stage'])} · 6 занятий и итоговая тренировка</p><h1>{e(route['title'])}</h1><p class="lead">{e(track['summary'])}</p></header>{nav(slug)}<div class="reading-layout"><nav class="reading-nav" aria-label="В этой ветке"><p class="eyebrow">Подготовка</p><a href="#format">Что требуется</a><a href="#materials">Документы и задания</a><a href="#lessons">Шесть занятий</a><a href="#lens">Православное прочтение</a><a href="#repair">Как улучшить ответ</a><a href="#worked-case">Развёрнутый пример</a><a href="#practice">Мой черновик</a><a href="#sources">Источники</a></nav><article class="article exam-article">
<section id="format"><h2>Что предстоит сделать</h2><p>{e(track['format'])}</p><div class="context-note">{e(track['version_note'])}</div><dl class="exam-facts">{facts}</dl><p><strong>Начните с короткой попытки:</strong> {e(track['lessons'][0]['task'])} Сохраните её и сравните со своей работой после шестого занятия.</p></section>
{route_box(slug)}
{lessons_html(track)}
<section id="lens"><h2>Как здесь помогает православное прочтение</h2><p>{e(lens['use'])}</p>{quote_block(route['quote'])}{prayer_note}<p><strong>Комментарий мастерской.</strong> {e(lens['example'])}</p><p>{e(lens['avoid'])}</p><p><a href="{GUIDE}">Пять шагов от нравственного понятия к доказательству</a></p></section>
<section id="repair"><h2>Один ответ до и после редактирования</h2><div class="exam-repair"><div><h3>Пока слабо</h3><p>{e(repair['weak'])}</p></div><div><h3>Точнее</h3><p>{e(repair['strong'])}</p></div></div><p>{e(repair['why'])}</p><h3>Что проверить особенно внимательно</h3><ul>{pitfalls}</ul></section>
<section><h2>Книги, к которым можно вернуться</h2><ul>{reading}</ul><p><a href="/chtenie/{READING[slug]}/">Перечни и рекомендации для этой ветки</a>. В русском языке наш список книг — помощь в подготовке, а не обязательный перечень ФИПИ.</p></section>
{exam_case(slug)}
<section id="final-training"><h2>Итоговая тренировка</h2><h3>{e(track['final_practice']['title'])}</h3><p>{e(track['final_practice']['task'])}</p><button class="button secondary" type="button" data-exam-open="6">Перейти к итоговой работе</button><p>После проверки выберите одну содержательную ошибку и перепишите соответствующий абзац. В следующей попытке проверьте это место первым.</p></section>
{timer() if slug == 'sobesedovanie' else ''}{practice(track)}
<section id="sources"><h2>Проверить требования у ФИПИ</h2><ul class="sources">{links(track['sources'])}</ul><p class="fine">Проверено 9 октября 2026 года. Упражнения и образцы созданы мастерской; это не задания ФИПИ и не обещание тем экзамена. Религиозное согласие не оценивается. Раздел посвящён устной и письменной творческой работе; тестовая часть русского языка в него не входит.</p></section><p><a href="/k-sochineniyu/">Все шесть веток подготовки</a></p></article></div></div><script src="/assets/exam-practice.js" defer></script>'''


def publish(page, routes):
    by_slug = {r['slug']: r for r in routes}
    page('/k-sochineniyu/', 'Подготовка к экзаменам: шесть веток', 'Собеседование, ОГЭ по русскому и литературе, итоговое сочинение, ЕГЭ по русскому и литературе: 36 занятий с практикой и разбором.', hub(), active='exam')
    paths = [GUIDE] + publish_resources(page)
    for slug in ORDER:
        route = by_slug[slug]
        path = f'/k-sochineniyu/{slug}/'
        page(path, route['title'], TRACKS[slug]['summary'], route_body(route, TRACKS[slug]), active='exam')
        paths.append(path)
    page(GUIDE, 'Православное прочтение и экзаменационная аргументация', 'Как превратить нравственный вопрос в доказательное рассуждение: эпизод, пояснение, художественный приём и точная духовная цитата.', guide_body(), active='exam')
    return paths


def hub():
    return '''<div class="wrap"><header class="page-title"><p class="eyebrow">9 и 11 классы · Устная речь и письменная работа</p><h1>К экзаменам —<br>через понимание текста</h1><p class="lead">Научиться отвечать по существу, находить доказательства, говорить понятно и редактировать написанное. Выберите свой экзамен: у каждого свой порядок подготовки.</p></header><div class="catalogue-intro"><p>Не нужно начинать с большого сочинения. Сначала попробуем ответить на один вопрос, потом объясним один эпизод и свяжем два наблюдения. Так постепенно появится целая работа, которую вы умеете написать самостоятельно.</p><div class="context-note"><strong>Требования проверены 9 октября 2026 года.</strong> ОГЭ, ЕГЭ и собеседование — по опубликованным ФИПИ проектам 2027 года. Итоговое сочинение — по материалам 2026/27 учебного года. Статус проекта сохранён; после утверждения инструкции могут уточняться.</div></div>''' + hub_callout() + cards() + '''<article class="prose"><section><h2>Где нужно писать сочинение?</h2><div class="table-scroll"><table class="comparison-table"><thead><tr><th>Испытание</th><th>Устная или письменная работа</th></tr></thead><tbody>
<tr><th>Собеседование</th><td>Устно: чтение, беседа по тексту и самостоятельный монолог.</td></tr><tr><th>ОГЭ по русскому</th><td>Сжатое изложение и одно сочинение из трёх предложенных вариантов. Здесь готовимся к этим двум частям.</td></tr><tr><th>ОГЭ по литературе</th><td>Развёрнутые ответы, сопоставление и сочинение на выбранную литературную тему.</td></tr><tr><th>Итоговое сочинение</th><td>Самостоятельное рассуждение с литературной аргументацией. Это отдельная работа, не задание ЕГЭ.</td></tr><tr><th>ЕГЭ по русскому</th><td>Сочинение по исходному тексту: позиция автора, комментарий, своё обоснованное отношение.</td></tr><tr><th>ЕГЭ по литературе</th><td>Анализ, сопоставительные ответы и большое сочинение на литературную тему.</td></tr></tbody></table></div></section>
<section><h2>Как мы помогаем пройти этот путь</h2><ol><li><strong>Короткая первая попытка.</strong> Она покажет конкретную трудность: найти мысль, выбрать пример, объяснить связь или связно произнести ответ.</li><li><strong>Шесть занятий.</strong> У каждого — задача, материал, подсказка и понятный признак готовности. Можно остановиться на трудном шаге.</li><li><strong>Разбор и редактура.</strong> Сравниваем слабый и улучшенный ответ, затем проверяем развёрнутый пример. Переписываем собственный неудачный фрагмент.</li><li><strong>Целая работа.</strong> Выполняем итоговую тренировку и проверяем её вместе с учителем. Сохраняем черновик, чтобы видеть своё продвижение.</li></ol><p>За один подход достаточно одного занятия. Когда основные действия станут понятны, переходите к полной официальной демоверсии своей дисциплины. Эта мастерская не обещает автоматического балла и не заменяет тестовую подготовку по русскому языку.</p></section>
<section id="tradition"><h2>Где здесь православная мысль?</h2><p>Она помогает задавать вопросы о совести, свободе, милосердии и ответственности. Экзаменационное доказательство строится на тексте: что человек сделал, как это показано, почему эпизод подтверждает наш вывод. В изложение нельзя добавлять собственное толкование; в сочинении важно понимать, где говорит автор, а где вы.</p><p><a class="button secondary" href="''' + GUIDE + '''">Как обосновать вывод через православное прочтение</a></p><p>Духовную цитату не требуется вставлять в каждый ответ. Религиозное согласие не является критерием оценки. Уместная, точная и объяснённая мысль ценнее формулы, которой пытаются закрыть любой вопрос.</p></section>
<section><h2>Если вы занимаетесь с учителем или родителями</h2><p>Сначала выслушайте ответ до конца. Попросите показать, где в тексте его основание. Отделите ошибку понимания от речевой неточности: переписать красивее ещё не значит исправить мысль. После обсуждения ученик сам создаёт второй вариант. Проверяйте его по критериям нужного формата, не требуя совпадения с мировоззрением взрослого.</p><p><a href="/chtenie/">Что читать для каждого экзамена</a> · <a href="/filosofiya/">Темы для размышления</a> · <a href="/tsitaty/">Точные духовные цитаты</a></p></section>
<section id="sources"><h2>Официальные материалы</h2><ul class="sources"><li><a href="https://fipi.ru/itogovoye-sobesedovaniye">ФИПИ: итоговое собеседование</a></li><li><a href="https://fipi.ru/oge/demoversii-specifikacii-kodifikatory">ФИПИ: ОГЭ</a></li><li><a href="https://fipi.ru/itogovoe-sochinenie">ФИПИ: итоговое сочинение</a></li><li><a href="https://fipi.ru/ege/demoversii-specifikacii-kodifikatory">ФИПИ: ЕГЭ</a></li></ul><p>Документы каждой дисциплины и подборки «Решу ЕГЭ / ОГЭ» собраны на <a href="/k-sochineniyu/materialy/">странице материалов</a>. Собственные учебные темы и примеры на сайте обозначены отдельно.</p></section></article></div>'''
