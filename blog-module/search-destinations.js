// Shared data validation in Node; query-only loading and rendering in the browser.
(function() {
    const SITE = 'https://f1-stories.gr';
    const TOOLS = {
        standings: SITE + '/standings/',
        telemetry: 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/',
        ghostcar: 'https://georgiosbalatzis.github.io/ghostcar/',
        tyres: 'https://georgiosbalatzis.github.io/Tyres/',
        betcast: 'https://georgiosbalatzis.github.io/BetCastVisualisation/'
    };
    const HUB = /^\/blog-module\/blog\/entities\/(drivers|teams|circuits|grands-prix)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/;
    const TYPES = { drivers: 'driver', teams: 'team', circuits: 'circuit', 'grands-prix': 'grand-prix' };
    const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ');
    const bounded = (value, max) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;

    function destination(record) {
        if (!bounded(record.href, 200)) throw new Error('Invalid search destination');
        const url = new URL(record.href, SITE);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid search URL');
        const hub = HUB.exec(record.href);
        if (record.type === 'entity' ? !hub || record.id !== TYPES[hub[1]] + ':' + hub[2]
            : record.type !== 'tool' || TOOLS[record.id] !== record.href) throw new Error('Unreviewed search destination');
        return url.href;
    }
    function validateIndex(data) {
        if (!data || data.v !== 1 || !Array.isArray(data.records) || data.records.length > 32
            || Object.keys(data).sort().join() !== 'records,v') throw new Error('Invalid search index');
        const ids = new Set(), urls = new Set();
        for (const record of data.records) {
            if (!record || Object.keys(record).sort().join() !== 'aliases,href,id,label,type'
                || !bounded(record.id, 100) || !/^[a-z0-9]+(?:[-:][a-z0-9]+)*$/.test(record.id)
                || !bounded(record.label, 160) || !Array.isArray(record.aliases) || record.aliases.length > 20
                || !record.aliases.every(alias => bounded(alias, 100))) throw new Error('Invalid search record');
            const url = destination(record);
            if (ids.has(record.id) || urls.has(url)) throw new Error('Duplicate search ID or destination');
            const aliases = record.aliases.map(normalize);
            if (new Set(aliases).size !== aliases.length || aliases.includes(normalize(record.label))) throw new Error('Duplicate search alias');
            ids.add(record.id); urls.add(url);
        }
        return data;
    }
    function matches(data, query) {
        const q = normalize(query.trim());
        return q ? data.records.filter(record => [record.label, ...record.aliases].some(term => normalize(term).includes(q))) : [];
    }

    let cached, pending, generation = 0;
    function load() {
        if (cached) return Promise.resolve(cached);
        if (pending) return pending;
        const current = generation;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 300);
        pending = fetch('/blog-module/search-destinations.json', { cache: 'no-store', signal: controller.signal })
            .then(response => { if (!response.ok) throw new Error('Search unavailable'); return response.json(); })
            .then(validateIndex).then(data => { if (current === generation) cached = data; return data; })
            .finally(() => { clearTimeout(timer); if (current === generation) pending = null; });
        return pending;
    }
    async function prepare(state, el) {
        let records = [], available = true;
        try { records = matches(await load(), state.q); } catch (_) { available = false; }
        return (view, articlesOK, total) => {
            const container = view.firstElementChild;
            const articleHeading = view.querySelector('#ed-list-title');
            if (articleHeading) articleHeading.textContent = 'Άρθρα';
            const sections = ['entity', 'tool'].map((type, i) => {
                const found = records.filter(record => record.type === type);
                return found.length ? el('section', { class: 'ed-destinations', 'aria-labelledby': 'search-' + type }, [
                    el('h2', { class: 'ed-label', id: 'search-' + type, text: i ? 'Εργαλεία' : 'Θέματα' }),
                    el('ul', {}, found.map(record => el('li', {}, [el('a', { href: record.href }, [record.label,
                        record.type === 'tool' && new URL(record.href).origin !== SITE
                            ? el('span', { class: 'ed-meta', text: ' — Εξωτερική εφαρμογή (georgiosbalatzis.github.io)' }) : null])])))
                ]) : null;
            }).filter(Boolean);
            if (articlesOK && !total && records.length) {
                const empty = view.querySelector('.ed-empty');
                empty.textContent = 'Δεν βρέθηκαν άρθρα για αυτή την αναζήτηση.';
                container.querySelector('.ed-columns').replaceChildren(el('section', { class: 'ed-list', 'aria-labelledby': 'ed-list-title' }, [
                    el('h2', { class: 'ed-label', id: 'ed-list-title', text: 'Άρθρα' }), empty
                ]));
            }
            if (state.category || state.author) sections.push(el('p', { class: 'ed-meta', text: 'Τα φίλτρα ενότητας και συντάκτη εφαρμόζονται μόνο στα άρθρα.' }));
            if (!available) sections.push(el('p', { role: 'status', text: articlesOK
                ? 'Δεν ήταν δυνατή η φόρτωση θεμάτων και εργαλείων. Τα αποτελέσματα άρθρων εμφανίζονται παρακάτω.'
                : 'Δεν ήταν δυνατή η πλήρης αναζήτηση. Δοκίμασε ξανά σε λίγο.' }));
            // The runtime commits the entire view once; no late insertion above article rows.
            if (articlesOK) container.querySelector('.ed-columns').before(...sections);
            else view.prepend(el('h1', { class: 'ed-section__title', text: '«' + state.q + '»' }), ...sections);
        };
    }
    const api = { normalize, destination, validateIndex, matches, prepare, reset: () => { generation++; cached = pending = null; } };
    if (typeof module !== 'undefined') module.exports = api;
    else window.F1S_SEARCH = api;
})();
