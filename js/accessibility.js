/* Accessibility toolbar: dyslexia-friendly typeface, a contrast boost,
   font scaling, a colour-blind friendly palette, and an explicit
   "reduce motion" override on top of the OS-level prefers-reduced-motion
   query. Preferences persist in localStorage and are applied to <html>
   synchronously here, in <head>, so a returning visitor never sees a
   flash of the un-adjusted page before this runs.

   The panel is a <details>/<summary> disclosure, the same pattern as the
   header menu in js/nav.js - keyboard-operable natively, with the same
   Escape/outside-click handling added for that menu, reimplemented here
   rather than generalising nav.js's copy, so neither script depends on
   the other's markup existing. */
(function () {
  'use strict';

  var STORAGE_KEY = 'kidscope-a11y';
  var MAX_FONT_STEP = 3;
  var FONT_STEP_LABELS = ['Normal', 'Larger', 'Largest', 'Maximum'];

  function defaults() {
    return { dyslexic: false, contrast: false, colorblind: false, reduceMotion: false, fontStep: 0 };
  }

  function readPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return {
        dyslexic: !!parsed.dyslexic,
        contrast: !!parsed.contrast,
        colorblind: !!parsed.colorblind,
        reduceMotion: !!parsed.reduceMotion,
        fontStep: Math.min(MAX_FONT_STEP, Math.max(0, parsed.fontStep | 0))
      };
    } catch (e) {
      return defaults();
    }
  }

  function writePrefs(prefs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (e) { /* storage blocked - state just won't persist */ }
  }

  var prefs = readPrefs();

  function applyPrefs() {
    var html = document.documentElement;
    html.classList.toggle('a11y-dyslexic', prefs.dyslexic);
    html.classList.toggle('a11y-contrast', prefs.contrast);
    html.classList.toggle('a11y-colorblind', prefs.colorblind);
    html.classList.toggle('a11y-reduce-motion', prefs.reduceMotion);
    html.setAttribute('data-a11y-font-step', String(prefs.fontStep));
  }

  applyPrefs(); // runs before <body> exists - prevents a flash of un-adjusted styles

  function commit() {
    writePrefs(prefs);
    applyPrefs();
    // Font size and the contrast toggle's thicker borders both change the
    // sticky header's height; nav.js only recalculates --header-h on
    // load/resize, so nudge it here.
    window.dispatchEvent(new Event('resize'));
  }

  function buildToolbar() {
    var widget = document.createElement('details');
    widget.className = 'a11y-widget';

    widget.innerHTML =
      '<summary class="a11y-toggle" aria-label="Accessibility settings">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M9 12h6"/><path d="M10 16h4"/></svg>' +
        '<span>Accessibility</span>' +
      '</summary>' +
      '<div class="a11y-panel">' +
        '<h2>Accessibility settings</h2>' +
        '<div class="a11y-group">' +
          '<span class="a11y-group-label">Reading</span>' +
          '<button type="button" class="a11y-btn" id="a11y-dyslexic" aria-pressed="false">' +
            '<span>Dyslexia-friendly font</span><span class="tick" aria-hidden="true">✓</span>' +
          '</button>' +
        '</div>' +
        '<div class="a11y-group">' +
          '<span class="a11y-group-label">Display</span>' +
          '<button type="button" class="a11y-btn" id="a11y-contrast" aria-pressed="false">' +
            '<span>High contrast</span><span class="tick" aria-hidden="true">✓</span>' +
          '</button>' +
          '<button type="button" class="a11y-btn" id="a11y-motion" aria-pressed="false">' +
            '<span>Reduce motion</span><span class="tick" aria-hidden="true">✓</span>' +
          '</button>' +
        '</div>' +
        '<div class="a11y-group">' +
          '<span class="a11y-group-label">Colour vision</span>' +
          '<button type="button" class="a11y-btn" id="a11y-colorblind" aria-pressed="false">' +
            '<span>Colour-blind friendly mode</span><span class="tick" aria-hidden="true">✓</span>' +
          '</button>' +
        '</div>' +
        '<div class="a11y-group">' +
          '<span class="a11y-group-label" id="a11y-fontsize-label">Text size</span>' +
          '<div class="a11y-steps" role="group" aria-labelledby="a11y-fontsize-label">' +
            '<button type="button" class="a11y-step-btn" id="a11y-font-down" aria-label="Decrease text size">A&minus;</button>' +
            '<span class="a11y-step-status" id="a11y-font-status" aria-live="polite">Normal</span>' +
            '<button type="button" class="a11y-step-btn" id="a11y-font-up" aria-label="Increase text size">A+</button>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="a11y-reset" id="a11y-reset">Reset all</button>' +
      '</div>';

    document.body.appendChild(widget);

    var toggle = widget.querySelector('.a11y-toggle');
    var dyslexicBtn = widget.querySelector('#a11y-dyslexic');
    var contrastBtn = widget.querySelector('#a11y-contrast');
    var colorblindBtn = widget.querySelector('#a11y-colorblind');
    var motionBtn = widget.querySelector('#a11y-motion');
    var fontDownBtn = widget.querySelector('#a11y-font-down');
    var fontUpBtn = widget.querySelector('#a11y-font-up');
    var fontStatus = widget.querySelector('#a11y-font-status');
    var resetBtn = widget.querySelector('#a11y-reset');

    function syncControls() {
      dyslexicBtn.setAttribute('aria-pressed', String(prefs.dyslexic));
      contrastBtn.setAttribute('aria-pressed', String(prefs.contrast));
      colorblindBtn.setAttribute('aria-pressed', String(prefs.colorblind));
      motionBtn.setAttribute('aria-pressed', String(prefs.reduceMotion));
      fontStatus.textContent = FONT_STEP_LABELS[prefs.fontStep];
      fontDownBtn.disabled = prefs.fontStep === 0;
      fontUpBtn.disabled = prefs.fontStep === MAX_FONT_STEP;
    }
    syncControls();

    dyslexicBtn.addEventListener('click', function () {
      prefs.dyslexic = !prefs.dyslexic;
      commit(); syncControls();
    });
    contrastBtn.addEventListener('click', function () {
      prefs.contrast = !prefs.contrast;
      commit(); syncControls();
    });
    colorblindBtn.addEventListener('click', function () {
      prefs.colorblind = !prefs.colorblind;
      commit(); syncControls();
    });
    motionBtn.addEventListener('click', function () {
      prefs.reduceMotion = !prefs.reduceMotion;
      commit(); syncControls();
    });
    fontDownBtn.addEventListener('click', function () {
      prefs.fontStep = Math.max(0, prefs.fontStep - 1);
      commit(); syncControls();
    });
    fontUpBtn.addEventListener('click', function () {
      prefs.fontStep = Math.min(MAX_FONT_STEP, prefs.fontStep + 1);
      commit(); syncControls();
    });
    resetBtn.addEventListener('click', function () {
      prefs = defaults();
      commit(); syncControls();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && widget.open) {
        widget.open = false;
        toggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (widget.open && !widget.contains(e.target)) {
        widget.open = false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildToolbar);
  } else {
    buildToolbar();
  }
})();
