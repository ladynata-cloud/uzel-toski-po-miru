"""Documented stills, kept distinct from the literary sources."""
import json
from html import escape as e
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('screen_adaptations.json').read_text())


def film_companions(slug):
    matches = [item for item in DATA['stills'] if item['article'] == slug]
    if not matches:
        return ''
    parts = ['<section class="screen-companion"><h2>На экране</h2>']
    for item in matches:
        parts.append(
            f'<figure class="artwork film-still" style="max-width:{item["width"]}px">'
            f'<a class="artwork-image" href="{e(item["image"], quote=True)}" aria-label="Открыть кадр: {e(item["title"], quote=True)}">'
            f'<img src="{e(item["image"], quote=True)}" width="{item["width"]}" height="{item["height"]}" '
            f'alt="{e(item["alt"], quote=True)}" loading="lazy" decoding="async"></a>'
            f'<figcaption><strong>{e(item["title"])}</strong><span>{e(item["credit"])}</span>'
            f'<span>{e(item["relation"])}</span><span class="artwork-credit">'
            f'<a href="{e(item["source"], quote=True)}">Источник кадра</a> · '
            f'<a href="{e(item["verification_source"], quote=True)}">Сведения о фильме</a>'
            + (f' · {e(item["timecode_label"])}' if item.get('timecode_label') else '')
            + '</span></figcaption></figure>'
        )
    parts.append('</section>')
    return ''.join(parts)


def textual_basis(items):
    """A short route to the passages behind the interpretation."""
    if not items:
        return ''
    return '<details class="textual-basis"><summary>Проверить наблюдения по книге</summary><p>События и детали можно сверить по этим ссылкам. Их объяснение в статье — прочтение мастерской.</p><ul>' + ''.join(
        f'<li><a href="{e(item["url"], quote=True)}">{e(item["label"])}</a>: {e(item["detail"])}</li>'
        for item in items
    ) + '</ul></details>'
