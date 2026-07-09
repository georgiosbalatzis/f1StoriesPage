document.addEventListener('DOMContentLoaded', function () {
    const $ = selector => document.querySelector(selector);
    const $$ = selector => Array.from(document.querySelectorAll(selector));

    const normalizeTag = value => String(value || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tagList = $('[data-tag-list]');
    const tagsSource = $('[data-tags]');
    if (tagList && tagsSource) {
        const seen = new Set();
        const chips = String(tagsSource.dataset.tags || '')
            .split(/[,|/]+/)
            .map(normalizeTag)
            .filter(Boolean)
            .filter(tag => {
                const key = tag.toLocaleLowerCase('el-GR');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 8)
            .map(tag => {
                const chip = document.createElement('span');
                chip.className = 'article-tag-chip';
                chip.textContent = tag;
                return chip;
            });

        if (chips.length) {
            tagList.replaceChildren(...chips);
        } else {
            tagList.closest('.article-rail-card')?.setAttribute('hidden', '');
        }
    }

    const railRelated = $('[data-rail-related]');
    if (railRelated) {
        const links = $$('.related-card-link')
            .slice(0, 3)
            .map(card => {
                const title = card.querySelector('h3')?.textContent.trim();
                const href = card.getAttribute('href');
                if (!title || !href) return null;

                const link = document.createElement('a');
                link.className = 'article-rail-related-item';
                link.href = href;
                link.textContent = title;
                return link;
            })
            .filter(Boolean);

        if (links.length) {
            railRelated.replaceChildren(...links);
        } else {
            railRelated.closest('.article-rail-card')?.setAttribute('hidden', '');
        }
    }
});
