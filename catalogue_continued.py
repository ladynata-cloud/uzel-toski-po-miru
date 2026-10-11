"""Bounded literary analyses, with source availability kept separately."""
import json
from pathlib import Path
from catalogue_companions import companion

DATA = json.loads(Path(__file__).with_name('catalogue_continued_data.json').read_text())
PENDING = {x['id']: x for x in DATA if x['source_status'] == 'blocked'}

def article(x):
    reflection = x['reflection']
    for prefix in ('Комментарий мастерской. ', 'Комментарий мастерской: '):
        reflection = reflection.removeprefix(prefix)
    sources = [(s['url'], s['label']) for s in x['sources']]
    return dict(slug=x['id'], catalogue=x['id'], title=x['title'], author=x['author'],
                scope=x['scope'], paragraphs=x['paragraphs'],
                reflection='Комментарий мастерской. '+reflection,
                task=x['task'], sources=sources, source=sources[0][0], source_label=sources[0][1],
                **companion(x['id']))

CONTINUED_ESSAYS = [article(x) for x in DATA if x['source_status'] != 'blocked']
