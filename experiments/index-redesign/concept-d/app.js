(function () {
    'use strict';
    function el(tag, className, value) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (value != null) node.textContent = value;
        return node;
    }
    function link(story) {
        var a = el('a', '', story.title);
        a.href = story.url;
        return a;
    }
    function meta(story) {
        return el('p', 'meta', story.categoryLabel + ' · ' + story.readingTime);
    }
    function shortDate(story) {
        return story.dateLabel.replace(/\s+\d{4}$/, '').toLocaleUpperCase('el');
    }
    function image(story, lazy) {
        var img = document.createElement('img');
        img.src = story.image;
        img.width = story.imageWidth;
        img.height = story.imageHeight;
        img.alt = story.title;
        img.decoding = 'async';
        if (lazy) img.loading = 'lazy';
        return img;
    }
    function headline(story, level) {
        var h = el(level || 'h3', 'story-title');
        h.append(link(story));
        return h;
    }
    function clear(node) { node.replaceChildren(); }
    IX.load().then(function (data) {
        var stories = data.stories;
        var lead = document.getElementById('lead-stories');
        clear(lead);
        stories.slice(0, 3).forEach(function (story, i) {
            var article = el('article', i === 0 ? 'lead-main' : 'lead-brief');
            if (i === 0) {
                var a = document.createElement('a');
                a.href = story.url;
                a.tabIndex = -1;
                a.setAttribute('aria-hidden', 'true');
                a.append(image(story, false));
                article.append(a);
            }
            article.append(meta(story), headline(story));
            if (i === 0) article.append(el('p', 'excerpt', story.excerpt));
            lead.append(article);
        });
        var wire = document.getElementById('wire-stories');
        clear(wire);
        stories.filter(function (s) { return s.categories.includes('News') && s.id !== stories[0].id; }).slice(0, 8).forEach(function (story) {
            var li = el('li', 'wire-item');
            var time = el('time', 'wire-date', shortDate(story));
            time.dateTime = story.date;
            var body = el('div');
            body.append(meta(story), headline(story, 'h3'));
            li.append(time, body);
            wire.append(li);
        });
        var analysis = document.getElementById('analysis-stories');
        clear(analysis);
        stories.filter(function (s) { return s.categories.includes('Analysis') || s.categories.includes('Technical'); }).slice(0, 6).forEach(function (story, i) {
            var li = el('li', 'analysis-item');
            var body = el('div');
            body.append(meta(story), headline(story, 'h3'));
            li.append(el('span', 'rank', String(i + 1).padStart(2, '0')), body);
            analysis.append(li);
        });
        var history = document.getElementById('history-stories');
        clear(history);
        stories.filter(function (s) { return s.categories.includes('History'); }).slice(0, 4).forEach(function (story) {
            var article = el('article', 'history-item');
            article.append(image(story, true), meta(story), headline(story));
            history.append(article);
        });
        document.querySelectorAll('.department').forEach(function (details) {
            var matches = stories.filter(function (s) { return s.categories.includes(details.dataset.category); });
            var slot = details.querySelector('.department-stories');
            clear(slot);
            var list = el('ul');
            matches.slice(1, 4).forEach(function (story) {
                var li = el('li');
                li.append(link(story), el('span', '', shortDate(story)));
                list.append(li);
            });
            slot.append(list);
            var latest = document.querySelector('[data-latest="' + details.dataset.category + '"]');
            clear(latest);
            if (matches[0]) latest.append(link(matches[0]), el('span', '', shortDate(matches[0])));
        });
        var input = document.getElementById('search-q');
        var heading = document.getElementById('search-heading');
        var output = document.getElementById('search-results');
        var status = document.getElementById('search-status');
        var more = document.getElementById('search-more');
        var results = [];
        var shown = 0;
        function render() {
            clear(output);
            results.slice(0, shown).forEach(function (story) {
                var li = el('li');
                li.append(link(story), el('span', '', story.categoryLabel + ' · ' + story.dateLabel));
                output.append(li);
            });
            more.hidden = shown >= results.length;
        }
        function search(announceEmpty) {
            results = IX.search(stories, input.value);
            shown = 8;
            heading.hidden = !input.value.trim() && !announceEmpty;
            status.textContent = !heading.hidden ? results.length + ' αποτελέσματα' : '';
            render();
        }
        input.addEventListener('input', function () { search(false); });
        input.form.addEventListener('submit', function (event) {
            event.preventDefault();
            search(true);
            heading.focus();
        });
        more.addEventListener('click', function () {
            shown += 8;
            render();
            status.textContent = 'Εμφανίζονται ' + Math.min(shown, results.length) + ' από ' + results.length + ' αποτελέσματα';
        });
    }).catch(function () {});
})();
