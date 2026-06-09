/* ============================================
   BIZMIS DEMO — early-access install loop (BIZ-134)
   --------------------------------------------
   bizmis.ai/demo redirects here with ?ref=<lead>&code=<early-access-code>&utm_*.
   The redirect only lands on the entry page, so we persist the attribution and
   re-apply it to every install CTA + code chip as the visitor browses the store.
   ============================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'bizmis:demo:attribution';
  var DISMISS_KEY = 'bizmis:demo:bar-dismissed';
  var COACH_DISMISS_KEY = 'bizmis:demo:coach-dismissed';
  var COPIED_RESET_MS = 2000;
  var COACH_ROTATE_MS = 4500;

  function isAttributionParam(key) {
    return key === 'ref' || key === 'code' || key.indexOf('utm_') === 0;
  }

  function readStored() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function writeStored(attribution) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    } catch (error) {
      /* Private mode / quota — attribution stays in-memory for this page only. */
    }
  }

  /* Merge fresh URL params over anything we persisted on an earlier page. */
  function resolveAttribution() {
    var stored = readStored();
    var params = new URLSearchParams(window.location.search);
    var changed = false;

    params.forEach(function (value, key) {
      if (isAttributionParam(key) && value) {
        stored[key] = value;
        changed = true;
      }
    });

    if (changed) writeStored(stored);
    return stored;
  }

  function effectiveCode(attribution, fallbackCode) {
    return attribution.code || fallbackCode || '';
  }

  function buildInstallUrl(base, attribution, fallbackCode) {
    var url;
    try {
      url = new URL(base, window.location.origin);
    } catch (error) {
      return base;
    }
    Object.keys(attribution).forEach(function (key) {
      if (isAttributionParam(key) && attribution[key]) {
        url.searchParams.set(key, attribution[key]);
      }
    });
    var code = effectiveCode(attribution, fallbackCode);
    if (code) url.searchParams.set('code', code);
    return url.toString();
  }

  function hydrateInstallLinks(attribution, fallbackCode) {
    var hasCode = Boolean(effectiveCode(attribution, fallbackCode));
    document.querySelectorAll('[data-bizmis-install]').forEach(function (link) {
      if (!link.dataset.base) link.dataset.base = link.getAttribute('href') || '';
      link.setAttribute('href', buildInstallUrl(link.dataset.base, attribution, fallbackCode));

      var label = hasCode ? link.dataset.labelWithCode : link.dataset.labelNoCode;
      if (label) link.textContent = label;
    });
  }

  function hydrateCodeDisplays(attribution, fallbackCode) {
    var code = effectiveCode(attribution, fallbackCode);

    document.querySelectorAll('[data-bizmis-code]').forEach(function (el) {
      el.textContent = code;
    });

    document.querySelectorAll('[data-bizmis-code-chip]').forEach(function (chip) {
      chip.hidden = !code;
    });
  }

  function initCopyButtons() {
    document.querySelectorAll('[data-bizmis-code-copy]').forEach(function (button) {
      button.addEventListener('click', function () {
        var chip = button.closest('[data-bizmis-code-chip]') || document;
        var codeEl = chip.querySelector('[data-bizmis-code]');
        var code = codeEl ? codeEl.textContent.trim() : '';
        if (!code || !navigator.clipboard) return;

        navigator.clipboard.writeText(code).then(function () {
          var original = button.textContent;
          button.textContent = button.dataset.copiedLabel || 'Copied';
          setTimeout(function () { button.textContent = original; }, COPIED_RESET_MS);
        }).catch(function () { /* clipboard blocked */ });
      });
    });
  }

  function initBar() {
    var bar = document.querySelector('[data-bizmis-demo-bar]');
    if (!bar) return;

    var dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch (error) {
      /* sessionStorage unavailable — show the bar. */
    }
    if (dismissed) return;

    bar.hidden = false;
    document.body.classList.add('has-bizmis-demo-bar');

    var dismissButton = bar.querySelector('[data-bizmis-demo-dismiss]');
    if (dismissButton) {
      dismissButton.addEventListener('click', function () {
        bar.hidden = true;
        document.body.classList.remove('has-bizmis-demo-bar');
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (error) { /* ignore */ }
      });
    }
  }

  /* Floating coachmark: reveal it, wire dismissal, and auto-rotate one
     tagged use case at a time (no visible controls — pauses on hover). */
  function initCoach() {
    var coach = document.querySelector('[data-bizmis-coach]');
    if (!coach) return;

    var dismissed = false;
    try {
      dismissed = sessionStorage.getItem(COACH_DISMISS_KEY) === '1';
    } catch (error) {
      /* sessionStorage unavailable — show the coachmark. */
    }
    if (dismissed) return;

    coach.hidden = false;

    var closeButton = coach.querySelector('[data-bizmis-coach-close]');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        coach.hidden = true;
        try { sessionStorage.setItem(COACH_DISMISS_KEY, '1'); } catch (error) { /* ignore */ }
      });
    }

    var slides = coach.querySelectorAll('[data-bizmis-coach-slide]');
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;

    function show(next) {
      slides[index].classList.remove('is-active');
      index = (next + slides.length) % slides.length;
      slides[index].classList.add('is-active');
    }

    function start() {
      timer = window.setInterval(function () { show(index + 1); }, COACH_ROTATE_MS);
    }

    function stop() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    coach.addEventListener('mouseenter', stop);
    coach.addEventListener('mouseleave', start);
    start();
  }

  function init() {
    var bar = document.querySelector('[data-bizmis-demo-bar]');
    var fallbackCode = bar ? (bar.dataset.fallbackCode || '') : '';
    var attribution = resolveAttribution();

    hydrateInstallLinks(attribution, fallbackCode);
    hydrateCodeDisplays(attribution, fallbackCode);
    initCopyButtons();
    initBar();
    initCoach();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
