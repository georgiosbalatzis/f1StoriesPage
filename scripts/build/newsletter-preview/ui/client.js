(() => {
    const form = document.querySelector('#signup-form');
    if (!form) return;
    const email = form.elements.email;
    const consent = form.elements.consent;
    const button = form.querySelector('button[type="submit"]');
    const summary = document.querySelector('#error-summary');
    const status = document.querySelector('#signup-status');
    const copy = {
        email: 'Συμπλήρωσε μια έγκυρη διεύθυνση email.',
        consent: 'Χρειάζεται η συγκατάθεσή σου για την εβδομαδιαία ενημέρωση.',
        neutral: 'Αν η διεύθυνση μπορεί να εγγραφεί, θα λάβεις email επιβεβαίωσης. Η εγγραφή ολοκληρώνεται μόνο όταν το επιβεβαιώσεις.',
        unknown: 'Η ενέργεια δεν ήταν δυνατό να ολοκληρωθεί. Τίποτα δεν επιβεβαιώθηκε· δοκίμασε ξανά αργότερα.'
    };
    let pending = false;
    form.noValidate = true;
    if (!summary.hidden) summary.focus();

    function validEmail(value) {
        const address = value.trim();
        if (!address || address.length > 254) return false;
        const parts = address.split('@');
        if (parts.length !== 2 || !parts[0] || parts[0].length > 64 || /[\s\x00-\x1f\x7f<>()\[\]\\,;:"]/.test(parts[0])) return false;
        const labels = parts[1].toLowerCase().split('.');
        return labels.length > 1 && labels.every(label => /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(label)) && /^[a-z]{2,}$/.test(labels.at(-1));
    }
    function showErrors(fields) {
        summary.replaceChildren();
        const list = document.createElement('ul');
        for (const [name, input] of [['email', email], ['consent', consent]]) {
            const error = document.getElementById(`${name}-error`);
            const invalid = fields.includes(name);
            error.hidden = !invalid;
            if (invalid) {
                input.setAttribute('aria-invalid', 'true');
                input.setAttribute('aria-describedby', `${name}-error`);
                const item = document.createElement('li');
                const link = document.createElement('a');
                link.href = `#${name}`;
                link.textContent = copy[name];
                item.append(link);
                list.append(item);
            } else {
                input.removeAttribute('aria-invalid');
                input.removeAttribute('aria-describedby');
            }
        }
        summary.hidden = fields.length === 0;
        if (fields.length) {
            const heading = document.createElement('p');
            heading.textContent = 'Έλεγξε τα παρακάτω πεδία:';
            summary.append(heading, list);
            summary.focus();
        }
    }
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (pending) return;
        const fields = [];
        if (!validEmail(email.value)) fields.push('email');
        if (!consent.checked) fields.push('consent');
        showErrors(fields);
        status.textContent = '';
        if (fields.length) return;
        pending = true;
        button.disabled = true;
        form.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch('/mock/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ email: email.value, consent: consent.checked }), signal: AbortSignal.timeout(10000) });
            if (!response.ok) throw new Error('request-failed');
            const result = await response.json();
            if (result?.result === 'neutral') {
                status.textContent = copy.neutral;
                email.value = '';
                consent.checked = false;
            } else if (result?.result === 'invalid' && Array.isArray(result.errors)) {
                const errors = result.errors.map(error => error.field).filter(field => field === 'email' || field === 'consent');
                if (errors.length) showErrors(errors);
                else status.textContent = copy.unknown;
            } else status.textContent = copy.unknown;
        } catch {
            status.textContent = copy.unknown;
        } finally {
            pending = false;
            button.disabled = false;
            form.removeAttribute('aria-busy');
        }
    });
})();
