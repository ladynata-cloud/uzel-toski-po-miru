"""The public, browser-local reader search. Only first-reading fields are rendered."""
from html import escape

from site_config import SITE_ASSISTANT_ORIGIN, SITE_URL
from reader_workshop import WORKS, workshop_markup


def reader_search_body(cards):
    rows = []
    for card in cards:
        href = card['url'].removeprefix(SITE_URL) if card['url'].startswith(SITE_URL + '/') else card['url']
        hint = card.get('detail_hint', '')
        hint_html = f'<p class="memory-hint">{escape(hint)}</p>' if hint else ''
        practice = '<button type="button" class="button secondary memory-practice" hidden>Читать начало вместе, шаг за шагом</button>' if card['id'] in WORKS else ''
        rows.append(f'''<article class="memory-card" id="{escape(card['id'], quote=True)}"
 data-cues="{escape(' '.join(card['cues']), quote=True)}">
<p class="memory-author">{escape(card["author"])}</p>
<h2>{escape(card["title"])}</h2>
<p class="memory-teaser">{escape(card["teaser"])}</p>{hint_html}
{practice}
<button type="button" class="button secondary memory-discuss" hidden>Я уже прочитал(а). Обсудить «{escape(card['title'])}»</button>
<a href="{escape(href, quote=True)}" aria-label="{escape('Открыть разбор «' + card['title'] + '» со спойлерами', quote=True)}">Открыть разбор со спойлерами</a>
</article>''')

    body = '''<div class="wrap memory-search">
<div class="breadcrumb"><a href="/">Главная</a><span>/</span><a href="/chtenie/">Что читать</a><span>/</span>Поиск по памяти</div>
<header class="page-title"><h1>Найти произведение по памяти</h1>
<p class="lead">Вспомните героя, место или поступок. В карточках можно узнать книгу, сохранив развязку для первого чтения.</p><p>Для «Студента», «Чудесного доктора», «Шинели» и «Вороны и Лисицы» есть короткое чтение с подсказками. Откройте карточку и выберите «Читать начало вместе, шаг за шагом».</p><p><a href="/praktika-chteniya/">Четыре коротких занятия: что попробовать самому или в группе</a></p></header>
<section id="memory-dialogue" hidden aria-label="Разговор с читательским помощником">
<p id="memory-mode">Поиск без спойлеров</p>
<div id="memory-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Ваш разговор"></div>
</section>
WORKSHOP_MARKUP
<form id="memory-form" role="search" data-assistant-origin="ASSISTANT_ORIGIN" hidden>
<p id="memory-transport" hidden><label><input type="checkbox" id="memory-server-consent">Отправлять мои реплики серверному помощнику</label>
Без этого выбора поиск и карточки работают в браузере. Режим «Читать начало вместе» всегда работает на сайте без отправки реплик.</p>
<label id="memory-label" for="memory-query">Что вам запомнилось?</label>
<div class="memory-controls">
<input type="search" id="memory-query" maxlength="300" placeholder="Например, разбирали горницу">
<button id="memory-send" class="button" type="submit">Найти</button>
<button class="button secondary" type="reset">Начать заново</button></div>
<div class="memory-actions" id="memory-actions" hidden>
<button class="button secondary" type="button" data-question="Что разбирает мастерская?">О чём поговорим?</button>
<button class="button secondary" type="button" data-question="Где сверить источник?">Где сверить источник?</button>
<button class="button secondary" type="button" id="memory-safe">Без спойлеров</button></div>
</form>
<p id="memory-status" role="status" aria-live="polite"></p>
<section id="memory-results" aria-label="Карточки произведений">''' + ''.join(rows) + '''</section>
</div>
<style>
.memory-search{padding-bottom:3rem}
.memory-search .page-title{padding-bottom:.3rem}
.memory-search .lead{max-width:48rem}
.memory-search form,.memory-card{max-width:46rem}
.memory-search label{display:block;margin:.5rem 0;font-weight:600}
.memory-controls{display:flex;flex-wrap:wrap;gap:.5rem}
.memory-controls input{flex:1 1 16rem;min-width:0;padding:.7rem;font:inherit;border:1px solid var(--muted);border-radius:2px;background:var(--white);color:var(--ink)}
.memory-search button{cursor:pointer}
.memory-search [hidden]{display:none!important}
#memory-mode{color:var(--muted);margin:1rem 0 .5rem}
#memory-log{max-width:46rem;max-height:23rem;overflow-y:auto;overscroll-behavior:contain}
#memory-log p{white-space:pre-line;margin:.35rem 0 .8rem}
#memory-log a{display:inline-block;margin:0 .7rem .4rem 0}
.memory-message{padding:.35rem .8rem;border-left:2px solid var(--line)}
.memory-message strong{font-size:.92rem}
.memory-actions,.memory-card .button{margin:.6rem 0}
.memory-actions{display:flex;flex-wrap:wrap;gap:.5rem}
.memory-discuss{display:block}
#memory-status{color:var(--muted);margin:1.25rem 0}
.memory-card{border-top:1px solid var(--line);padding:1.35rem 0;scroll-margin-top:1.5rem}
.memory-card h2{font-size:clamp(1.6rem,3vw,2rem);line-height:1.2;margin:.25rem 0 .65rem}
.memory-author{color:var(--muted);margin:0}
.memory-teaser,.memory-hint{margin:.5rem 0}
.memory-card a{display:inline-block;margin-top:.3rem}
#reader-workshop{max-width:46rem;border:1px solid var(--line);padding:1rem;margin:1rem 0}
#reader-workshop h2{font-size:clamp(1.45rem,3vw,1.9rem)}
#reader-workshop button{white-space:normal;text-align:left;min-height:44px}
#reader-workshop button[aria-pressed="true"]{outline:2px solid currentColor;outline-offset:2px}
#reading-source-text{white-space:pre-line}
#reading-note{width:100%;box-sizing:border-box;padding:.7rem;font:inherit;line-height:1.6;color:var(--ink);background:var(--white);border:1px solid var(--muted);resize:vertical}
#reading-note-help,#reading-saved{font-size:.94rem}
#reading-prompt{font-size:1.1rem;line-height:1.7}
#reading-step{border-top:1px solid var(--line);padding-top:.6rem;margin-top:1rem}
#reader-workshop :focus-visible{outline:3px solid currentColor;outline-offset:3px}
.memory-practice{display:block}
</style>
<script defer src="/assets/reader-workshop.js"></script><script defer src="/assets/reader-search.js"></script>'''
    return body.replace('WORKSHOP_MARKUP', workshop_markup()).replace('ASSISTANT_ORIGIN', escape(SITE_ASSISTANT_ORIGIN, quote=True))
