// NEXT UP ranking: which three stories follow an article. Pure build-time logic; related.js renders the choice.
const { getPostTaxonomy, isDay, athensDay } = require('../taxonomy');
const { isReleased } = require('./entities/hubs');

// Labels that say nothing about the subject: generic F1 words, and plain section words ("driver", "historical"),
// which repeat the category scored on its own. Series tags such as head2head or betcast stay topical.
const GENERIC_TAGS = new Set(['f1', 'formula 1', 'racing', 'misc', 'random', 'images', 'gallery', 'gp',
    'news', 'analysis', 'technical', 'tech', 'history', 'historical', 'opinion', 'opinions', 'betting', 'bet',
    'driver', 'drivers', 'team', 'teams']);
// One spelling per tag: Unicode form, case and final sigma never split a tag.
const tagKey = tag => String(tag).normalize('NFC').toLocaleLowerCase().replace(/ς/g, 'σ');
const topicTags = post => [...new Set(getPostTaxonomy(post).tags.map(tagKey))].filter(tag => !GENERIC_TAGS.has(tag));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
// Rarer tags say more about a story: weight = ln(stories / stories carrying the tag), over the stories readers can open.
function tagWeights(posts) {
    const counts = new Map();
    posts.forEach(post => topicTags(post).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return new Map([...counts].map(([tag, count]) => [tag, Math.log(posts.length / count)]));
}

// How well `candidate` fits as further reading for `post`, strongest evidence first:
// - both are human-approved substantive subjects of the same entity (`subjects`: article id → entity ids, from the
//   approval gate; pending proposals and tag matches never count);
// - their specific tags overlap: weighted shared tags over all of both stories' tags, so a story tagged with every team
//   is no longer a strong match for each of them;
// - the same section, then the same writer or a nearby date as minor signals.
function relatedScore(post, candidate, { weights, subjects }) {
    const entities = subjects.get(candidate.id);
    const sharedSubjects = [...(subjects.get(post.id) || [])].filter(entity => entities && entities.has(entity)).length;
    const a = new Set(topicTags(post)), b = topicTags(candidate);
    const weight = tag => weights.get(tag) || 0;
    const shared = b.filter(tag => a.has(tag)).reduce((sum, tag) => sum + weight(tag), 0);
    const union = [...new Set([...a, ...b])].reduce((sum, tag) => sum + weight(tag), 0);
    const ta = getPostTaxonomy(post), tb = getPostTaxonomy(candidate);
    const days = Math.abs(Date.parse(post.date) - Date.parse(candidate.date)) / 864e5;
    // An approved shared subject (9) always outweighs the strongest tag overlap (at most 8).
    return Math.min(sharedSubjects, 2) * 9
        + (union ? (shared / union) * 8 : 0)
        + (tb.category === ta.category ? 1.5 : ta.categories.some(category => tb.categories.includes(category)) ? 0.5 : 0)
        + (candidate.author && candidate.author === post.author ? 0.5 : 0)
        + (days <= 30 ? 0.5 : 0);
}

// Three further stories for `post`. Only stories readers can open (released, dated `today` or earlier) are offered.
// `picturesOf(post)` lists keys of the photographs a post shows (cover and card); a candidate whose card repeats the
// article's own cover or another chosen card is passed over, so one photograph appears once per page. Ties fall to the
// newer story, then the article id, so the choice never depends on input order.
function scoreRelatedPosts(blogPosts, post, index, picturesOf = () => [], { today = athensDay(), subjects = new Map() } = {}) {
    const shown = new Set(picturesOf(post));
    const distinct = candidate => {
        const keys = picturesOf(candidate).slice(-1);
        if (keys.some(key => shown.has(key))) return false;
        keys.forEach(key => shown.add(key));
        return true;
    };
    const readable = blogPosts.filter(candidate => isDay(candidate.date) && candidate.date <= today && isReleased(candidate));
    const open = readable.filter(candidate => candidate !== blogPosts[index] && candidate.id !== post.id);
    const newestFirst = (a, b) => compare(b.date, a.date) || compare(a.id, b.id);
    const weights = tagWeights(readable);
    const scored = open.map(candidate => ({ post: candidate, score: relatedScore(post, candidate, { weights, subjects }) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || newestFirst(a.post, b.post));

    const relatedPosts = [];
    for (const candidate of scored.map(item => item.post)) {
        if (relatedPosts.length === 3) break;
        if (distinct(candidate)) relatedPosts.push(candidate);
    }
    const ids = new Set(relatedPosts.map(candidate => candidate.id));
    for (const candidate of open.slice().sort(newestFirst)) {
        if (relatedPosts.length === 3) break;
        if (!ids.has(candidate.id) && distinct(candidate)) relatedPosts.push(candidate);
    }
    return relatedPosts;
}

// Article id → the entities a human approved it as a substantive subject of, from the approval gate's selection
// (selectHubs: every entity, published or not; only approved, substantive, published members).
function approvedSubjects(hubs) {
    const subjects = new Map();
    for (const { entity, posts } of hubs) for (const post of posts) {
        if (!subjects.has(post.id)) subjects.set(post.id, new Set());
        subjects.get(post.id).add(entity.id);
    }
    return subjects;
}

module.exports = { topicTags, tagWeights, scoreRelatedPosts, approvedSubjects };
