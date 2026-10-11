"""Human-made artworks: verified credits and descriptive reading companions."""
import json
from html import escape as esc
from pathlib import Path

ARTWORKS = json.loads((Path(__file__).parent / 'artworks.json').read_text())


def figure(art, *, hero=False):
    loading = 'fetchpriority="high"' if hero else 'loading="lazy" decoding="async"'
    css = 'hero-figure artwork' if hero else 'artwork'
    collection = f" · {esc(art['collection'])}" if art.get('collection') else ''
    museum = f''' · <a href="{esc(art['verification_source'], quote=True)}">О произведении</a>''' if art.get('verification_source') else ''
    license_link = f' · <a href="{esc(art["license_url"], quote=True)}">Условия использования</a>' if art.get('license_url') else ''
    return f'''<figure class="{css}">
    <a class="artwork-image" href="{esc(art['image'], quote=True)}" aria-label="Открыть репродукцию: {esc(art['title'], quote=True)}">
    <img src="{esc(art['image'], quote=True)}" width="{art['width']}" height="{art['height']}" style="max-width:{art['width']}px" alt="{esc(art['alt'], quote=True)}" {loading}></a>
    <figcaption><strong>{esc(art['artist'])}. {esc(art['title'])}</strong>
    <span>{esc(art['date'])}. {esc(art['kind'])}{collection}</span>
    <span>{esc(art['relation'])}</span>
    <span class="artwork-credit"><a href="{esc(art['source'], quote=True)}">Источник репродукции</a>{museum} · {esc(art['rights'])}{license_link}</span></figcaption></figure>'''


def hero_artwork():
    return figure(ARTWORKS['home'], hero=True)


def lesson_artwork(slug):
    if slug == 'uvidet-drugogo':
        from prisoner_reading import film_figure
        return '<div class="artwork-reading"><h3>Кадр из экранизации</h3>' + film_figure('caucasus-film-1975-dina') + '</div>'
    art = ARTWORKS.get(slug)
    additional = {'matrenin-dvor-neuznannaya':'levitan', 'smotritel-vozvrashchenie':'prodigal', 'rekviem-golos-i-pamyat':'vladimir', 'sonya-slovo-i-prisutstvie':'jairus', 'leto-gospodne-pamyat':'nativity'}
    if not art and slug in additional:
        from art_library import ART_LIBRARY, NOTES
        key = additional[slug]
        _, note, question = NOTES[key]
        if slug == 'matrenin-dvor-neuznannaya': note = '«Вечерний звон» Левитана сопровождает тему сельской жизни и памяти. Тихий пейзаж оставляет место размышлению о человеке, чьё отсутствие меняет знакомый мир. Это не изображение Матрёниного дома.'
        art = {**ART_LIBRARY[key], 'relation':note, 'questions':[question]}
    if not art:
        return ''
    return f'<div class="artwork-reading"><h3>Иллюстрация к тексту</h3>{figure(art)}</div>'
