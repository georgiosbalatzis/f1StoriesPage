export const PREVIEW_MARKER = 'f1s-newsletter-preview';

export const messages = Object.freeze({
    eyebrow: 'F1 STORIES — ΕΒΔΟΜΑΔΙΑ ΕΝΗΜΕΡΩΣΗ',
    lede: 'Οι σημαντικότερες ιστορίες, οι τεχνικές αναλύσεις και όσα αξίζει να διαβάσεις από την εβδομάδα της Formula 1.',
    neutral: 'Αν η διεύθυνση μπορεί να εγγραφεί, θα λάβεις email επιβεβαίωσης. Η εγγραφή ολοκληρώνεται μόνο όταν το επιβεβαιώσεις.',
    unknown: 'Η ενέργεια δεν ήταν δυνατό να ολοκληρωθεί. Τίποτα δεν επιβεβαιώθηκε· δοκίμασε ξανά αργότερα.',
    email: 'Συμπλήρωσε μια έγκυρη διεύθυνση email.',
    consent: 'Χρειάζεται η συγκατάθεσή σου για την εβδομαδιαία ενημέρωση.'
});

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const themeName = theme => theme === 'light' ? 'light' : 'dark';

function documentPage(title, content, theme) {
    return `<!doctype html><html lang="el" data-theme="${themeName(theme)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="${PREVIEW_MARKER}" content="local"><meta name="robots" content="noindex, nofollow"><title>${escape(title)}</title><link rel="stylesheet" href="/styles/editorial.css"><link rel="stylesheet" href="/ui/styles.css"><script defer src="/ui/client.js"></script></head><body class="editorial-page"><div class="preview-banner">ΤΟΠΙΚΗ ΠΡΟΕΠΙΣΚΟΠΗΣΗ — δεν αποστέλλονται δεδομένα ή email</div><main class="preview-main">${content}</main></body></html>`;
}

function hasError(errors, field) {
    return Array.isArray(errors) ? errors.some(error => error?.field === field) : Boolean(errors?.[field]);
}

export function renderSignupPage({ state = 'idle', errors = {}, email = '', theme = 'dark' } = {}) {
    const invalid = state === 'invalid';
    const emailError = invalid && hasError(errors, 'email');
    const consentError = invalid && hasError(errors, 'consent');
    const summary = invalid ? `<div id="error-summary" class="error-summary" tabindex="-1" autofocus><p>Έλεγξε τα παρακάτω πεδία:</p><ul>${emailError ? '<li><a href="#email">Διεύθυνση email</a></li>' : ''}${consentError ? '<li><a href="#consent">Συγκατάθεση</a></li>' : ''}</ul></div>` : '<div id="error-summary" class="error-summary" tabindex="-1" hidden></div>';
    const status = state === 'neutral' || state === 'unknown' ? messages[state] : '';
    return documentPage('Εβδομαδιαία ενημέρωση | F1 Stories', `<p class="eyebrow">${messages.eyebrow}</p><h1>Η εβδομάδα στη Formula 1.</h1><p class="lede">${messages.lede}</p>${summary}<div id="signup-status" class="status" role="status">${status}</div><form id="signup-form" method="post" action="/mock/signup"><div class="field"><label for="email">Διεύθυνση email</label><input id="email" type="email" name="email" autocomplete="email" inputmode="email" required value="${escape(email)}"${emailError ? ' aria-invalid="true" aria-describedby="email-error"' : ''}><p id="email-error" class="field-error"${emailError ? '' : ' hidden'}>${messages.email}</p></div><div class="field"><div class="consent-row"><input id="consent" type="checkbox" name="consent" value="yes" required${consentError ? ' aria-invalid="true" aria-describedby="consent-error"' : ''}><label for="consent">Συμφωνώ να λαμβάνω το εβδομαδιαίο email ενημέρωσης του F1 Stories (f1-stories.gr), μία φορά την εβδομάδα. Η διεύθυνσή μου θα υποβληθεί σε επεξεργασία από πάροχο email, ο οποίος δεν έχει ακόμη επιλεγεί στην προεπισκόπηση. Απαιτείται επιβεβαίωση μέσω email. Μπορώ να διαγραφώ οποτεδήποτε από τον σύνδεσμο σε κάθε email. <a href="/privacy/privacy.html">Πολιτική Απορρήτου</a>.</label></div><p id="consent-error" class="field-error"${consentError ? '' : ' hidden'}>${messages.consent}</p></div><button type="submit">Αποστολή αιτήματος</button></form><p class="preview-link"><a href="/mock/inbox">Τοπικά μηνύματα προεπισκόπησης</a></p>`, theme);
}

export function renderInboxPage({ messages: inbox = [], theme = 'dark' } = {}) {
    const items = inbox.map(item => {
        const action = item.kind === 'confirmation' ? '/mock/confirm' : '/mock/manage';
        const label = item.kind === 'confirmation' ? 'Επιβεβαίωση' : 'Διαχείριση';
        return `<li><p>${escape(label)} — ${escape(item.to)}</p><form method="post" action="${action}"><input type="hidden" name="token" value="${escape(item.id)}"><button type="submit">${escape(label)}</button></form></li>`;
    }).join('');
    return documentPage('Τοπικά μηνύματα | F1 Stories', `<p class="eyebrow">${messages.eyebrow}</p><h1>Τοπικά μηνύματα</h1><p>Πρόκειται για τοπική προσομοίωση. Δεν στάλθηκε τίποτα.</p><ul class="inbox">${items}</ul><p><a href="/">Επιστροφή στην εγγραφή</a></p>`, theme);
}

export function renderManagePage({ state = 'ready', token = '', theme = 'dark' } = {}) {
    const status = state === 'updated' ? 'Η προτίμησή σου ενημερώθηκε.' : state === 'neutral' ? 'Το αίτημα δεν μπορεί να επιβεβαιωθεί.' : state === 'unknown' ? messages.unknown : '';
    return documentPage('Προτιμήσεις | F1 Stories', `<p class="eyebrow">${messages.eyebrow}</p><h1>Προτιμήσεις ενημέρωσης</h1><div class="status" role="status">${escape(status)}</div>${state === 'ready' ? `<p>Εβδομαδιαία ενημέρωση: ενεργή.</p><form method="post" action="/mock/unsubscribe"><input type="hidden" name="token" value="${escape(token)}"><button type="submit">Διακοπή εγγραφής</button></form>` : ''}<p>Για νέα εγγραφή χρειάζεται νέο αίτημα με συγκατάθεση και επιβεβαίωση.</p>`, theme);
}
