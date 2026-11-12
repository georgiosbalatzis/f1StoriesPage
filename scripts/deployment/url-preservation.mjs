#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { XMLValidator } from 'fast-xml-parser';
import { DOMParser } from '@xmldom/xmldom';
import { ORIGIN } from './release.mjs';

const args = process.argv.slice(2);
try {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
        if (!['--previous', '--current', '--report'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) throw new Error('usage: --previous <site> --current <site> [--report <file>]');
        options[args[i]] = args[i + 1];
    }
    if (!options['--previous'] || !options['--current']) throw new Error('usage: --previous <site> --current <site> [--report <file>]');
    const previous = options['--previous'], current = options['--current'];
    const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
    const currentRoot = fs.realpathSync(current);
    const inside = (root, candidate) => candidate === root || candidate.startsWith(root + path.sep);
    const validateUrl = value => {
        let url;
        try { url = new URL(value); } catch { throw new Error(`invalid sitemap URL: ${value}`); }
        if (url.origin !== ORIGIN || url.username || url.password) throw new Error(`invalid sitemap origin: ${value}`);
        const match = value.match(/^https?:\/\/[^/?#]+([^?#]*)/i);
        if (!match) throw new Error(`invalid sitemap URL: ${value}`);
        let parts;
        try { parts = (match[1] || '/').split('/').map(decodeURIComponent); }
        catch { throw new Error(`invalid URL escape: ${value}`); }
        if (parts.some(part => part === '.' || part === '..' || /[\\/\0]/.test(part))) throw new Error(`invalid URL path: ${value}`);
        return parts;
    };
    const locs = (site, baseline = false) => {
        const xml = fs.readFileSync(path.join(site, 'sitemap.xml'), 'utf8');
        if (/<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('malformed or unsupported sitemap XML');
        const errors = [];
        const doc = new DOMParser({ errorHandler: { warning: message => errors.push(message), error: message => errors.push(message), fatalError: message => errors.push(message) } }).parseFromString(xml, 'application/xml');
        if (errors.length || !doc.documentElement) throw new Error('malformed sitemap XML');
        const root = doc.documentElement;
        if (root.localName === 'sitemapindex') throw new Error('sitemap index unsupported');
        if (root.localName !== 'urlset' || root.namespaceURI !== namespace) throw new Error('expected sitemap urlset');
        const entries = Array.from(root.childNodes).filter(node => node.nodeType === 1);
        const urls = entries.map(entry => {
            if (entry.localName !== 'url' || entry.namespaceURI !== namespace) throw new Error('invalid sitemap entry');
            const locations = Array.from(entry.childNodes).filter(node => node.nodeType === 1 && node.localName === 'loc' && node.namespaceURI === namespace);
            if (locations.length !== 1 || Array.from(locations[0].childNodes).some(node => node.nodeType === 1)) throw new Error('invalid sitemap location');
            const value = locations[0].textContent.trim();
            validateUrl(value);
            return value;
        });
        if (baseline && !urls.length) throw new Error('empty baseline sitemap');
        return urls;
    };
    const fileFor = url => {
        const parts = validateUrl(url);
        if (parts.at(-1) === '') parts[parts.length - 1] = 'index.html';
        const candidate = path.join(currentRoot, ...parts);
        if (!inside(currentRoot, candidate)) throw new Error(`path outside artifact: ${url}`);
        try {
            const real = fs.realpathSync(candidate);
            return inside(currentRoot, real) && fs.statSync(real).isFile();
        } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
    };
    const oldLocs = locs(previous, true), newSet = new Set(locs(current));
    const removed = oldLocs.filter(u => !newSet.has(u));
    const unresolved = oldLocs.filter(u => !fileFor(u));
    const added = [...newSet].filter(u => !oldLocs.includes(u));
    const result = { oldCount: oldLocs.length, newCount: newSet.size, removedFromSitemap: removed, unresolvedFiles: unresolved, addedCount: added.length, added };
    if (options['--report']) {
        const roots = [previous, current].map(site => fs.realpathSync(site));
        const parent = fs.realpathSync(path.dirname(path.resolve(options['--report'])));
        const target = path.join(parent, path.basename(options['--report']));
        const inside = candidate => roots.some(root => candidate === root || candidate.startsWith(root + path.sep));
        if (inside(parent) || inside(target)) throw new Error('report must be outside both artifacts');
        try {
            const stat = fs.lstatSync(target);
            if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink > 1 || inside(fs.realpathSync(target))) throw new Error('invalid report target');
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        const temp = path.join(parent, `.url-report-${randomBytes(16).toString('hex')}.tmp`);
        let created = false;
        try { fs.writeFileSync(temp, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); created = true; fs.renameSync(temp, target); }
        finally { if (created && fs.existsSync(temp)) fs.unlinkSync(temp); }
    }
    console.log(`old ${oldLocs.length} new ${newSet.size} removed ${removed.length} unresolved ${unresolved.length} added ${added.length}`);
    process.exitCode = removed.length || unresolved.length ? 1 : 0;
} catch (error) { console.error(error.message); process.exitCode = 2; }
