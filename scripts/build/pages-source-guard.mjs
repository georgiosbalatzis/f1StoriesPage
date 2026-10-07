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
const BUILD_PAGES_ACTION = '.github/actions/build-pages/action.yml';
const PUBLIC_ARTIFACT_SCRIPT = 'scripts/build/public-artifact.mjs';
const PUBLIC_VALIDATOR_SCRIPT = 'scripts/build/validate-public-artifact.mjs';
const PACKAGE_JSON = 'package.json';
const AUTHOR_TOOL_FILES = ['generate.html', 'housekeeping.html'];

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
    assertPattern(DEPLOY_WORKFLOW, workflow, /uses:\s*\.\/\.github\/actions\/build-pages\b/, 'Pages deploy must use the shared artifact preparation action');
    const preparation = readText(BUILD_PAGES_ACTION);
    assertPattern(BUILD_PAGES_ACTION, preparation, /run:\s*npm run build:public\b/, 'Pages preparation must build the validated public artifact');
    assertPattern(BUILD_PAGES_ACTION, preparation, /uses:\s*actions\/upload-pages-artifact@/i, 'Pages preparation must upload an Actions Pages artifact');
    assertPattern(BUILD_PAGES_ACTION, preparation, /\bpath:\s*dist\b/, 'Pages artifact upload path must be dist');
    assertPattern(BUILD_PAGES_ACTION, preparation, /run:\s*npm run quality:static\b/, 'Pages preparation must run the static source guard');
    assertPattern(BUILD_PAGES_ACTION, preparation, /run:\s*npm run audit:runtime\b/, 'Pages preparation must audit runtime dependencies');
    assertPattern(DEPLOY_WORKFLOW, workflow, /uses:\s*actions\/deploy-pages@/i, 'Pages deploy must use actions/deploy-pages');
    assertPattern(DEPLOY_WORKFLOW, workflow, /\bpages:\s*write\b/, 'Pages deploy must declare pages: write permission');
    assertPattern(DEPLOY_WORKFLOW, workflow, /\bid-token:\s*write\b/, 'Pages deploy must declare id-token: write permission');
    assertPattern(DEPLOY_WORKFLOW, workflow, /\bworkflow_call:\s*$/m, 'Pages deploy must remain reusable by publishing workflows');
    assertNoPattern(DEPLOY_WORKFLOW, workflow, /\bworkflow_run:\s*$/m, 'Pages deploy must not fan out from completed workflows');
    assertNoPattern(DEPLOY_WORKFLOW, workflow, /^  push:\s*$/m, 'main pushes must deploy through maintenance, not a second Pages run');

    const articleWorkflow = readText(ARTICLE_PUBLISH_WORKFLOW);
    // Article publishing reaches the Pages deploy through the reusable maintenance workflow.
    assertPattern(ARTICLE_PUBLISH_WORKFLOW, articleWorkflow, /uses:\s*\.\/\.github\/workflows\/publish-blog\.yml\b/, 'article publishing must call the reusable maintenance workflow in the same run');
    assertPattern(MAINTENANCE_WORKFLOW, readText(MAINTENANCE_WORKFLOW), /\bworkflow_call:\s*$/m, 'maintenance must remain reusable by article publishing');
    assertNoPattern(ARTICLE_PUBLISH_WORKFLOW, articleWorkflow, /gh\s+workflow\s+run\s+["']?Deploy Pages/i, 'article publishing must not dispatch a second Pages workflow run');

    const maintenanceWorkflow = readText(MAINTENANCE_WORKFLOW);
    assertPattern(MAINTENANCE_WORKFLOW, maintenanceWorkflow, /^  push:\s*\n\s+branches:\s*\[main\]/m, 'maintenance must own main pushes');
    assertPattern(MAINTENANCE_WORKFLOW, maintenanceWorkflow, /uses:\s*\.\/\.github\/workflows\/deploy-pages\.yml\b/, 'maintenance must call the reusable Pages deploy in the same run');
    assertPattern(MAINTENANCE_WORKFLOW, maintenanceWorkflow, /outputs:\s*\n\s+changed:/, 'maintenance jobs must expose whether they committed a change');
    assertPattern(MAINTENANCE_WORKFLOW, maintenanceWorkflow, /uses:\s*\.\/\.github\/actions\/build-pages\b/, 'article generation must prepare Pages using its installed dependencies');

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
