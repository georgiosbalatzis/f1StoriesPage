#!/usr/bin/env node
// Validate the checked-in identity registry and show unresolved optional bindings.
import fs from 'node:fs';
import { validateRegistry } from './core/index.mjs';

const registryUrl = new URL('../../data/race-desk/registry.v1.json', import.meta.url);
try {
    const registry = JSON.parse(fs.readFileSync(registryUrl, 'utf8'));
    const result = validateRegistry(registry);
    if (!result.valid) {
        console.error('Race desk registry validation failed:');
        for (const error of result.errors) console.error(`  - ${error.path}: ${error.message} (${error.code})`);
        process.exitCode = 1;
    } else {
        const { races, sessions, missing } = result.coverage;
        console.log(`Race desk registry validated: ${races} races, ${sessions} sessions.`);
        for (const [key, values] of Object.entries(missing)) {
            console.log(`  Missing ${key}: ${values.length ? values.join(', ') : 'none'}`);
        }
    }
} catch (error) {
    console.error(`Race desk registry validation failed: ${error.message}`);
    process.exitCode = 1;
}
