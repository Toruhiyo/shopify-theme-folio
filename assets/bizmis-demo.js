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
  var COACH_START_MS = 1600;   // wait for the widget to mount before the first hint
  var COACH_SHOW_MS = 6000;    // how long a hint lingers
  var COACH_GAP_MS = 250;      // brief pause between hints (kept short)
  var COACH_FADE_MS = 600;     // matches the CSS fade duration
  var COACH_WORD_MS = 340;     // karaoke dwell per word (matches the landing page)
  var COACH_MARGIN = 12;       // viewport edge padding
  var COACH_GAP_PX = 10;       // gap between the hint and the widget card
  var COACH_FIND_MS = 250;     // how often to re-scan for the widget card
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
      if (label) {
        var labelTarget = link.querySelector('[data-bizmis-install-label]') || link;
        labelTarget.textContent = label;
      }
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

  function hasBackground(el) {
    var bg = window.getComputedStyle(el).backgroundColor;
    return bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)';
  }

  /* The visible widget is a framer-motion draggable card inside the fixed mount.
     The card overflows a much taller transparent avatar canvas, so we can't use
     the largest descendant. Instead take the largest element that actually paints
     a background — that's the card box, and it follows drags/scrolls/resizes. */
  function findWidgetCard(root) {
    var nodes = root.getElementsByTagName('*');
    var best = null;
    var bestArea = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var r = el.getBoundingClientRect();
      var area = r.width * r.height;
      if (area <= bestArea) continue;
      if (!hasBackground(el)) continue;
      bestArea = area;
      best = el;
    }
    return best;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /* Keep the hint pinned just above the widget card every frame so it rides
     along with drags, scrolls, and resizes. */
  function trackToWidget(coach) {
    var root = null;
    var target = null;
    var lastFind = 0;

    function frame() {
      if (!root || !root.isConnected) root = findWidgetRoot();
      if (root && (!target || !target.isConnected)) {
        var now = (window.performance && performance.now()) || Date.now();
        if (now - lastFind > COACH_FIND_MS) { target = findWidgetCard(root); lastFind = now; }
      }

      var rect = target ? target.getBoundingClientRect() : (root ? root.getBoundingClientRect() : null);

      /* Match the widget card's width so the two stack as one column. */
      if (rect && rect.width) coach.style.width = rect.width + 'px';

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

      coach.style.left = clamp(centerX - w / 2, COACH_MARGIN, vw - w - COACH_MARGIN) + 'px';
      coach.style.top = Math.max(anchorTop - COACH_GAP_PX - h, COACH_MARGIN) + 'px';

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
    var wordTimers = [];

    function clearWordTimers() {
      for (var i = 0; i < wordTimers.length; i++) window.clearTimeout(wordTimers[i]);
      wordTimers = [];
    }

    /* Karaoke caption: sweep the highlight across the words one at a time, like
       the landing page. */
    function runKaraoke(slide) {
      clearWordTimers();
      var words = slide.querySelectorAll('.bizmis-coach__word');
      if (!words.length) return;

      function step(i) {
        for (var w = 0; w < words.length; w++) words[w].classList.remove('is-current');
        if (i >= words.length) return;
        words[i].classList.add('is-current');
        wordTimers.push(window.setTimeout(function () { step(i + 1); }, COACH_WORD_MS));
      }
      step(0);
    }

    /* The card stays put; only the suggestion text fades in, lingers, fades
       out, pauses, then the next one fades in. */
    function showText() {
      var slide = slides[index];
      slide.classList.add('is-active');
      runKaraoke(slide);
      if (slides.length < 2) return;
      timer = window.setTimeout(hideText, COACH_SHOW_MS);
    }

    function hideText() {
      clearWordTimers();
      slides[index].classList.remove('is-active');
      timer = window.setTimeout(function () {
        index = (index + 1) % slides.length;
        showText();
      }, COACH_FADE_MS + COACH_GAP_MS);
    }

    if (bubble && slides.length > 1) {
      bubble.addEventListener('mouseenter', function () {
        if (timer) { window.clearTimeout(timer); timer = null; }
        slides[index].classList.add('is-active');
      });
      bubble.addEventListener('mouseleave', function () {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(hideText, COACH_SHOW_MS);
      });
    }

    timer = window.setTimeout(function () {
      coach.classList.add('is-shown');
      showText();
    }, COACH_START_MS);
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
