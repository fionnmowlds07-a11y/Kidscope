/* In-page PDF viewer.

   Every resource PDF is self-hosted under pdfs/ (see the README note on
   HSE laptops blocking Drive), so it is same-origin and can be shown
   inside the site rather than throwing the visitor out to a separate
   browser tab. The rendering is done by the browser's own built-in PDF
   reader in an <iframe> - no PDF library is loaded, which keeps the "no
   build step, no bundled dependencies" promise the rest of the site keeps.

   Progressive enhancement, same as js/nav.js: the links keep their plain
   href and target="_blank" in the markup, so with JS off - or in a
   browser with no built-in PDF reader - a visitor gets exactly the old
   behaviour. Only an unmodified left-click on a same-origin .pdf is
   intercepted, so Ctrl/Cmd-click and middle-click still open a real new
   tab for anyone who wants one, and the viewer's own toolbar offers both
   "new tab" and "download" as a permanent escape hatch. */
(function () {
  'use strict';

  var viewer = null;      // built lazily, on the first open
  var panel, stage, frame, fallback, titleEl, metaEl, downloadLink, newTabLink, closeBtn;
  var fullBtn, fullLabel;
  var lastFocused = null;
  var pushedState = false;
  var loadTimer = null;
  var session = 0;        // bumped on every open/close; stale async work checks it
  var pdfDoc = null;      // the pdf.js document currently rendered, if any
  var pdfjsPromise = null;

  /* Where the vendored pdf.js lives, worked out from this script's own URL
     so the paths hold wherever the site is deployed. */
  var PDFJS_BASE = (function () {
    var self = document.currentScript;
    var src = self ? self.src : '';
    return src ? src.replace(/js\/pdf-viewer\.js(\?.*)?$/, 'vendor/pdfjs/') : 'vendor/pdfjs/';
  })();

  /* import() has to be reached through the Function constructor: written
     literally it is a *parse* error in browsers that predate it, which
     would take this whole file down with it - including the plain-link
     fallback those same browsers depend on. */
  var dynamicImport = null;
  try {
    dynamicImport = new Function('u', 'return import(u);');
  } catch (e) {
    dynamicImport = null;
  }

  /* Three ways to put a PDF on the page, in order of preference:

     'native'  - the browser's own PDF reader in an <iframe>. Best on a
                 laptop: real text selection, search, print.
     'pdfjs'   - our vendored pdf.js, drawing the pages onto canvases.
                 This is the phone path. No mobile browser renders a PDF
                 inside an iframe: Android Chrome shows nothing at all and
                 iOS Safari shows at most a frozen first page, and neither
                 admits it through navigator.pdfViewerEnabled - which is
                 why the touch test below overrules that flag rather than
                 trusting it.
     'card'    - neither is available: a short explanation, with the
                 toolbar's New tab and Download as the way through. */
  function chooseMode() {
    var touchPrimary = !!(window.matchMedia &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    var nativeOk = typeof navigator.pdfViewerEnabled === 'boolean' ? navigator.pdfViewerEnabled : true;

    if (nativeOk && !touchPrimary) return 'native';
    if (dynamicImport && window.Promise) return 'pdfjs';
    return 'card';
  }

  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = dynamicImport(PDFJS_BASE + 'pdf.min.mjs').then(function (lib) {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.mjs';
        return lib;
      });
    }
    return pdfjsPromise;
  }

  /* Fullscreen API, with the -webkit- spellings Safari still needs. iOS
     Safari on iPhone supports neither, and says so through
     fullscreenEnabled - the button is hidden there rather than offered
     and then failing. */
  function fullscreenSupported() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function enterFullscreen(el) {
    var request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) return;
    try {
      var result = request.call(el);
      if (result && result.catch) result.catch(function () { /* refused - the viewer just stays windowed */ });
    } catch (e) { /* same */ }
  }

  function exitFullscreen() {
    if (!fullscreenElement()) return;
    var exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!exit) return;
    try {
      var result = exit.call(document);
      if (result && result.catch) result.catch(function () { });
    } catch (e) { }
  }

  function isViewablePdf(link) {
    if (!link || link.hasAttribute('data-no-viewer')) return false;
    var url;
    try { url = new URL(link.href, location.href); } catch (e) { return false; }
    if (url.origin !== location.origin) return false;   // external PDFs still open normally
    return /\.pdf$/i.test(url.pathname);
  }

  /* The visible name of a resource lives in .res-name with the "- PDF"
     tag as a child span; strip the tag so the viewer heading reads
     "Bedtime Routine", not "Bedtime Routine - PDF". */
  function labelFor(link) {
    var name = link.querySelector('.res-name');
    var text;
    if (name) {
      var clone = name.cloneNode(true);
      var tag = clone.querySelector('.tag');
      if (tag) tag.parentNode.removeChild(tag);
      text = clone.textContent;
    } else {
      text = link.textContent;
    }
    text = (text || '').replace(/\s+/g, ' ').trim();
    return text || 'Document';
  }

  function metaFor(link) {
    var meta = link.querySelector('.res-meta');
    return meta ? meta.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function fileNameFor(link) {
    var parts = link.pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1]) || 'document.pdf';
  }

  function build() {
    viewer = document.createElement('div');
    viewer.className = 'pdf-viewer';
    viewer.hidden = true;

    viewer.innerHTML =
      '<div class="pdf-backdrop" data-pdf-close></div>' +
      '<div class="pdf-panel" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">' +
        '<div class="pdf-bar">' +
          '<div class="pdf-titles">' +
            '<h2 class="pdf-title" id="pdf-viewer-title">Document</h2>' +
            '<p class="pdf-meta"></p>' +
          '</div>' +
          '<div class="pdf-actions">' +
            '<button type="button" class="pdf-btn pdf-btn-full" id="pdf-fullscreen" aria-pressed="false" hidden>' +
              '<svg class="ico-enter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/></svg>' +
              '<svg class="ico-exit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3a2 2 0 0 0 2-2V3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/><path d="M8 21v-3a2 2 0 0 0-2-2H3"/></svg>' +
              '<span class="pdf-btn-label">Full screen</span>' +
            '</button>' +
            '<a class="pdf-btn" id="pdf-download" href="#" download data-no-viewer>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>' +
              '<span class="pdf-btn-label">Download</span>' +
            '</a>' +
            '<a class="pdf-btn" id="pdf-newtab" href="#" target="_blank" rel="noopener noreferrer" data-no-viewer>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>' +
              '<span class="pdf-btn-label">New tab</span>' +
            '</a>' +
            '<button type="button" class="pdf-btn pdf-btn-close" data-pdf-close>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
              '<span>Close</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="pdf-stage">' +
          '<p class="pdf-loading" role="status">Loading the document&hellip;</p>' +
          '<iframe class="pdf-frame" title="Document" src="about:blank"></iframe>' +
          '<div class="pdf-fallback" hidden>' +
            '<h3>This browser cannot show PDFs on the page</h3>' +
            '<p>Use <strong>New tab</strong> or <strong>Download</strong> above to read this document.</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(viewer);

    panel = viewer.querySelector('.pdf-panel');
    stage = viewer.querySelector('.pdf-stage');
    frame = viewer.querySelector('.pdf-frame');
    fallback = viewer.querySelector('.pdf-fallback');
    titleEl = viewer.querySelector('.pdf-title');
    metaEl = viewer.querySelector('.pdf-meta');
    downloadLink = viewer.querySelector('#pdf-download');
    newTabLink = viewer.querySelector('#pdf-newtab');
    closeBtn = viewer.querySelector('.pdf-btn-close');
    fullBtn = viewer.querySelector('.pdf-btn-full');
    fullLabel = fullBtn.querySelector('.pdf-btn-label');

    viewer.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-pdf-close]')) close();
    });

    /* Full screen hands the whole display over to the document - useful on
       a laptop for anything landscape or dense (the charts and diaries
       especially). Only offered where the browser actually supports it. */
    fullBtn.hidden = !fullscreenSupported();
    fullBtn.addEventListener('click', function () {
      if (fullscreenElement()) exitFullscreen();
      else enterFullscreen(panel);
    });

    /* The browser can leave full screen on its own (Escape, F11, a window
       change), so the button's state is synced from the event rather than
       assumed from the click. */
    var syncFullscreen = function () {
      var on = fullscreenElement() === panel;
      fullBtn.setAttribute('aria-pressed', String(on));
      fullBtn.classList.toggle('is-full', on);
      fullLabel.textContent = on ? 'Exit full screen' : 'Full screen';
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);

    /* Clears the loading line once the reader has the file. The timeout is
       the same defensive backstop js/motion.js uses for its skeletons - a
       missed load event must not leave "Loading..." on screen forever. */
    frame.addEventListener('load', function () {
      if (frame.getAttribute('src') !== 'about:blank') stage.classList.remove('is-loading');
    });

    /* Keyboard handling sits on the panel, with Escape also on the
       document so it works while focus is on the backdrop. Neither can see
       keys pressed *inside* the PDF iframe - that is a separate document
       and its events never reach this one - which is why Close is a
       permanently visible button and not a keyboard-only affordance. */
    panel.addEventListener('keydown', function (e) {
      /* In full screen, Escape belongs to the browser - it steps back out
         to the windowed viewer rather than closing the document outright. */
      if (e.key === 'Escape' && fullscreenElement()) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;

      var focusable = [];
      var items = panel.querySelectorAll('a[href], button:not([disabled]), iframe');
      Array.prototype.forEach.call(items, function (el) {
        if (!el.hidden && (el.offsetWidth || el.offsetHeight || el === document.activeElement)) {
          focusable.push(el);
        }
      });
      if (!focusable.length) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen() && !fullscreenElement()) { e.preventDefault(); close(); }
    });

    /* The phone/browser back button closes the viewer instead of leaving
       the page, which is what a full-screen overlay looks like it should
       do. The entry pushed on open is popped here, so the flag is cleared
       before close() gets a chance to pop it a second time. */
    window.addEventListener('popstate', function () {
      if (isOpen()) {
        pushedState = false;
        close();
      }
    });
  }

  function isOpen() {
    return !!viewer && !viewer.hidden;
  }

  /* Hides the rest of the page from screen readers and the tab order
     while the viewer is up. `inert` does both in one attribute; browsers
     without it still get the focus trap above. */
  function setBackgroundInert(on) {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === viewer) return;
      if (on) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    });
  }

  /* ---- the pdf.js path (phones, and anything else without a reader) ----
     Pages are drawn onto canvases in one scrolling column. Only the pages
     near the viewport are rendered, and a page that scrolls well clear of
     it gives its canvas back - a 40-page booklet at full device pixel
     ratio would otherwise hold well over 100MB of bitmaps on a phone. */

  function clearPages() {
    if (!stage) return;
    var wrap = stage.querySelector('.pdf-pages');
    if (wrap) {
      if (wrap.resizeHandler) window.removeEventListener('resize', wrap.resizeHandler);
      Array.prototype.forEach.call(wrap.querySelectorAll('.pdf-page'), releasePage);
      wrap.parentNode.removeChild(wrap);
    }
    if (pdfDoc) {
      try { pdfDoc.destroy(); } catch (e) { /* already gone */ }
      pdfDoc = null;
    }
  }

  function releasePage(holder) {
    if (holder.renderTask) {
      try { holder.renderTask.cancel(); } catch (e) { }
      holder.renderTask = null;
    }
    holder.isRendered = false;
    holder.classList.remove('is-rendered');
    var canvas = holder.querySelector('canvas');
    if (!canvas.width && !canvas.height) return;
    /* renderPage() sizes the canvas *before* the render promise settles,
       so a page cancelled mid-draw already holds a full-size bitmap even
       though isRendered never went true. Sizing off that instead of the
       flag is what actually hands the memory back on a page that never
       finished. */
    canvas.width = 0;
    canvas.height = 0;
  }

  function renderPage(holder, mine) {
    if (holder.isRendered || holder.renderTask || mine !== session) return;

    var page = holder.pdfPage;
    var canvas = holder.querySelector('canvas');
    var cssWidth = holder.clientWidth;
    if (!cssWidth) return;              // not laid out yet

    var base = page.getViewport({ scale: 1 });
    /* Cap the pixel ratio at 2: past that the sharpness gain is invisible
       and the memory cost is not. */
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    var task = page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport });
    holder.renderTask = task;
    task.promise.then(function () {
      holder.renderTask = null;
      if (mine !== session) { releasePage(holder); return; }
      holder.isRendered = true;
      holder.classList.add('is-rendered');
    }, function () {
      holder.renderTask = null;         // cancelled, or the page failed to draw
    });
  }

  /* Every page holds its full height from the moment the column is built,
     drawn or not, so scrolling never jumps and the release logic below has
     real geometry to work from. The height is pinned in pixels rather than
     left to the CSS aspect-ratio alone, which older Safari ignores. A page
     already drawn at a different width is released so it redraws sharp at
     the new one - this is what makes rotating the phone, or going full
     screen, come back crisp instead of upscaled. */
  function layoutPages(wrap) {
    Array.prototype.forEach.call(wrap.querySelectorAll('.pdf-page'), function (holder) {
      var width = holder.clientWidth;
      if (!width || width === holder.laidOutAt) return;
      holder.style.height = Math.round(width / holder.pageRatio) + 'px';
      if (holder.laidOutAt) releasePage(holder);
      holder.laidOutAt = width;
    });
  }

  /* One pass over the column: render what is near the viewport, release
     what is far from it. Driven by scroll and resize rather than an
     IntersectionObserver so that a width change - rotating the phone,
     entering full screen - re-renders at the new size through the same
     code path. */
  function syncPages(wrap, mine) {
    if (mine !== session || !wrap.parentNode) return;
    layoutPages(wrap);

    var wrapBox = wrap.getBoundingClientRect();
    var margin = (wrap.clientHeight || 1) * 1.5;

    Array.prototype.forEach.call(wrap.querySelectorAll('.pdf-page'), function (holder) {
      var box = holder.getBoundingClientRect();
      var near = box.bottom > wrapBox.top - margin && box.top < wrapBox.bottom + margin;
      if (near) renderPage(holder, mine);
      else releasePage(holder);
    });
  }

  function renderWithPdfjs(url, name, mine) {
    loadPdfjs().then(function (pdfjs) {
      if (mine !== session) return null;
      return pdfjs.getDocument({
        url: url,
        standardFontDataUrl: PDFJS_BASE + 'standard_fonts/',
        wasmUrl: PDFJS_BASE + 'wasm/',
        isEvalSupported: false          // no code out of a PDF is ever evaluated
      }).promise;
    }).then(function (doc) {
      if (!doc) return null;
      if (mine !== session) { doc.destroy(); return null; }
      pdfDoc = doc;

      var numbers = [];
      for (var n = 1; n <= doc.numPages; n++) numbers.push(n);
      return Promise.all(numbers.map(function (n) { return doc.getPage(n); }));
    }).then(function (pages) {
      if (!pages || mine !== session) return;

      var wrap = document.createElement('div');
      wrap.className = 'pdf-pages';
      wrap.tabIndex = 0;                // so the column can be scrolled by keyboard
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', name + ', ' + pages.length + (pages.length === 1 ? ' page' : ' pages'));

      /* Canvases carry no text, so a screen reader gets nothing useful out
         of this column - say so, and point at the button that opens the
         real document. */
      var note = document.createElement('p');
      note.className = 'visually-hidden';
      note.textContent = 'This document is drawn as page images. To read it with a screen reader, ' +
                         'use the New tab button to open the file itself.';
      wrap.appendChild(note);

      pages.forEach(function (page, i) {
        var viewport = page.getViewport({ scale: 1 });
        var holder = document.createElement('div');
        holder.className = 'pdf-page';
        /* Every page reserves its true height before it is drawn, so the
           column never jumps around underneath a reader's thumb. */
        holder.style.aspectRatio = viewport.width + ' / ' + viewport.height;
        holder.pageRatio = viewport.width / viewport.height;
        holder.pdfPage = page;
        holder.isRendered = false;
        holder.renderTask = null;
        holder.laidOutAt = 0;

        var canvas = document.createElement('canvas');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Page ' + (i + 1) + ' of ' + pages.length);
        holder.appendChild(canvas);
        wrap.appendChild(holder);
      });

      stage.appendChild(wrap);
      stage.classList.remove('is-loading');

      var pending = false;
      var schedule = function () {
        if (pending || mine !== session) return;
        pending = true;
        window.requestAnimationFrame(function () {
          pending = false;
          syncPages(wrap, mine);
        });
      };
      wrap.addEventListener('scroll', schedule, { passive: true });
      wrap.resizeHandler = schedule;    // kept so clearPages() can detach it
      window.addEventListener('resize', schedule);
      syncPages(wrap, mine);
    }).catch(function () {
      if (mine !== session) return;
      /* Anything at all went wrong - the library, the network, a document
         pdf.js cannot parse. Fall back to the card rather than leaving a
         blank stage, which is the failure this whole path exists to fix. */
      stage.classList.remove('is-loading');
      clearPages();
      frame.hidden = true;
      fallback.hidden = false;
    });
  }

  function open(link) {
    if (!viewer) build();

    var href = link.href;
    var name = labelFor(link);
    var meta = metaFor(link);

    lastFocused = document.activeElement;

    titleEl.textContent = name;
    metaEl.textContent = meta;
    metaEl.hidden = !meta;
    downloadLink.href = href;
    downloadLink.setAttribute('download', fileNameFor(link));
    newTabLink.href = href;
    frame.title = name + ' (PDF)';

    session += 1;
    clearPages();

    var mode = chooseMode();
    fallback.hidden = mode !== 'card';
    frame.hidden = mode !== 'native';
    stage.classList.toggle('is-loading', mode !== 'card');

    if (mode === 'native') {
      /* #view=FitH asks the built-in reader to open fitted to the width of
         the frame, which is the readable default in a narrow panel. */
      frame.src = href + '#view=FitH';
      clearTimeout(loadTimer);
      loadTimer = setTimeout(function () { stage.classList.remove('is-loading'); }, 8000);
    } else if (mode === 'pdfjs') {
      renderWithPdfjs(href, name, session);
    }

    viewer.hidden = false;
    document.documentElement.classList.add('pdf-viewer-open');
    setBackgroundInert(true);
    closeBtn.focus();

    if (window.history && history.pushState) {
      try {
        history.pushState({ kidscopePdfViewer: true }, '');
        pushedState = true;
      } catch (e) {
        pushedState = false;
      }
    }
  }

  function close() {
    if (!isOpen()) return;

    clearTimeout(loadTimer);
    exitFullscreen();                   // never leave the screen owned by a hidden panel
    session += 1;                       // anything still rendering is now stale
    viewer.hidden = true;
    frame.src = 'about:blank';          // releases the reader and its memory
    clearPages();
    stage.classList.remove('is-loading');
    document.documentElement.classList.remove('pdf-viewer-open');
    setBackgroundInert(false);

    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;

    if (pushedState) {
      pushedState = false;
      history.back();                   // drop the entry pushed on open
    }
  }

  /* Retitles the affordance on every link the viewer takes over: the icon
     becomes an "open in place" mark instead of the external-link arrow,
     and the screen-reader-only note stops promising a new tab. Done here
     rather than in the HTML so the markup keeps telling the truth for a
     visitor without JS. */
  function decorate(link) {
    var use = link.querySelector('.ext use');
    if (use && document.getElementById('i-view')) {
      use.setAttribute('href', '#i-view');
    }
    var note = link.querySelector('.visually-hidden');
    if (note && /new tab/i.test(note.textContent)) {
      note.textContent = '(opens in a viewer on this page)';
    }
    link.setAttribute('data-pdf-inline', '');
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (link) {
      if (isViewablePdf(link)) decorate(link);
    });

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // let real new tabs happen
      if (!e.target.closest) return;

      var link = e.target.closest('a[href]');
      if (!link || !isViewablePdf(link)) return;
      /* The viewer's own Download and New tab links point at the same
         same-origin PDF, so without this they would match the rule above
         and be swallowed by the viewer that is already open. They also
         carry data-no-viewer; this is the belt to that pair of braces. */
      if (viewer && viewer.contains(link)) return;

      e.preventDefault();
      open(link);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
