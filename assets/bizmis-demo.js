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

  /* Coachmark timing (kept slow + calm) and layout. */
  var COACH_START_MS = 1600;   // wait for the widget to mount before the first pop
  var COACH_SHOW_MS = 6000;    // how long a bubble lingers
  var COACH_GAP_MS = 1400;     // empty pause between bubbles
  var COACH_FADE_MS = 600;     // matches the CSS fade duration
  var COACH_MARGIN = 12;       // viewport edge padding
  var COACH_GAP_PX = 14;       // gap between the bubble tail and the widget
  var WIDGET_SELECTORS = ['#bizmis-avatar-embed', '.bizmis-avatar-widget-root', '#avatar-root', '[data-avatar-widget]'];

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

  function findWidgetRoot() {
    for (var i = 0; i < WIDGET_SELECTORS.length; i++) {
      var el = document.querySelector(WIDGET_SELECTORS[i]);
      if (el) return el;
    }
    return null;
  }

  /* The visible widget is a framer-motion draggable inside the fixed mount, so
     its position only shows on a descendant. Track the largest one — it follows
     the card (and the user dragging it) without depending on the widget's
     internal class names. */
  function largestDescendant(root) {
    var nodes = root.getElementsByTagName('*');
    var best = null;
    var bestArea = 0;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      var area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = nodes[i]; }
    }
    return best;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /* Keep the bubble pinned just above the widget every frame so it rides along
     with drags, scrolls, and resizes. */
  function trackToWidget(coach) {
    var root = null;
    var target = null;

    function frame() {
      if (!root || !root.isConnected) root = findWidgetRoot();

      var rect = null;
      if (root) {
        if (!target || !target.isConnected) {
          target = largestDescendant(root) || root;
        } else {
          var tr = target.getBoundingClientRect();
          if (tr.width * tr.height === 0) target = largestDescendant(root) || root;
        }
        rect = target.getBoundingClientRect();
        if (rect.width * rect.height === 0) rect = root.getBoundingClientRect();
      }

      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var w = coach.offsetWidth;
      var h = coach.offsetHeight;

      var centerX;
      var anchorTop;
      if (rect && (rect.width || rect.height)) {
        centerX = rect.left + rect.width / 2;
        anchorTop = rect.top;
      } else {
        centerX = vw - 56;       // fallback: roughly where the bottom-right widget sits
        anchorTop = vh - 96;
      }

      var left = clamp(centerX - w / 2, COACH_MARGIN, vw - w - COACH_MARGIN);
      var top = Math.max(anchorTop - COACH_GAP_PX - h, COACH_MARGIN);
      coach.style.left = left + 'px';
      coach.style.top = top + 'px';
      coach.style.setProperty('--tail-x', clamp(centerX - left, 18, w - 18) + 'px');

      window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
  }

  /* Pop one tagged use case at a time: fade in, linger, fade out, pause, next.
     Pauses while hovered so it can be read. */
  function initCoach() {
    var coach = document.querySelector('[data-bizmis-coach]');
    if (!coach) return;

    var bubble = coach.querySelector('[data-bizmis-coach-bubble]');
    var slides = coach.querySelectorAll('[data-bizmis-coach-slide]');
    if (!slides.length) return;

    coach.hidden = false;
    trackToWidget(coach);

    var index = 0;
    var timer = null;

    function setActive(i) {
      slides[index].classList.remove('is-active');
      index = (i + slides.length) % slides.length;
      slides[index].classList.add('is-active');
    }

    function advance() {
      coach.classList.remove('is-shown');
      timer = window.setTimeout(function () {
        setActive(index + 1);
        show();
      }, COACH_FADE_MS + COACH_GAP_MS);
    }

    function show() {
      coach.classList.add('is-shown');
      if (slides.length < 2) return;
      timer = window.setTimeout(advance, COACH_SHOW_MS);
    }

    if (bubble && slides.length > 1) {
      bubble.addEventListener('mouseenter', function () {
        if (timer) { window.clearTimeout(timer); timer = null; }
        coach.classList.add('is-shown');
      });
      bubble.addEventListener('mouseleave', function () {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(advance, COACH_SHOW_MS);
      });
    }

    setActive(0);
    timer = window.setTimeout(show, COACH_START_MS);
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
