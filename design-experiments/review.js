let page = 'homepage', viewport = 'desktop';
const pages = {homepage:'index.html',article:'article.html','data-hub':'data.html'};
function update() {
 document.body.classList.toggle('mobile-comparison', viewport === 'mobile');
 for (const card of document.querySelectorAll('[data-concept]')) {
  const c = card.dataset.concept, base = `/screenshots/final/${c}-${page}-${viewport}`;
  const image = card.querySelector('.screenshot-link img');
  image.src = `${base}-viewport.png`;
  image.alt = `${card.querySelector('h2').textContent} — ${page}, ${viewport}`;
  image.width = viewport === 'mobile' ? 390 : 1440;
  image.height = viewport === 'mobile' ? 844 : 900;
  card.querySelector('.screenshot-link').href = `${base}.png`;
  card.querySelector('.full-capture').href = `${base}.png`;
  card.querySelector('.open-live').href = `/concept-${c}/${pages[page]}`;
  for(const link of card.querySelectorAll('[data-frame]')) link.href = `/preview.html?concept=${c}&width=${link.dataset.frame}&page=${page}`;
 }
 document.querySelector('#selection-status').textContent = `${page === 'data-hub' ? 'Data Hub' : page === 'article' ? 'Article' : 'Homepage'} · ${viewport === 'mobile' ? 'Mobile' : 'Desktop'}`;
 for(const b of document.querySelectorAll('[data-page]')) b.setAttribute('aria-pressed',String(b.dataset.page===page));
 for(const b of document.querySelectorAll('[data-viewport]')) b.setAttribute('aria-pressed',String(b.dataset.viewport===viewport));
}
for(const b of document.querySelectorAll('[data-page]')) b.addEventListener('click',()=>{page=b.dataset.page;update()});
for(const b of document.querySelectorAll('[data-viewport]')) b.addEventListener('click',()=>{viewport=b.dataset.viewport;update()});
