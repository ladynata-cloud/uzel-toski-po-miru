"""Deployment address shared by the builder and its link checks."""
import os
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit


SITE_URL = os.environ.get(
    'SITE_URL', 'https://ladynata-cloud.github.io/uzel-toski-po-miru/'
).strip().rstrip('/')
_url = urlsplit(SITE_URL)
if (_url.scheme not in ('http', 'https') or not _url.hostname
        or _url.username or _url.password or _url.query or _url.fragment
        or any(part in ('.', '..') for part in _url.path.split('/'))
        or '//' in _url.path):
    raise ValueError('SITE_URL must be an absolute HTTP(S) site address without query or fragment')

BASE_PATH = _url.path


def site_path(path):
    """Prefix a source route with the deployment path; preserve external URLs."""
    if not path.startswith('/') or path.startswith('//'):
        return path
    if BASE_PATH and (path == BASE_PATH or path.startswith(BASE_PATH + '/')):
        return path
    return BASE_PATH + path


class _StartTags(HTMLParser):
    """Record source tags so that rewriting URLs preserves all other markup."""
    def __init__(self, markup):
        super().__init__(convert_charrefs=False)
        self.offsets = [0]
        for line in markup.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.replacements = []

    def handle_starttag(self, tag, attrs):
        original = self.get_starttag_text()
        updated = re.sub(
            r'''(\s(?:href|src|action|poster)\s*=\s*)(["'])(/(?!/)[^"']*)\2''',
            lambda m: m[1] + m[2] + site_path(m[3]) + m[2],
            original, flags=re.IGNORECASE,
        )
        if updated != original:
            line, column = self.getpos()
            start = self.offsets[line - 1] + column
            self.replacements.append((start, start + len(original), updated))


def deployment_links(markup):
    if not BASE_PATH:
        return markup
    parser = _StartTags(markup)
    parser.feed(markup)
    for start, end, replacement in reversed(parser.replacements):
        markup = markup[:start] + replacement + markup[end:]
    return markup


def write_domain_file(output):
    """CNAME is meaningful only for a custom hostname, never for github.io."""
    cname = output / 'CNAME'
    if _url.hostname == 'github.io' or _url.hostname.endswith('.github.io') or _url.hostname == 'localhost':
        cname.unlink(missing_ok=True)
    else:
        cname.write_text(_url.hostname + '\n', encoding='utf-8')
