const STATES = Object.freeze(['none', 'pending', 'active', 'expired', 'unsubscribed', 'suppressed']);
const EVENTS = Object.freeze(['request', 'confirm', 'expire', 'unsubscribe', 'suppress', 'erase']);
const PUBLIC_RESULTS = Object.freeze(['neutral', 'unknown']);

function transition(state, event) {
    function fail(code) { throw Object.assign(new Error(code), { code }); }
    if (!STATES.includes(state)) fail('unknown-state');
    if (!EVENTS.includes(event)) fail('unknown-event');
    if (event === 'suppress') return 'suppressed';
    if (event === 'erase') return state === 'suppressed' ? 'suppressed' : 'none';
    if (event === 'request') return state === 'active' || state === 'suppressed' ? state : 'pending';
    if (state === 'pending' && event === 'confirm') return 'active';
    if (state === 'pending' && event === 'expire') return 'expired';
    if ((state === 'pending' || state === 'active') && event === 'unsubscribe') return 'unsubscribed';
    fail('invalid-transition');
}

function validateEmail(value) {
    if (typeof value !== 'string' || !value.trim()) return { ok: false, code: 'email-missing' };
    const email = value.trim();
    if (email.length > 254) return { ok: false, code: 'email-too-long' };
    const parts = email.split('@');
    if (parts.length !== 2 || !parts[0] || parts[0].length > 64 || /[\s\u0000-\u001f\u007f-\u009f<>()\[\]\\,;:"]/.test(parts[0])) {
        return { ok: false, code: 'email-invalid' };
    }
    const domain = parts[1].toLowerCase();
    const labels = domain.split('.');
    if (labels.length < 2 || !labels.every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
        || !/^[a-z]{2,}$/.test(labels[labels.length - 1])) return { ok: false, code: 'email-invalid' };
    return { ok: true, email: `${parts[0]}@${domain}` };
}

function validateSignupInput(input, { policyVersion, sourceForm }) {
    if (typeof policyVersion !== 'string' || !policyVersion.trim() || typeof sourceForm !== 'string' || !sourceForm.trim()) {
        throw new Error('newsletter: policyVersion and sourceForm are required');
    }
    const email = validateEmail(input && input.email);
    const errors = [];
    if (!email.ok) errors.push({ field: 'email', code: email.code });
    if (!input || input.consent !== true) errors.push({ field: 'consent', code: 'consent-required' });
    if (errors.length) return { ok: false, errors };
    return { ok: true, request: { email: email.email, consent: { newsletter: 'weekly-briefing', policyVersion, sourceForm } } };
}

function publicSignupResult(outcome) {
    return outcome && ['accepted', 'duplicate', 'pending', 'active', 'suppressed'].includes(outcome.kind) ? 'neutral' : 'unknown';
}

async function requestSignup(adapter, input, { policyVersion, sourceForm, timeoutMs = 8000 }) {
    const validated = validateSignupInput(input, { policyVersion, sourceForm });
    if (!validated.ok) return { result: 'invalid', errors: validated.errors };
    const controller = new AbortController();
    let timer;
    try {
        const timeout = new Promise(resolve => {
            timer = setTimeout(() => { resolve(null); controller.abort(); }, timeoutMs);
        });
        const outcome = await Promise.race([Promise.resolve().then(() => adapter.submit(validated.request, { signal: controller.signal })), timeout]);
        return { result: publicSignupResult(outcome) };
    } catch (_) {
        return { result: 'unknown' };
    } finally {
        clearTimeout(timer);
    }
}

function managementResult(outcome) {
    if (outcome && outcome.kind === 'updated') return 'updated';
    if (outcome && ['invalid-authorization', 'expired-authorization'].includes(outcome.kind)) return 'neutral';
    return 'unknown';
}

function validatePreferenceUpdate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'briefing')
        || !Object.hasOwn(input, 'briefing') || (input.briefing !== true && input.briefing !== false)) {
        return { ok: false, errors: [{ field: 'briefing', code: 'preference-unknown' }] };
    }
    if (input.briefing === true) return { ok: false, errors: [{ field: 'briefing', code: 'resubscribe-requires-consent' }] };
    return { ok: true, update: { briefing: false } };
}

module.exports = { STATES, EVENTS, transition, validateEmail, validateSignupInput, PUBLIC_RESULTS,
    publicSignupResult, requestSignup, managementResult, validatePreferenceUpdate };
