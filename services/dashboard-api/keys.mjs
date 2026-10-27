#!/usr/bin/env node
// keys.mjs — Dashboard Access Keys: format, verifiers and the key store.
//
// A key is `f1sdk_<id>_<secret>`: an 8-character public id and 256 random bits. Only a verifier
// (SHA-256 of the secret) is stored server-side. A slow password KDF adds nothing for a 256-bit
// random secret; it protects guessable passwords, and no Dashboard Access Key is one.
//
//   node services/dashboard-api/keys.mjs new "<label>"
// prints the key once on stderr and the store record on stdout; the plaintext is never written to disk.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY_PATTERN = /^f1sdk_([a-z0-9]{8})_([A-Za-z0-9_-]{43})$/;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const digest = secret => createHash('sha256').update(secret, 'utf8').digest('hex');

export function newKey(label) {
    if (typeof label !== 'string' || !label.trim() || label.length > 80) throw new Error('A key needs a label of 1–80 characters.');
    const id = Array.from(randomBytes(8), byte => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
    const secret = randomBytes(32).toString('base64url');
    return { key: `f1sdk_${id}_${secret}`, record: { id, label: label.trim(), verifier: `sha256:${digest(secret)}`, revoked: false } };
}

// The store: {"keys":[{id,label,verifier,revoked}]}. Anything malformed denies every key (fail closed).
export function parseKeyStore(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.keys)) throw new Error('Key store must be {"keys":[...]}');
    const keys = new Map();
    for (const record of data.keys) {
        if (!record || !/^[a-z0-9]{8}$/.test(record.id) || !/^sha256:[a-f0-9]{64}$/.test(record.verifier)
            || typeof record.label !== 'string' || typeof record.revoked !== 'boolean') {
            throw new Error('Key store has a malformed record');
        }
        if (keys.has(record.id)) throw new Error(`Key store repeats id ${record.id}`);
        keys.set(record.id, record);
    }
    return keys;
}

export function readKeyStore(file) {
    try {
        return parseKeyStore(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`dashboard-api: key store unavailable, denying all keys (${error.message})`);
        return new Map();
    }
}

// The active record for a presented key, or null. Revoked and unknown keys are rejected alike.
export function verifyKey(keys, presented) {
    const match = typeof presented === 'string' ? KEY_PATTERN.exec(presented) : null;
    if (!match) return null;
    const record = keys.get(match[1]);
    if (!record || record.revoked) return null;
    const expected = Buffer.from(record.verifier.slice('sha256:'.length), 'hex');
    return timingSafeEqual(expected, Buffer.from(digest(match[2]), 'hex')) ? record : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [command, label] = process.argv.slice(2);
    if (command !== 'new') {
        console.error('Usage: node services/dashboard-api/keys.mjs new "<label>"');
        process.exit(2);
    }
    const { key, record } = newKey(label);
    console.error(`Dashboard Access Key (shown once, store it in a password manager):\n${key}\n`);
    console.log(JSON.stringify(record));
}
