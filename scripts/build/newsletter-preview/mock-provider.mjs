import { createHash, randomBytes } from 'node:crypto';
import model from '../../../blog-module/build/newsletter/model.js';

export function createMockProvider({ now = () => 0, rateLimit = { max: 5 } } = {}) {
    const records = new Map();
    const tokens = new Map();
    const outbox = [];
    let submissions = 0;
    const hash = email => createHash('sha256').update(email.toLowerCase()).digest('hex');
    const synthetic = email => /@(?:example\.(?:com|org|net)|(?:[a-z0-9-]+\.)*(?:test|invalid))$/i.test(email);
    records.set(hash('suppressed@example.com'), 'suppressed');
    function message(key, to, kind) {
        const token = randomBytes(18).toString('base64url');
        tokens.set(token, { key, kind });
        outbox.push({ id: token, kind, to });
    }
    const state = email => records.get(hash(email)) || 'none';
    const change = (key, event) => records.set(key, model.transition(records.get(key) || 'none', event));
    const adapter = {
        async submit(request, { signal }) {
            const email = request.email;
            if (!synthetic(email)) throw Object.assign(new Error('non-synthetic-address'), { code: 'non-synthetic-address' });
            if (++submissions > rateLimit.max) return { kind: 'rate-limited' };
            if (email.toLowerCase() === 'timeout@example.com') return new Promise((resolve, reject) => {
                if (signal.aborted) return reject(new Error('aborted'));
                signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            });
            if (email.toLowerCase() === 'error@example.com') throw new Error('mock error');
            if (email.toLowerCase() === 'malformed@example.com') return {};
            const key = hash(email);
            const previous = records.get(key) || 'none';
            change(key, 'request');
            if (records.get(key) === 'pending' && (previous !== 'pending' || ![...tokens.values()].some(item => item.key === key && item.kind === 'confirmation'))) message(key, email, 'confirmation');
            return { kind: ['none', 'expired', 'unsubscribed'].includes(previous) ? 'accepted' : previous };
        },
        async preferences(authorization, update) {
            const entry = tokens.get(authorization);
            if (!entry || entry.kind !== 'management') return { kind: 'invalid-authorization' };
            if (update?.briefing !== false) return { kind: 'error' };
            change(entry.key, 'unsubscribe');
            tokens.delete(authorization);
            return { kind: 'updated' };
        },
        async unsubscribe(authorization) { return this.preferences(authorization, { briefing: false }); }
    };
    function confirm(token) {
        const entry = tokens.get(token);
        if (!entry || entry.kind !== 'confirmation' || records.get(entry.key) !== 'pending') return { kind: 'invalid-authorization' };
        change(entry.key, 'confirm');
        tokens.delete(token);
        const original = outbox.find(item => item.id === token);
        message(entry.key, original.to, 'management');
        return { kind: 'updated' };
    }
    function expireAll() {
        now();
        for (const [key, value] of records) {
            if (value !== 'pending') continue;
            change(key, 'expire');
            // An expired request loses its confirmation authority: a later re-signup must be confirmed with its own token.
            for (const [token, entry] of tokens) if (entry.key === key && entry.kind === 'confirmation') tokens.delete(token);
        }
    }
    return { adapter, outbox, confirm, expireAll, state, isManagementToken: token => tokens.get(token)?.kind === 'management' };
}
