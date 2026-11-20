"""Build the full-draft checker for Pages, a single HTML file and the family ZIP."""
from base64 import b64encode
from hashlib import sha256
import json
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from .catalogue import load_catalog

HERE = Path(__file__).parent
SOURCE = HERE / 'full-review'


def review_bundle(catalog=None):
    if catalog is None:
        catalog = load_catalog()
    method = json.loads((SOURCE / 'method.json').read_text(encoding='utf-8'))
    if not isinstance(method['version'], str) or not method['version'].strip():
        raise ValueError('Missing essay review method version')
    instructions = method['instructions']
    if not isinstance(instructions, list) or not instructions or not all(isinstance(line, str) and line.strip() for line in instructions):
        raise ValueError('Missing essay review instructions')
    examples = []
    for item in method['examples']:
        if item['criterion'] not in ('K1', 'K2', 'K3', 'K4', 'K5') or not item['passage'].strip() or not item['question'].strip() or not item['observation'].strip():
            raise ValueError('Invalid essay review example')
        examples.append(f"{item['criterion']}. Учебная фраза: {item['passage']} Что видно: {item['observation']} Возможный вопрос: {item['question']}")
    prompt = '\n\n'.join([*instructions, 'Учебные примеры', *examples])

    cards, seen = [], set()
    for work in catalog['works']:
        card = {key: work[key] for key in ('id', 'title', 'fact', 'url')}
        if not all(isinstance(value, str) and value.strip() for value in card.values()) or card['id'] in seen:
            raise ValueError('Invalid or duplicate work in the essay review catalogue')
        url = urlsplit(card['url'])
        if url.scheme not in ('http', 'https') or not url.hostname:
            raise ValueError('Missing source address for ' + card['id'])
        seen.add(card['id'])
        cards.append(card)
    bundle = {'method': method, 'systemPrompt': prompt + '\n\n' + method['formats']['api'],
              'manualPrompt': prompt + '\n\n' + method['formats']['chat'], 'cards': cards}
    canonical = json.dumps(bundle, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    bundle['materialsId'] = sha256(canonical).hexdigest()[:20]
    return bundle


def topic_menu(catalog):
    public = catalog.get('publicTopics') or {}
    sources, positions = [], {}
    for src in public.get('sources', []):
        label = src['title']
        if src.get('kind') == 'secondary_index':
            label = ' · '.join(part for part in (src.get('publisher'), src.get('year'), label) if part)
        url = urlsplit(src['url'])
        if url.scheme not in ('http', 'https') or not url.hostname:
            raise ValueError('Missing topic source address for ' + src['id'])
        positions[src['id']] = len(sources)
        sources.append({'title': label, 'url': src['url']})
    topics = [[item['title'], positions[item['source']]] for item in public.get('topics', [])]
    author_source = len(sources)
    sources.append({'title': 'Авторская тренировочная тема «Узла тоски по миру»', 'url': ''})
    topics.extend([item['title'], author_source] for item in catalog['topics'])
    return {'sources': sources, 'authorSource': author_source, 'topics': topics}


def inline_json(value):
    # The catalogue is prose. A quotation must not end the inline script.
    text = json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', r'\u003c')
    return text.replace('\u2028', r'\u2028').replace('\u2029', r'\u2029')


def replace_marker(text, marker, value):
    if text.count(marker) != 1:
        raise ValueError('Missing or ambiguous essay checker marker: ' + marker)
    return text.replace(marker, value)


def build_review_package(destination, practice_page=None):
    catalog = load_catalog()
    bundle = review_bundle(catalog)
    source = (SOURCE / 'full_review_server.py').read_text(encoding='utf-8')
    launcher_data = {'method': {'version': bundle['method']['version']}, 'materialsId': bundle['materialsId'],
                     'systemPrompt': bundle['systemPrompt'], 'cards': bundle['cards']}
    standalone = replace_marker(source, 'None  # __INCLUDE_REVIEW_BUNDLE__', repr(launcher_data))
    server = standalone.encode('utf-8')
    guide = (SOURCE / 'gigachat-key-guide.gif').read_bytes()
    html = (SOURCE / 'essay-check.html').read_text(encoding='utf-8')
    replacements = {
        '__LOCAL_LAUNCHER_B64__': b64encode(server).decode('ascii'),
        '/*__COACH_WORD_COUNTER__*/': (HERE / 'coach.js').read_text(encoding='utf-8'),
        '/*__REVIEW_BUNDLE__*/': inline_json(bundle),
        '/*__TOPIC_MENU__*/': inline_json(topic_menu(catalog)),
        '__KEY_GUIDE_POSTER__': b64encode((SOURCE / 'gigachat-key-poster.png').read_bytes()).decode('ascii'),
        '__KEY_GUIDE_GIF__': b64encode(guide).decode('ascii'),
    }
    for marker, value in replacements.items():
        html = replace_marker(html, marker, value)
    page = html.encode('utf-8')
    (destination / 'proverka-sochineniya.html').write_bytes(page)
    (destination / 'gigachat-key-guide.gif').write_bytes(guide)
    assets = {'essay-check.html': page, 'full_review_server.py': server, 'gigachat-key-guide.gif': guide}
    if practice_page is not None:
        assets['practice.html'] = practice_page
    for name in ('start-windows.cmd', 'README.txt', 'method.json'):
        assets[name] = (SOURCE / name).read_bytes()
    with ZipFile(destination / 'proverka-gigachat.zip', 'w') as package:
        for name, data in assets.items():
            info = ZipInfo(name)
            info.external_attr = 0o644 << 16
            package.writestr(info, data, compress_type=ZIP_DEFLATED)
