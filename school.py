"""Grade-by-grade reading guide, connected to longer workshops and human art."""
from html import escape as e
from school_data import load_grades
from quote_sources import QUOTES

PROGRAMS = {
 'primary': ('https://edsoo.ru/wp-content/uploads/2025/07/2025_noo_frp_literaturnoe-chtenie_1-4.pdf', 'ФРП: литературное чтение, 1–4 классы, 2025'),
 'middle': ('https://edsoo.ru/wp-content/uploads/2025/07/2025_ooo_frp_literatura_5-9.pdf', 'ФРП: литература, 5–9 классы, 2025'),
 'senior': ('https://edsoo.ru/wp-content/uploads/2025/07/2025_soo_frp_literatura_10_11_baz.pdf', 'ФРП: литература, 10–11 классы, базовый уровень, 2025'),
 'changes': ('https://edsoo.ru/wp-content/uploads/2026/08/literatura2-2.pdf', 'Методическое письмо на 2026/27 учебный год'),
}

def publish_school(page, lessons, art_library):
    grades=load_grades(); quotes={q['id']:q for q in QUOTES}; by_slug={d['slug']:d for d in lessons}
    count=sum(len(g['units']) for g in grades.values())
    def nav(current=0):
        return '<nav class="grade-nav" aria-label="Выбрать класс">'+''.join(f'<a href="/shkola/{n}/"'+(' aria-current="page"' if n==current else '')+f'>{n}<span> класс</span></a>' for n in grades)+'</nav>'
    cards=''.join(f'<article class="grade-card"><p class="eyebrow">{n} класс · тем: {len(g["units"])}</p><h2><a href="/shkola/{n}/">{e(g["subtitle"])}</a></h2><p>{e(g["focus"])}</p></article>' for n,g in grades.items())
    source_links=''.join(f'<li><a href="{u}">{label}</a></li>' for u,label in PROGRAMS.values())
    body=f'''<div class="wrap"><header class="page-title"><p class="eyebrow">От первого чтения до выпускного сочинения</p><h1>Литература.<br>Курс по классам.</h1><p class="lead">1–11 классы · {count} страниц чтения и анализа · {len(lessons)} практических занятий. Художественный текст, духовное размышление и встреча с искусством.</p></header>{nav()}
    <div class="catalogue-intro"><p>Здесь собраны тематические блоки федеральных программ литературного чтения и литературы. Там, где программа предусматривает выбор, предложен наш вариант: его можно заменить произведением из вашего учебника. Перечни «например» не превращаются в обязательное чтение всех названных книг.</p><p>У каждого из 187 блоков есть отдельная страница: дополнительный литературный анализ, точная духовная цитата с прямой ссылкой и работа над собственным ответом. Карточка помогает выбрать тему. Ссылка на занятие открывает также вопросы и поле для черновика. Для 10–11 классов взят базовый уровень; дополнительные сопоставления не заменяют углублённую программу.</p></div>
    <div class="grade-grid">{cards}</div><section class="school-finish"><p class="eyebrow">Завершение курса</p><h2>Сочинения и устная речь</h2><p>Собеседование и творческие задания ОГЭ, декабрьское итоговое сочинение и сочинения ЕГЭ. Шесть маршрутов с православным осмыслением, письменной практикой и самопроверкой.</p><a class="button" href="/k-sochineniyu/">Перейти к творческой подготовке</a></section><section class="section prose" id="approach"><h2>Как соединять три вида чтения</h2><ol><li>Сначала прочитайте произведение и найдите указанную сцену, деталь или речевой приём.</li><li>Откройте точную духовную цитату с источником. Обсудите предложенный вопрос. Наш комментарий не является словами святого отца или доказательством влияния на писателя.</li><li>Картина и музыка помогут задержаться в настроении прочитанного. Собственный ответ строим на литературном тексте.</li></ol><p>В 1–4 классах взрослый помогает прочитать духовный источник и объясняет незнакомые слова. Ребёнок может ответить устно. Участие в религиозном обсуждении добровольно; учебный ответ оценивается по пониманию произведения.</p><p><a href="/uchebniki/">Какие учебные линии мы сопоставили</a> · <a href="/iskusstvo/">Живопись и церковное искусство</a> · <a href="/muzyka/">Музыкальные записи</a></p><h2>Внеклассное чтение</h2><p><a href="/chtenie/vneklassnoe/">Маршруты для 1–11 классов</a> соединяют рекомендательный каталог с карточками по спискам внутри учебников и новыми разборами отдельных произведений.</p><h2>Списки для экзаменов</h2><p><a href="/chtenie/">Проверенные перечни ОГЭ и ЕГЭ и рекомендации для творческих работ</a> связывают позиции документов с готовыми занятиями. В них отмечены случаи, когда для экзамена необходимо расширить первоначальную учебную подборку.</p><h2>Основания курса</h2><ul class="sources">{source_links}</ul><p class="fine">Сверено 2 октября 2026 года. Учебники разных лет могут распределять произведения иначе. Этот дополнительный курс не заменяет школьное планирование и не является исчерпывающим комментарием к каждому стихотворению и каждой главе романа.</p></section></div>'''
    page('/shkola/', 'Литература 1–11: курс по классам', f'{count} тематических карточек: литературный разбор, святоотеческая мысль, искусство и письменная практика.',body,active='school')
    for n,g in grades.items():
        sections=[]
        for u in g['units']:
            q=quotes[u['quote']]
            art=''
            if u['art']:
                a=art_library[u['art']]
                art=f'<p class="card-art"><strong>Иллюстрация к чтению.</strong> <a href="/iskusstvo/#{u["art"]}">{e(a["artist"])}. {e(a["title"])}</a>. </p>'
            lesson=f'<p><a class="text-link" href="/masterskaya/{u["lesson"]}/">Подробное занятие: {e(by_slug[u["lesson"]]["title"])}</a></p>' if u['lesson'] else ''
            sections.append(f'''<section class="school-unit" id="{u['id']}"><p class="eyebrow">{n} класс · {u['id'][5:]}</p><h2>{e(u['title'])}</h2><p class="reading-selection"><strong>Читаем.</strong> {e(u['reading'])}</p><h3>Вход в тему</h3><p>{e(u['analysis'])}</p><p><a class="text-link" href="/shkola/{n}/{u['id']}/">Читать развёрнутый разбор</a></p><div class="school-dialogue"><h3>Встреча со святоотеческой мыслью</h3><p><a href="/tsitaty/#{q['id']}">{e(q['title'])}: точная цитата и источник</a></p><p><strong>Комментарий мастерской.</strong> {e(u['dialogue'])}</p></div>{art}<div class="course-outcome"><strong>Обсудите или напишите</strong><p>{e(u['practice'])}</p></div>{lesson}<a class="fine" href="#topics">К темам класса</a></section>''')
        topics=''.join(f'<li><a href="#{u["id"]}">{e(u["title"])}</a></li>' for u in g['units'])
        source=PROGRAMS['primary' if n<5 else 'middle' if n<10 else 'senior']
        finish='<section class="school-finish"><h2>От чтения — к собственному ответу</h2><p>Продолжите работу: устная речь, изложение и сочинение в экзаменационных форматах.</p><a href="/k-sochineniyu/">Творческие маршруты и поле для черновика</a></section>' if n>=8 else ''
        body=f'''<div class="wrap"><div class="breadcrumb"><a href="/">Главная</a><span>/</span><a href="/shkola/">Курс по классам</a><span>/</span>{n} класс</div><header class="page-title"><p class="eyebrow">{'Литературное чтение' if n<5 else 'Литература'} · {n} класс</p><h1>{e(g['subtitle'])}</h1><p class="lead">{e(g['focus'])}</p></header>{nav(n)}<div class="catalogue-intro"><p>Число карточек: {len(g['units'])}. Внутри тематической подборки можно возвращаться к каждому произведению отдельно. Указанные варианты выбора уточняйте по школьному плану.</p><p><a href="{source[0]}">{source[1]}</a> · <a href="/shkola/#approach">Как работать с духовным источником</a></p></div><nav class="school-topics" id="topics" aria-label="Темы класса"><h2>Круг чтения</h2><ol>{topics}</ol></nav><article class="prose school-prose">{''.join(sections)}</article>{finish}</div>'''
        page(f'/shkola/{n}/',f'{n} класс: {g["subtitle"]}',f'Литература, {n} класс. Разборы, проверенные духовные цитаты, искусство и задания.',body,active='school')
    return ['/shkola/']+[f'/shkola/{n}/' for n in grades]
