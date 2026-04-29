#!/usr/bin/env node

import { execSync } from 'node:child_process';

const REQUIRED_ENV = [
    'SPOTIFY_CREATORS_EMAIL',
    'SPOTIFY_CREATORS_PASSWORD',
    'VOICE_REF_BUNDLE_URL'
];

const OPTIONAL_ENV = [
    'SPOTIFY_SHOW_URL',
    'SPOTIFY_SHOW_ID',
    'VOICE_REF_BUNDLE_SHA256',
    'VOICE_PROFILE_ID'
];

function maskValue(value) {
    if (!value) return '(missing)';
    const text = String(value);
    if (text.length <= 8) return '*'.repeat(text.length);
    return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function hasGpu() {
    try {
        const output = execSync('nvidia-smi -L', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        return output ? output : null;
    } catch (_) {
        return null;
    }
}

function parseUrl(raw) {
    try {
        return new URL(String(raw || '').trim());
    } catch (_) {
        return null;
    }
}

function validateSpotifyShow(env, issues) {
    const showUrl = env.SPOTIFY_SHOW_URL;
    const showId = env.SPOTIFY_SHOW_ID;

    if (!showUrl && !showId) {
        issues.push('Provide one of SPOTIFY_SHOW_URL or SPOTIFY_SHOW_ID.');
        return;
    }

    if (showUrl) {
        const url = parseUrl(showUrl);
        if (!url) {
            issues.push('SPOTIFY_SHOW_URL is not a valid URL.');
            return;
        }
        const host = url.hostname.toLowerCase();
        if (!host.endsWith('spotify.com')) {
            issues.push('SPOTIFY_SHOW_URL must point to a Spotify domain.');
        }
    }

    if (showId && !/^[a-zA-Z0-9]+$/.test(String(showId))) {
        issues.push('SPOTIFY_SHOW_ID should contain only letters and digits.');
    }
}

function validateVoiceBundle(env, issues) {
    const bundleUrl = env.VOICE_REF_BUNDLE_URL;
    if (!String(bundleUrl || '').trim()) return;
    const url = parseUrl(bundleUrl);
    if (!url) {
        issues.push('VOICE_REF_BUNDLE_URL is not a valid URL.');
        return;
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        issues.push('VOICE_REF_BUNDLE_URL must use http or https.');
    }

    if (env.VOICE_REF_BUNDLE_SHA256 && !/^[a-fA-F0-9]{64}$/.test(String(env.VOICE_REF_BUNDLE_SHA256).trim())) {
        issues.push('VOICE_REF_BUNDLE_SHA256 must be a 64-character hex SHA256.');
    }
}

function main() {
    const env = process.env;
    const missing = REQUIRED_ENV.filter(name => !String(env[name] || '').trim());
    const issues = [];

    validateSpotifyShow(env, issues);
    validateVoiceBundle(env, issues);

    console.log('Spotify narration Phase 0 check');
    console.log('================================');
    console.log('');
    console.log('Required secrets/inputs');
    REQUIRED_ENV.forEach(name => {
        console.log(`- ${name}: ${maskValue(env[name])}`);
    });
    console.log(`- SPOTIFY_SHOW_URL: ${maskValue(env.SPOTIFY_SHOW_URL)}`);
    console.log(`- SPOTIFY_SHOW_ID: ${maskValue(env.SPOTIFY_SHOW_ID)}`);
    console.log('');
    console.log('Optional inputs');
    OPTIONAL_ENV.filter(name => !['SPOTIFY_SHOW_URL', 'SPOTIFY_SHOW_ID'].includes(name)).forEach(name => {
        console.log(`- ${name}: ${maskValue(env[name])}`);
    });
    console.log('');

    const gpuInfo = hasGpu();
    if (gpuInfo) {
        console.log('Runner GPU');
        console.log(`- detected: ${gpuInfo}`);
    } else {
        console.log('Runner GPU');
        console.log('- detected: none');
        console.log('- note: cloned-voice Coqui synthesis will run slower on CPU-only runners');
    }
    console.log('');

    if (missing.length) {
        console.log('Missing required secrets/inputs');
        missing.forEach(name => console.log(`- ${name}`));
        console.log('');
    }

    if (issues.length) {
        console.log('Validation issues');
        issues.forEach(issue => console.log(`- ${issue}`));
        console.log('');
    }

    if (missing.length || issues.length) {
        process.exitCode = 1;
        console.log('Phase 0 config check failed.');
        return;
    }

    console.log('Phase 0 config check passed.');
}

main();
