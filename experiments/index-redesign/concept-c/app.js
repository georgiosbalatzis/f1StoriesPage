(function () {
    'use strict';
    var form = document.querySelector('.c-search form');
    var input = document.getElementById('c-query');
    var list = document.getElementById('c-stories');
    var heading = document.getElementById('results-title');
    var status = document.getElementById('c-status');
    var more = document.getElementById('c-more');
    var template = document.getElementById('c-story-template');

    IX.load().then(function (data) {
        var matches = data.stories.slice(0, 8);
        var visible = 8;
        function render() {
            list.replaceChildren();
            matches.slice(0, visible).forEach(function (story) {
                var entry = template.content.cloneNode(true);
                entry.querySelector('.c-story-kicker').textContent = story.categoryLabel + ' · ' + story.dateLabel;
                var link = entry.querySelector('h3 a');
                link.href = story.url;
                link.textContent = story.title;
                entry.querySelector('.c-excerpt').textContent = story.excerpt;
                entry.querySelector('.c-meta').textContent = story.author + ' · ' + story.readingTime;
                list.appendChild(entry);
            });
            more.hidden = visible >= matches.length;
        }
        function search() {
            var query = input.value.trim();
            matches = query ? IX.search(data.stories, query) : data.stories.slice(0, 8);
            visible = query ? 20 : 8;
            heading.textContent = query ? 'Αποτελέσματα αναζήτησης' : 'Πρόσφατες ιστορίες';
            status.textContent = matches.length + ' ιστορίες';
            render();
        }
        input.addEventListener('input', search);
        form.addEventListener('submit', function (event) { event.preventDefault(); search(); });
        more.addEventListener('click', function () { visible += 20; render(); });
        render();
    }).catch(function () {
        // The static discovery links and production search remain available.
    });
}());
