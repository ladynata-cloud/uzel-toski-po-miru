"""Create a downloadable, self-contained family edition from the same editor sources."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

HERE = Path(__file__).parent


def build_personal_package(destination, body):
    html = ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Итоговое сочинение · Узел тоски по миру</title>'
            '<style>body{margin:0;background:#f8f7f0}</style></head>'
            '<body><main>' + body + '</main></body></html>')
    assets = {
        'index.html': html.encode('utf-8'),
        'catalog.json': (HERE / 'catalog.json').read_bytes(),
        'system.ru.md': (HERE / 'assistant/system.ru.md').read_bytes(),
    }
    for name in ('server.py', 'README.txt', 'start-windows.cmd'):
        assets[name] = (HERE / 'personal-gigachat' / name).read_bytes()
    with ZipFile(destination, 'w') as package:
        for name, data in assets.items():
            info = ZipInfo(name)
            info.external_attr = 0o644 << 16
            package.writestr(info, data, compress_type=ZIP_DEFLATED)
