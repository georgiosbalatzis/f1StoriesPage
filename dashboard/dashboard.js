// dashboard.js — login shell for /dashboard/. Authentication happens only on the API
// (services/dashboard-api); this page holds no key, token or analytics. The key lives in the
// input until submit and the session cookie is HttpOnly, so nothing here is stored or readable.
(function () {
    'use strict';

    var meta = document.querySelector('meta[name="f1s-dashboard-api"]');
    var api = meta ? meta.getAttribute('content').trim() : '';
    var panels = document.querySelectorAll('[data-state]');
    var form = document.querySelector('.dash-form');
    var input = document.getElementById('dash-key');
    var error = document.querySelector('[data-login-error]');
    var expiry = document.querySelector('[data-session-expiry]');
    var reason = document.querySelector('[data-unavailable-reason]');

    function show(state) {
        panels.forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-state') !== state;
        });
    }

    function unavailable(message) {
        if (message) reason.textContent = message;
        show('unavailable');
    }

    function signedIn(session) {
        var time = new Date(session.expiresAt).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
        expiry.textContent = 'Η συνεδρία λήγει στις ' + time + '.';
        show('signed-in');
    }

    function call(method, body) {
        return fetch(api + '/api/session', {
            method: method,
            credentials: 'include',
            cache: 'no-store',
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body: body ? JSON.stringify(body) : undefined
        });
    }

    // A framed copy could be overlaid to capture the key (meta CSP cannot set frame-ancestors).
    if (window.top !== window.self) return unavailable('Ο πίνακας δεν ανοίγει μέσα σε άλλη σελίδα.');
    // Same-site API only: SameSite cookies are not sent to any other site.
    if (!/^https:\/\/[a-z0-9-]+\.f1-stories\.gr$/.test(api)) return unavailable();

    show('checking');
    call('GET').then(function (res) {
        if (res.status === 200) return res.json().then(signedIn);
        if (res.status === 401) return show('login');
        unavailable('Η υπηρεσία σύνδεσης δεν απαντά σωστά. Δοκίμασε ξανά αργότερα.');
    }).catch(function () {
        unavailable('Η υπηρεσία σύνδεσης δεν είναι προσβάσιμη. Δοκίμασε ξανά αργότερα.');
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        var key = input.value.trim();
        input.value = '';
        error.hidden = true;
        if (!key) {
            error.textContent = 'Γράψε το κλειδί πρόσβασης.';
            error.hidden = false;
            return;
        }
        var button = form.querySelector('button');
        button.disabled = true;
        call('POST', { key: key }).then(function (res) {
            if (res.status === 200) return res.json().then(signedIn);
            error.textContent = res.status === 429
                ? 'Πολλές αποτυχημένες προσπάθειες. Περίμενε λίγα λεπτά.'
                : res.status === 401 ? 'Το κλειδί δεν είναι έγκυρο ή έχει ανακληθεί.' : 'Η σύνδεση απέτυχε. Δοκίμασε ξανά.';
            error.hidden = false;
            input.focus();
        }).catch(function () {
            error.textContent = 'Η υπηρεσία σύνδεσης δεν είναι προσβάσιμη.';
            error.hidden = false;
        }).then(function () {
            button.disabled = false;
        });
    });

    document.querySelector('[data-logout]').addEventListener('click', function () {
        // Only a confirmed logout returns to the form; otherwise the server session may still be open.
        call('DELETE').then(function (res) {
            if (res.status !== 204) throw new Error('logout');
            show('login');
            input.focus();
        }).catch(function () {
            unavailable('Η αποσύνδεση δεν επιβεβαιώθηκε. Η συνεδρία λήγει αυτόματα σε έως 30 λεπτά.');
        });
    });
})();
