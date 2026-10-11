"""Full pages for each programme block, with direct links to spiritual sources."""
from html import escape as e
from reading_lists import references_for_unit
from extra_reading import related_for_unit
from reading_depth import load_depth
from school_data import load_grades
from quote_sources import quote_block, COLLECTION
from quote_dialogues import additional_dialogue
from illustrations import figure
from music import MUSIC

TEXT_LINKS = {
    (5, 'unit-07'): ('https://ilibrary.ru/text/1250/p.1/index.html', 'И. С. Тургенев. «Муму»: полный текст'),
    (10, 'unit-02'): ('https://ilibrary.ru/text/994/index.html', 'А. Н. Островский. «Гроза»: текст и оглавление'),
    (10, 'unit-03'): ('https://www.ilibrary.ru/text/475/index.html', 'И. А. Гончаров. «Обломов»: текст и оглавление'),
}


def reading_path(grade, unit):
    return f'/shkola/{grade}/{unit["id"]}/'


def publish_reading_pages(page, lessons, art_library):
    depth = load_depth()
    grades = load_grades()
    by_slug = {d['slug']: d for d in lessons}
    all_units = [(n, u) for n, g in grades.items() for u in g['units']]
    expected = {(n, u['id']) for n, u in all_units}
    if expected != set(depth):
        raise ValueError(('Depth coverage differs', expected - set(depth), set(depth) - expected))
    paths = []
    for position, (n, u) in enumerate(all_units):
        path = reading_path(n, u)
        paths.append(path)
        paragraphs = ''.join(f'<p>{e(p)}</p>' for p in depth[(n, u['id'])])
        lesson = by_slug.get(u['lesson'])
        art = ''
        if u['art']:
            work = art_library[u['art']]
            art = f'''<section id="art"><h2>Иллюстрация к тексту</h2>{figure(work)}</section>'''
        music = [m for m in MUSIC if lesson and m.get('lesson') == lesson['slug']]
        listening = ''
        if music:
            links = ''.join(f'<li><a href="/muzyka/#{m["id"]}">{e(m["composer"])}. {e(m["title"])}</a></li>' for m in music)
            listening = f'<section id="listening"><h2>Продолжить слушанием</h2><ul>{links}</ul><p>Музыка сопровождает чтение. По ссылке указаны исполнители, источник записи и её связь с темой.</p></section>'
        source_items = []
        if (n, u['id']) in TEXT_LINKS:
            url, label = TEXT_LINKS[(n, u['id'])]
            source_items.append(f'<li><a href="{e(url, quote=True)}">{e(label)}</a></li>')
        if lesson:
            for url, label in lesson['sources']:
                if url.startswith('http') and 'biblioteka3' not in url:
                    source_items.append(f'<li><a href="{e(url, quote=True)}">{e(label)}</a></li>')
        sources = f'<ul class="sources">{"".join(source_items)}</ul>' if source_items else ''
        workshop = f'<p><a class="button secondary" href="/masterskaya/{u["lesson"]}/">Занятие с вопросами и черновиком</a></p>' if lesson else ''
        if n < 5:
            writing = 'Начните с устного ответа из двух-трёх предложений. Назовите действие героя или заметную деталь, затем объясните, что она помогает понять. Взрослый может записать ответ ребёнка дословно; после чтения вслух вместе найдите место, которое требует уточнения.'
            bridge = '/k-sochineniyu/sobesedovanie/'
            bridge_label = 'Как развивается навык устного ответа'
        elif n < 8:
            writing = 'Постройте абзац из собственной мысли, конкретного наблюдения и объяснения связи между ними. Пересказ отвечает на вопрос «что произошло»; анализ добавляет «почему эта подробность важна». Проверьте, не повторяет ли последнее предложение первое другими словами.'
            bridge = '/k-sochineniyu/oge-russkiy/'
            bridge_label = 'Дальнейший путь к сочинению-рассуждению'
        elif n < 10:
            writing = 'Сформулируйте тезис, который можно проверить по произведению. Подберите эпизод, реплику или приём, объясните их функцию. Для сравнения сначала назовите общее основание, затем приведите подтверждение из каждого текста. Личная оценка дополняет анализ, но не подменяет его.'
            bridge = '/k-sochineniyu/oge-literatura/'
            bridge_label = 'Сочинение и сопоставление на ОГЭ по литературе'
        else:
            writing = 'Разверните тезис в два разных аргументированных утверждения. Для каждого выберите точный эпизод или особенность формы. Найдите деталь, которая могла бы возразить вашему первому выводу, и уточните мысль. В итоговом сочинении отвечайте на общий вопрос темы; в литературном анализе показывайте, как смысл создаётся устройством произведения.'
            bridge = '/k-sochineniyu/itogovoe/'
            bridge_label = 'Декабрьское итоговое сочинение и литературная аргументация'
        next_n, next_u = all_units[(position + 1) % len(all_units)]
        nav = f'<a href="#analysis">Литературный разбор</a><a href="#tradition">Духовное сопоставление</a>' + ('<a href="#art">Искусство</a>' if art else '') + ('<a href="#listening">Слушание</a>' if listening else '') + '<a href="#writing">Собственный ответ</a><a href="#sources">Тексты и источники</a>'
        body = f'''<div class="wrap"><div class="breadcrumb"><a href="/shkola/">Курс по классам</a><span>/</span><a href="/shkola/{n}/">{n} класс</a><span>/</span>Чтение и анализ</div><header class="page-title"><p class="eyebrow">{n} класс · Тема {u['id'][5:]} · Дополнительный курс</p><h1>{e(u['title'])}</h1><p class="lead">{e(grades[n]['focus'])}</p></header><div class="reading-layout"><nav class="reading-nav" aria-label="В разборе"><p class="eyebrow">В разборе</p>{nav}</nav><article class="article reading-detail">
        <section id="analysis"><h2>Литературный разбор</h2><p class="reading-selection"><strong>Круг чтения.</strong> {e(u['reading'])}</p><p>{e(u['analysis'])}</p>{paragraphs}</section>
        <section id="tradition"><h2>Встреча со святоотеческой мыслью</h2>{quote_block(u['quote'])}<div class="school-dialogue"><h3>Комментарий мастерской</h3><p>{e(u['dialogue'])}</p></div>{additional_dialogue(str(n)+'-'+u['id'])}<p class="fine">Цитата и подпись сохранены по выбранной подборке; знак […] обозначает пропущенное продолжение. Нажатие на цитату или имя автора открывает соответствующую страницу biblioteka3.ru. Литературное сопоставление принадлежит мастерской.</p></section>
        {art}{listening}
        <section id="writing"><h2>От чтения к собственной мысли</h2><p class="reading-prompt">{e(u['practice'])}</p><p>{writing}</p>{workshop}<p><a href="{bridge}">{bridge_label}</a> · <a href="/filosofiya/">Общие вопросы о добре, свободе и надежде</a></p></section>
        {references_for_unit(n,u["id"])}{related_for_unit(n,u["id"])}<section id="sources"><h2>Тексты и источники</h2>{sources}<p>Разбор рассчитан на чтение названных произведений или указанных фрагментов в вашем издании. Если внутри блока предложен выбор, произведения не объявляются дополнительным обязательным списком. Обсуждение одного эпизода не заменяет чтения книги.</p><p><a href="{COLLECTION}">Единственный источник духовных цитат: подборка biblioteka3.ru</a> · <a href="/tsitaty/">Примечания к цитатам</a> · <a href="/uchebniki/">Учебные линии и доступные фрагменты</a> · <a href="/shkola/#approach">Основания курса</a></p><p class="fine">Аналитические тексты подготовлены мастерской с помощью ИИ. Ученик может предложить другое прочтение, если обоснует его произведением. Религиозное согласие не является критерием оценки.</p></section>
        <nav class="next-lesson" aria-label="Продолжить курс"><a href="/shkola/{n}/#topics">Все темы {n} класса</a><a href="{reading_path(next_n, next_u)}">Далее: {e(next_u['title'])}</a></nav></article></div></div>'''
        page(path, u['title'], f'{n} класс. Литературный анализ, точная духовная цитата с прямой ссылкой и самостоятельное рассуждение.', body, active='school')
    return paths
