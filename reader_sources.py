"""Bounded, after-reading material from the sources used to publish the workshop."""

import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

from articles import load_articles
from catalogue_continued import DATA
from extra_reading import CATALOGUE_ESSAYS, CATALOGUE_READINGS, ESSAYS, ROOT, essay_path
from site_config import SITE_URL
from reader_lens_tasks import AFTER_READING


# These textbook essays cover additional works outside the linked catalogue position.
# Only the named links on the original essay belong to the catalogue recommendation.
OVERLAPPING_SOURCE_LABELS = {
    'primary-043': {'«Скворцы»', '«Белый пудель»'},
    'middle-037': {'«Похождения жука-носорога»'},
    'middle-047': {'«Звоните и приезжайте»: издательский фрагмент'},
    'middle-048': {'«Конь с розовой гривой»: текст рассказа'},
}

# The same review cites an actual page, the surrounding edition, and a library listing.
FOREST_SOURCE_ROLES = {
    'https://imo10.labirint.ru/books/998836/ph_01.jpg/800-0': 'primary_fragment',
    'https://www.labirint.ru/books/998836/': 'edition_record',
    'https://belgdb.ru/activities/projects/current/zhyuri-detyam/2025pr/KNIGI-PRETENDENTY-2025/':
        'bibliographic_reference',
}


def source_links(essay):
    links = essay['sources'] if 'sources' in essay else [(essay['source'], essay['source_label'])]
    return [
        {'url': url, 'label': label, 'kind': 'cited_source'}
        for url, label in links
    ]


def catalogue_records():
    entries = json.loads(Path(__file__).with_name('extra_reading_data.json').read_text(encoding='utf-8'))
    reviews = {review['id']: review for review in DATA}
    essays = {essay['catalogue']: essay for essay in CATALOGUE_ESSAYS}
    textbook_essays = {essay['textbook']: essay for essay in ESSAYS}
    records = []
    for entry in entries:
        key = entry['id']
        list_url = f'{SITE_URL}{ROOT}{entry["band"]}/#{key}'
        review = reviews.get(key)
        record = {
            'id': key, 'kind': 'catalogue_entry', 'title': entry['title'],
            'author': entry['author'], 'band': entry['band'], 'theme': entry['theme'],
            'age': entry['age'], 'url': list_url, 'catalogue_url': list_url,
            # Earlier articles state their scope without assigning a source audit status.
            'source_status': review['source_status'] if review else 'not_recorded',
        }
        if review and review['source_status'] == 'blocked':
            record.update(author=review['author'], scope=review['scope'],
                          sources=[{**s, 'kind': 'related_reference'} for s in review['sources']],
                          source_note=review['source_notes'])
        else:
            if key in CATALOGUE_READINGS:
                textbook_id, linked_scope = CATALOGUE_READINGS[key]
                essay = textbook_essays[textbook_id]
                scope = linked_scope
            else:
                essay = essays[key]
                scope = essay['scope']
            sources = source_links(essay)
            if key in OVERLAPPING_SOURCE_LABELS:
                labels = OVERLAPPING_SOURCE_LABELS[key]
                sources = [s for s in sources if s['label'] in labels]
                if {s['label'] for s in sources} != labels:
                    raise ValueError(f'Check scoped textbook source links for {key}')
            record.update(author=essay['author'], scope=scope, sources=sources,
                          url=SITE_URL + essay_path(essay), analysis_title=essay['title'])
            if key not in OVERLAPPING_SOURCE_LABELS:
                # The article and its prompt are the workshop's own commentary.
                record['commentary'] = essay['paragraphs'][0]
                record['reading_task'] = essay['task']
            if review:
                record['source_note'] = review['source_notes']
            if key == 'middle-093':
                for source in sources:
                    source['kind'] = FOREST_SOURCE_ROLES.get(source['url'], 'cited_source')
                    if source['kind'] == 'primary_fragment':
                        source['pages'] = [9]
                # The last paragraph distinguishes the children's observations from a guess.
                record['commentary'] += '\n\n' + essay['paragraphs'][-1]
        records.append(record)
    return records


class AnalysisParagraphs(HTMLParser):
    """Collect editorial paragraphs from the lesson, excluding quoted source blocks."""
    def __init__(self):
        super().__init__()
        self.paragraphs = []
        self.current = None
        self.excluded = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('aside', 'blockquote', 'figure', 'script', 'style'):
            self.excluded += 1
        elif tag == 'p' and not self.excluded:
            self.current = []

    def handle_data(self, data):
        if self.current is not None and not self.excluded:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag in ('aside', 'blockquote', 'figure', 'script', 'style'):
            self.excluded -= 1
        elif tag == 'p' and self.current is not None and not self.excluded:
            text = ' '.join(''.join(self.current).split())
            if text:
                self.paragraphs.append(text)
            self.current = None


def workshop_record(card, lesson):
    url = card['url']
    analysis = AnalysisParagraphs()
    analysis.feed(lesson['analysis'])
    analysis.close()
    sources = []
    for href, label in lesson['sources']:
        if href.startswith('/tsitaty/') or urlsplit(href).path.rstrip('/') == '/biblia':
            continue  # Cross-references for the theological discussion, not the work read here.
        sources.append({'url': SITE_URL + href if href.startswith('/') else href,
                        'label': label, 'kind': 'work_source'})
    return {
        'id': card['id'], 'card_id': card['id'], 'kind': 'workshop',
        'url': url, 'author': lesson['author'], 'title': lesson['work'],
        'analysis_title': lesson['title'], 'scope': 'Эпизоды и вопросы из раздела «Чтение» занятия.',
        'source_status': 'not_recorded', 'sources': sources,
        'commentary': lesson['lead'], 'commentary_paragraphs': analysis.paragraphs,
        'reading_task': lesson['questions'][0],
        'sections': [
            {'label': label, 'url': url + '#' + section}
            for section, label in [('reading', 'Чтение'), ('analysis', 'Разбор мастерской'),
                                   ('writing', 'Письменное задание'), ('sources', 'Источники')]
        ],
    }


def article_record(card, article):
    """Reuse the published analysis without promoting its source-review status."""
    return {
        'id': card['id'], 'card_id': card['id'], 'kind': 'article',
        'url': card['url'], 'author': card['author'], 'title': card['title'],
        'analysis_title': article['title'],
        'scope': 'Эпизоды и вопросы из опубликованной статьи мастерской о рассказе.',
        'source_status': 'not_recorded', 'source_note': article.get('sources_note', ''),
        'sources': [{'url': source['url'], 'label': source['title'], 'kind': 'work_source'}
                    for source in article['sources']],
        'commentary': article['lead'],
        'commentary_paragraphs': [paragraph for section in article['sections']
                                 for paragraph in section['paragraphs']],
        'reading_task': article['task'],
    }


def after_reading_records(cards, lessons):
    """Return catalogue entries and explicitly linked workshops/articles, once per source."""
    records = catalogue_records()
    by_url = {record['url']: record for record in records}
    workshops = {f'{SITE_URL}/masterskaya/{lesson["slug"]}/': lesson for lesson in lessons}
    articles = {SITE_URL + article['path']: article for article in load_articles()}
    ids = {record['id'] for record in records}
    card_ids = set()
    if len(ids) != len(records):
        raise ValueError('Duplicate reading catalogue ID')
    for card in cards:
        key, url = card['id'], card['url']
        if key in ids or key in card_ids:
            raise ValueError(f'Duplicate reader card ID: {key}')
        card_ids.add(key)
        if url in by_url:
            record = by_url[url]
            if 'card_id' in record:
                raise ValueError(f'Multiple reader cards for {url}')
            record['card_id'] = key
        elif url in workshops:
            record = workshop_record(card, workshops[url])
            records.append(record)
            by_url[url] = record
        elif url in articles:
            record = article_record(card, articles[url])
            records.append(record)
            by_url[url] = record
        else:
            raise ValueError(f'No published reading material for reader card {key}: {url}')
        if record.get('reading_task') and record.get('source_status') != 'blocked':
            record['lens_questions'] = {
                'secular': record['reading_task'],
                'orthodox': AFTER_READING[key],
            }
    return records
