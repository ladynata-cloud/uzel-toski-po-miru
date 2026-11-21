"""Attach the editorial selections to identified topics in each workshop edition."""
import hashlib
import json
import re
from urllib.parse import urlsplit
from pathlib import Path

HERE = Path(__file__).parent


def title_key(title):
    letters = ''.join(c for c in title.lower().replace('ё', 'е') if c.isalnum())
    return hashlib.sha1(letters.encode('utf-8')).hexdigest()[:14]


def scene_selection(route, works):
    work = route['work']
    base = works[work]
    fact, url = route.get('scene', base['fact']), route.get('url', base['url'])
    if (fact, url) == (base['fact'], base['url']):
        return work, None
    address = urlsplit(url)
    if not fact.strip() or address.scheme not in ('http', 'https') or not address.hostname:
        raise ValueError('Invalid thematic scene for ' + work)
    digest = hashlib.sha256((fact + '\n' + url).encode('utf-8')).hexdigest()[:16]
    override = {'id': work, 'fact': fact, 'url': url}
    if route.get('title') and route['title'] != base['title']:
        override['title'] = route['title']
    return work + '@' + digest, override


def attach_book_routes(catalog):
    works = {w['id']: w for w in catalog['works']}
    routes = {}
    choices = {}

    def register(code, selected):
        if not 1 <= len(selected) <= 3 or len({row[0] for row in selected}) != len(selected):
            raise ValueError('A topic needs 1–3 distinct books: ' + code)
        keys = []
        for i, item in enumerate(selected):
            work, why, *fragment = item
            if fragment and (len(fragment) != 2 or not fragment[0].startswith('https://') or not fragment[1].strip()):
                raise ValueError('Invalid alternate fragment: ' + code)
            if work not in works or not why.strip():
                raise ValueError('Invalid book recommendation: ' + code + '/' + work)
            key = f'{code}.{i + 1}'
            routes[key] = {'work': work, 'why': why}
            if fragment:
                title = re.sub(r'», (глава|часть|сцена|действие|рассказ|главы)\b.*$', '»', works[work]['title'])
                routes[key].update(url=fragment[0], scene=fragment[1], title=title)
                card, override = scene_selection(routes[key], works)
                if override:
                    routes[key]['card'] = card
            keys.append(key)
        return keys

    for filename in ('ethics', 'society', 'culture'):
        content = json.loads((HERE / (filename + '.json')).read_text(encoding='utf-8'))
        groups = {name: register(filename[0] + '/' + name, rows) for name, rows in content['groups'].items()}
        for fingerprint, group in content['choices'].items():
            if fingerprint in choices or group not in groups:
                raise ValueError('Ambiguous topic recommendation: ' + fingerprint)
            choices[fingerprint] = groups[group]
    editions = json.loads((HERE / 'editions.json').read_text(encoding='utf-8'))
    edition_groups = {name: register('ed/' + name, rows) for name, rows in editions['groups'].items()}
    for fingerprint, group in editions['choices'].items():
        choices[fingerprint] = edition_groups[group]
    for topic in catalog['publicTopics']['topics']:
        key = title_key(topic['title'])
        if key not in choices:
            raise ValueError('Missing editorial choice: ' + topic['id'])
        topic['bookRoutes'] = choices[key]

    authored = json.loads((HERE / 'authored.json').read_text(encoding='utf-8'))
    for topic in catalog['topics']:
        work = topic['work']
        focus = topic.get('focus') or works[work]['secular']
        extra = authored.get(topic['id'], [])
        topic['bookRoutes'] = register('a/' + topic['id'], [[work, focus], *extra])
    catalog['bookRoutes'] = routes
