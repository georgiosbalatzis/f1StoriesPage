#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const DOM_TOOLS_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'dom-tools.js');

class FakeNode {
    constructor(tagName, textContent = '') {
        this.tagName = tagName;
        this.textContent = textContent;
        this.children = [];
        this.attributes = {};
        this.className = '';
        this.title = '';
    }

    appendChild(node) {
        this.children.push(node);
        return node;
    }

    replaceChildren(...nodes) {
        this.children = nodes;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'class') this.className = String(value);
    }
}

const fakeDocument = {
    createElement(tagName) {
        return new FakeNode(tagName);
    },
    createElementNS(_namespace, tagName) {
        return new FakeNode(tagName);
    },
    createTextNode(text) {
        return new FakeNode('#text', String(text));
    }
};

function loadDomTools() {
    const context = {
        console,
        document: fakeDocument,
        window: {}
    };
    vm.runInNewContext(fs.readFileSync(DOM_TOOLS_PATH, 'utf8'), context, {
        filename: DOM_TOOLS_PATH
    });
    return context.window.F1S_AUTHOR_DOM_TOOLS;
}

const domTools = loadDomTools();

const icon = domTools.createSvgIcon('fa-check', 'fa-spin');
assert.equal(icon.tagName, 'svg');
assert.equal(icon.attributes.class, 'icon fa-spin');
assert.equal(icon.children[0].attributes.href, '#fa-check');

const button = fakeDocument.createElement('button');
domTools.setIconText(button, 'fa-rocket', 'Publish');
assert.equal(button.children.length, 2);
assert.equal(button.children[0].children[0].attributes.href, '#fa-rocket');
assert.equal(button.children[1].textContent, ' Publish');

domTools.setBusyText(button, 'Saving');
assert.equal(button.children[0].attributes.class, 'icon fa-spin');
assert.equal(button.children[0].children[0].attributes.href, '#fa-spinner');
assert.equal(button.children[1].textContent, ' Saving');

const message = domTools.createStatusMessage('hk-empty', 'Loading', 'fa-spinner', 'fa-spin');
assert.equal(message.className, 'hk-empty');
assert.equal(message.children[0].attributes.class, 'icon fa-spin');
assert.equal(message.children[2].textContent, 'Loading');

const action = domTools.createIconTextButton('hk-btn', 'Preview', 'fa-eye', 'Preview');
assert.equal(action.className, 'hk-btn');
assert.equal(action.title, 'Preview');
assert.equal(action.children[1].textContent, ' Preview');

const trusted = fakeDocument.createElement('div');
assert.throws(
    () => domTools.setTrustedHtml(trusted, '<p>Preview</p>'),
    /requires a short reason/
);
domTools.setTrustedHtml(trusted, '<p>Preview</p>', 'tested trusted preview HTML');
assert.equal(trusted.innerHTML, '<p>Preview</p>');

console.log('author DOM tools tests passed.');
