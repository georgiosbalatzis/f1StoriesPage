document.addEventListener('DOMContentLoaded', function () {
    const $ = selector => document.querySelector(selector);
    const $$ = selector => Array.from(document.querySelectorAll(selector));

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
