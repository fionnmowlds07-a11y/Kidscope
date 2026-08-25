/* Small, hardcoded keyword-to-page index - there is no backend to index
   against, and the whole site is six pages, so a build step or external
   search service would be overkill. Aimed at visitors who don't know the
   site's structure: matching is loose (substring, on plain-language
   keywords) and every result shows a one-line hint, not just a title. */
var SEARCH_INDEX = [
  { title: "Home", url: "index.html",
    hint: "About Kidscope, and quick links to every page.",
    keywords: ["home", "kidscope", "paediatric clinic", "start", "about"] },
  { title: "What we do", url: "what-we-do.html",
    hint: "Who we are, our aims, and the team behind the clinic.",
    keywords: ["what we do", "about us", "aims", "team", "multidisciplinary", "who we are", "staff", "involved"] },
  { title: "Research and publications", url: "research.html",
    hint: "Work published by the Kidscope team.",
    keywords: ["research", "publications", "studies", "papers", "teaching", "ucc"] },
  { title: "Contact us", url: "contact.html",
    hint: "Phone number, address, and how to reach the clinic.",
    keywords: ["contact", "phone", "number", "address", "location", "directions", "call", "coordinator", "ciara", "niche community centre", "email"] },
  { title: "Being referred to Kidscope", url: "referrals.html",
    hint: "How children are referred, and the area the clinic covers.",
    keywords: ["referral", "refer", "referred", "public health nurse", "phn", "eligibility", "catchment", "area", "waiting list"] },
  { title: "Resources for families", url: "resources.html",
    hint: "Support on therapy, sleep, ADHD and more.",
    keywords: ["resources", "families", "support", "help", "links"] },
  { title: "Toilet Training resources", url: "resources.html#toilet-training",
    hint: "Guides, charts and information sheets on toilet training and constipation.",
    keywords: ["toilet", "toileting", "potty", "constipation", "bedwetting", "bladder", "bowel"] },
  { title: "Sleep resources", url: "resources.html#sleep",
    hint: "Bedtime routines, sleep strategies and relaxation tips.",
    keywords: ["sleep", "bedtime", "routine", "night", "relaxation"] },
  { title: "Food and Nutrition resources", url: "resources.html#food-and-nutrition",
    hint: "Healthy eating, lunchboxes and tackling fussy eating.",
    keywords: ["food", "nutrition", "eating", "lunchbox", "fussy eating", "diet"] },
  { title: "Occupational Therapy resources", url: "resources.html#occupational-therapy",
    hint: "Sensory processing information and OT videos.",
    keywords: ["occupational therapy", "ot", "sensory"] },
  { title: "Speech and Language resources", url: "resources.html#speech-and-language",
    hint: "Help with talking, language delay and communication.",
    keywords: ["speech", "language", "talking", "talk", "communication", "hanen"] },
  { title: "Healthy Habits and Lifestyle resources", url: "resources.html#healthy-habits",
    hint: "Building healthier habits and general parenting resources.",
    keywords: ["healthy habits", "lifestyle", "parenting", "enable ireland"] },
  { title: "ADHD resources", url: "resources.html#adhd",
    hint: "Information on ADHD.",
    keywords: ["adhd", "attention", "hyperactivity"] },
  { title: "Physiotherapy resources", url: "resources.html#physiotherapy",
    hint: "Learn to Move handouts and videos.",
    keywords: ["physiotherapy", "physio", "move", "movement"] },
  { title: "Infant Mental Health resources", url: "resources.html#infant-mental-health",
    hint: "Support for infant mental health and wellbeing.",
    keywords: ["infant mental health", "mental health", "wellbeing", "bonding"] },
  { title: "Services", url: "resources.html#services",
    hint: "The Kidscope catchment area map and related services.",
    keywords: ["services", "map", "catchment area", "google maps"] },
  { title: "Other information", url: "resources.html#other-information",
    hint: "A guide to hospital admission and other family information.",
    keywords: ["hospital", "admission", "other", "citizens information", "milestones"] }
];

(function () {
  var input = document.getElementById('site-search');
  var panel = document.getElementById('search-results');
  if (!input || !panel) return;

  var activeIndex = -1;
  var currentMatches = [];

  function normalize(s) { return s.toLowerCase().trim(); }

  function search(query) {
    var q = normalize(query);
    if (!q) return [];
    return SEARCH_INDEX.filter(function (entry) {
      if (normalize(entry.title).indexOf(q) !== -1) return true;
      return entry.keywords.some(function (k) { return k.indexOf(q) !== -1; });
    }).slice(0, 6);
  }

  function setActive(index) {
    var options = panel.querySelectorAll('.search-result');
    options.forEach(function (opt) { opt.removeAttribute('aria-selected'); });
    activeIndex = index;
    if (index >= 0 && options[index]) {
      options[index].setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', options[index].id);
      options[index].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function render(matches) {
    currentMatches = matches;
    panel.innerHTML = '';

    if (!matches.length) {
      var empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = 'No matching pages. Try a different word, or use the Menu button to browse every page.';
      panel.appendChild(empty);
    } else {
      matches.forEach(function (entry, i) {
        var a = document.createElement('a');
        a.href = entry.url;
        a.className = 'search-result';
        a.id = 'search-result-' + i;
        a.setAttribute('role', 'option');

        var title = document.createElement('span');
        title.className = 'sr-title';
        title.textContent = entry.title;

        var hint = document.createElement('span');
        hint.className = 'sr-hint';
        hint.textContent = entry.hint;

        a.appendChild(title);
        a.appendChild(hint);
        panel.appendChild(a);
      });
    }

    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(-1);
  }

  function close() {
    panel.hidden = true;
    panel.innerHTML = '';
    currentMatches = [];
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  input.addEventListener('input', function () {
    var matches = search(input.value);
    if (!input.value.trim()) { close(); return; }
    render(matches);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      if (panel.hidden) { render(search(input.value)); return; }
      if (!currentMatches.length) return;
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, currentMatches.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (panel.hidden || !currentMatches.length) return;
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      var target = currentMatches[activeIndex >= 0 ? activeIndex : 0];
      if (target) {
        e.preventDefault();
        window.location.href = target.url;
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });

  document.addEventListener('click', function (e) {
    if (!input.contains(e.target) && !panel.contains(e.target)) close();
  });

  input.addEventListener('blur', function () {
    // Delay so a pointer click on a result still registers as navigation
    // before the panel is torn down by the blur.
    setTimeout(function () {
      if (document.activeElement !== input && !panel.contains(document.activeElement)) close();
    }, 150);
  });
})();
