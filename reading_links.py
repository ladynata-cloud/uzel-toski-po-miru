"""Keep a reading page open while the reader visits a source or recording."""
import re
from html.parser import HTMLParser


class Anchor(HTMLParser):
    def handle_starttag(self, tag, attrs):
        self.attrs = dict(attrs)


def open_sources_separately(markup):
    def update(match):
        tag = match.group(0)
        parser = Anchor()
        parser.feed(tag)
        href = parser.attrs.get('href', '')
        if not (href.startswith(('https://', 'http://', '/muzyka/#', '/tsitaty/#'))):
            return tag
        tag = re.sub(r'\s+(?:target|rel)\s*=\s*(?:"[^"]*"|\x27[^\x27]*\x27)', '', tag)
        return tag[:-1] + ' target="_blank" rel="noopener noreferrer">'
    return re.sub(r'<a\b[^>]*>', update, markup)
