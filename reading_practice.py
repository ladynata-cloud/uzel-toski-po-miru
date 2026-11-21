"""A static guide to existing reading routes and a bounded public-card download."""
from html import escape
import hashlib
from io import BytesIO
import json
from pathlib import Path
import zipfile


PAGE_PATH = '/praktika-chteniya/'
DOWNLOAD_PATH = '/materials/reader-practice-20261120.zip'
SOURCE = Path(__file__).with_name('reader_workshop_cards')
APPROVED_FILES = {
    'kb-reader-doctor-opening-after.json': 'ec744fa3d8c97a8973a41eeecbb98b5a084b7d91f21e1e496f7b8283b38d6ed0',
    'kb-reader-shinel-opening-after.json': '361678fc6899289fe6a913043096a7b9784a66c06b557ab70de759dc33697645',
    'kb-reader-student-opening-before.json': '93be25fa474c7ed453ca93bb8d5b04fb43ec99daca9a5eda06ed30aa7b62e8a8',
    'kb-reader-vorona-full-during.json': 'b01c01e7870da1ce88c74b42b0291676a257cc27eeb2fb0fb19733badeb02100',
}
PUBLIC_FIELDS = {'title', 'learning_goal', 'read_mode', 'source_scope', 'anchor_text', 'links', 'branches'}
BRANCH_FIELDS = {'branch_id', 'trigger', 'cause_hypothesis', 'brief_explanation', 'hints', 'understanding_check'}

LESSONS = (
    ('work-student', 'А. П. Чехов', 'Студент', 'Одно слово в первой фразе',
     'Выберите слово, которое хочется выделить голосом. Прочитайте фразу ещё раз без этого выделения и запишите, что изменилось.',
     'Начать с одной фразы'),
    ('work-vorona-i-lisitsa', 'И. А. Крылов', 'Ворона и Лисица', 'Услышать интонацию',
     'В показанном начале выберите одну строку и произнесите её по-разному. Покажите собеседнику слово или паузу, на которых держится ваше прочтение.',
     'Читаю начало'),
    ('work-chudesnyy-doktor', 'А. И. Куприн', 'Чудесный доктор', 'Проверить свою догадку',
     'Прочитайте показанное начало. Назовите одно действие рассказчика или мальчиков, затем отдельно сформулируйте, что вы об этом предполагаете.',
     'Начало прочитано. Обсудить'),
    ('work-shinel', 'Н. В. Гоголь', 'Шинель', 'Объяснить своё впечатление',
     'Найдите в начале место, на котором хочется задержаться. Опишите, как оно вам звучит, и укажите слова, которые помогают это услышать.',
     'Начало прочитано. Обсудить'),
)


def _approved_card_bytes(source):
    provenance = json.loads((source / 'provenance.json').read_text(encoding='utf-8'))
    rows = provenance.get('files')
    if not isinstance(rows, list) or len(rows) != len(APPROVED_FILES):
        raise ValueError('Reader download requires exactly four approved source records')
    if any(not isinstance(row, dict) or set(row) != {'card_id', 'path', 'sha256'} for row in rows):
        raise ValueError('Unexpected source manifest fields')
    if {row['path'] for row in rows} != set(APPROVED_FILES):
        raise ValueError('Reader source manifest differs from the four-card allowlist')
    files = {}
    for row in rows:
        name = row['path']
        expected = APPROVED_FILES[name]
        if row['sha256'] != expected or row['card_id'] != name.removesuffix('.json'):
            raise ValueError('Reader source manifest does not match the pinned card')
        raw = (source / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('Reader card hash mismatch: ' + name)
        card = json.loads(raw)
        if (set(card) != {'schema_version', 'card_id', 'site', 'source_ids', 'public_card', 'quotes'}
                or card['schema_version'] != 1 or card['site'] != 'reader'
                or card['card_id'] != row['card_id'] or set(card['public_card']) != PUBLIC_FIELDS):
            raise ValueError('Unexpected public reader card fields')
        for branch in card['public_card']['branches']:
            if (set(branch) != BRANCH_FIELDS or set(branch['understanding_check']) != {'question'}
                    or any(set(hint) != {'level', 'text'} for hint in branch['hints'])):
                raise ValueError('Unexpected public reader branch fields')
        if any(set(quote) != {'location', 'source_id', 'text', 'start', 'end'} for quote in card['quotes']):
            raise ValueError('Unexpected public quotation fields')
        files['cards/' + name] = raw
    return files


def publish_download(output, source=SOURCE):
    """Validate before writing; never walk the experiment or copy sibling data."""
    files = _approved_card_bytes(source)
    provenance = {
        'schema_version': 1,
        'date': '2026-11-20',
        'kind': 'four_reviewed_public_reader_cards',
        'origin': 'Reviewed public cards used by the Uzel reading workshop',
        'cards_unchanged': True,
        'private_data_included': False,
        'files': [
            {'card_id': name.removesuffix('.json'), 'path': 'cards/' + name, 'sha256': digest}
            for name, digest in sorted(APPROVED_FILES.items())
        ],
    }
    files['provenance.json'] = (json.dumps(provenance, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    files['README_RU.md'] = '''# Четыре карточки чтения с подсказками

«Узел тоски по миру», 20 ноября 2026 года.

В папке cards находятся четыре неизменённых открытых JSON: начало «Студента»
Чехова, «Шинели» Гоголя, «Чудесного доктора» Куприна и первые десять строк
«Вороны и Лисицы» Крылова. Название файла с фрагментом full историческое:
полной басни в карточке нет. Объём задают read_mode и source_scope.

Готовый маршрут: https://usel-toski-po-miru.art/praktika-chteniya/
Карточки и выбор режима: https://usel-toski-po-miru.art/poisk-po-pamyati/

Это данные для подготовки занятия или адаптации своего сайта, не отдельное
приложение. В каждом JSON шесть ситуаций, четыре подсказки к каждой ситуации
и вопрос для проверки понимания. Показывайте одну подсказку за раз и оставляйте
вывод читателю. Поля trigger и cause_hypothesis описывают возможную ситуацию;
они не устанавливают, что чувствует или думает конкретный человек.

Сохраняйте автора, точный текст и ссылку на первоисточник. Отделяйте цитату от
учебного комментария; внешний полный текст может раскрывать продолжение.
Вопрос о прочитанном начале не означает, что прочитано всё произведение.

SHA256SUMS.txt позволяет проверить все остальные файлы. provenance.json
указывает происхождение и хеши карточек. Закрытые ответы и критерии оценивания,
журналы API и исполняемые файлы в комплект не входят. Никакие запросы к модели
этот архив не запускает. Содержательная проверка исходных материалов выполнена
ИИ-агентами; эффективность с реальными учениками этим не измерялась.
'''.encode('utf-8')
    files['SHA256SUMS.txt'] = ''.join(
        hashlib.sha256(data).hexdigest() + '  ' + name + '\n'
        for name, data in sorted(files.items())
    ).encode('utf-8')
    archive = BytesIO()
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 11, 20, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, data)
    target = output / DOWNLOAD_PATH.lstrip('/')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(archive.getvalue())
    return len(archive.getvalue())


def publish_reading_practice(page, output):
    size = publish_download(output)
    entries = []
    for work_id, author, title, heading, action, mode in LESSONS:
        entries.append(f'''<article class="practice-card">
<p class="practice-author">{escape(author)} · «{escape(title)}»</p>
<h2>{escape(heading)}</h2><p>{escape(action)}</p>
<p class="practice-mode">Режим для этого задания: «{escape(mode)}».</p>
<a class="button secondary" href="/poisk-po-pamyati/#{work_id}">Открыть карточку «{escape(title)}»</a>
</article>''')
    body = '''<div class="wrap practice-page">
<div class="breadcrumb"><a href="/">Главная</a><span>/</span><a href="/chtenie/">Что читать</a><span>/</span>Читаем вместе</div>
<header class="page-title"><h1>Читаем вместе: четыре коротких занятия</h1>
<p class="lead">Один фрагмент, одна деталь и собственная мысль. Можно читать самостоятельно или обсуждать в группе до четырёх человек.</p></header>
<section class="practice-start" aria-labelledby="practice-start-title">
<h2 id="practice-start-title">Как начать</h2>
<ol>
<li>Выберите одно из четырёх заданий ниже и откройте карточку книги.</li>
<li>Нажмите <strong>«Читать начало вместе, шаг за шагом»</strong>, затем выберите режим, указанный в задании. На экране появится текст.</li>
<li>Прочитайте фрагмент. Если нужна подсказка, выберите ситуацию, которая вам подходит.</li>
<li>Запишите свою мысль в поле «Моя заметка к этому фрагменту». Она сохранится автоматически в этом браузере. Чтобы вернуться к ней, откройте ту же книгу и тот же режим.</li>
</ol>
<p>Задание можно выполнить по тексту на экране. По внешней ссылке открывается полное произведение, где можно узнать продолжение.</p>
<p>Если подсказки не появились, проверьте, включён ли JavaScript. Само задание из этой подборки можно выполнить на бумаге по своему изданию.</p>
</section>
<div class="practice-grid">''' + ''.join(entries) + '''</div>
<section class="practice-session" aria-labelledby="practice-session-title">
<h2 id="practice-session-title">Занятие на 10–15 минут</h2>
<p>Для одного — четырёх участников. Выберите одну книгу и один объём чтения для всей группы.</p>
<ol>
<li><strong>Две минуты — прочитать и заметить.</strong> Каждый читает фрагмент самостоятельно и записывает одно наблюдение. Подсказки пока закрыты.</li>
<li><strong>Три–пять минут — показать деталь.</strong> Каждый по очереди читает свою фразу и указывает слова, на которые опирается. Остальные могут задать один уточняющий вопрос. Если читаете сами, произнесите объяснение вслух.</li>
<li><strong>Две–три минуты — попробовать подсказку.</strong> Выберите одну подходящую ситуацию в карточке. Откройте только следующий шаг, выполните его и сравните наблюдения.</li>
<li><strong>Три–пять минут — уточнить мысль.</strong> Каждый дополняет или переписывает одно предложение. Рядом отмечает, какая деталь текста помогла это сделать.</li>
</ol>
<p><strong>Результат:</strong> у каждого осталось собственное предложение с опорой на текст. Прочтения могут различаться; важно показать, откуда возникла мысль.</p>
</section>
<section class="practice-notes" aria-labelledby="practice-notes-title">
<h2 id="practice-notes-title">Где останется моя заметка</h2>
<p>В режиме чтения по шагам заметка, выбранная ситуация и шаг сохраняются в этом браузере, отдельно для каждой книги и каждого режима. Они не отправляются помощнику и не получают автоматическую оценку.</p>
<p>Запись не переносится на другой телефон или компьютер. Если браузер запретил сохранение, сайт сообщит об этом: можно продолжать, а перед уходом выделить текст заметки и скопировать его в свой документ.</p>
<p>На общем устройстве после занятия нажмите <strong>«Удалить заметку и шаг этого режима»</strong>. Для разных режимов удаление выполняется отдельно. Чтобы сохранить свою работу перед удалением, сначала скопируйте её вручную.</p>
</section>
<section class="practice-materials" aria-labelledby="practice-materials-title">
<h2 id="practice-materials-title">Материалы для преподавателя</h2>
<p>Четыре исходные карточки можно скачать для подготовки занятия или адаптации на своём сайте. В ZIP — вопросы и ступени помощи, ссылки на тексты, инструкция и сведения о происхождении. Это файлы данных, не готовое автономное приложение.</p>
<p><a class="button secondary" href="''' + DOWNLOAD_PATH + '''" download>Скачать четыре карточки · ZIP, ''' + str(round(size / 1024)) + ''' КБ</a></p>
<p>Показанные маршруты работают по подготовленным вопросам без обращения к модели. Материалы проверялись ИИ-агентами; опыт их применения с учениками ещё предстоит собрать.</p>
<p>Другие разработки: <a href="https://mathexam.space/laboratory/">лаборатория репетитора MathExam</a> и <a href="https://mathexam.space/pedagogam/">материалы MathExam для педагогов</a>.</p>
</section>
</div>
<style>
.practice-page{max-width:58rem;padding-bottom:3rem}
.practice-page .lead{max-width:46rem}
.practice-page .practice-start,.practice-page .practice-session,.practice-page .practice-notes,.practice-page .practice-materials{margin:1.5rem 0 2rem;max-width:48rem}
.practice-page h2{font-size:clamp(1.35rem,2.7vw,1.7rem);line-height:1.3}
.practice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin:1.5rem 0 2.5rem}
.practice-card{border:1px solid var(--line);padding:1.1rem;min-width:0}
.practice-author{color:var(--muted);margin-top:0}
.practice-mode{font-size:1rem}
.practice-page .button{white-space:normal;text-align:left;min-height:44px;overflow-wrap:anywhere}
.practice-session li{padding-left:.25rem;margin:.9rem 0;line-height:1.65}
.practice-page :focus-visible{outline:3px solid currentColor;outline-offset:3px}
@media(max-width:640px){.practice-grid{grid-template-columns:1fr}.practice-card{padding:1rem}}
</style>'''
    page(PAGE_PATH, 'Читаем вместе: четыре коротких занятия',
         'Чехов, Гоголь, Куприн и Крылов: чтение фрагмента по шагам, собственная заметка и короткое занятие для одного — четырёх участников.',
         body, active='reading')
    return PAGE_PATH
