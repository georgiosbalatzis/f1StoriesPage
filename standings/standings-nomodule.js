(function () {
    'use strict';

    function showUnsupportedBrowserMessage() {
        var wrapper = document.querySelector('.standings-wrapper .container');
        var error;
        var icon;
        var use;
        var message;
        var hint;

        if (!wrapper) return;

        error = document.createElement('div');
        icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        message = document.createElement('p');
        hint = document.createElement('p');

        error.className = 'standings-error';
        icon.classList.add('icon');
        icon.setAttribute('aria-hidden', 'true');
        use.setAttribute('href', '#fa-exclamation-triangle');
        message.textContent = 'Ο browser δεν υποστηρίζει τη νεότερη έκδοση των βαθμολογιών.';
        hint.style.fontSize = '0.8rem';
        hint.textContent = 'Χρησιμοποίησε έναν σύγχρονο browser για να φορτώσουν τα δεδομένα.';

        icon.appendChild(use);
        error.appendChild(icon);
        error.appendChild(message);
        error.appendChild(hint);
        wrapper.prepend(error);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showUnsupportedBrowserMessage, { once: true });
    } else {
        showUnsupportedBrowserMessage();
    }
})();
