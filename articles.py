"""Original articles about individual literary works."""
from datetime import date
from html import escape
import json
from pathlib import Path


ARTICLES_PATH = '/stati/'
ARTICLE_DATA = Path(__file__).with_name('article_data')


def load_articles():
    articles = []
    for file in ARTICLE_DATA.glob('*.json'):
        article = json.loads(file.read_text(encoding='utf-8'))
        article['path'] = ARTICLES_PATH + file.stem + '/'
        article['date'] = date.fromisoformat(article['date'])
        articles.append(article)
    return sorted(articles, key=lambda article: (article['date'], article['path']), reverse=True)


def links(items):
    entries = ''.join(
        f'<li><a href="{escape(item["url"], quote=True)}">{escape(item["title"])}</a></li>'
        for item in items
    )
    return f'<ul>{entries}</ul>'


def home_articles(articles):
    entries = ''.join(
        '<article class="home-reading-item">'
        f'<h3><a href="{article["path"]}">{escape(article["title"])}</a></h3>'
        f'<p>{escape(article["description"])}</p></article>'
        for article in articles[:3]
    )
    return (
        '<section class="section home-reading" aria-labelledby="recent-reading">'
        '<div class="section-top"><h2 id="recent-reading">Новые статьи о литературе</h2>'
        f'<a href="{ARTICLES_PATH}">Все статьи</a></div>{entries}</section>'
    )


def publish_articles(page, articles):
    cards = ''.join(
        f'<section class="reading-list-entry"><h2><a href="{article["path"]}">'
        f'{escape(article["title"])}</a></h2><p>{escape(article["description"])}</p></section>'
        for article in articles
    )
    page(
        ARTICLES_PATH, 'Статьи о литературе',
        'Разборы русской литературы с опорой на текст и заданиями для самостоятельного чтения.',
        '<div class="wrap"><header class="page-title"><h1>Статьи о литературе</h1>'
        '<p class="lead">В каждой статье разбираем один вопрос к произведению и предлагаем '
        'задание для самостоятельного ответа.</p></header>'
        f'<div class="prose">{cards}<p><a href="/filosofiya/">Философская мастерская</a></p></div></div>',
        active='reading',
    )
    for article in articles:
        parts = []
        for section in article['sections']:
            paragraphs = ''.join(f'<p>{escape(text)}</p>' for text in section['paragraphs'])
            parts.append(f'<section><h2>{escape(section["heading"])}</h2>{paragraphs}</section>')
        published = article['date']
        body = (
            f'<div class="wrap"><div class="breadcrumb"><a href="/">Главная</a><span>/</span>'
            f'<a href="{ARTICLES_PATH}">Статьи о литературе</a></div>'
            f'<header class="page-title"><time class="fine" datetime="{published.isoformat()}">'
            f'{published:%d.%m.%Y}</time><h1>{escape(article["title"])}</h1>'
            f'<p class="lead">{escape(article["lead"])}</p></header>'
            f'<article class="prose">{"".join(parts)}'
            f'<section><h2>Самостоятельная работа</h2><p>{escape(article["task"])}</p></section>'
            f'<section><h2>Первичный текст</h2>{links(article["sources"])}</section>'
            f'<section><h2>Продолжить чтение</h2>{links(article["related"])}</section>'
            '<p class="fine">Разбор подготовлен литературной мастерской с помощью ИИ.</p>'
            '</article></div>'
        )
        page(article['path'], article['title'], article['description'], body, active='reading')
    return [ARTICLES_PATH, *(article['path'] for article in articles)]
