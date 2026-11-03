(function () {
    'use strict';
    var $ = function (selector) { return document.querySelector(selector); };
    var make = function (tag, className, value) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (value !== undefined) node.textContent = value;
        return node;
    };
    var link = function (url, value, className) {
        var node = make('a', className, value);
        node.href = url;
        return node;
    };
    var photo = function (story, lazy) {
        var image = make('img');
        image.src = story.image;
        image.width = story.imageWidth;
        image.height = story.imageHeight;
        image.alt = lazy ? '' : story.title;
        image.decoding = 'async';
        if (lazy) image.loading = 'lazy';
        return image;
    };
    IX.load().then(function (data) {
        var months = data.months;
        var selected = 0;
        var select = $('#month-select');
        var ledger = $('#ledger');
        var heading = $('#month-heading');
        var resultBox = $('#search-results');
        var more = $('#more');
        var matches = [];
        var shown = 0;
        var newest = data.stories[0];
        var feature = $('#feature-story');
        var featureLink = link(newest.url, undefined, 'feature-image');
        featureLink.setAttribute('aria-label', newest.title);
        featureLink.append(photo(newest, false));
        var featureBody = make('div', 'feature-body');
        var date = make('div', 'feature-date');
        date.append(make('span', '', newest.date.slice(8, 10) + '.' + newest.date.slice(5, 7)), make('small', '', newest.date.slice(0, 4)));
        var copy = make('div', 'feature-copy');
        copy.append(make('p', 'eyebrow', newest.categoryLabel), make('h2', 'feature-title'), make('p', 'feature-excerpt', newest.excerpt), make('p', 'feature-meta', newest.author + ' · ' + newest.readingTime));
        copy.querySelector('h2').append(link(newest.url, newest.title));
        featureBody.append(date, copy);
        feature.replaceChildren(featureLink, featureBody);
        feature.className = 'feature-grid';

        function renderMonth(index, focus) {
            selected = index;
            var month = months[index];
            var key = month.year + '-' + String(month.month).padStart(2, '0');
            var stories = data.stories.filter(function (story) { return story.date.slice(0, 7) === key; });
            heading.replaceChildren(document.createTextNode(month.label.replace(/\s+\d{4}$/, '') + ' '), make('span', '', String(month.year)));
            select.value = key;
            $('#month-link').href = month.url;
            $('#recent').disabled = index === 0;
            $('#previous').disabled = index === months.length - 1;
            $('#next').disabled = index === 0;
            document.querySelectorAll('[data-month]').forEach(function (button) {
                button.setAttribute('aria-pressed', String(button.dataset.month === key));
            });
            ledger.replaceChildren();
            var dates = Array.from(new Set(stories.map(function (story) { return story.date; })));
            dates.forEach(function (day, dayIndex) {
                var group = make('div', 'day-group');
                var dayTitle = make('h3', 'day-heading');
                var weekday = new Intl.DateTimeFormat('el-GR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
                dayTitle.append(make('span', 'day-number', day.slice(8)), make('span', 'weekday', weekday));
                var entries = make('div', 'day-entries');
                stories.filter(function (story) { return story.date === day; }).forEach(function (story) {
                    var article = make('article', 'entry');
                    var title = make('h4');
                    title.append(link(story.url, story.title));
                    article.append(make('p', 'eyebrow', story.categoryLabel), title, make('p', 'entry-meta', story.author + ' · ' + story.readingTime));
                    entries.append(article);
                });
                group.append(dayTitle, entries);
                ledger.append(group);
                if (dayIndex === 0) {
                    var illustrated = stories.find(function (story) { return story.image && story.url !== newest.url; });
                    if (illustrated) {
                        var interlude = link(illustrated.url, undefined, 'interlude');
                        if (illustrated.category === 'History') interlude.classList.add('history');
                        interlude.append(photo(illustrated, true), make('span', '', illustrated.title));
                        ledger.append(interlude);
                    }
                }
            });
            if (focus) {
                $('#month-status').textContent = month.label + ' · ' + stories.length + ' ιστορίες';
                heading.focus();
            }
        }
        select.disabled = false;
        document.querySelectorAll('[data-month], #previous, #next, #recent').forEach(function (button) { button.hidden = false; });
        select.addEventListener('change', function () { renderMonth(months.findIndex(function (month) { return month.year + '-' + String(month.month).padStart(2, '0') === select.value; }), true); });
        $('#previous').addEventListener('click', function () { if (selected < months.length - 1) renderMonth(selected + 1, true); });
        $('#next').addEventListener('click', function () { if (selected > 0) renderMonth(selected - 1, true); });
        $('#recent').addEventListener('click', function () { renderMonth(0, true); });
        document.querySelectorAll('[data-month]').forEach(function (button) {
            button.addEventListener('click', function () {
                var index = months.findIndex(function (month) { return month.year + '-' + String(month.month).padStart(2, '0') === button.dataset.month; });
                if (index >= 0) renderMonth(index, true);
            });
        });
        renderMonth(0, false);
        function showResults() {
            resultBox.replaceChildren();
            if (!$('#query').value.trim()) { more.hidden = true; return; }
            resultBox.append(make('p', 'result-count', matches.length + ' αποτελέσματα'));
            var list = make('ul', 'results');
            matches.slice(0, shown).forEach(function (story) {
                var item = make('li');
                item.append(link(story.url, story.title), make('small', '', story.dateLabel));
                list.append(item);
            });
            resultBox.append(list);
            more.hidden = shown >= matches.length;
        }
        function search() { matches = IX.search(data.stories, $('#query').value); shown = 5; showResults(); }
        $('#query').addEventListener('input', search);
        document.querySelector('.concept-e form[role="search"]').addEventListener('submit', function (event) { event.preventDefault(); search(); });
        more.addEventListener('click', function () { shown += 5; showResults(); });
    }).catch(function () {
        // The static archive links and production search form remain available.
    });
}());
