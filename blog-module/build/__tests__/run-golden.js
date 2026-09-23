#!/usr/bin/env node
const { updateGoldenSnapshots, verifyGoldenSnapshots } = require('./golden');

async function main() {
    if (process.argv.includes('--update')) {
        await updateGoldenSnapshots();
        console.log('Golden snapshots updated.');
        return;
    }

    const failures = await verifyGoldenSnapshots();
    if (!failures.length) {
        console.log('Golden snapshots match.');
        return;
    }

    failures.forEach(failure => {
        console.error(`Mismatch: ${failure.name}`);
        console.error(`  expected: ${failure.expectedPath}`);
        console.error(`  actual:   ${failure.actualPath}`);
    });
    process.exitCode = 1;
}

main().catch(error => {
    console.error('Golden run failed:', error);
    process.exitCode = 1;
});
