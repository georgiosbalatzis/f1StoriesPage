import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAMS } from '../teams.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../../standings.css');
const editorial = read('../../standings-editorial.css');
const tokens = read('../../../styles/editorial.css');
const source = read('../../standings.js');
const luminance = hex => hex.match(/[\da-f]{2}/gi).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('fallback initials use theme text on the surface for every team', () => {
    assert.match(css, /\.st-avatar-fallback\s*\{[^}]*color:\s*var\(--st-text\)/);
    assert.match(editorial, /--st-text:\s*var\(--text-primary\)/);
    assert.match(editorial, /--st-surface:\s*var\(--bg-surface\)/);
    assert.match(editorial, /\.st-avatar-fallback\s*\{[^}]*border-bottom:\s*2px solid var\(--team-color\)[^}]*background:\s*var\(--st-surface\)/);
    assert.doesNotMatch(source, /class="st-avatar-fallback"[^']*color:/);
    for (const [text, surface] of [['20251f', 'e9e3d6'], ['eee8db', '242321'], ['eee8df', '242321'], ['1d1d1f', 'f5f5f7'], ['e5e5e7', '161618']]) {
        assert.ok(tokens.includes('#' + text) || css.includes('#' + text), text);
        assert.ok(tokens.includes('#' + surface) || css.includes('#' + surface), surface);
        for (const [team, { color }] of Object.entries(TEAMS)) assert.ok(contrast(text, surface) >= 4.5, `${team} ${color}: ${text}/${surface}`);
    }
});
