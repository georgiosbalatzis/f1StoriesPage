(function () {
    'use strict';
    var $ = function (s) { return document.querySelector(s); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function link(text, url, cls) { var n = el('a', cls, text); n.href = url; return n; }
    function kind(story) { return story.sectionUrl.split('/').filter(Boolean).pop(); }
    function photo(story, eager) { var n = el('img'); n.src = story.image; n.width = story.imageWidth; n.height = story.imageHeight; n.alt = story.title; n.decoding = 'async'; if (!eager) n.loading = 'lazy'; return n; }
    function kicker(story, withNew) {
        var n = el('p', 'kicker story-kicker'); n.dataset.kind = kind(story);
        n.append(document.createTextNode(story.categoryLabel + ' · ' + story.readingTime));
        if (withNew && story.isNew) n.append(el('span', 'new', 'ΝΕΟ'));
        return n;
    }
    IX.load().then(function (data) {
        var stories = data.stories, newest = stories[0], months = data.months, selected = 0;
        var lead = el('article', 'lead-grid');
        lead.append(photo(newest, true));
        var copy = el('div', 'lead-copy'), leadKicker = kicker(newest, false);
        leadKicker.prepend(el('span', 'square'));
        var leadTitle = el('h2', 'lead-title'); leadTitle.append(link(newest.title, newest.url));
        copy.append(leadKicker, leadTitle, el('p', 'excerpt', newest.excerpt), el('p', 'byline', newest.author + ' · ' + newest.dateLabel), link('ΔΙΑΒΑΣΕ ΤΗΝ ΙΣΤΟΡΙΑ →', newest.url, 'cta'));
        lead.append(copy); $('#lead-slot').replaceChildren(lead);
        var wire = document.createDocumentFragment();
        stories.slice(1, 9).forEach(function (story) {
            var row = el('li', 'wire-row'), date = el('time', 'wire-date'), body = el('div'), title = el('h4');
            date.dateTime = story.date; date.append(el('b', '', story.date.slice(8)), el('span', '', story.dateLabel.split(' ')[1]));
            title.append(link(story.title, story.url)); body.append(kicker(story, true), title, el('p', 'meta', story.author)); row.append(date, body); wire.append(row);
        });
        $('#wire-slot').replaceChildren(wire);
        var opinion = stories.find(function (s) { return s.category === 'Opinion'; });
        if (opinion) {
            var voice = el('article', 'voice'), title = el('h4'), author = data.authors.find(function (a) { return a.slug === opinion.authorSlug; }), byline = el('p', 'voice-author');
            voice.append(photo(opinion, false));
            if (author) { var portrait = el('img'); portrait.src = author.portrait; portrait.alt = ''; portrait.width = 96; portrait.height = 96; portrait.loading = 'lazy'; portrait.decoding = 'async'; byline.append(portrait); }
            byline.append(document.createTextNode(opinion.author)); title.append(link(opinion.title, opinion.url));
            voice.append(byline, title, kicker(opinion, true)); $('#voice-slot').replaceChildren(voice);
        }
        var heading = $('#month-heading'), select = $('#month-select');
        function key(m) { return m.year + '-' + String(m.month).padStart(2, '0'); }
        function renderMonth(index, focus) {
            selected = index; var month = months[index], monthStories = stories.filter(function (s) { return s.date.slice(0, 7) === key(month); });
            heading.replaceChildren(document.createTextNode(month.label.replace(/\s+\d{4}$/, '') + ' '), el('span', '', month.year));
            select.value = key(month); $('#month-link').href = month.url; $('#previous').disabled = index === months.length - 1; $('#next').disabled = index === 0;
            document.querySelectorAll('[data-month]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.month === key(month))); });
            var ledger = $('#ledger'); ledger.replaceChildren();
            var illustrated = monthStories.find(function (s) { return s.image && s.id !== newest.id; });
            Array.from(new Set(monthStories.map(function (s) { return s.date; }))).forEach(function (day, i) {
                var group = el('div', 'day-group'), dayHeading = el('h4', 'day-heading');
                var weekday = new Intl.DateTimeFormat('el-GR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
                dayHeading.append(el('b', '', day.slice(8)), el('span', '', weekday)); var entries = el('div', 'entries');
                monthStories.filter(function (s) { return s.date === day; }).forEach(function (s) { var article = el('article', 'entry'), h = el('h5'); h.append(link(s.title, s.url)); article.append(kicker(s, false), h, el('p', 'meta', s.author + ' · ' + s.readingTime)); entries.append(article); });
                group.append(dayHeading, entries); ledger.append(group);
                if (i === 0 && illustrated) { var figure = link('', illustrated.url, 'interlude'); if (illustrated.category === 'History') figure.classList.add('history'); var img = photo(illustrated, false); img.alt = ''; figure.append(img, el('span', '', illustrated.title)); ledger.append(figure); }
            });
            if (focus) { $('#month-status').textContent = month.label + ' · ' + monthStories.length + ' ιστορίες'; heading.focus(); }
        }
        select.disabled = false; document.querySelectorAll('[data-month], #previous, #next').forEach(function (b) { b.hidden = false; });
        // With the month button visible, its archive link shrinks to the arrow (its aria-label still names the month).
        document.querySelectorAll('.month-cell > a').forEach(function (a) { var arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; a.replaceChildren(arrow); });
        select.addEventListener('change', function () { renderMonth(months.findIndex(function (m) { return key(m) === select.value; }), true); });
        $('#previous').addEventListener('click', function () { if (selected < months.length - 1) renderMonth(selected + 1, true); });
        $('#next').addEventListener('click', function () { if (selected > 0) renderMonth(selected - 1, true); });
        document.querySelectorAll('[data-month]').forEach(function (b) { b.addEventListener('click', function () { renderMonth(months.findIndex(function (m) { return key(m) === b.dataset.month; }), true); }); });
        renderMonth(0, false);
        var matches = [], shown = 0, input = $('#query');
        function renderSearch() {
            var list = $('#search-list'); list.replaceChildren();
            matches.slice(0, shown).forEach(function (story) { var item = el('li'); item.append(link(story.title, story.url)); list.append(item); });
            $('#search-status').textContent = matches.length + ' αποτελέσματα · εμφανίζονται ' + Math.min(shown, matches.length);
            $('#more').hidden = shown >= matches.length;
        }
        function search() { var query = input.value.trim(); $('.search-results').hidden = !query; matches = IX.search(stories, query); shown = 6; renderSearch(); }
        input.addEventListener('input', search); $('.search').addEventListener('submit', function (event) { event.preventDefault(); search(); });
        $('#more').addEventListener('click', function () { shown += 6; renderSearch(); });
    }).catch(function () {});
}());
