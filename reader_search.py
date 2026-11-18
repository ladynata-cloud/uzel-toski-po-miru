"""The public, browser-local reader search. Only first-reading fields are rendered."""
from html import escape

from site_config import SITE_URL


def reader_search_body(cards):
    rows = []
    for card in cards:
        href = card['url'].removeprefix(SITE_URL) if card['url'].startswith(SITE_URL + '/') else card['url']
        hint = card.get('detail_hint', '')
        hint_html = f'<p class="memory-hint">{escape(hint)}</p>' if hint else ''
        rows.append(f'''<article class="memory-card" id="{escape(card['id'], quote=True)}"
 data-cues="{escape(' '.join(card['cues']), quote=True)}">
<p class="memory-author">{escape(card["author"])}</p>
<h2>{escape(card["title"])}</h2>
<p class="memory-teaser">{escape(card["teaser"])}</p>{hint_html}
<a href="{escape(href, quote=True)}" aria-label="{escape('Открыть разбор «' + card['title'] + '» со спойлерами', quote=True)}">Открыть разбор со спойлерами</a>
</article>''')

    return '''<div class="wrap memory-search">
<div class="breadcrumb"><a href="/">Главная</a><span>/</span><a href="/chtenie/">Что читать</a><span>/</span>Поиск по памяти</div>
<header class="page-title"><h1>Найти произведение по памяти</h1>
<p class="lead">Вспомните героя, место или поступок. В карточках можно узнать книгу, сохранив развязку для первого чтения.</p></header>
<form id="memory-form" role="search" hidden>
<label for="memory-query">Что вам запомнилось?</label>
<div class="memory-controls">
<input type="search" id="memory-query" maxlength="300" placeholder="Например, разбирали горницу">
<button class="button" type="submit">Найти</button>
<button class="button secondary" type="reset">Показать все</button></div>
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
.memory-controls .button{cursor:pointer}
#memory-status{color:var(--muted);margin:1.25rem 0}
.memory-card{border-top:1px solid var(--line);padding:1.35rem 0;scroll-margin-top:1.5rem}
.memory-card h2{font-size:clamp(1.6rem,3vw,2rem);line-height:1.2;margin:.25rem 0 .65rem}
.memory-author{color:var(--muted);margin:0}
.memory-teaser,.memory-hint{margin:.5rem 0}
.memory-card a{display:inline-block;margin-top:.3rem}
</style>
<script defer src="/assets/reader-search.js"></script>'''
