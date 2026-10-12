"""Exam source library: official downloads and attributed practice links."""
import json
from html import escape as e
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / 'exam_resources_data.json').read_text())
PATH = '/k-sochineniyu/materialy/'
ORDER = ['oge-russkiy', 'oge-literatura', 'ege-russkiy', 'ege-literatura', 'itogovoe', 'sobesedovanie']
LABELS = dict(zip(ORDER, ['ОГЭ · русский язык', 'ОГЭ · литература', 'ЕГЭ · русский язык', 'ЕГЭ · литература', 'Итоговое сочинение', 'Итоговое собеседование']))
DESCRIPTIONS = {
    'oge-russkiy': 'Начните с изложения или одного сочинения. В демоверсии найдите задание и критерии его проверки.',
    'oge-literatura': 'Тренируйте ответ по тексту, сопоставление и сочинение. Проверяйте, какие произведения указаны в самом задании.',
    'ege-russkiy': 'Работаем с заданием 27: понимаем позицию автора, объясняем примеры и их связь, обосновываем своё отношение.',
    'ege-literatura': 'Здесь собраны материалы для развёрнутых ответов. Нужные произведения и объём работы определяются конкретным заданием.',
    'itogovoe': 'Это отдельная работа. Выберите тему, найдите литературную опору и проверьте, отвечает ли рассуждение на поставленный вопрос.',
    'sobesedovanie': 'В проекте 2027 года изменился формат. Для подготовки используйте документы 2027 года: чтение, беседа по тексту и монолог.',
}


def documents(slug, role):
    key = 'oge-russkiy' if slug == 'sobesedovanie' else slug
    return [d for d in DATA['documents'] if key in d['tracks'] and d['role'] == role]


def primary_document(slug):
    docs = documents(slug, 'current')
    return next((d for d in docs if d['id'] == 'essay-4'), docs[0])


def size_label(size):
    return (f'{size / 1024 / 1024:.1f} МБ' if size >= 1024 * 1024 else f'{round(size / 1024)} КБ').replace('.', ',')


def download_link(doc, label=None):
    action = label or ('Скачать комплект' if doc['format'] == 'ZIP' else 'Открыть документ')
    return f'<a class="button secondary" href="{e(doc["url"], quote=True)}">{e(action)} · {doc["format"]} · {size_label(doc["size_bytes"])}</a>'


def route_box(slug):
    primary = primary_document(slug)
    practice_name = 'документы ФИПИ или подборку «Решу ЕГЭ / ОГЭ»' if slug in DATA['external'] else 'документы ФИПИ'
    return f'''<section class="exam-resource-callout" id="materials"><p class="eyebrow">Документы и самостоятельная практика</p><h2>Материалы для этой ветки</h2><p>Откройте {practice_name}, выберите задание и вернитесь сюда со своим ответом. Для внешнего задания в черновике есть отдельный режим и поле для ссылки или номера.</p><div class="resource-actions"><a class="button" href="{PATH}#{slug}">Выбрать материалы</a>{download_link(primary)}</div><p class="fine">{'Материалы итогового сочинения — 2026/27 учебный год.' if slug == 'itogovoe' else 'Комплект ФИПИ 2027 пока имеет статус проекта.'} Ссылки проверены 12 октября 2026 года. Внешние страницы открываются в новой вкладке.</p><button class="text-button" type="button" data-exam-open="7">Написать ответ на внешнее задание →</button></section>'''


def hub_callout():
    return f'''<section class="exam-resource-callout"><p class="eyebrow">Всё для одной самостоятельной попытки</p><h2>Документы ФИПИ и задания для практики</h2><p>Демоверсии с критериями, пояснения к формату и подборки «Решу ЕГЭ / ОГЭ». Материалы разложены по предметам и годам.</p><a class="button" href="{PATH}">Открыть материалы</a></section>'''


def doc_card(doc, slug):
    title = doc['title']
    description = doc['description']
    if slug == 'sobesedovanie' and doc['role'] in ('current', 'archive'):
        title = 'Комплект русского языка, включая итоговое собеседование'
        description = 'Распакуйте ZIP и откройте папку «Итоговое собеседование». В ней находятся демоверсия с критериями и спецификация.'
    return f'''<article class="resource-document"><p class="resource-version">{e(doc['status'])}</p><h4>{e(title)}</h4><p>{e(description)}</p>{download_link(doc)}<p class="fine resource-source"><a href="{e(doc['source_page'], quote=True)}">Проверить версию на странице ФИПИ</a></p></article>'''


def section(slug):
    current = ''.join(doc_card(d, slug) for d in documents(slug, 'current'))
    changes = ''.join(doc_card(d, slug) for d in documents(slug, 'changes'))
    extras = ''
    for role, title in [('teacher', 'Для учителя: разбор оценивания, 2026 год'), ('archive', 'Материалы 2026 года для сравнения')]:
        docs = documents(slug, role)
        if slug == 'sobesedovanie' and role == 'teacher':
            continue
        if docs:
            extras += f'<details class="resource-extra"><summary>{title}</summary><p>Это документы 2026 года. Для подготовки к экзамену 2027 года сверяйте требования с его демоверсией: баллы, формулировки и формат могли измениться.</p>' + ''.join(doc_card(d, slug) for d in docs) + '</details>'
    online = ''
    if slug in DATA['external']:
        external = DATA['external'][slug]
        selections = ''.join(f'<li><a href="{e(s["url"], quote=True)}">{e(s["label"])}</a><p>{e(s["help"])}</p></li>' for s in external['selections'])
        exam = slug.split('-')[0]
        online = f'''<h3>Попрактиковаться на «Решу»</h3><ul class="resource-selections">{selections}</ul><p><a href="{external['catalog_url']}">Полный каталог: {e(external['name'])}</a> · <a href="https://fipi.ru/{exam}/otkrytyy-bank-zadaniy-{exam}">Открытый банк ФИПИ</a></p><p class="fine">В просмотренных каталогах «Решу» указан 2026 год; есть и задания прошлых лет. Они подходят для тренировки отдельных умений, но инструкции и критерии для экзамена 2027 года проверяйте по ФИПИ. Ответы и результаты с другого сайта сюда автоматически не переносятся.</p>'''
    year = '2026/27 учебный год' if slug == 'itogovoe' else 'Проект 2027 года'
    return f'''<section class="resource-section" id="{slug}"><p class="eyebrow">{year}</p><h2>{LABELS[slug]}</h2><p>{DESCRIPTIONS[slug]}</p><h3>Документы ФИПИ</h3><div class="resource-documents">{current}</div>{changes}{online}<div class="resource-actions"><a class="button" href="/k-sochineniyu/{slug}/?practice=external#practice">Написать свой ответ</a><a href="/k-sochineniyu/{slug}/#lessons">Сначала пройти занятия мастерской</a></div><p class="fine">Для проверки укажите источник и номер задания. Сохранить ответ или открыть письмо в мастерскую можно в черновике.</p>{extras}</section>'''


def body():
    nav = ''.join(f'<a href="#{slug}">{LABELS[slug]}</a>' for slug in ORDER)
    return f'''<div class="wrap"><div class="breadcrumb"><a href="/k-sochineniyu/">К экзаменам</a><span>/</span>Материалы</div><header class="page-title"><p class="eyebrow">Русский язык и литература · 9 и 11 классы</p><h1>Документы и задания<br>для подготовки</h1><p class="lead">Выберите свой экзамен. Сначала посмотрите требования, затем выполните одно задание и принесите свой ответ в мастерскую.</p></header><nav class="reading-list-nav" aria-label="Выбрать экзамен">{nav}</nav><div class="resource-intro"><div class="context-note"><strong>Проверено 12 октября 2026 года.</strong> Комплекты ОГЭ, ЕГЭ и собеседования 2027 опубликованы ФИПИ как проекты. Итоговое сочинение — по материалам 2026/27. Документы 2026 года показаны отдельно.</div><ol class="resource-steps"><li><strong>Откройте документ.</strong> В демоверсии есть задания и критерии. ZIP нужно распаковать; PDF можно сохранить из окна просмотра.</li><li><strong>Попробуйте сами.</strong> Условия и тексты заданий «Решу» находятся на сайте источника. Сначала напишите свой ответ, затем смотрите разбор.</li><li><strong>Вернитесь к черновику.</strong> Укажите ссылку или год и номер задания. Ответ можно скачать, сохранить в браузере или отправить на проверку по электронной почте.</li></ol><p>Мастерская помогает с устной речью, изложением, анализом и сочинениями. В полных документах и внешних каталогах есть и другие части экзамена.</p><p><a class="button secondary" href="/assets/exams/materialy-i-ssylki.txt" download>Скачать список материалов · TXT</a></p><p class="fine">Документы открываются с официального сайта ФИПИ; задания — на «Решу». Для этих переходов нужен интернет. Скачанный список содержит ссылки, а не копии банков заданий.</p></div><div class="resource-content">{''.join(section(slug) for slug in ORDER)}</div><section class="exam-resource-callout"><h2>Как разобраться в проверке</h2><p>У разных работ разные критерии. Сначала выясните, выполнено ли само задание и есть ли опора на текст. Затем разберите логику и речь. Пометка учителя должна объяснять конкретную ошибку и помогать исправить её.</p><p>Духовная цитата не обязательна и не заменяет литературный пример. Художественные и музыкальные иллюстрации помогают чтению, а экзаменационный ответ строится по условиям задания.</p><p><a href="/k-sochineniyu/">Вернуться к шести маршрутам подготовки</a></p></section></div>'''


def publish(page):
    lines = ['МАТЕРИАЛЫ ДЛЯ ЛИТЕРАТУРНОЙ МАСТЕРСКОЙ', 'Проверено 12 октября 2026 года.', 'ОГЭ и ЕГЭ 2027: проекты ФИПИ. Итоговое сочинение: 2026/27.', 'Файлы по ссылкам открываются на сайте источника. Нужен интернет.', 'Пособия 2026 года не заменяют критерии 2027 года.', '']
    for slug in ORDER:
        lines += [LABELS[slug].upper(), DESCRIPTIONS[slug]]
        for role in ['current', 'changes', 'teacher', 'archive']:
            if slug == 'sobesedovanie' and role == 'teacher':
                continue
            for doc in documents(slug, role):
                lines += [f"{doc['title']} — {doc['status']}", doc['url']]
        external = DATA['external'].get(slug)
        if external:
            lines += [external['name'] + ': каталог просмотрен с маркировкой 2026 года.', external['catalog_url']]
            for item in external['selections']:
                lines += [item['label'], item['url']]
        lines += ['Черновик мастерской: https://usel-toski-po-miru.art/k-sochineniyu/' + slug + '/?practice=external#practice', '']
    file = ROOT / 'dist/assets/exams/materialy-i-ssylki.txt'
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text('\n'.join(lines) + '\n', encoding='utf-8-sig')
    page(PATH, 'Материалы ФИПИ и задания «Решу ЕГЭ / ОГЭ»', 'Документы ФИПИ по русскому языку и литературе, критерии, подборки заданий и черновик для отправки на проверку.', body(), active='exam')
    return [PATH]
