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
  var COPIED_RESET_MS = 2000;

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

  function init() {
    var bar = document.querySelector('[data-bizmis-demo-bar]');
    var fallbackCode = bar ? (bar.dataset.fallbackCode || '') : '';
    var attribution = resolveAttribution();

    hydrateInstallLinks(attribution, fallbackCode);
    hydrateCodeDisplays(attribution, fallbackCode);
    initCopyButtons();
    initBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
