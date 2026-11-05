#!/usr/bin/env node
// Builds shared/content.json for the INDEX redesign prototypes from the tracked, published article metadata.
// Every concept reads this one file, so all five compare on identical real content. Exploration only: nothing here
// is part of the public build (experiments/ is never copied by scripts/build/public-artifact.mjs).
const fs = require('node:fs');
const path = require('node:path');
const T = require('../../blog-module/taxonomy.js');

const ROOT = path.resolve(__dirname, '../..');
const cache = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-source-cache.json'), 'utf8'));
const today = T.athensDay();
// Topic hubs published on the live INDEX (2026-11-03); the hub list is generated, so it is copied, not invented.
const HUBS = [{ label: 'Λάντο Νόρις', kind: 'Οδηγός', url: '/blog-module/blog/entities/drivers/lando-norris/', count: 4 }];

const exists = rel => fs.existsSync(path.join(ROOT, rel.replace(/^\//, '')));
const stories = cache.posts
    .filter(post => post.dateISO <= today)
    // Stable sort: same-day stories keep the source order, as on the live INDEX.
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
    .map(post => {
        const author = T.findAuthor(post.author);
        const category = post.category;
        const card = post.image.replace(/\/1\.webp$/, '/1-card.webp');
        return {
            id: post.id,
            title: post.title,
            url: post.url,
            date: post.dateISO,
            dateLabel: T.formatDate(post.dateISO),
            category,
            categories: post.categories && post.categories.length ? post.categories : [category],
            categoryLabel: T.categoryLabel(category),
            sectionUrl: T.sectionPath(category),
            author: author ? author.label : post.author,
            authorSlug: author ? author.slug : null,
            authorUrl: author ? `/blog-module/blog/index.html?author=${author.slug}` : null,
            readingTime: T.formatReadingTime(post.readingTime),
            excerpt: post.excerpt,
            image: post.image,
            imageCard: exists(card) ? card : post.image,
            imageWidth: post.imageWidth,
            imageHeight: post.imageHeight,
            isNew: T.isNewStory(post.dateISO, today)
        };
    });

const count = (list, key) => list.reduce((map, item) => map.set(item[key], (map.get(item[key]) || 0) + 1), new Map());
// A story counts in every category it carries, as on the live INDEX and section pages.
const inCategory = category => stories.filter(story => story.categories.includes(category));
const sections = T.PUBLIC_CATEGORIES.map(category => ({
    category,
    label: T.categoryLabel(category),
    url: T.sectionPath(category),
    count: inCategory(category).length,
    latest: (inCategory(category)[0] || {}).id || null
}));
const byAuthor = count(stories.filter(s => s.authorSlug), 'authorSlug');
const authors = T.AUTHORS.map(author => ({
    label: author.label,
    slug: author.slug,
    portrait: author.portrait,
    desk: author.desk,
    url: `/blog-module/blog/index.html?author=${author.slug}`,
    count: byAuthor.get(author.slug) || 0,
    latest: (stories.find(story => story.authorSlug === author.slug) || {}).date || null
})).filter(author => author.count);
const months = [...count(stories.map(s => ({ ym: s.date.slice(0, 7) })), 'ym')].map(([ym, n]) => ({
    year: Number(ym.slice(0, 4)),
    month: Number(ym.slice(5, 7)),
    label: T.monthName(ym),
    short: T.monthShort(ym),
    url: `/blog-module/blog/archive/${ym.slice(0, 4)}/${ym.slice(5, 7)}/`,
    count: n
}));

const content = {
    note: 'Real published F1 Stories metadata (blog-module/blog-source-cache.json). Prototype data only.',
    asOf: today,
    total: stories.length,
    routes: { index: '/blog-module/blog/', search: '/blog-module/blog/index.html?q=', archive: '/blog-module/blog/archive/', authors: '/authors/' },
    sections, authors, hubs: HUBS, months, stories
};
fs.mkdirSync(path.join(__dirname, 'shared'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'shared/content.json'), JSON.stringify(content) + '\n');
console.log(`stories ${stories.length}, sections ${sections.length}, authors ${authors.length}, months ${months.length}, asOf ${today}`);
