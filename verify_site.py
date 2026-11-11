"""Check published routes, anchors, assets and the approved quotation wiring."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, urljoin, unquote
from collections import Counter
import json
import xml.etree.ElementTree as ET
from datetime import datetime
from zoneinfo import ZoneInfo
from site_config import SITE_URL, BASE_PATH, site_path
from seo_metadata import HOMEPAGE_ANALYSES, PAGE_METADATA

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.assets = []
        self.images = []
        self.h1 = 0
        self.radio = 0
        self.quote_links = []
        self.quote_depth = 0
        self.canonicals = []
        self.og_urls = []
        self.titles = []
        self.descriptions = []
        self.schemas = []
        self.head_text = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title' or (tag == 'script' and a.get('type') == 'application/ld+json'):
            self.head_text = []
        if tag == 'meta' and a.get('name') == 'description':
            self.descriptions.append(a.get('content', ''))
        if 'id' in a: self.ids.append(a['id'])
        if tag == 'h1': self.h1 += 1
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
            if self.quote_depth: self.quote_links.append(a['href'])
        if tag in ('script', 'img', 'source', 'iframe', 'audio', 'video') and a.get('src'): self.assets.append(a['src'])
        if a.get('poster'): self.assets.append(a['poster'])
        if tag == 'link' and a.get('rel') in ('stylesheet', 'icon'): self.assets.append(a['href'])
        if tag == 'link' and a.get('rel') == 'canonical': self.canonicals.append(a['href'])
        if tag == 'meta' and a.get('property') == 'og:url': self.og_urls.append(a.get('content'))
        if tag == 'img': self.images.append(a)
        if tag == 'input' and a.get('type') == 'radio': self.radio += 1
        if tag == 'blockquote' and 'sourced-quote' in a.get('class', '').split(): self.quote_depth += 1
    def handle_data(self, data):
        if self.head_text is not None:
            self.head_text.append(data)
    def handle_endtag(self, tag):
        if self.head_text is not None and tag in ('title', 'script'):
            target = self.titles if tag == 'title' else self.schemas
            target.append(''.join(self.head_text))
            self.head_text = None
        if tag == 'blockquote' and self.quote_depth: self.quote_depth -= 1

def verify():
    pages = {}
    errors = []
    for file in OUT.rglob('index.html'):
        route = '/' + str(file.relative_to(OUT).parent).replace('\\', '/') + '/'
        if route == '/./': route = '/'
        p = Page(); p.feed(file.read_text()); pages[route] = p
        if p.canonicals != [SITE_URL + route]: errors.append((route, 'canonical mismatch', p.canonicals))
        if p.og_urls != [SITE_URL + route]: errors.append((route, 'og:url mismatch', p.og_urls))
        if len(p.titles) != 1 or not p.titles[0].strip():
            errors.append((route, 'expected one nonempty title'))
        if len(p.descriptions) != 1 or not p.descriptions[0].strip():
            errors.append((route, 'expected one nonempty description'))
        if route in PAGE_METADATA:
            title, description = PAGE_METADATA[route]
            if p.titles != [title] or p.descriptions != [description]:
                errors.append((route, 'editorial search metadata mismatch'))
        try:
            schema = json.loads(p.schemas[0]) if len(p.schemas) == 1 else {}
        except ValueError:
            schema = {}
        expected_type = 'WebSite' if route == '/' else 'WebPage'
        if not isinstance(schema, dict) or schema.get('@type') != expected_type or schema.get('url') != SITE_URL + route:
            errors.append((route, 'invalid page structured data'))
        if p.h1 != 1: errors.append((route, 'h1 count', p.h1))
        if len(p.ids) != len(set(p.ids)): errors.append((route, 'duplicate ids'))
        if p.radio: errors.append((route, 'multiple-choice input'))
        for img in p.images:
            if not img.get('alt'): errors.append((route, 'image without alt', img.get('src')))
        for target in p.quote_links:
            if not target.startswith('http://www.biblioteka3.ru/biblioteka/citaty/txt'):
                errors.append((route, 'spiritual quote link', target))
    homepage = pages.get('/')
    for route in HOMEPAGE_ANALYSES:
        if route not in pages or homepage is None or site_path(route) not in homepage.links:
            errors.append((route, 'missing priority page or homepage link'))
    sitemap_urls = [node.text for node in ET.parse(OUT/'sitemap.xml').iter() if node.tag.endswith('loc')]
    declared = set(sitemap_urls)
    expected = {SITE_URL + route for route in pages}
    if len(sitemap_urls) != len(declared): errors.append(('duplicate sitemap URLs',))
    if declared != expected: errors.append(('sitemap mismatch', sorted(expected-declared), sorted(declared-expected)))
    if 'Sitemap: ' + SITE_URL + '/sitemap.xml' not in (OUT/'robots.txt').read_text().splitlines():
        errors.append(('robots sitemap mismatch',))
    hostname = urlsplit(SITE_URL).hostname
    cname = OUT/'CNAME'
    if hostname == 'github.io' or hostname.endswith('.github.io') or hostname == 'localhost':
        if cname.exists(): errors.append(('unexpected CNAME on shared hosting',))
    elif not cname.exists() or cname.read_text().strip() != hostname:
        errors.append(('custom domain CNAME mismatch',))
    internal = 0
    def check_target(route, target):
        nonlocal internal
        u = urlsplit(urljoin(SITE_URL + route, target))
        if u.scheme not in ('http', 'https') or u.netloc != urlsplit(SITE_URL).netloc:
            return
        internal += 1
        if BASE_PATH and not u.path.startswith(BASE_PATH + '/'):
            errors.append((route, 'URL escapes deployment path', target))
            return
        path = unquote(u.path[len(BASE_PATH):])
        if path in pages:
            if u.fragment and unquote(u.fragment) not in pages[path].ids:
                errors.append((route, 'missing anchor', target))
        elif not (OUT / path.lstrip('/')).is_file():
            errors.append((route, 'missing route or asset', target))

    for route, p in pages.items():
        for target in p.links + p.assets:
            check_target(route, target)
    # The downloaded guide must send students back to this deployment as well.
    draft_links = [line.removeprefix('Черновик мастерской: ') for line in
                   (OUT/'assets/exams/materialy-i-ssylki.txt').read_text(encoding='utf-8-sig').splitlines()
                   if line.startswith('Черновик мастерской: ')]
    if len(draft_links) != 6: errors.append(('downloaded guide draft links', len(draft_links)))
    for target in draft_links:
        if not target.startswith(SITE_URL + '/'):
            errors.append(('downloaded guide wrong deployment', target))
        check_target('/', target)
    from extra_reading import ESSAYS, CATALOGUE_ESSAYS, CATALOGUE_READINGS, INDEPENDENT_ESSAYS
    from catalogue_continued import DATA, PENDING
    from quote_sources import QUOTES
    from art_library import ART_LIBRARY
    from music import MUSIC
    from exam_tracks import TRACKS, ORDER, GUIDE
    catalogue = json.loads((ROOT/'extra_reading_data.json').read_text())
    assert len(catalogue) == 236
    assert len(DATA) == len({x['id'] for x in DATA}) == 202
    assert {x['source_status'] for x in DATA} <= {'verified', 'limited', 'blocked'}
    complete = {x['catalogue'] for x in CATALOGUE_ESSAYS} | set(CATALOGUE_READINGS)
    assert complete | set(PENDING) == {x['id'] for x in catalogue}
    assert not complete & set(PENDING)
    qids = {q['id'] for q in QUOTES}; mids = {m['id'] for m in MUSIC}
    for x in ESSAYS + CATALOGUE_ESSAYS + INDEPENDENT_ESSAYS:
        assert x['quote'] in qids and x['art'] in ART_LIBRARY and x['music'] in mids
        assert x['paragraphs'] and x.get('scope', 'Полный текст произведения, указанного в заглавии.') and x.get('sources', x.get('source'))
        assert x['reflection'].count('Комментарий мастерской') == 1
        assert '/chtenie/razbory/'+x['slug']+'/' in pages
    assert set(TRACKS) == set(ORDER) and len(TRACKS) == 6
    assert GUIDE in pages
    for slug, track in TRACKS.items():
        assert len(track['lessons']) == 6
        exam_page = pages[f'/k-sochineniyu/{slug}/']
        assert all(f'lesson-{i}' in exam_page.ids for i in range(1, 7))
        assert {'practice', 'worked-case', 'sources', 'lens', 'repair'} <= set(exam_page.ids)
        assert track['sources'] and track['final_practice']['checks']
    report = dict(checked_on=datetime.now(ZoneInfo('Asia/Novosibirsk')).date().isoformat(), site_url=SITE_URL+'/', base_path=BASE_PATH,
                  pages=len(pages), internal_links_and_assets=internal,
                  supplementary_articles=len(ESSAYS)+len(CATALOGUE_ESSAYS)+len(INDEPENDENT_ESSAYS),
                  catalogue_positions_with_scoped_analysis=len(complete),
                  catalogue_positions_waiting_for_primary_text=len(PENDING),
                  quotation_fragments=len(QUOTES), human_artworks=len(ART_LIBRARY),
                  exam_branches=len(TRACKS), exam_lessons=sum(len(t['lessons']) for t in TRACKS.values()),
                  new_source_status=dict(Counter(x['source_status'] for x in DATA)), errors=errors,
                  limits=['No browser rendering or external audio playback check.',
                          'Source availability and scope retained per article; no claim of full-book coverage.'])
    if errors:
        print(json.dumps(report, ensure_ascii=False, indent=2)); raise SystemExit(1)
    (ROOT/'verification_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__': verify()
