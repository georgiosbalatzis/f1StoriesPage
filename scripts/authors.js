(function () {
    'use strict';

    var directory = document.querySelector('[data-author-directory]');
    if (!directory) return;

    var profiles = Array.prototype.slice.call(directory.querySelectorAll('[data-author-slug]'));
    var requested = new URL(window.location.href).searchParams.get('author');
    if (!requested) return;

    function slug(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    var wanted = slug(requested);
    var selected = profiles.find(function (profile) {
        return slug(profile.getAttribute('data-author-slug')) === wanted
            || slug(profile.getAttribute('data-author-name')) === wanted;
    });
    if (!selected) return;

    directory.classList.add('is-focused');
    selected.classList.add('is-selected');
    selected.setAttribute('aria-current', 'page');

    var heading = selected.querySelector('.author-profile__name');
    var name = heading ? heading.textContent.trim() : '';
    if (name && heading) document.title = name + ' | F1 Stories';

    // The page header speaks for the selected author, not the whole directory.
    var title = document.querySelector('.authors-intro h1');
    if (name && title) {
        var accent = title.querySelector('.editorial-accent');
        title.textContent = name;
        if (accent) title.appendChild(accent);
    }
    var desk = selected.querySelector('.author-profile__kicker');
    var folioDesk = document.querySelector('.authors-edition > span:last-child');
    if (desk && folioDesk) {
        folioDesk.textContent = desk.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().normalize('NFC');
    }
    var introCopy = document.querySelector('.authors-intro__copy');
    if (introCopy) introCopy.hidden = true;

    var back = document.querySelector('[data-author-directory-back]');
    if (back) back.hidden = false;

    window.requestAnimationFrame(function () {
        selected.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
}());
