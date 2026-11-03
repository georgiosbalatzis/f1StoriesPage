(function () {
    'use strict';
    var root = document.querySelector('.concept-b');
    var preview = root.querySelector('.preview');
    var sheet = root.querySelector('.sheet');
    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function picture(story, eager, full) {
        var img = element('img');
        img.src = full ? story.image : (story.imageCard || story.image);
        img.width = story.imageWidth;
        img.height = story.imageHeight;
        img.alt = '';
        img.decoding = 'async';
        if (!eager) img.loading = 'lazy';
        return img;
    }
    function link(text, url, className) {
        var a = element('a', className, text);
        a.href = url;
        return a;
    }
    function select(story, buttons) {
        preview.replaceChildren();
        var media = element('div', 'preview-media');
        var img = picture(story, true, true);
        media.append(img);
        var copy = element('div', 'preview-copy');
        copy.append(link(story.categoryLabel, story.sectionUrl, 'preview-kicker'));
        var title = element('h3');
        title.append(link(story.title, story.url));
        copy.append(title, element('p', 'excerpt', story.excerpt), link(story.author, story.authorUrl, 'byline'));
        var strip = element('div', 'stat-strip');
        var date = story.date.split('-');
        [[ 'Κατηγορία', story.categoryLabel ], [ 'Δημοσίευση', date[2] + '.' + date[1], date[0] ], [ 'Ανάγνωση', (story.readingTime.match(/\d+/) || [''])[0], 'λεπτά' ]].forEach(function (parts, index) {
            var cell = element('div');
            cell.append(element('span', 'stat-label', parts[0]));
            var value = element('strong', index ? 'stat-number' : 'stat-category', parts[1]);
            if (parts[2]) value.append(element('small', '', ' ' + parts[2]));
            cell.append(value);
            strip.append(cell);
        });
        preview.append(media, copy, strip);
        buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.id === story.id)); });
    }
    IX.load().then(function (data) {
        var buttons = [];
        sheet.replaceChildren();
        data.stories.slice(0, 12).forEach(function (story, index) {
            var item = element('div', 'sheet-item');
            var button = element('button', 'sheet-button');
            button.type = 'button';
            button.dataset.id = story.id;
            button.setAttribute('aria-pressed', 'false');
            var media = element('span', 'sheet-media');
            media.append(picture(story, index < 2, false));
            button.append(media, element('span', 'sheet-title', story.title));
            button.addEventListener('click', function () { select(story, buttons); });
            buttons.push(button);
            item.append(button, link('Άνοιγμα ↗', story.url, 'open-link'));
            sheet.append(item);
        });
        select(data.stories[0], buttons);
        var recent = root.querySelector('.recent-list');
        recent.replaceChildren();
        data.stories.slice(12, 24).forEach(function (story) {
            var a = link('', story.url, 'recent-row');
            a.append(element('span', 'recent-date', story.dateLabel), element('span', 'recent-title', story.title), element('span', 'recent-category', story.categoryLabel), element('span', '', '↗'));
            recent.append(a);
        });
        root.querySelectorAll('[data-category]').forEach(function (slot) {
            var story = data.stories.find(function (item) { return item.id === slot.dataset.category; });
            if (story) slot.append(picture(story, false, false));
        });
        var form = root.querySelector('.search');
        var input = form.querySelector('input');
        var status = root.querySelector('[data-search-status]');
        var list = root.querySelector('[data-search-list]');
        var more = root.querySelector('[data-more]');
        var matches = [];
        var shown = 0;
        function render() {
            list.replaceChildren();
            matches.slice(0, shown).forEach(function (story) {
                var li = element('li');
                li.append(link(story.title, story.url));
                list.append(li);
            });
            more.hidden = shown >= matches.length;
            status.textContent = input.value.trim() ? matches.length + ' αποτελέσματα' : '';
        }
        function search() {
            matches = IX.search(data.stories, input.value);
            shown = 8;
            render();
        }
        input.addEventListener('input', search);
        form.addEventListener('submit', function (event) { event.preventDefault(); search(); });
        more.addEventListener('click', function () { shown += 8; render(); });
    }).catch(function () {});
}());
