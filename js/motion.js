/* Motion polish: reveal-on-scroll for card/list groups, a sticky-header
   elevation cue, and skeleton loading states for the two things on this
   site that genuinely load asynchronously after paint - the partner logos
   (loading="lazy") on the home page and the embedded Google catchment-area
   map on the referrals page.

   Everything here is opt-in: nothing animates for a visitor who has asked
   the OS, or the accessibility toolbar's "Reduce motion" toggle
   (html.a11y-reduce-motion, set by js/accessibility.js before this file
   runs), for reduced motion. */
(function () {
  'use strict';

  function reducedMotion() {
    var osPref = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !!osPref || document.documentElement.classList.contains('a11y-reduce-motion');
  }

  /* --- header elevation on scroll ---------------------------------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var setElevated = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 4);
    };
    setElevated();
    window.addEventListener('scroll', setElevated, { passive: true });
  }

  /* --- scroll-reveal for card and list groups ----------------------------
     Targets the direct children of every card grid / list group already
     on the page (.grid covers every card grid, since grid-2/grid-3 are
     always paired with it in the markup). Skipped entirely under reduced
     motion, so those visitors never have content start off-screen. */
  if (!reducedMotion() && 'IntersectionObserver' in window) {
    var groups = document.querySelectorAll(
      '.grid, .aims, .team-list, .contact-rows, .res-list, .partner-grid'
    );
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

    groups.forEach(function (group) {
      var items = group.children;
      for (var i = 0; i < items.length; i++) {
        items[i].classList.add('reveal');
        items[i].style.setProperty('--reveal-i', Math.min(i, 6));
        observer.observe(items[i]);
      }
    });
  }

  /* --- skeleton: lazy-loaded partner logos --------------------------------
     img.complete is already true for a cached image by the time this
     runs, so those never show a skeleton at all - only a genuinely
     still-loading image does. A timeout is a defensive backstop against a
     skeleton that never clears if the load/error events are ever missed. */
  var lazyImages = document.querySelectorAll('.partner-tile img[loading="lazy"]');
  lazyImages.forEach(function (img) {
    var tile = img.closest('.partner-tile');
    if (!tile || (img.complete && img.naturalWidth > 0)) return;

    tile.classList.add('is-loading');
    var clear = function () { tile.classList.remove('is-loading'); };
    img.addEventListener('load', clear, { once: true });
    img.addEventListener('error', clear, { once: true });
    setTimeout(clear, 5000);
  });

  /* --- skeleton: embedded catchment-area map ------------------------------ */
  var mapFrame = document.querySelector('.map-frame');
  var mapIframe = mapFrame && mapFrame.querySelector('iframe');
  if (mapFrame && mapIframe) {
    mapFrame.classList.add('is-loading');
    var clearMap = function () { mapFrame.classList.remove('is-loading'); };
    mapIframe.addEventListener('load', clearMap, { once: true });
    setTimeout(clearMap, 6000);
  }
})();
