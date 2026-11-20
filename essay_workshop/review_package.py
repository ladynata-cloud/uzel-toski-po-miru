"""Build the same full-draft checker for Pages, a single HTML file and the family ZIP."""
from base64 import b64encode
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

HERE = Path(__file__).parent
SOURCE = HERE / 'full-review'


def build_review_package(destination):
    server = (SOURCE / 'full_review_server.py').read_bytes()
    guide = (SOURCE / 'gigachat-key-guide.gif').read_bytes()
    html = (SOURCE / 'essay-check.html').read_text(encoding='utf-8')
    replacements = {
        '__LOCAL_LAUNCHER_B64__': b64encode(server).decode('ascii'),
        '/*__COACH_WORD_COUNTER__*/': (HERE / 'coach.js').read_text(encoding='utf-8'),
        '__KEY_GUIDE_POSTER__': b64encode((SOURCE / 'gigachat-key-poster.png').read_bytes()).decode('ascii'),
        '__KEY_GUIDE_GIF__': b64encode(guide).decode('ascii'),
    }
    for marker, value in replacements.items():
        if html.count(marker) != 1:
            raise ValueError('Missing or ambiguous essay checker marker: ' + marker)
        html = html.replace(marker, value)
    page = html.encode('utf-8')
    (destination / 'proverka-sochineniya.html').write_bytes(page)
    (destination / 'gigachat-key-guide.gif').write_bytes(guide)
    assets = {'essay-check.html': page, 'full_review_server.py': server, 'gigachat-key-guide.gif': guide}
    for name in ('start-windows.cmd', 'README.txt'):
        assets[name] = (SOURCE / name).read_bytes()
    with ZipFile(destination / 'proverka-gigachat.zip', 'w') as package:
        for name, data in assets.items():
            info = ZipInfo(name)
            info.external_attr = 0o644 << 16
            package.writestr(info, data, compress_type=ZIP_DEFLATED)
