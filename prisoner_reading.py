"""Close reading, film quotations and documented reception of Tolstoy's story."""
import json
from html import escape as e
from pathlib import Path

BASE = Path(__file__).parent
ARTICLE = json.loads((BASE / 'prisoner_expanded.json').read_text())
FILM = json.loads((BASE / 'caucasus_film_stills.json').read_text())


def film_figure(key):
    art = next(x for x in FILM['stills'] if x['id'] == key)
    return f'''<figure class="artwork film-still"><a class="artwork-image" href="{e(art['image'], quote=True)}" aria-label="Открыть кадр: {e(art['title'], quote=True)}"><img src="{e(art['image'], quote=True)}" width="{art['width']}" height="{art['height']}" alt="{e(art['alt'], quote=True)}" loading="lazy" decoding="async"></a><figcaption><strong>{e(art['title'])}</strong><span>«Кавказский пленник», 1975. Режиссёр Георгий Калатозишвили, оператор Давид Схиртладзе. Грузия-фильм.</span><span>{e(art['relation'])}</span><span class="artwork-credit"><a href="{e(art['source'], quote=True)}">Источник кадра</a> · <a href="{e(FILM['film']['official_source_context'], quote=True)}">О фильме — Гостелерадиофонд</a>. Кадр приведён для обсуждения экранизации; открытая лицензия не заявлена.</span></figcaption></figure>'''


def analysis_html():
    heads = {x['before']: x['title'] for x in ARTICLE['section_headings']}
    parts = []
    for i, text in enumerate(ARTICLE['paragraphs']):
        if i in heads:
            parts.append(f'<h3 id="prisoner-part-{i}">{e(heads[i])}</h3>')
        parts.append(f'<p>{e(text)}</p>')
        if i == 5:
            parts.append(film_figure('caucasus-film-1975-aul'))
        if i == 13:
            parts.append(film_figure('caucasus-film-1975-zhilin-kostylin'))
    return ''.join(parts)


def reception_html():
    data = json.loads((BASE / 'caucasus_reception_article.json').read_text())
    parts = ['<section id="reception"><h2>Почему вокруг рассказа продолжается спор</h2>']
    for section in data['sections']:
        parts.append(f'<h3>{e(section["title"])}</h3>')
        for p in section['paragraphs']:
            source = f' <a href="{e(p["url"], quote=True)}">{e(p["label"])}</a>.' if p.get('url') else ''
            parts.append(f'<p>{e(p["text"])}{source}</p>')
    parts.append('</section>')
    return ''.join(parts)


def village_html():
    data = json.loads((BASE / 'village_perspective.json').read_text())
    parts = [f'<section id="village-perspective"><h2>{e(data["title"])}</h2><p>{e(data["intro"])}</p>']
    for section in data['sections']:
        parts.append(f'<h3>{e(section["title"])}</h3><p>{e(section["text"])}</p><p class="fine"><a href="{e(section["url"], quote=True)}">{e(section["label"])}</a></p>')
    parts.append(f'<div class="prompt-box"><h3>Для разговора</h3><p>{e(data["question"])}</p></div></section>')
    return ''.join(parts)


def revise_prisoner(original):
    question_links = ''.join(f'<li><a href="#prisoner-part-{h["before"]}">{e(h["title"])}</a></li>' for h in ARTICLE['section_headings'])
    original.update(
        title=ARTICLE['title'],
        lead='Какую цену имеет спасение — и кто её платит?',
        desc=ARTICLE['lead'],
        start=ARTICLE['start'],
        time='Два занятия по 40–50 минут или самостоятельное чтение',
        reading='<p>Разбор охватывает <a href="https://ilibrary.ru/text/1846/index.html">все шесть глав рассказа</a>. Проследим путь от письма матери до возвращения Жилина. У каждого героя остаётся своя точка зрения, а у повествования — границы того, что оно нам открывает.</p>'
                '<details><summary>Темы развёрнутого разбора</summary><ol>'+question_links+'</ol><p><a href="#village-perspective">Взгляд жителей аула: от появления пленных до побега</a></p><p><a href="#reception">Критические прочтения и письмо из Старых Атагов</a></p></details>',
        analysis=analysis_html(),
        village=village_html(),
        reception=reception_html(),
        questions=ARTICLE['questions'] + ['Что мы знаем о чувствах Дины из текста, а что только предполагаем? Чем помощь при побеге отличается от первого проявления симпатии — и что меняется в цене поступка?'],
        bridge='Сопоставьте помощь Дины с притчей о милосердном самарянине: найдите одну смысловую близость и одно существенное различие. Как меняет разговор о милосердии то, что здесь помогает ребёнок, которому самому нужна защита?',
        sources=[(s['url'], s['label']) for s in ARTICLE['sources']] + [('https://azbyka.ru/biblia/?Lk.10:25-37', 'Евангелие от Луки, 10:25–37. Притча о милосердном самарянине')],
    )
    original['tradition'] += '<p><strong>Комментарий мастерской.</strong> Милосердие Дины не освобождает взрослых от ответственности за неё. Спросить о цене помощи — значит продолжить внимание к ближнему: увидеть и спасённого, и того, кто ради него подвергся опасности. Благодарность не требует объявить все решения Жилина безупречными.</p>'
