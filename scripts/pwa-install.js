/* ============================================================
   F1 Stories — PWA Install Prompt
   - Registers the service worker
   - On Android/Chrome: captures beforeinstallprompt and shows
     a custom banner after the user has spent time on the site
   - On iOS Safari: detects standalone-eligibility and shows
     an "Add to Home Screen" instruction banner
   ============================================================ */

(function () {
  'use strict';

  // ── Register service worker ───────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  // Don't show prompt if already running as installed PWA
  if (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true) return;

  // Don't show if user already dismissed permanently
  if (localStorage.getItem('f1-pwa-dismissed') === 'true') return;

  var deferredPrompt = null;
  var bannerShown = false;

  // ── Detect platform ───────────────────────────
  var ua = navigator.userAgent;
  var isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  var isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
  var isAndroid = /android/i.test(ua);

  // ── Build banner HTML ─────────────────────────
  function createBanner(isIOS) {
    var banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.setAttribute('role', 'banner');
    banner.setAttribute('aria-label', 'Εγκατάσταση εφαρμογής');

    var content = isIOS
      ? '<span class="pwa-banner__icon"><img src="/images/icons/icon-192.png" alt=""></span>' +
        '<span class="pwa-banner__text">' +
          '<strong>Πρόσθεσέ μας στην Αρχική</strong>' +
          '<span>Πάτα <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true"><path d="M7 1v10M3 5l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="1" y="8" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/></svg> και μετά <em>«Προσθήκη στην Αρχική Οθόνη»</em></span>' +
        '</span>'
      : '<span class="pwa-banner__icon"><img src="/images/icons/icon-192.png" alt=""></span>' +
        '<span class="pwa-banner__text">' +
          '<strong>Εγκατάσταση εφαρμογής</strong>' +
          '<span>Πρόσθεσε το F1 Stories στην αρχική σου οθόνη</span>' +
        '</span>' +
        '<button class="pwa-banner__install" id="pwa-install-btn">Εγκατάσταση</button>';

    banner.innerHTML = content +
      '<button class="pwa-banner__close" id="pwa-dismiss-btn" aria-label="Κλείσιμο">✕</button>';

    return banner;
  }

  // ── Inject banner styles ──────────────────────
  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = [
      '#pwa-install-banner{',
        'position:fixed;bottom:0;left:0;right:0;z-index:10000;',
        'display:flex;align-items:center;gap:.75rem;',
        'padding:max(.85rem,env(safe-area-inset-bottom,.85rem)) 1rem .85rem;',
        'background:rgba(22,22,24,.97);',
        'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
        'border-top:1px solid rgba(255,255,255,.1);',
        'box-shadow:0 -4px 24px rgba(0,0,0,.5);',
        'transform:translateY(100%);',
        'transition:transform .35s cubic-bezier(.2,.8,.3,1);',
        'font-family:system-ui,-apple-system,sans-serif;',
      '}',
      '[data-theme="light"] #pwa-install-banner{',
        'background:rgba(255,255,255,.97);',
        'border-top-color:rgba(0,0,0,.08);',
      '}',
      '#pwa-install-banner.visible{transform:translateY(0);}',
      '.pwa-banner__icon img{width:40px;height:40px;border-radius:10px;flex-shrink:0;}',
      '.pwa-banner__text{flex:1;min-width:0;display:flex;flex-direction:column;gap:.15rem;}',
      '.pwa-banner__text strong{font-size:.88rem;font-weight:700;color:#e5e5e7;white-space:nowrap;}',
      '[data-theme="light"] .pwa-banner__text strong{color:#1d1d1f;}',
      '.pwa-banner__text span{font-size:.78rem;color:#a1a1a6;line-height:1.4;}',
      '.pwa-banner__text em{font-style:normal;font-weight:600;color:#3b82f6;}',
      '.pwa-banner__text svg{vertical-align:middle;margin:0 2px;color:#a1a1a6;}',
      '.pwa-banner__install{',
        'flex-shrink:0;background:#3b82f6;color:#fff;border:none;',
        'padding:.5rem 1rem;border-radius:8px;font-size:.82rem;font-weight:600;',
        'cursor:pointer;white-space:nowrap;',
        'touch-action:manipulation;-webkit-tap-highlight-color:transparent;',
      '}',
      '.pwa-banner__install:active{opacity:.85;}',
      '.pwa-banner__close{',
        'flex-shrink:0;background:none;border:none;color:#6e6e73;',
        'font-size:.95rem;cursor:pointer;padding:.25rem .4rem;line-height:1;',
        'touch-action:manipulation;-webkit-tap-highlight-color:transparent;',
        'border-radius:4px;',
      '}',
      '.pwa-banner__close:active{background:rgba(255,255,255,.08);}',
      /* Push fixed bottom-left buttons (theme toggle + scroll-to-top) above the banner */
      'body.pwa-banner-open .theme-toggle-btn{',
        'bottom:calc(var(--pwa-h,72px) + 1rem) !important;',
        'transition:bottom .35s cubic-bezier(.2,.8,.3,1),transform .25s,color .25s,border-color .25s !important;',
      '}',
      'body.pwa-banner-open .scroll-to-top-btn{',
        'bottom:calc(var(--pwa-h,72px) + 1rem + 44px) !important;',
        'transition:bottom .35s cubic-bezier(.2,.8,.3,1),opacity .4s,visibility .4s,transform .4s cubic-bezier(.34,1.56,.64,1) !important;',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Show banner ───────────────────────────────
  function showBanner(isIOS) {
    if (bannerShown) return;
    bannerShown = true;

    injectStyles();
    var banner = createBanner(isIOS);
    document.body.appendChild(banner);

    // Animate in after paint, then measure height and push buttons up
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('visible');
        var h = banner.offsetHeight;
        document.documentElement.style.setProperty('--pwa-h', h + 'px');
        document.body.classList.add('pwa-banner-open');
      });
    });

    // Dismiss button
    document.getElementById('pwa-dismiss-btn').addEventListener('click', function () {
      dismissBanner(banner);
      localStorage.setItem('f1-pwa-dismissed', 'true');
    });

    // Install button (Android only)
    var installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        dismissBanner(banner);
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') {
            localStorage.setItem('f1-pwa-dismissed', 'true');
          }
          deferredPrompt = null;
        });
      });
    }

    // Auto-hide after 20s if not interacted
    setTimeout(function () { dismissBanner(banner); }, 20000);
  }

  function dismissBanner(banner) {
    banner.classList.remove('visible');
    document.body.classList.remove('pwa-banner-open');
    document.documentElement.style.removeProperty('--pwa-h');
    setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 400);
  }

  // ── Android: capture install prompt ──────────
  if (isAndroid || (!isIOS && !isIOSSafari)) {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      // Show after 30s or on second page load
      var visits = parseInt(sessionStorage.getItem('f1-visits') || '0', 10) + 1;
      sessionStorage.setItem('f1-visits', visits);
      if (visits >= 2) {
        setTimeout(function () { showBanner(false); }, 3000);
      } else {
        setTimeout(function () { showBanner(false); }, 30000);
      }
    });
  }

  // ── iOS Safari: show manual instructions ─────
  if (isIOSSafari) {
    var iosVisits = parseInt(localStorage.getItem('f1-ios-visits') || '0', 10) + 1;
    localStorage.setItem('f1-ios-visits', iosVisits);
    // Show on 2nd+ visit, after 4s
    if (iosVisits >= 2) {
      setTimeout(function () { showBanner(true); }, 4000);
    }
  }

})();
