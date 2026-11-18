"""Publish the two reading modes separately so first-reading clients never need analysis text."""
import json
import re
from pathlib import Path

from reader_search import reader_search_body
from reader_sources import after_reading_records
from site_config import SITE_URL

SEARCH_PATH = '/poisk-po-pamyati/'
DATA_PATH = '/assistant/v1/'
CARDS_FILE = Path(__file__).with_name('assistant_cards.json')
SAFE_FIELDS = {'id', 'title', 'author', 'teaser', 'cues'}
OPTIONAL_FIELDS = {'detail_hint'}


def load_cards():
    entries = json.loads(CARDS_FILE.read_text(encoding='utf-8'))
    cards = []
    ids, routes = set(), set()
    for entry in entries:
        fields = set(entry)
        required = SAFE_FIELDS | {'path'}
        if not required <= fields or fields - required - OPTIONAL_FIELDS:
            raise ValueError(f'Unexpected reader card fields: {entry.keys()}')
        route, card_id = entry['path'], entry['id']
        if (not re.fullmatch(r'work-[a-z0-9]+(?:-[a-z0-9]+)*', card_id) or card_id in ids
                or not re.fullmatch(r'/(?:[a-z0-9-]+/)+', route) or route in routes):
            raise ValueError(f'Duplicate or invalid reader card: {card_id}, {route}')
        for field in ('title', 'author', 'teaser', 'detail_hint'):
            if field in entry and (not isinstance(entry[field], str) or not entry[field].strip()):
                raise ValueError(f'Invalid {field} for {card_id}')
        cues = entry['cues']
        if not isinstance(cues, list) or not cues or not all(isinstance(c, str) and c.strip() for c in cues):
            raise ValueError(f'Missing recognition clues for {card_id}')
        ids.add(card_id)
        routes.add(route)
        cards.append({**{k: v for k, v in entry.items() if k != 'path'}, 'url': SITE_URL + route})
    if not cards:
        raise ValueError('Empty first-reading catalogue')
    return cards


def publish_reader_catalogue(page, output, lessons):
    cards = load_cards()
    page(SEARCH_PATH, 'Найти произведение по памяти',
         'Поиск по герою, месту и поступку. Короткие карточки для первого чтения и ссылки на литературные разборы.',
         reader_search_body(cards), active='reading')
    directory = output / DATA_PATH.strip('/')
    directory.mkdir(parents=True, exist_ok=True)
    first_reading = []
    for card in cards:
        safe = {k: v for k, v in card.items() if k in SAFE_FIELDS | OPTIONAL_FIELDS}
        safe['url'] = SITE_URL + SEARCH_PATH + '#' + card['id']
        first_reading.append(safe)
    after_reading = after_reading_records(cards, lessons)
    details = directory / 'after-reading'
    details.mkdir(exist_ok=True)
    expected_packets = {card['id'] for card in cards}
    for old in details.glob('work-*.json'):
        if old.stem not in expected_packets:
            old.unlink()
    for record in after_reading:
        if 'card_id' in record:
            packet = {'version': 1, 'mode': 'after_reading', 'record': record}
            (details / (record['card_id'] + '.json')).write_text(
                json.dumps(packet, ensure_ascii=False) + '\n', encoding='utf-8')
    for filename, mode, records in [
        ('before-reading.json', 'before_reading', first_reading),
        ('after-reading.json', 'after_reading', after_reading),
    ]:
        catalogue = {'version': 1, 'mode': mode, 'language': 'ru', 'records': records}
        (directory / filename).write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + '\n',
                                          encoding='utf-8')
    return SEARCH_PATH
