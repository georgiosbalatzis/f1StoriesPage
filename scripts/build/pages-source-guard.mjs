#!/usr/bin/env node
// pages-source-guard.mjs - enforce the GitHub Pages public boundary.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

const DEPLOY_WORKFLOW = '.github/workflows/deploy-pages.yml';
const ARTICLE_PUBLISH_WORKFLOW = '.github/workflows/auto-publish-author-pr.yml';
const MAINTENANCE_WORKFLOW = '.github/workflows/publish-blog.yml';
const PUBLIC_ARTIFACT_SCRIPT = 'scripts/build/public-artifact.mjs';
const PUBLIC_VALIDATOR_SCRIPT = 'scripts/build/validate-public-artifact.mjs';
const PACKAGE_JSON = 'package.json';
const AUTHOR_TOOL_FILES = ['generate.html', 'housekeeping.html', 'statistics.html'];

const errors = [];

function readText(relPath) {
    const abs = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(abs)) {
        errors.push(`${relPath}: missing`);
        return '';
    }
    return fs.readFileSync(abs, 'utf8');
}

function hasPattern(text, pattern) {
    return pattern.test(text);
}

function assertPattern(relPath, text, pattern, message) {
    if (!hasPattern(text, pattern)) errors.push(`${relPath}: ${message}`);
}

function assertNoPattern(relPath, text, pattern, message) {
    if (hasPattern(text, pattern)) errors.push(`${relPath}: ${message}`);
}

function main() {
    const pkg = JSON.parse(readText(PACKAGE_JSON) || '{}');
    const buildPublic = pkg.scripts && pkg.scripts['build:public'] || '';
    assertPattern(PACKAGE_JSON, buildPublic, /\bnpm run pages:guard\b/, '`build:public` must run `pages:guard` before building dist/');

    const workflow = readText(DEPLOY_WORKFLOW);
    assertPattern(DEPLOY_WORKFLOW, workflow, /run:\s*npm run build:public\b/, 'Pages deploy must build the validated public artifact');
    assertPattern(DEPLOY_WORKFLOW, workflow, /uses:\s*actions\/upload-pages-artifact@/i, 'Pages deploy must upload an Actions Pages artifact');
    assertPattern(DEPLOY_WORKFLOW, workflow, /\bpath:\s*dist\b/, 'Pages artifact upload path must be dist');
    assertPattern(DEPLOY_WORKFLOW, workflow, /uses:\s*actions\/deploy-pages@/i, 'Pages deploy must use actions/deploy-pages');
    assertPattern(DEPLOY_WORKFLOW, workflow, /\bpages:\s*write\b/, 'Pages deploy must declare pages: write permission');
    assertPattern(DEPLOY_WORKFLOW, workflow, /\bid-token:\s*write\b/, 'Pages deploy must declare id-token: write permission');
    assertPattern(DEPLOY_WORKFLOW, workflow, /\bworkflow_call:\s*$/m, 'Pages deploy must remain reusable by publishing workflows');
    assertNoPattern(DEPLOY_WORKFLOW, workflow, /\bworkflow_run:\s*$/m, 'Pages deploy must not fan out from completed workflows');

    const articleWorkflow = readText(ARTICLE_PUBLISH_WORKFLOW);
    assertPattern(ARTICLE_PUBLISH_WORKFLOW, articleWorkflow, /uses:\s*\.\/\.github\/workflows\/deploy-pages\.yml\b/, 'article publishing must call the reusable Pages deploy in the same run');
    assertNoPattern(ARTICLE_PUBLISH_WORKFLOW, articleWorkflow, /gh\s+workflow\s+run\s+["']?Deploy Pages/i, 'article publishing must not dispatch a second Pages workflow run');

    const maintenanceWorkflow = readText(MAINTENANCE_WORKFLOW);
    assertPattern(MAINTENANCE_WORKFLOW, maintenanceWorkflow, /uses:\s*\.\/\.github\/workflows\/deploy-pages\.yml\b/, 'maintenance must call the reusable Pages deploy in the same run');
    assertPattern(MAINTENANCE_WORKFLOW, maintenanceWorkflow, /outputs:\s*\n\s+changed:/, 'maintenance jobs must expose whether they committed a change');

    const publicArtifact = readText(PUBLIC_ARTIFACT_SCRIPT);
    for (const file of AUTHOR_TOOL_FILES) {
        assertPattern(PUBLIC_ARTIFACT_SCRIPT, publicArtifact, new RegExp(`['"]${file.replace('.', '\\.')}['"]`), `${file} must be copied into dist/`);
    }

    const validator = readText(PUBLIC_VALIDATOR_SCRIPT);
    for (const file of AUTHOR_TOOL_FILES) {
        assertPattern(PUBLIC_VALIDATOR_SCRIPT, validator, new RegExp(`['"]${file.replace('.', '\\.')}['"]`), `${file} must be explicitly required in dist/`);
    }

    for (const file of AUTHOR_TOOL_FILES) {
        const html = readText(file);
        assertNoPattern(file, html, /cdn\.jsdelivr\.net\/npm\/jszip/i, 'author tools must not load JSZip from jsDelivr while handling GitHub tokens');
        assertNoPattern(file, html, /writeStorage\(\s*localStorage\s*,\s*TOKEN_KEY/i, 'author tools must not persist GitHub tokens to localStorage');
        assertNoPattern(file, html, /localStorage\.setItem\(\s*TOKEN_KEY/i, 'author tools must not persist GitHub tokens to localStorage');
        assertNoPattern(file, html, /\/git\/refs\/heads\/main/i, 'author tools must not patch main directly; use branch + PR publishing');
    }

    if (errors.length) {
        console.error('Pages source guard failed:');
        errors.forEach(error => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log('Pages source guard passed: GitHub Pages deploys the validated dist/ artifact with author tools.');
}

main();
