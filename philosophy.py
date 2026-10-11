"""Original philosophical essays; scientific models are not theological proofs."""
from html import escape as e
import json
from pathlib import Path
from illustrations import figure
from art_library import ART_LIBRARY
from music import MUSIC
from philosophy_essays import ESSAYS
from quote_sources import quote_block


THEME_READING = json.loads(Path(__file__).with_name('theme_reading.json').read_text())

def publish_philosophy(page):
    paths = ['/filosofiya/']
    music = {m['id']: m for m in MUSIC}
    cards = []
    for index, a in enumerate(ESSAYS, 1):
        path = f'/filosofiya/{a["slug"]}/'
        paths.append(path)
        cards.append(f'''<article class="thought-card"><p class="eyebrow">{index:02d} · {e(a['theme'])}</p><h2><a href="{path}">{e(a['title'])}</a></h2><p>{e(a['lead'])}</p><p class="fine">{e(a['lens'])}</p><a href="{path}">Читать статью</a></article>''')
        sections = ''.join(f'<section id="part-{n}"><h2>{e(title)}</h2>{text}</section>' for n, (title, text) in enumerate(a['sections'], 1))
        nav = ''.join(f'<a href="#part-{n}">{e(title)}</a>' for n, (title, _) in enumerate(a['sections'], 1))
        listens = []
        for mid, question in a['music']:
            m = music[mid]
            listens.append(f'''<div class="thought-listen"><h3>{e(m['composer'])}. {e(m['title'])}</h3><p class="fine">{e(m['kind'])}. {e(m['performers'])}</p><p>{e(question)}</p><p><a href="{e(m['url'], quote=True)}">Открыть запись у источника</a> · <a href="/muzyka/#{mid}">О записи и её связи с чтением</a></p></div>''')
        sources = ''.join(f'<li id="source-{n}"><a href="{e(url, quote=True)}">{e(title)}</a><span class="source-purpose">{e(note)}</span></li>' for n, (url, title, note) in enumerate(a['sources'], 1))
        books = ''.join(f'<li><a href="/masterskaya/{slug}/">{e(title)}</a> — {e(question)}</li>' for slug, title, question in a['books'])
        further = THEME_READING.get(a['slug'], [])
        further_html = '<section><h2>Продолжить эту тему</h2><ul>' + ''.join(f'<li><a href="{e(url, quote=True)}">{e(title)}</a><p>{e(note)}</p></li>' for url, title, note in further) + '</ul></section>' if further else ''
        extra_quotes = ''.join(quote_block(key) for key in a.get('extra_quotes', []))
        nxt = ESSAYS[index % len(ESSAYS)]
        art = {**ART_LIBRARY[a['art']], 'relation': ''}
        body = f'''<div class="wrap"><div class="breadcrumb"><a href="/">Главная</a><span>/</span><a href="/filosofiya/">Философская мастерская</a></div><header class="page-title"><p class="eyebrow">{e(a['theme'])} · Статья {index:02d}</p><h1>{e(a['title'])}</h1><p class="lead">{e(a['lead'])}</p><p class="thought-lens">{e(a['lens'])}</p></header>
        <div class="reading-layout"><nav class="reading-nav" aria-label="В этой статье"><p class="eyebrow">В этой статье</p><a href="#picture">Встреча с картиной</a>{nav}<a href="#listening">Слушать</a><a href="#writing">От вопроса к сочинению</a><a href="#sources">Источники</a></nav><article class="article thought-article">
        <p class="fine">Комментарий мастерской. Авторское рассуждение проекта; научные сведения, условные модели и христианское прочтение обозначены отдельно.</p>
        <section id="picture" class="thought-picture">{figure(art)}<h2>{e(a['art_title'])}</h2>{a['art_text']}</section>
        {sections}
        <aside class="school-dialogue"><h2>Рядом со святоотеческой мыслью</h2>{quote_block(a['quote'])}<p><strong>Комментарий мастерской.</strong> {e(a['quote_comment'])}</p>{extra_quotes}</aside>
        <section id="listening"><h2>Музыкальная иллюстрация</h2>{''.join(listens)}<p class="fine">Музыка сопровождает чтение. Записи созданы людьми и открываются на страницах исполнителей и музыкальных проектов.</p></section>
        <section id="writing" class="thought-writing"><p class="eyebrow">Творческая работа</p><h2>От вопроса к сочинению</h2><p><strong>Тема мастерской:</strong> {e(a['prompt'])}</p><p>{e(a['writing'])}</p><h3>Две литературные опоры</h3><ul>{books}</ul><p class="fine">Это тренировочная тема, а не объявленная тема экзамена. В <a href="/k-sochineniyu/itogovoe/">итоговом сочинении</a> нужен собственный ответ на выбранную тему с литературной аргументацией. В <a href="/k-sochineniyu/ege-russkiy/">ЕГЭ по русскому</a> работа начинается с предложенного текста и позиции его автора: философская статья не заменяет комментарий к нему. В <a href="/k-sochineniyu/ege-literatura/">ЕГЭ по литературе</a> определяющим остаётся анализ произведения. Картина, музыка и формула не заменяют обязательную литературную или текстовую опору.</p></section>
        {further_html}<section id="sources"><h2>Источники и границы прочтения</h2><ol class="sources thought-sources">{sources}</ol><p class="fine">Первоначальные источники проверены 2 октября 2026 года; новые материалы и дальнейшее чтение добавлены 9 октября. Подпись к изображению содержит источник репродукции и атрибуции. Все духовные цитаты проекта берутся только из <a href="/tsitaty/">выбранной подборки</a>; библейские тексты указаны отдельно. Материалы подготовлены с помощью ИИ; иллюстрации и музыка не генерировались.</p></section>
        <nav class="next-lesson" aria-label="Продолжить чтение"><a href="/filosofiya/">Все философские статьи</a><a href="/filosofiya/{nxt['slug']}/">Далее: {e(nxt['title'])}</a></nav>
        </article></div></div>'''
        page(path, a['title'], a['lead'], body, active='philosophy')
    theme_art = {**ART_LIBRARY['philosophers'], 'relation': 'Михаил Нестеров изображает Павла Флоренского и Сергея Булгакова. Их совместная прогулка сопровождает философскую мастерскую — разговор людей, которые ищут истину и умеют слушать друг друга.'}
    body = f'''<div class="wrap"><header class="page-title"><p class="eyebrow">Самостоятельные вопросы · Старшие классы и взрослое чтение</p><h1>Добро. Свобода.<br>Надежда.</h1><p class="lead">Философская мастерская о том, как жить среди несовершенства мира и не переставать видеть человека.</p></header><div class="catalogue-intro"><p>Здесь мы начинаем с вопроса, который шире одной книги. Христианская мысль помогает назвать ценности; математика приучает проверять ход рассуждения; физика — уважать границы объяснения. Живопись и музыка дают опыт, который нельзя заменить формулой.</p><p>Одиннадцать самостоятельных статей можно читать в любом порядке. Рядом с рассуждением — картина и музыка. В конце можно выбрать вопрос для собственного сочинения. Для первого знакомства с темой подойдёт чтение вместе с учителем или родителями; формулы можно разобрать отдельно.</p></div><section class="prose">{figure(theme_art)}<p><a href="/filosofiya/pochemu-dobro-pobedit-zlo/">О картине «Философы» и вопросе о добре</a></p></section><div class="thought-grid">{''.join(cards)}</div>
    <section class="thought-method prose"><h2>Три разных основания мысли</h2><p><strong>Христианское прочтение</strong> открыто называет свою основу: Писание, веру в Воскресение, призвание любить ближнего. Читатель может исследовать эту позицию, не соглашаясь с ней.</p><p><strong>Научное утверждение</strong> относится к определённой области и проверяется её средствами. Энтропия не измеряет зло, а непредсказуемость системы сама по себе не доказывает свободу воли.</p><p><strong>Модель или аналогия</strong> выделяет одну сторону вопроса. Мы показываем её условия и пределы. Ни таблица выигрышей, ни красивый ряд чисел не выносят окончательного решения о человеческой жизни.</p><h2>Сначала вопрос, затем литературная опора</h2><p>Общая тема итогового сочинения может не называть конкретную книгу — произведение для аргументации выбирает сам пишущий. Это не означает, что литературная опора необязательна. На ЕГЭ по русскому рассуждение связано с предложенным текстом, на ЕГЭ по литературе — с анализом художественных произведений. Поэтому у каждой статьи есть разные пути от общего вопроса к чтению.</p><p><a href="/k-sochineniyu/">Требования творческих экзаменационных форматов</a> · <a href="/shkola/">Книги по классам</a> · <a href="/tsitaty/">Точные духовные цитаты</a></p></section></div>'''
    page('/filosofiya/', 'Философская мастерская', 'Одиннадцать статей о добре, свободе, надежде и мире: христианская мысль, математика, физика, живопись и музыка.', body, active='philosophy')
    return paths
