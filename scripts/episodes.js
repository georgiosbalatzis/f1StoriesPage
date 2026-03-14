/* ============================================================
   F1 STORIES — episodes.js (Phase 4)
   
   Handles:
   - Skeleton → real card transition
   - Filter bar logic
   - Standardized episode card rendering
   - Load more pagination
   
   Integration:
   - This expects your YouTube API to provide episode data.
   - If window.f1Episodes is set before this script runs, it
     will use that data. Otherwise, it hooks into your existing
     f1-optimized.js episode loading via MutationObserver.
   
   Data shape expected per episode:
   {
     id: 'youtube-video-id',
     title: 'Episode title',
     date: '2025-01-15',           // ISO date string
     duration: '58:32',            // or seconds
     description: 'Short desc...',
     thumbnail: 'https://img.youtube.com/vi/.../hqdefault.jpg',
     category: 'betcast|live|boxbox|podcast|shorts|general',
     url: 'https://youtube.com/watch?v=...'
   }
   ============================================================ */

(function() {
    'use strict';

    /* ── Config ── */
    var CARDS_PER_PAGE = 9;
    var currentFilter = 'all';
    var allEpisodes = [];
    var visibleCount = 0;

    /* ── DOM refs ── */
    var grid = document.getElementById('episodes-grid');
    var emptyState = document.getElementById('episodes-empty');
    var loadMoreBtn = document.getElementById('load-more-btn');
    var filterChips = document.querySelectorAll('.filter-chip');
    var filterCount = document.querySelector('.filter-status__count');
    var filterClear = document.querySelector('.filter-status__clear');

    /* ── Utilities ── */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function truncate(str, maxLen) {
        if (!str) return '';
        str = str.trim();
        if (str.length <= maxLen) return str;
        return str.substring(0, maxLen).trim() + '…';
    }

    function detectCategory(title) {
        var t = (title || '').toLowerCase();
        if (t.includes('betcast') || t.includes('bet cast')) return 'betcast';
        if (t.includes('live') || t.includes('ζωντανά')) return 'live';
        if (t.includes('box box') || t.includes('boxbox')) return 'boxbox';
        if (t.includes('#shorts') || t.includes('short')) return 'shorts';
        if (t.includes('podcast') || t.includes('ep.') || t.includes('episode')) return 'podcast';
        return 'general';
    }

    /* ── 4.2: Standardized card HTML ── */
    function createCardHTML(ep) {
        var cat = ep.category || detectCategory(ep.title);
        var tagHTML = '';
        
        if (cat === 'live') {
            tagHTML = '<span class="ep-card__tag ep-card__tag--live">LIVE</span>';
        } else if (cat === 'shorts') {
            tagHTML = '<span class="ep-card__tag ep-card__tag--shorts">Short</span>';
        } else if (cat === 'betcast') {
            tagHTML = '<span class="ep-card__tag">BetCast</span>';
        } else if (cat === 'boxbox') {
            tagHTML = '<span class="ep-card__tag">BoxBox</span>';
        }

        var durationHTML = ep.duration 
            ? '<span class="ep-card__duration">' + ep.duration + '</span>' 
            : '';

        var url = ep.url || ('https://www.youtube.com/watch?v=' + ep.id);
        var thumb = ep.thumbnail || ('https://img.youtube.com/vi/' + ep.id + '/hqdefault.jpg');
        var excerpt = truncate(ep.description || '', 80);
        var metaDate = formatDate(ep.date);
        var metaDuration = ep.duration ? '<i class="fas fa-clock"></i> ' + ep.duration : '';
        var metaSep = (metaDate && metaDuration) ? ' <span style="opacity:.4">·</span> ' : '';

        return '<div class="col-md-6 col-lg-4 ep-card-wrapper" data-category="' + cat + '">' +
            '<a href="' + url + '" target="_blank" class="ep-card" title="' + (ep.title || '').replace(/"/g, '&quot;') + '">' +
                '<div class="ep-card__thumb">' +
                    '<img src="' + thumb + '" alt="' + (ep.title || '').replace(/"/g, '&quot;') + '" loading="lazy">' +
                    tagHTML +
                    durationHTML +
                    '<div class="ep-card__play"><i class="fas fa-play"></i></div>' +
                '</div>' +
                '<div class="ep-card__body">' +
                    '<h3 class="ep-card__title">' + (ep.title || 'Untitled') + '</h3>' +
                    '<div class="ep-card__meta">' + metaDate + metaSep + metaDuration + '</div>' +
                    (excerpt ? '<p class="ep-card__excerpt">' + excerpt + '</p>' : '') +
                    '<span class="ep-card__cta">Play <i class="fas fa-play"></i></span>' +
                '</div>' +
            '</a>' +
        '</div>';
    }

    /* ── Remove skeletons ── */
    function removeSkeletons(callback) {
        var skeletons = grid.querySelectorAll('.skeleton-card-wrapper');
        if (skeletons.length === 0) {
            if (callback) callback();
            return;
        }

        skeletons.forEach(function(sk) {
            sk.classList.add('removing');
        });

        setTimeout(function() {
            skeletons.forEach(function(sk) {
                sk.remove();
            });
            if (callback) callback();
        }, 300);
    }

    /* ── Render episodes ── */
    function renderEpisodes() {
        var filtered = currentFilter === 'all' 
            ? allEpisodes 
            : allEpisodes.filter(function(ep) {
                return (ep.category || detectCategory(ep.title)) === currentFilter;
            });

        // Update count
        if (filterCount) {
            filterCount.textContent = filtered.length + ' episode' + (filtered.length !== 1 ? 's' : '');
        }

        // Show/hide clear button
        if (filterClear) {
            filterClear.style.display = currentFilter === 'all' ? 'none' : 'inline-flex';
        }

        // Clear grid (keep only non-skeleton content)
        var existingCards = grid.querySelectorAll('.ep-card-wrapper');
        existingCards.forEach(function(c) { c.remove(); });

        if (filtered.length === 0) {
            emptyState.style.display = 'block';
            loadMoreBtn.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';

        // Show first page
        visibleCount = Math.min(CARDS_PER_PAGE, filtered.length);
        var html = '';
        for (var i = 0; i < visibleCount; i++) {
            html += createCardHTML(filtered[i]);
        }
        grid.insertAdjacentHTML('beforeend', html);

        // Load more button
        loadMoreBtn.style.display = filtered.length > visibleCount ? 'inline-block' : 'none';
    }

    /* ── Load more ── */
    function loadMore() {
        var filtered = currentFilter === 'all'
            ? allEpisodes
            : allEpisodes.filter(function(ep) {
                return (ep.category || detectCategory(ep.title)) === currentFilter;
            });

        var nextBatch = filtered.slice(visibleCount, visibleCount + CARDS_PER_PAGE);
        var html = '';
        nextBatch.forEach(function(ep) {
            html += createCardHTML(ep);
        });
        grid.insertAdjacentHTML('beforeend', html);
        visibleCount += nextBatch.length;

        loadMoreBtn.style.display = filtered.length > visibleCount ? 'inline-block' : 'none';
    }

    /* ── Filter logic ── */
    filterChips.forEach(function(chip) {
        chip.addEventListener('click', function() {
            currentFilter = chip.dataset.filter;

            filterChips.forEach(function(c) {
                c.classList.remove('active');
                c.setAttribute('aria-selected', 'false');
            });
            chip.classList.add('active');
            chip.setAttribute('aria-selected', 'true');

            renderEpisodes();
        });
    });

    if (filterClear) {
        filterClear.addEventListener('click', function() {
            document.querySelector('[data-filter="all"]').click();
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMore);
    }

    /* ── Initialize ── */
    function init(episodes) {
        allEpisodes = episodes || [];
        
        // Auto-detect categories if not provided
        allEpisodes.forEach(function(ep) {
            if (!ep.category) {
                ep.category = detectCategory(ep.title);
            }
        });

        removeSkeletons(function() {
            renderEpisodes();
        });
    }

    /* ── Integration points ── */

    // Option 1: Data already available
    if (window.f1Episodes && window.f1Episodes.length) {
        init(window.f1Episodes);
        return;
    }

    // Option 2: Hook into existing episode loading via MutationObserver
    // Watches for the old .episode-card elements being added by f1-optimized.js
    // and converts them to the new format
    var observer = new MutationObserver(function(mutations) {
        var hasNewCards = false;
        mutations.forEach(function(m) {
            m.addedNodes.forEach(function(node) {
                if (node.nodeType === 1 && (
                    node.classList.contains('episode-card') || 
                    node.querySelector && node.querySelector('.episode-card')
                )) {
                    hasNewCards = true;
                }
            });
        });

        if (hasNewCards) {
            observer.disconnect();
            
            // Parse existing cards into our data format
            var cards = document.querySelectorAll('.episode-card');
            var parsed = [];
            cards.forEach(function(card) {
                var titleEl = card.querySelector('.video-title');
                var descEl = card.querySelector('.video-description');
                var durationEl = card.querySelector('.video-duration');
                var imgEl = card.querySelector('img');
                var linkEl = card.querySelector('a[href*="youtube"]') || card.querySelector('a');
                var dateEl = card.querySelector('.video-date');

                parsed.push({
                    id: '',
                    title: titleEl ? titleEl.textContent.trim() : '',
                    description: descEl ? descEl.textContent.trim() : '',
                    duration: durationEl ? durationEl.textContent.trim() : '',
                    thumbnail: imgEl ? imgEl.src : '',
                    url: linkEl ? linkEl.href : '#',
                    date: dateEl ? dateEl.textContent.trim() : '',
                    category: null  // will be auto-detected
                });

                // Remove old card
                var wrapper = card.closest('.col-md-6, .col-lg-4, [class*="col-"]');
                if (wrapper) wrapper.remove();
                else card.remove();
            });

            if (parsed.length) {
                init(parsed);
            }
        }
    });

    observer.observe(grid, { childList: true, subtree: true });

    // Option 3: Timeout fallback — if nothing loads in 8s, remove skeletons
    setTimeout(function() {
        if (allEpisodes.length === 0) {
            observer.disconnect();
            removeSkeletons(function() {
                // Show empty or whatever f1-optimized.js rendered
                if (grid.children.length === 0) {
                    emptyState.style.display = 'block';
                }
            });
        }
    }, 8000);

    // Expose for external use
    window.f1EpisodesInit = init;

})();
