// f1-optimized.js — Homepage-only interactions
// Keeps the home page behavior lightweight and avoids duplicate handlers.
(function () {
    'use strict';

    var contactForm = document.getElementById('contact-form');
    var YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

    function normalizeVideoId(value) {
        var id = String(value || '').trim();
        return YOUTUBE_ID_RE.test(id) ? id : '';
    }

    function initFadeIns() {
        var sections = document.querySelectorAll('.fade-in');
        if (!sections.length) return;

        if (!('IntersectionObserver' in window)) {
            sections.forEach(function (section) {
                section.classList.add('visible');
            });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -80px 0px'
        });

        sections.forEach(function (section) {
            section.classList.add('is-observed');
            observer.observe(section);
        });
    }

    function initContactForm() {
        if (!contactForm) return;

        var nativeSubmit = HTMLFormElement.prototype.submit;

        var validationMessages = {
            name: {
                valueMissing: 'Συμπλήρωσε το όνομά σου.'
            },
            email: {
                valueMissing: 'Συμπλήρωσε το email σου.',
                typeMismatch: 'Συμπλήρωσε ένα έγκυρο email.'
            },
            message: {
                valueMissing: 'Γράψε το μήνυμά σου.'
            }
        };

        function getValidationMessage(field) {
            var messages = validationMessages[field.name] || {};
            if (field.validity.valueMissing && messages.valueMissing) return messages.valueMissing;
            if (field.validity.typeMismatch && messages.typeMismatch) return messages.typeMismatch;
            return '';
        }

        function parseFormResponse(response) {
            return response.text().then(function (text) {
                if (!text) return null;
                try {
                    return JSON.parse(text);
                } catch (_) {
                    return { raw: text };
                }
            });
        }

        Array.prototype.forEach.call(contactForm.querySelectorAll('input, textarea'), function (field) {
            field.addEventListener('invalid', function () {
                field.setCustomValidity(getValidationMessage(field));
            });
            field.addEventListener('input', function () {
                field.setCustomValidity('');
            });
            field.addEventListener('blur', function () {
                if (field.validity.valid) field.setCustomValidity('');
            });
        });

        contactForm.addEventListener('submit', function (event) {
            event.preventDefault();

            var submitButton = contactForm.querySelector('.contact-submit');
            var submitText = contactForm.querySelector('.submit-text');
            var submitSpinner = contactForm.querySelector('.submit-spinner');
            var status = document.getElementById('form-status');
            var success = document.getElementById('form-success');
            var info = document.getElementById('form-info');
            var error = document.getElementById('form-error');
            var submitLabel = submitText.textContent;
            var redirectingForVerification = false;

            if (!submitButton || !submitText || !submitSpinner || !status || !success || !error || !info) return;

            submitButton.disabled = true;
            submitText.style.display = 'none';
            submitSpinner.style.display = 'inline';
            status.style.display = 'none';
            success.style.display = 'none';
            info.style.display = 'none';
            error.style.display = 'none';

            fetch(contactForm.action, {
                method: 'POST',
                body: new FormData(contactForm),
                headers: { Accept: 'application/json' }
            }).then(function (response) {
                return parseFormResponse(response).then(function (data) {
                    status.style.display = 'block';
                    if (response.ok) {
                        success.style.display = 'flex';
                        contactForm.reset();
                    } else {
                        var apiError = data && (data.error || (data.errors && data.errors[0] && data.errors[0].message)) || '';
                        var needsFormspreeVerification = response.status === 403 && /submit via ajax|custom key|recaptcha/i.test(apiError);

                        if (needsFormspreeVerification) {
                            redirectingForVerification = true;
                            submitSpinner.style.display = 'none';
                            submitText.style.display = 'inline';
                            submitText.textContent = 'Μεταφορά...';
                            info.style.display = 'flex';
                            window.setTimeout(function () {
                                nativeSubmit.call(contactForm);
                            }, 350);
                            return;
                        }

                        var msg = (data && data.errors && data.errors.length)
                            ? 'Δεν ήταν δυνατή η αποστολή του μηνύματος.'
                            : 'Παρουσιάστηκε σφάλμα κατά την αποστολή.';
                        var errorText = error.querySelector('span');
                        if (errorText) {
                            var emailLink = document.createElement('a');
                            emailLink.href = 'mailto:myf1stories@gmail.com';
                            emailLink.textContent = 'myf1stories@gmail.com';
                            errorText.replaceChildren(
                                document.createTextNode(msg + ' - ή στείλε email στο '),
                                emailLink
                            );
                        }
                        error.style.display = 'flex';
                    }
                });
            }).catch(function () {
                status.style.display = 'block';
                error.style.display = 'flex';
            }).finally(function () {
                if (redirectingForVerification) return;
                submitButton.disabled = false;
                submitText.style.display = 'inline';
                submitText.textContent = submitLabel;
                submitSpinner.style.display = 'none';
            });
        });
    }

    function initHomeVideoFacade() {
        var facade = document.querySelector('.home-video-facade');
        if (!facade) return;
        facade.addEventListener('click', function () {
            if (facade.dataset.loaded === 'true') return;
            facade.dataset.loaded = 'true';
            var frame = facade.parentElement;
            var id = normalizeVideoId(facade.getAttribute('data-video-id'));
            if (!frame || !id) return;
            var iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1';
            iframe.title = (facade.getAttribute('data-video-title') || 'Επεισόδιο') + ' — F1 Stories';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            frame.replaceChildren(iframe);
        });
    }

    // Team spotlight: the next writer in roster order every twelve seconds, from a random
    // start. The active card's fuse (a 12s CSS animation) drives the rotation, so hover,
    // focus and the pause button only pause that animation and the timing always matches
    // what the reader sees.
    // The section jump bar scrolls sideways. Browsers scroll a focused link in only when it is wholly outside the
    // bar, so one half outside would keep a clipped focus ring: bring every focused link fully into view.
    function initPageIndex() {
        var bar = document.querySelector('.page-index');
        if (!bar) return;
        bar.addEventListener('focusin', function (event) {
            if (event.target.closest('a')) event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
        function edge() { bar.classList.toggle('is-more', bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2); }
        bar.addEventListener('scroll', edge, { passive: true });
        window.addEventListener('resize', edge);
        edge();
    }

    function initTeamSpotlight() {
        var spotlight = document.querySelector('[data-team-spotlight]');
        if (!spotlight) return;
        var cards = Array.prototype.slice.call(spotlight.querySelectorAll('.team-card'));
        var rosterItems = Array.prototype.slice.call(document.querySelectorAll('.team-roster__item'));
        var pause = spotlight.querySelector('[data-team-pause]');
        var current = -1;
        if (cards.length < 2) return;

        function show(index) {
            current = index;
            var slug = cards[index].getAttribute('data-author-slug');
            cards.forEach(function (card, i) {
                card.classList.toggle('is-active', i === index);
            });
            rosterItems.forEach(function (item) {
                var isCurrent = item.getAttribute('data-author-slug') === slug;
                item.classList.toggle('is-current', isCurrent);
                if (isCurrent) item.setAttribute('aria-current', 'true');
                else item.removeAttribute('aria-current');
            });
        }

        // Roster order from a random start, so every writer gets a turn before any repeats.
        function showNext() {
            show((current + 1) % cards.length);
        }

        show(Math.floor(Math.random() * cards.length));
        // Reduced motion: one random writer, no rotation.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        spotlight.addEventListener('animationend', function (event) {
            if (event.animationName === 'team-fuse') showNext();
        });
        spotlight.classList.add('is-rotating');

        if (!pause) return;
        var label = pause.querySelector('.visually-hidden');
        pause.hidden = false;
        pause.addEventListener('click', function () {
            var paused = spotlight.classList.toggle('is-paused');
            pause.setAttribute('aria-pressed', paused ? 'true' : 'false');
            if (label) label.textContent = paused ? 'Συνέχιση εναλλαγής' : 'Παύση εναλλαγής';
            pause.lastElementChild.textContent = paused ? '▶' : '❚❚';
        });
    }

    initFadeIns();
    initContactForm();
    initHomeVideoFacade();
    initTeamSpotlight();
    initPageIndex();
})();
