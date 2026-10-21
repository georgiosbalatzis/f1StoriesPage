import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

origin = sys.argv[1] if len(sys.argv) > 1 else 'https://f1-stories.gr'
site = 'https://f1-stories.gr'
route = '/blog-module/blog/entities/drivers/lando-norris/'
canonical = site + route
ids = ['20260927G', '20260824W', '20260822W', '20260725W']


def get(path):
    with urllib.request.urlopen(origin + path, timeout=30) as response:
        assert response.status == 200, path
        assert not re.search(r'\b(noindex|none)\b', response.headers.get('X-Robots-Tag', ''), re.I), path
        return response.read().decode('utf-8')


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def meta(self, key):
        values = [a['content'] for t, a in self.tags if t == 'meta' and (a.get('name') == key or a.get('property') == key)]
        assert len(values) == 1, key
        return values[0]

    def canonicals(self):
        return [a['href'] for t, a in self.tags if t == 'link' and 'canonical' in a.get('rel', '').split()]


html = get(route)
page = Page(html)
titles = re.findall(r'<title>(.*?)</title>', html, re.S)
assert titles == ['Λάντο Νόρις — Formula 1, αναλύσεις και ιστορίες | F1 Stories']
assert page.canonicals() == [canonical]
assert re.search('[Α-Ωα-ω]', page.meta('description'))
assert page.meta('og:url') == canonical
assert page.meta('og:type') == 'website'
assert page.meta('twitter:card') == 'summary'
for prefix in ['og:', 'twitter:']:
    assert page.meta(prefix + 'title') == titles[0]
    assert page.meta(prefix + 'description') == page.meta('description')
    assert page.meta(prefix + 'image') == site + '/images/icons/icon-512.png'
assert not re.search(r'noindex|localhost|127\.0\.0\.1|/preview', html, re.I)
assert len([1 for t, a in page.tags if t == 'h1']) == 1
schemas = [json.loads(s) for s in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)]
assert len(schemas) == 1
assert schemas[0]['@context'] == 'https://schema.org'
graph = {n['@type']: n for n in schemas[0]['@graph']}
crumbs = graph['BreadcrumbList']['itemListElement']
assert [c['position'] for c in crumbs] == [1, 2, 3]
assert [c['item'] for c in crumbs] == [site + '/', site + '/blog-module/blog/index.html', canonical]
collection = graph['CollectionPage']
assert collection['url'] == canonical and collection['@id'] == canonical
assert collection['inLanguage'] == 'el' and collection['dateModified'] == '2026-10-21'
assert collection['mainEntity']['@id'] == graph['ItemList']['@id']
assert collection['breadcrumb']['@id'] == graph['BreadcrumbList']['@id']
expected = [site + '/blog-module/blog-entries/' + i + '/article.html' for i in ids]
items = graph['ItemList']['itemListElement']
assert graph['ItemList']['numberOfItems'] == 4
assert [i['position'] for i in items] == [1, 2, 3, 4]
assert [i['url'] for i in items] == expected
for url in expected:
    assert any(t == 'a' and a.get('href') == url for t, a in page.tags)
    assert Page(get(url.removeprefix(site))).canonicals() == [url]
assert '20260928G' not in html
sitemap = ET.fromstring(get('/sitemap.xml'))
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
entity_entries = [e for e in sitemap.findall('s:url', ns) if '/entities/' in e.findtext('s:loc', namespaces=ns)]
assert len(entity_entries) == 1
assert entity_entries[0].findtext('s:loc', namespaces=ns) == canonical
assert entity_entries[0].findtext('s:lastmod', namespaces=ns) == '2026-10-21'
for other in ['drivers/lewis-hamilton', 'teams/ferrari', 'teams/mclaren', 'grands-prix/singapore', 'circuits/sepang']:
    try:
        get('/blog-module/blog/entities/' + other + '/')
    except urllib.error.HTTPError as error:
        assert error.code == 404, (other, error.code)
    else:
        raise AssertionError('Unexpected public entity: ' + other)
assert site + '/sitemap.xml' in get('/robots.txt')
print('PASS: hub HTTP 200, indexable SEO/JSON-LD, sitemap/lastmod, four original article links; other five hubs HTTP 404.')
