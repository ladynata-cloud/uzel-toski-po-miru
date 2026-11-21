"""Render the same self-contained short writing exercises on the site and offline."""
import json
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).parent
SKILLS = {
    'topic': 'Понять вопрос темы',
    'thesis': 'Сформулировать тезис',
    'retell': 'Перейти от пересказа к объяснению',
    'motive': 'Обосновать мотив героя',
    'quote': 'Сверить цитату',
    'transition': 'Связать абзацы',
    'ending': 'Написать вывод',
    'precision': 'Сделать фразу точнее',
    'alternative': 'Защитить своё прочтение',
}


def render_writing_practice():
    cards = []
    for filename in ('writing-skills.json', 'literary-revision.json'):
        cards.extend(json.loads((HERE / filename).read_text(encoding='utf-8')))
    seen = set()
    for card in cards:
        if not all(isinstance(card.get(k), str) and card[k].strip()
                   for k in ('id', 'skill', 'title', 'topic', 'context', 'question', 'self_check')):
            raise ValueError('Incomplete writing exercise: ' + str(card.get('id')))
        if card['id'] in seen or card['skill'] not in SKILLS:
            raise ValueError('Duplicate writing exercise or unknown skill: ' + card['id'])
        if card['control'] not in ('revise', 'sound', 'blank') or not isinstance(card['draft'], str):
            raise ValueError('Invalid writing exercise type: ' + card['id'])
        if bool(card['draft'].strip()) == (card['control'] == 'blank'):
            raise ValueError('Exercise and initial draft disagree: ' + card['id'])
        if 'source' in card:
            source = urlsplit(card['source'])
            if source.scheme not in ('http', 'https') or not source.hostname:
                raise ValueError('Invalid reading reference: ' + card['id'])
        if 'transfer' in card and not all(card['transfer'].get(k) for k in ('task', 'teacher_check')):
            raise ValueError('Incomplete transfer exercise: ' + card['id'])
        if card['skill'] in ('retell', 'motive', 'quote') and not card.get('orthodox_question', '').strip():
            raise ValueError('Missing reading question for the scene: ' + card['id'])
        seen.add(card['id'])
    if {c['skill'] for c in cards} != set(SKILLS):
        raise ValueError('Missing writing skill')
    method = json.loads((HERE / 'review-method.json').read_text(encoding='utf-8'))
    payload = json.dumps({'skills': SKILLS, 'cards': cards, 'method': method},
                         separators=(',', ':'), ensure_ascii=False)
    payload = payload.replace('<', r'\u003c').replace('\u2028', r'\u2028').replace('\u2029', r'\u2029')
    section = (HERE / 'section.html').read_text(encoding='utf-8')
    css = (HERE / 'practice.css').read_text(encoding='utf-8')
    js = (HERE / 'practice.js').read_text(encoding='utf-8')
    return f'<style>{css}</style>\n{section}\n<script type="application/json" id="wp-cards">{payload}</script>\n<script>{js}</script>'
