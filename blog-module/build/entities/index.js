// Standalone editorial tooling. Nothing in the publishing or browser pipeline imports this module.
const fs = require('node:fs');
const path = require('node:path');
const { getPostTaxonomy, isDay } = require('../../taxonomy');

const ROOT = path.resolve(__dirname, '../../..');
const TYPES = ['driver', 'team', 'circuit', 'grand-prix'];
const ROLES = ['primary', 'secondary', 'mention', 'excluded', 'unresolved'];
const DISCIPLINES = ['f1', 'wec', 'wrc', 'motogp', 'other', 'mixed', 'unknown'];
const TAG_SCOPES = ['article-tag', 'f1-tag'];
const text = value => typeof value === 'string' && value.trim().length > 0;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const pairKey = item => `${item.entityId}/${item.articleId}`;
const ordered = items => items.slice().sort((a, b) => compare(pairKey(a), pairKey(b)));
const check = (condition, message) => { if (!condition) throw new Error(message); };

function normalizeAlias(value) {
    // Only separator punctuation already supported by taxonomy; never strip arbitrary punctuation.
    return String(value ?? '').normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
        .replace(/ς/g, 'σ').replace(/[-_\u2010-\u2015]+/g, ' ').replace(/\s+/g, ' ').trim().normalize('NFC');
}

function validateReview(review, label) {
    check(review && ['pending', 'approved'].includes(review.status), `${label}: invalid review status`);
    if (review.status === 'approved') {
        check(review.kind === 'human' && text(review.by) && isDay(review.date), `${label}: human reviewer and date required`);
    }
}

function validateRegistry(registry) {
    check(registry?.version === 1 && Array.isArray(registry.entities) && registry.entities.length > 0, 'registry: version 1 and entities required');
    const ids = new Set(), slugs = new Set(), aliases = new Map();
    for (const entity of registry.entities) {
        check(entity && TYPES.includes(entity.type), 'registry: invalid entity type');
        check(text(entity.id) && new RegExp(`^${entity.type}:[a-z0-9]+(?:-[a-z0-9]+)*$`).test(entity.id), 'registry: invalid canonical ID');
        check(!ids.has(entity.id), `registry: duplicate canonical ID ${entity.id}`);
        ids.add(entity.id);
        check(text(entity.slug) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entity.slug), `${entity.id}: invalid slug`);
        const slug = `${entity.type}/${entity.slug}`;
        check(!slugs.has(slug), `registry: duplicate type/slug ${slug}`);
        slugs.add(slug);
        check(text(entity.name) && text(entity.labelEl), `${entity.id}: name and labelEl required`);
        check(Array.isArray(entity.aliases) && entity.aliases.length > 0, `${entity.id}: aliases required`);
        for (const alias of entity.aliases) {
            check(alias && text(alias.value) && text(alias.scope) && normalizeAlias(alias.value), `${entity.id}: alias value/scope required`);
            const key = JSON.stringify([alias.scope, normalizeAlias(alias.value)]);
            check(!aliases.has(key) || aliases.get(key) === entity.id, `registry: scoped alias collision ${alias.value} (${alias.scope})`);
            aliases.set(key, entity.id);
        }
        if (entity.providerIds !== undefined) {
            check(entity.providerIds && !Array.isArray(entity.providerIds) && typeof entity.providerIds === 'object'
                && Object.entries(entity.providerIds).every(([provider, id]) => text(provider) && text(id)), `${entity.id}: invalid providerIds`);
        }
        validateReview(entity.hub?.review, `${entity.id} hub`);
        if (entity.hub.introduction !== undefined) {
            check(text(entity.hub.introduction?.text), `${entity.id}: introduction text required`);
            if (entity.hub.introduction.heading !== undefined) check(text(entity.hub.introduction.heading), `${entity.id}: introduction heading must be nonempty text`);
            validateReview(entity.hub.introduction.review, `${entity.id} introduction`);
        }
    }
    return registry;
}

function resolveAlias(registry, value, scope = 'article-tag') {
    const key = normalizeAlias(value);
    const matches = registry.entities.filter(entity => entity.aliases.some(alias => alias.scope === scope && normalizeAlias(alias.value) === key));
    check(matches.length <= 1, `registry: scoped alias collision ${value} (${scope})`);
    return matches[0]?.id || null;
}

function findCandidates(registry, articles) {
    const candidates = [];
    for (const article of articles) {
        const matches = new Map();
        for (const tag of getPostTaxonomy(article).tags) {
            for (const scope of TAG_SCOPES) {
                const entityId = resolveAlias(registry, tag, scope);
                if (!entityId) continue;
                if (!matches.has(entityId)) matches.set(entityId, new Set());
                matches.get(entityId).add(tag);
            }
        }
        for (const [entityId, tags] of matches) candidates.push({ articleId: article.id, entityId, tags: [...tags].sort(compare) });
    }
    return ordered(candidates);
}

function validateAssociations(registry, manifest, articles, readSource = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8')) {
    validateRegistry(registry);
    check(manifest?.version === 1 && text(manifest.baseline) && Array.isArray(manifest.associations), 'manifest: version, baseline and associations required');
    const ids = new Set(registry.entities.map(entity => entity.id));
    const articleIds = new Set(articles.map(article => article.id));
    const seen = new Set();
    for (const item of manifest.associations) {
        check(item && ids.has(item.entityId), `manifest: unknown entity reference ${item?.entityId}`);
        check(articleIds.has(item.articleId), `manifest: unknown article reference ${item.articleId}`);
        const key = pairKey(item);
        check(!seen.has(key), `manifest: duplicate or contradictory association ${key}`);
        seen.add(key);
        check(ROLES.includes(item.role) && DISCIPLINES.includes(item.discipline), `${key}: invalid role/discipline`);
        validateReview(item.review, key);
        if (item.review.status === 'pending') {
            check(item.role === 'unresolved', `${key}: pending review cannot confirm membership or exclusion`);
            check(ROLES.includes(item.proposedRole), `${key}: proposedRole required for pending review`);
        } else {
            check(item.role !== 'unresolved', `${key}: approved review must resolve the candidate`);
            if (['primary', 'secondary'].includes(item.role)) check(typeof item.substantive === 'boolean', `${key}: substantive assessment required`);
        }
        check(Array.isArray(item.tags) && item.tags.every(text), `${key}: source tags required (empty for manual associations)`);
        const articleTags = getPostTaxonomy(articles.find(article => article.id === item.articleId)).tags;
        check(item.tags.every(tag => articleTags.includes(tag)), `${key}: source tag missing from article metadata`);
        check(Array.isArray(item.flags) && item.flags.every(text), `${key}: flags array required`);
        const evidence = item.evidence;
        check(evidence && text(evidence.path) && Number.isInteger(evidence.line) && evidence.line > 0
            && text(evidence.quote) && text(evidence.note), `${key}: source evidence path/line/quote/note required`);
        check(new RegExp(`^blog-module/blog-entries/${item.articleId}/(?:source\\.txt|article\\.html)$`).test(evidence.path), `${key}: evidence must belong to this article`);
        const source = readSource(evidence.path).replace(/\r\n?/g, '\n').split('\n');
        check(source[evidence.line - 1]?.includes(evidence.quote), `${key}: evidence quote no longer matches source line`);
        if (evidence.path.endsWith('/source.txt')) {
            const headerEnd = source[0].replace(/^\uFEFF/, '').trim() === '---' ? source.indexOf('---', 1) : 0;
            check(headerEnd >= 0 && evidence.line > headerEnd + 1, `${key}: evidence requires article context beyond the taxonomy header`);
        }
    }
    return manifest;
}

function coverageReport(registry, manifest, articles) {
    const articleMap = new Map(articles.map(article => [article.id, article]));
    const candidates = findCandidates(registry, articles);
    const rows = new Map(candidates.map(candidate => [pairKey(candidate), {
        ...candidate, role: 'unresolved', proposedRole: 'unresolved', discipline: 'unknown',
        review: { status: 'pending' }, flags: ['not-yet-reviewed']
    }]));
    for (const item of manifest.associations) rows.set(pairKey(item), item);
    return {
        version: 1, baseline: manifest.baseline,
        rule: 'At least 3 substantive human-reviewed F1/mixed subject articles on multiple publication dates, plus a useful human-reviewed introduction and hub approval. Never generates pages.',
        entities: registry.entities.slice().sort((a, b) => compare(a.id, b.id)).map(entity => {
            const associations = ordered([...rows.values()].filter(item => item.entityId === entity.id)).map(item => ({
                articleId: item.articleId, entityId: item.entityId,
                title: articleMap.get(item.articleId).title, date: articleMap.get(item.articleId).date,
                role: item.role, proposedRole: item.proposedRole, discipline: item.discipline,
                review: { status: item.review.status, kind: item.review.kind, by: item.review.by, date: item.review.date },
                tags: item.tags.slice().sort(compare), flags: item.flags.slice().sort(compare),
                substantive: item.substantive,
                evidence: item.evidence && { path: item.evidence.path, line: item.evidence.line, quote: item.evidence.quote, note: item.evidence.note }
            }));
            const counts = Object.fromEntries(ROLES.map(role => [role, associations.filter(item => item.role === role).length]));
            const proposed = Object.fromEntries(ROLES.map(role => [role, associations.filter(item => item.review.status === 'pending' && item.proposedRole === role).length]));
            const subjects = associations.filter(item => ['primary', 'secondary'].includes(item.role) && item.review.status === 'approved'
                && item.substantive === true && ['f1', 'mixed'].includes(item.discipline));
            const dates = [...new Set(subjects.map(item => item.date).filter(isDay))].sort(compare);
            const reviewedIntroduction = entity.hub.introduction?.review.status === 'approved' || false;
            const reasons = [];
            if (subjects.length < 3) reasons.push('Fewer than 3 substantive human-reviewed subject articles');
            if (dates.length < 2) reasons.push('Fewer than 2 relevant publication dates');
            if (!reviewedIntroduction) reasons.push('Useful human-reviewed introduction missing');
            if (entity.hub.review.status !== 'approved') reasons.push('Public hub approval pending');
            return {
                id: entity.id, name: entity.name,
                candidateCount: candidates.filter(item => item.entityId === entity.id).length,
                counts, proposed, reviewRequired: associations.filter(item => item.review.status === 'pending').length,
                candidatePublicationDates: [...new Set(associations.map(item => item.date).filter(isDay))].sort(compare),
                relevantPublicationDates: dates, substantiveSubjects: subjects.length,
                provisionalHubEligibility: reasons.length === 0, reasons, associations
            };
        })
    };
}

function renderCoverage(report) {
    const lines = ['# Pilot entity coverage', '', `Baseline: ${report.baseline}`, '', report.rule, '',
        'Proposals are agent assessments, not editorial approvals. Candidate tags never establish article membership.', '',
        '| Entity | Tag candidates | Primary | Secondary | Mentions | Excluded | Unresolved | Needs review | Subject dates | Eligible |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'];
    for (const entity of report.entities) {
        const c = entity.counts;
        lines.push(`| ${entity.id} | ${entity.candidateCount} | ${c.primary} | ${c.secondary} | ${c.mention} | ${c.excluded} | ${c.unresolved} | ${entity.reviewRequired} | ${entity.relevantPublicationDates.length} | ${entity.provisionalHubEligibility ? 'yes' : 'no'} |`);
    }
    for (const entity of report.entities) {
        lines.push('', `## ${entity.name}`, '', `Candidate dates: ${entity.candidatePublicationDates.length}. Eligibility: ${entity.reasons.join('; ') || 'criteria satisfied; generation is a separate phase'}.`,
            '', `Pending proposals: ${JSON.stringify(entity.proposed)}`, '');
        for (const item of entity.associations) {
            const evidence = item.evidence;
            lines.push(`- ${item.articleId} (${item.date}) — ${item.title}`, `  - ${item.role}; proposed: ${item.proposedRole || '—'}; ${item.discipline}; review: ${item.review.status}; tags: ${item.tags.join(', ') || 'manual association'}.`,
                `  - ${evidence ? `${evidence.path}:${evidence.line} — ${evidence.quote}` : 'No source review recorded.'}`,
                `  - ${evidence?.note || 'New candidate requires source review.'}${item.flags.length ? ` Flags: ${item.flags.join(', ')}.` : ''}`);
        }
    }
    return lines.join('\n') + '\n';
}

function loadFoundation() {
    return {
        registry: JSON.parse(fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf8')),
        manifest: JSON.parse(fs.readFileSync(path.join(__dirname, 'associations.json'), 'utf8')),
        articles: JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-source-cache.json'), 'utf8')).posts
    };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    check(args.length <= 1 && (!args.length || ['--validate', '--json'].includes(args[0])), 'Usage: node blog-module/build/entities/index.js [--validate|--json]');
    const { registry, manifest, articles } = loadFoundation();
    validateAssociations(registry, manifest, articles);
    const report = coverageReport(registry, manifest, articles);
    if (args[0] === '--validate') process.stdout.write(`Valid: ${registry.entities.length} entities, ${manifest.associations.length} associations; ${report.entities.reduce((sum, entity) => sum + entity.associations.filter(item => !item.evidence).length, 0)} candidates awaiting source review.\n`);
    else process.stdout.write(args[0] === '--json' ? JSON.stringify(report, null, 2) + '\n' : renderCoverage(report));
}

module.exports = { normalizeAlias, validateRegistry, resolveAlias, findCandidates, validateAssociations, coverageReport, renderCoverage, loadFoundation };
