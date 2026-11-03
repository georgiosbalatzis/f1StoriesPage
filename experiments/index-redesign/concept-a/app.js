(function () {
    'use strict';
    var $ = function (selector) { return document.querySelector(selector); };
    function el(tag, className, value) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (value != null) node.textContent = value;
        return node;
    }
    function link(text, href, className) {
        var node = el('a', className, text);
        node.href = href;
        return node;
    }
    function image(src, title, className, eager, width, height) {
        var node = el('img', className);
        node.src = src;
        node.alt = title;
        node.width = width || 1600;
        node.height = height || 900;
        if (!eager) node.loading = 'lazy';
        node.decoding = 'async';
        return node;
    }
    function meta(story) { return story.categoryLabel + ' · ' + story.readingTime; }
    function fill(slot, node) { slot.replaceChildren(node); }
    document.querySelectorAll('.desks a').forEach(function (anchor) {
        anchor.addEventListener('click', function () {
            document.querySelectorAll('.desks a').forEach(function (item) { item.removeAttribute('aria-current'); });
            anchor.setAttribute('aria-current', 'true');
            var target = document.getElementById(anchor.getAttribute('href').slice(1));
            if (target) target.focus({ preventScroll: true });
        });
    });
    IX.load().then(function (data) {
        var stories = data.stories;
        var lead = stories.find(function (s) { return s.category === 'News'; });
        var opinion = stories.find(function (s) { return s.category === 'Opinion'; });
        var technical = stories.filter(function (s) { return s.category === 'Technical'; });
        var leadArticle = el('article', 'lead-story');
        leadArticle.append(image(lead.image, lead.title, 'lead-image', true, lead.imageWidth, lead.imageHeight));
        var leadCopy = el('div', 'lead-copy');
        leadCopy.append(el('p', 'kicker', meta(lead)), el('h2', 'lead-title', lead.title), el('p', 'excerpt', lead.excerpt), el('p', 'byline', lead.author + ' · ' + lead.dateLabel), link('ΔΙΑΒΑΣΕ ΤΗΝ ΙΣΤΟΡΙΑ →', lead.url, 'cta'));
        leadArticle.append(leadCopy);
        fill($('#lead-slot'), leadArticle);
        var wire = document.createDocumentFragment();
        stories.filter(function (s) { return s.id !== lead.id; }).slice(0, 6).forEach(function (story) {
            var item = el('li', 'wire-row');
            var date = el('time', 'wire-date');
            date.dateTime = story.date;
            date.append(el('b', '', story.date.slice(8, 10)), document.createTextNode(story.dateLabel.split(' ')[1].toUpperCase()));
            var copy = el('div');
            var title = el('h4'); title.append(link(story.title, story.url));
            copy.append(el('p', 'kicker', meta(story)), title);
            item.append(date, copy); wire.append(item);
        });
        fill($('#wire-slot'), wire);
        var voice = el('article', 'voice');
        voice.append(image(opinion.image, opinion.title, 'voice-image', false, opinion.imageWidth, opinion.imageHeight));
        var author = data.authors.find(function (a) { return a.slug === opinion.authorSlug; });
        var who = el('p', 'voice-author');
        if (author) who.append(image(author.portrait, '', '', false, 96, 96));
        who.append(document.createTextNode(opinion.author));
        var voiceTitle = el('h4'); voiceTitle.append(link(opinion.title, opinion.url));
        voice.append(who, voiceTitle, el('p', 'kicker', meta(opinion) + ' · ' + opinion.dateLabel));
        fill($('#opinion-slot'), voice);
        var tech = el('div', 'tech-layout');
        var techCopy = el('article', 'tech-copy');
        var techTitle = el('h3'); techTitle.append(link(technical[0].title, technical[0].url));
        techCopy.append(el('p', 'kicker', meta(technical[0])), techTitle, el('p', 'excerpt', technical[0].excerpt), el('p', 'byline', technical[0].author + ' · ' + technical[0].dateLabel), link('ΔΙΑΒΑΣΕ ΤΗΝ ΙΣΤΟΡΙΑ →', technical[0].url, 'cta'));
        var techList = el('ul', 'tech-list');
        technical.slice(1, 3).forEach(function (story) { var item = el('li'); item.append(link(story.title + ' →', story.url)); techList.append(item); });
        techCopy.append(techList);
        tech.append(techCopy, image(technical[0].image, technical[0].title, 'tech-image', false, technical[0].imageWidth, technical[0].imageHeight));
        fill($('#technical-slot'), tech);
        var input = $('#search-q');
        var results = $('.search-results');
        var list = $('#search-list');
        var status = $('#search-status');
        var more = $('#search-more');
        var matches = [];
        var shown = 0;
        function render() {
            list.replaceChildren();
            matches.slice(shown - 6, shown).forEach(function (story) { var item = el('li'); item.append(link(story.title, story.url)); list.append(item); });
            status.textContent = matches.length + ' αποτελέσματα' + (matches.length ? ' · ' + (shown - 5) + '–' + Math.min(shown, matches.length) : '');
            more.hidden = shown >= matches.length;
        }
        function search(showEmpty) {
            var query = input.value.trim();
            results.hidden = !query && !showEmpty;
            matches = IX.search(stories, query);
            shown = 6;
            render();
        }
        input.addEventListener('input', function () { search(false); });
        $('.search').addEventListener('submit', function (event) {
            event.preventDefault();
            search(true);
            status.focus();
        });
        more.addEventListener('click', function () { shown += 6; render(); });
    }).catch(function () {});
}());
