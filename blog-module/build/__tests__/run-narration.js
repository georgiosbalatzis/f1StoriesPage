#!/usr/bin/env node
const { verifyNarrationExtraction } = require('./narration');

function main() {
    const failures = verifyNarrationExtraction();
    if (!failures.length) {
        console.log('Narration extraction checks passed.');
        return;
    }

    failures.forEach(failure => {
        console.error(`Narration check failed: ${failure}`);
    });
    process.exitCode = 1;
}

main();
