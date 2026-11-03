import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONFIG_PATH = path.join(root, 'data/audience/newsletter.v1.json');
export const EVIDENCE_KEYS = Object.freeze(['provider-approval', 'provider-account-configuration', 'processor-dpa-transfer-review', 'dpia-decision', 'legal-review-consent-privacy', 'privacy-notice-update', 'retention-deletion', 'double-opt-in-verified', 'unsubscribe-suppression-verified', 'preference-management-verified', 'csp-endpoint-review', 'domain-authentication', 'operator-incident-owner', 'security-abuse-tests', 'accessibility-no-js', 'aggregate-reporting', 'rollback-plan', 'launch-authorization']);
export function loadNewsletterConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}
export function validateNewsletterConfig(config) {
    const errors = [];
    const add = (code, detail) => errors.push({ code, detail });
    const shape = (value, keys, label) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            add('invalid-shape', label);
            return false;
        }
        if (Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) add('invalid-shape', label);
        return true;
    };
    const nonempty = value => typeof value === 'string' && value.trim().length > 0;
    if (!shape(config, ['version', 'enabled', 'provider', 'review', 'evidence'], 'config')) return { errors };
    if (config.version !== 1) add('invalid-version', 'version');
    if (typeof config.enabled !== 'boolean') add('invalid-enabled', 'enabled');
    if (config.provider !== null && shape(config.provider, ['id', 'name'], 'provider') && (!nonempty(config.provider.id) || !nonempty(config.provider.name))) add('invalid-provider', 'provider');
    if (shape(config.review, ['status'], 'review') && !['pending', 'approved'].includes(config.review.status)) add('invalid-review', 'review.status');
    if (shape(config.evidence, EVIDENCE_KEYS, 'evidence')) {
        for (const key of EVIDENCE_KEYS) {
            const item = config.evidence[key];
            if (!item || typeof item !== 'object' || Array.isArray(item)) { add('invalid-evidence', key); continue; }
            if (item.status === 'open') shape(item, ['status'], key);
            else if (item.status === 'complete') {
                shape(item, ['status', 'by', 'date', 'reference'], key);
                const date = item.date;
                const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : new Date(NaN);
                const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
                if (!nonempty(item.by) || /synthetic/i.test(item.by) || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date || date > today || !nonempty(item.reference) || /@|https?:\/\/\S*\?/i.test(item.reference)) add('invalid-evidence', key);
            } else add('invalid-evidence', key);
            if (config.enabled === true && item.status === 'open') add('evidence-open', key);
        }
    }
    if (config.enabled === true) {
        if (config.provider === null) add('provider-required', 'provider');
        if (config.review?.status !== 'approved') add('review-required', 'review');
        add('production-adapter-unavailable', 'production adapter unavailable');
    }
    return { errors };
}
export function validateNewsletterArtifact({ distRoot }) {
    const errors = [];
    const markers = ['f1s-newsletter-preview', '/mock/signup', '/mock/confirm', '/mock/manage', '/mock/unsubscribe', 'newsletter.v1.json', 'name="consent"', 'data-newsletter'];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, entry.name);
            const rel = path.relative(distRoot, abs).split(path.sep).join('/');
            // Only newsletter-named paths and an exact `mock` segment: "preview-…" article slugs are legitimate; content markers catch preview leaks.
            if (/(^|\/)newsletter(\/|[.-]|$)/i.test(rel) || /(^|\/)mock(\/|$)/i.test(rel)) errors.push({ code: 'forbidden-path', detail: rel });
            if (entry.isSymbolicLink()) errors.push({ code: 'forbidden-symlink', detail: rel });
            else if (entry.isDirectory()) walk(abs);
            else if (entry.isFile() && /\.(?:html|js|css|json|xml|txt)$/i.test(rel)) {
                const content = fs.readFileSync(abs, 'utf8');
                for (const marker of markers) if (content.includes(marker)) errors.push({ code: 'forbidden-marker', detail: `${rel}: ${marker}` });
            }
        }
    }
    walk(distRoot);
    return { errors };
}
function cli(args) {
    if (args.length && (args.length !== 2 || args[0] !== '--artifact' || !args[1])) { console.error('Usage: node newsletter-gate.mjs [--artifact <dir>]'); return 2; }
    try {
        const config = loadNewsletterConfig();
        const errors = validateNewsletterConfig(config).errors;
        if (config.enabled !== false) errors.push({ code: 'newsletter-not-disabled', detail: 'enabled must be false' });
        if (args.length) errors.push(...validateNewsletterArtifact({ distRoot: args[1] }).errors);
        for (const error of errors) console.error(`${error.code}: ${error.detail}`);
        return errors.length ? 1 : 0;
    } catch (error) { console.error(`newsletter-gate: ${error.message}`); return 1; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = cli(process.argv.slice(2));
