/* Accessibility toolbar: dyslexia-friendly typeface, a contrast boost,
   font scaling, a colour-blind friendly palette, a "read this page aloud"
   control, and an explicit "reduce motion" override on top of the OS-level
   prefers-reduced-motion query. Preferences persist in localStorage and are
   applied to <html> synchronously here, in <head>, so a returning visitor
   never sees a flash of the un-adjusted page before this runs.

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

  // Same test js/motion.js uses: the OS query, or this toolbar's own override.
  function reducedMotion() {
    var osPref = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !!osPref || document.documentElement.classList.contains('a11y-reduce-motion');
  }

  /* ======================================================================
     Read aloud (Web Speech API)
     ----------------------------------------------------------------------
     Deliberately NOT part of prefs/localStorage: this is an action a
     visitor takes on one page, not a setting to carry between visits.

     Returns null - and buildToolbar then omits the control entirely - on
     any browser without speechSynthesis, so nobody is offered a button
     that quietly does nothing.
     ====================================================================== */
  var speech = (function () {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return null;

    var synth = window.speechSynthesis;

    /* Elements carrying no readable prose, plus <nav>: the resources
       page's jump list would otherwise read out eleven category names
       immediately before reading the same eleven headings. */
    var SKIP_TAGS = {
      script: 1, style: 1, noscript: 1, template: 1, iframe: 1, svg: 1,
      canvas: 1, video: 1, audio: 1, img: 1, input: 1, select: 1,
      textarea: 1, nav: 1
    };

    /* Anything generating its own line box starts a new chunk. Read from
       the computed style rather than a tag list, so the card grids
       (display:flex on an <a>) chunk correctly too. */
    var BLOCK_DISPLAY = {
      block: 1, 'flow-root': 1, 'list-item': 1, flex: 1, grid: 1,
      table: 1, 'table-row': 1, 'table-cell': 1, 'table-caption': 1
    };

    /* Chrome truncates a long utterance at roughly fifteen seconds of
       speech, so cap a chunk at about one long sentence and split on
       sentence boundaries beyond that. */
    var MAX_CHUNK = 180;

    var chunks = [];
    var index = 0;
    var current = null;   // the utterance we are actually waiting on
    var marked = null;    // element currently carrying .a11y-speaking
    var active = false;
    var paused = false;
    var listener = null;

    function tidy(s) {
      return s
        .replace(/\s+/g, ' ')
        // Typographic separators (the breadcrumb's rsaquo, bullet
        // dividers) read as punctuation on screen but as noise aloud.
        .replace(/\s*[›»·•‣|]\s*/g, ', ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
    }

    function split(text) {
      if (text.length <= MAX_CHUNK) return [text];
      var sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
      var out = [];
      var buf = '';
      for (var i = 0; i < sentences.length; i++) {
        if (buf && (buf + sentences[i]).length > MAX_CHUNK) {
          out.push(buf.trim());
          buf = sentences[i];
        } else {
          buf += sentences[i];
        }
      }
      if (buf.trim()) out.push(buf.trim());
      return out;
    }

    /* Walks <main> and returns [{ el, text }, ...] in reading order.

       Deliberately does NOT test opacity: js/motion.js parks not-yet-
       revealed cards at opacity:0 until they scroll into view, so an
       opacity check would silently read only the part of the page the
       visitor had already scrolled past. */
    function collect() {
      var root = document.querySelector('main') || document.body;
      var out = [];
      var buf = '';
      var bufEl = null;

      function flush() {
        var text = tidy(buf);
        buf = '';
        if (!bufEl || !text || !/[a-z0-9]/i.test(text)) { bufEl = null; return; }
        var parts = split(text);
        for (var i = 0; i < parts.length; i++) out.push({ el: bufEl, text: parts[i] });
        bufEl = null;
      }

      function walk(node, blockEl) {
        if (node.nodeType === 3) {            // text
          buf += node.nodeValue;
          bufEl = blockEl;
          return;
        }
        if (node.nodeType !== 1) return;      // comments and the rest

        var name = node.nodeName.toLowerCase();
        if (SKIP_TAGS[name]) return;
        if (name === 'br') { buf += ' '; return; }
        // Text the markup has already declared redundant to assistive
        // technology - the link-card summaries, the "&middot;" separators.
        if (node.hidden || node.getAttribute('aria-hidden') === 'true') return;

        var cs = window.getComputedStyle(node);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return;

        // A closed <details> renders its <summary> and nothing else. The
        // resources page keeps hundreds of collapsed links in the DOM.
        if (name === 'details' && !node.open) {
          var summary = node.querySelector('summary');
          if (summary) walk(summary, blockEl);
          return;
        }

        var isBlock = BLOCK_DISPLAY[cs.display] === 1;
        if (isBlock) flush();

        var kids = node.childNodes;
        for (var i = 0; i < kids.length; i++) walk(kids[i], isBlock ? node : blockEl);

        if (isBlock) flush();
      }

      walk(root, null);
      flush();
      return out;
    }

    function highlight(el) {
      if (marked === el) return;
      if (marked) marked.classList.remove('a11y-speaking');
      marked = el;
      if (!el) return;
      el.classList.add('a11y-speaking');
      // 'nearest' leaves an already-visible passage where it is, so the
      // page only moves when the reading runs off the bottom.
      try {
        el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      } catch (e) {
        el.scrollIntoView();
      }
    }

    function state() {
      return active ? (paused ? 'paused' : 'speaking') : 'idle';
    }

    function emit(message) {
      if (listener) listener(state(), message || '');
    }

    function speakAt(i) {
      index = i;
      if (i >= chunks.length) {
        active = false; paused = false; current = null;
        highlight(null);
        emit('Finished reading this page.');
        return;
      }

      var u = new SpeechSynthesisUtterance(chunks[i].text);
      u.lang = document.documentElement.lang || 'en';
      // No voice is picked on purpose: getVoices() is empty until the
      // async voiceschanged event fires on most browsers, and letting the
      // platform choose from lang sidesteps that race for no real loss.
      u.rate = 0.95;

      u.onend = function () {
        if (!active || current !== u) return;   // a cancelled utterance still fires
        speakAt(index + 1);
      };
      u.onerror = function (e) {
        if (!active || current !== u) return;
        if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
        stop('Sorry - this browser could not read the page aloud.');
      };

      current = u;
      highlight(chunks[i].el);
      synth.speak(u);
    }

    /* Chunks are a snapshot taken here: opening one of the resources
       dropdowns mid-read does not fold it into the reading in progress. */
    function start() {
      chunks = collect();
      if (!chunks.length) { emit('There is nothing to read on this page.'); return; }
      synth.cancel();          // clear any queue a previous read left stuck
      active = true;
      paused = false;
      emit();
      speakAt(0);
    }

    function pause() {
      if (!active || paused) return;
      synth.pause();
      paused = true;
      emit();
    }

    function resume() {
      if (!active || !paused) return;
      synth.resume();
      paused = false;
      emit();
    }

    function stop(message) {
      active = false;
      paused = false;
      current = null;
      chunks = [];
      synth.cancel();
      highlight(null);
      emit(message);
    }

    // Every link here is a full navigation, and speech otherwise outlives
    // the page that started it.
    window.addEventListener('pagehide', function () { synth.cancel(); });

    return {
      toggle: function () {
        if (!active) start();
        else if (paused) resume();
        else pause();
      },
      stop: function () { stop(); },
      onState: function (fn) { listener = fn; }
    };
  })();

  function buildToolbar() {
    var widget = document.createElement('details');
    widget.className = 'a11y-widget';

    var speechGroup = !speech ? '' :
      '<div class="a11y-group">' +
        '<span class="a11y-group-label">Listen</span>' +
        '<button type="button" class="a11y-btn a11y-btn--speak" id="a11y-speak">' +
          '<span id="a11y-speak-label">Read this page aloud</span>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.8 5.2a9 9 0 0 1 0 13.6"/></svg>' +
        '</button>' +
        '<button type="button" class="a11y-btn a11y-btn--stop" id="a11y-speak-stop" hidden>' +
          '<span>Stop reading</span>' +
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>' +
        '</button>' +
        '<p class="a11y-speak-status" id="a11y-speak-status" role="status"></p>' +
      '</div>';

    widget.innerHTML =
      '<summary class="a11y-toggle" aria-label="Accessibility settings">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M9 12h6"/><path d="M10 16h4"/></svg>' +
        '<span>Accessibility</span>' +
      '</summary>' +
      '<div class="a11y-panel">' +
        '<h2>Accessibility settings</h2>' +
        speechGroup +
        '<div class="a11y-group">' +
          '<span class="a11y-group-label">Reading</span>' +
          '<button type="button" class="a11y-btn" id="a11y-dyslexic" aria-pressed="false">' +
            '<span>Dyslexia-friendly font</span><span class="tick" aria-hidden="true">&#10003;</span>' +
          '</button>' +
        '</div>' +
        '<div class="a11y-group">' +
          '<span class="a11y-group-label">Display</span>' +
          '<button type="button" class="a11y-btn" id="a11y-contrast" aria-pressed="false">' +
            '<span>High contrast</span><span class="tick" aria-hidden="true">&#10003;</span>' +
          '</button>' +
          '<button type="button" class="a11y-btn" id="a11y-motion" aria-pressed="false">' +
            '<span>Reduce motion</span><span class="tick" aria-hidden="true">&#10003;</span>' +
          '</button>' +
        '</div>' +
        '<div class="a11y-group">' +
          '<span class="a11y-group-label">Colour vision</span>' +
          '<button type="button" class="a11y-btn" id="a11y-colorblind" aria-pressed="false">' +
            '<span>Colour-blind friendly mode</span><span class="tick" aria-hidden="true">&#10003;</span>' +
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

    if (speech) {
      var speakBtn = widget.querySelector('#a11y-speak');
      var speakLabel = widget.querySelector('#a11y-speak-label');
      var speakStop = widget.querySelector('#a11y-speak-stop');
      var speakStatus = widget.querySelector('#a11y-speak-status');

      // Plain words rather than media-player jargon - the people who need
      // this most are parents, not screen-reader users.
      var SPEAK_LABELS = {
        idle: 'Read this page aloud',
        speaking: 'Pause reading',
        paused: 'Carry on reading'
      };
      var SPEAK_STATUS = {
        idle: '',
        speaking: 'Reading the page aloud…',
        paused: 'Paused.'
      };

      speech.onState(function (state, message) {
        speakLabel.textContent = SPEAK_LABELS[state];
        speakStop.hidden = state === 'idle';
        speakStatus.textContent = message || SPEAK_STATUS[state];
        // The toggle stays visible once the panel closes, so it carries
        // the "still talking" cue and the way back to Stop.
        widget.classList.toggle('is-speaking', state !== 'idle');
      });

      speakBtn.addEventListener('click', function () { speech.toggle(); });
      speakStop.addEventListener('click', function () { speech.stop(); });
    }

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
      if (speech) speech.stop();
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
