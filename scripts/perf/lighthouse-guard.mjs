#!/usr/bin/env node
// lighthouse-guard.mjs - serve dist/, run Lighthouse, and enforce route budgets.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DEFAULT_ROOT = path.join(REPO_ROOT, 'dist');
const DEFAULT_BUDGET = path.join(REPO_ROOT, 'perf', 'lighthouse-budget.json');
const MIME_TYPES = new Map([
    ['.avif', 'image/avif'],
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.map', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.webmanifest', 'application/manifest+json; charset=utf-8'],
    ['.webp', 'image/webp'],
    ['.woff2', 'font/woff2'],
    ['.xml', 'application/xml; charset=utf-8']
]);

function parseArgs(argv) {
    const args = {
        budgetPath: process.env.LIGHTHOUSE_BUDGET_PATH || DEFAULT_BUDGET,
        keepJson: process.env.LIGHTHOUSE_KEEP_JSON === '1',
        outputDir: process.env.LIGHTHOUSE_OUTPUT_DIR || '',
        root: process.env.LIGHTHOUSE_ROOT || DEFAULT_ROOT
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--budget') args.budgetPath = path.resolve(argv[++i]);
        else if (arg === '--root') args.root = path.resolve(argv[++i]);
        else if (arg === '--output-dir') args.outputDir = path.resolve(argv[++i]);
        else if (arg === '--keep-json') args.keepJson = true;
    }

    return args;
}

function loadBudget(budgetPath) {
    if (!fs.existsSync(budgetPath)) {
        throw new Error(`Lighthouse budget not found: ${path.relative(REPO_ROOT, budgetPath)}`);
    }
    const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
    if (!Array.isArray(budget.routes) || !budget.routes.length) {
        throw new Error(`${path.relative(REPO_ROOT, budgetPath)} must define at least one route`);
    }
    return budget;
}

function isInside(root, filePath) {
    const rel = path.relative(root, filePath);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function resolveRequest(root, requestUrl) {
    const url = new URL(requestUrl, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const direct = path.resolve(root, `.${pathname}`);
    if (!isInside(root, direct)) return null;
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

    if (!path.extname(direct)) {
        const index = path.join(direct, 'index.html');
        if (isInside(root, index) && fs.existsSync(index) && fs.statSync(index).isFile()) return index;
    }

    return null;
}

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES.get(ext) || 'application/octet-stream';
    res.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': type
    });
    fs.createReadStream(filePath).pipe(res);
}

function startServer(root) {
    if (!fs.existsSync(path.join(root, 'index.html'))) {
        throw new Error(`Public artifact missing at ${path.relative(REPO_ROOT, root)}. Run npm run build:public first.`);
    }

    const server = http.createServer((req, res) => {
        if (!req.url || !['GET', 'HEAD'].includes(req.method || '')) {
            res.writeHead(405);
            res.end('Method not allowed');
            return;
        }

        const filePath = resolveRequest(root, req.url);
        if (!filePath) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        if (req.method === 'HEAD') {
            res.writeHead(200);
            res.end();
            return;
        }
        sendFile(res, filePath);
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({ server, origin: `http://127.0.0.1:${address.port}` });
        });
    });
}

function lighthouseBin() {
    const bin = process.platform === 'win32' ? 'lighthouse.cmd' : 'lighthouse';
    return path.join(REPO_ROOT, 'node_modules', '.bin', bin);
}

function slug(value) {
    return String(value || 'route')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'route';
}

function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: REPO_ROOT,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', code => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }
            const err = new Error(`Lighthouse exited with code ${code}`);
            err.stdout = stdout;
            err.stderr = stderr;
            reject(err);
        });
    });
}

async function runLighthouse(route, origin, budget, outputDir) {
    const outputPath = path.join(outputDir, `${slug(route.name)}.json`);
    const routePath = String(route.path || '/').startsWith('/') ? route.path : `/${route.path}`;
    const url = new URL(routePath, origin).toString();
    const chromeFlags = process.env.LIGHTHOUSE_CHROME_FLAGS || '--headless --no-sandbox --disable-dev-shm-usage';
    const categories = (budget.onlyCategories || ['performance', 'accessibility', 'best-practices', 'seo']).join(',');
    const throttlingMethod = process.env.LIGHTHOUSE_THROTTLING_METHOD || budget.throttlingMethod || 'provided';

    await runCommand(lighthouseBin(), [
        url,
        '--quiet',
        `--chrome-flags=${chromeFlags}`,
        `--only-categories=${categories}`,
        `--throttling-method=${throttlingMethod}`,
        '--output=json',
        `--output-path=${outputPath}`
    ]);

    return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
}

function score(lhr, id) {
    const value = lhr.categories?.[id]?.score;
    return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function auditValue(lhr, id) {
    const value = lhr.audits?.[id]?.numericValue;
    return Number.isFinite(value) ? value : null;
}

function fmtMs(value) {
    return value == null ? '-' : `${Math.round(value)}ms`;
}

function fmtScore(value) {
    return value == null ? '-' : String(value);
}

function fmtCls(value) {
    return value == null ? '-' : value.toFixed(3);
}

function evaluateRoute(route, lhr) {
    const thresholds = route.thresholds || {};
    const metrics = {
        performance: score(lhr, 'performance'),
        accessibility: score(lhr, 'accessibility'),
        'best-practices': score(lhr, 'best-practices'),
        seo: score(lhr, 'seo'),
        'largest-contentful-paint': auditValue(lhr, 'largest-contentful-paint'),
        'cumulative-layout-shift': auditValue(lhr, 'cumulative-layout-shift'),
        'total-blocking-time': auditValue(lhr, 'total-blocking-time')
    };

    const failures = [];
    for (const [id, threshold] of Object.entries(thresholds)) {
        const actual = metrics[id];
        if (actual == null) {
            failures.push(`${id}: missing Lighthouse metric`);
            continue;
        }
        const maxMetric = id === 'largest-contentful-paint'
            || id === 'cumulative-layout-shift'
            || id === 'total-blocking-time';
        if (maxMetric && actual > threshold) failures.push(`${id}: ${actual.toFixed(3)} > ${threshold}`);
        if (!maxMetric && actual < threshold) failures.push(`${id}: ${actual} < ${threshold}`);
    }

    return { metrics, failures };
}

function printTable(rows) {
    const nameW = Math.max(...rows.map(row => row.route.name.length), 5);
    console.log('\nLighthouse route budgets:\n');
    console.log(`${'route'.padEnd(nameW)}  ${'perf'.padStart(4)}  ${'a11y'.padStart(4)}  ${'bp'.padStart(4)}  ${'seo'.padStart(4)}  ${'lcp'.padStart(7)}  ${'cls'.padStart(6)}  ${'tbt'.padStart(7)}  status`);
    console.log('-'.repeat(nameW + 57));
    rows.forEach(row => {
        const m = row.metrics;
        const status = row.failures.length ? 'FAIL' : 'ok';
        console.log(
            `${row.route.name.padEnd(nameW)}  ${fmtScore(m.performance).padStart(4)}  ${fmtScore(m.accessibility).padStart(4)}  ${fmtScore(m['best-practices']).padStart(4)}  ${fmtScore(m.seo).padStart(4)}  ${fmtMs(m['largest-contentful-paint']).padStart(7)}  ${fmtCls(m['cumulative-layout-shift']).padStart(6)}  ${fmtMs(m['total-blocking-time']).padStart(7)}  ${status}`
        );
    });
    console.log('');
}

async function main() {
    const args = parseArgs(process.argv);
    const budget = loadBudget(args.budgetPath);
    const tempDir = args.outputDir || fs.mkdtempSync(path.join(os.tmpdir(), 'f1stories-lighthouse-'));
    fs.mkdirSync(tempDir, { recursive: true });

    let server;
    try {
        const started = await startServer(args.root);
        server = started.server;
        console.log(`Serving ${path.relative(REPO_ROOT, args.root)} at ${started.origin}`);

        const rows = [];
        for (const route of budget.routes) {
            const lhr = await runLighthouse(route, started.origin, budget, tempDir);
            rows.push({ route, ...evaluateRoute(route, lhr) });
        }

        printTable(rows);
        const failures = rows.flatMap(row => row.failures.map(message => `${row.route.name}: ${message}`));
        if (failures.length) {
            console.error('Lighthouse budget failures:');
            failures.forEach(failure => console.error(`  - ${failure}`));
            process.exitCode = 1;
        } else {
            console.log('All Lighthouse budgets passed.');
        }
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (!args.keepJson && !args.outputDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } else {
            console.log(`Lighthouse JSON written to ${path.relative(REPO_ROOT, tempDir)}`);
        }
    }
}

main().catch(error => {
    console.error(error.message || error);
    if (error.stderr) console.error(error.stderr.trim());
    process.exit(1);
});
