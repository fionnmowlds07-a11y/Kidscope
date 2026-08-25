/* Progressive enhancement on top of the native <details>/<summary> menu -
   opening and closing already works with zero JS. This just adds Escape to
   close (returning focus to the toggle button) and closing on an outside
   click, matching the behaviour of a typical dropdown. */
(function () {
  var details = document.querySelector('.nav-details');
  var toggle = details && details.querySelector('.nav-toggle');
  if (!details || !toggle) return;

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && details.open) {
      details.open = false;
      toggle.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (details.open && !details.contains(e.target)) {
      details.open = false;
    }
  });
})();

/* Keeps :target scroll offsets (the resources jump-nav, and search results
   that land on an anchor) clear of the sticky header, including when the
   search bar wraps onto its own row on narrow screens. */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;

  function setHeaderHeight() {
    document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  }

  setHeaderHeight();
  window.addEventListener('load', setHeaderHeight);
  window.addEventListener('resize', setHeaderHeight);
})();
