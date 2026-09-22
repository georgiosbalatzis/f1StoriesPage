/* Shared behavior only; each concept owns its markup and visual system. */
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
const closeMenu = (restore = false) => {
  toggle?.setAttribute('aria-expanded', 'false');
  nav?.classList.remove('is-open');
  if (restore) toggle?.focus();
};
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
});
nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') closeMenu(true); });
document.addEventListener('click', event => { if (!event.target.closest('header')) closeMenu(); });
for (const button of document.querySelectorAll('[data-report]')) {
  button.addEventListener('click', () => {
    for (const other of document.querySelectorAll('[data-report]')) other.setAttribute('aria-pressed', String(other === button));
    for (const panel of document.querySelectorAll('.report-panel')) panel.hidden = panel.id !== `report-${button.dataset.report}`;
  });
}
for (const button of document.querySelectorAll('[data-video]')) {
  button.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${button.dataset.video}?autoplay=0`;
    iframe.title = 'BetCast #270 Hungaroring — F1Stories';
    iframe.allow = 'encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    button.replaceWith(iframe);
    iframe.focus();
  });
}
const readingBreakpoint = matchMedia('(max-width: 600px)');
const setReadingIndex = () => { const index = document.querySelector('.reading-index'); if (index) index.open = !readingBreakpoint.matches; };
setReadingIndex();
readingBreakpoint.addEventListener('change', setReadingIndex);
