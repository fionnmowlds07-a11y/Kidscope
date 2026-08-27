# Kidscope Paediatric Clinic — website

Static site (plain HTML/CSS/JS, no build step). Deploys as-is to Vercel, Netlify, GitHub Pages or any web host — upload the folder.

## Pages

| File | Page |
|---|---|
| `index.html` | Home |
| `what-we-do.html` | What we do |
| `research.html` | Research and publications |
| `contact.html` | Contact us |
| `referrals.html` | Being referred to Kidscope |
| `resources.html` | Resources for families |

Shared: `css/kidscope.css`, `js/nav.js`, `js/accessibility.js`, `js/motion.js`, `img/`.

## Running it locally

```bash
npx serve -l 4321 .
```

Then open <http://localhost:4321>.

## Design notes

**Colour.** The brand blue `#4E91BD` was sampled from the supplied logo. It measures **3.44:1 against white**, which fails WCAG AA for body text in both directions (blue-on-white *and* white-on-blue). So the palette uses two blues: `#4E91BD` for decoration and large headings only, and `#1F5C82` for all links, small text, and any filled surface carrying white text (6.88:1 / 7.21:1). Body ink is `#1C2B36` on an off-white `#F7FAFC` ground.

Do not use `--brand` for body-size text — that is the one rule that keeps the site accessible.

**Type.** Lexend (Google Fonts), as requested for dyslexia-friendliness. The rest of the reading comfort comes from the settings around it: 17px base, 1.65 line-height, a 68-character maximum line length, and left-aligned text that is never justified.

**Focus.** A warm `#B4530A` ring on light surfaces, switching to white on blue-filled surfaces (the warm ring measures only 1.46:1 against the brand blue, so it would vanish there).

**Motion.** `js/motion.js` adds a header elevation cue, a reveal-on-scroll effect for card and list groups, and skeleton shimmer states for the two things on the site that genuinely load asynchronously (the lazy-loaded partner logos, the embedded Google map). `css/kidscope.css` adds cross-document view transitions (`@view-transition { navigation: auto }`) for a soft cross-fade between pages, entrance animations for the two header dropdowns, and refined hover/press easing. All of it is layered opt-out: the OS `prefers-reduced-motion` query, and the accessibility toolbar's own "Reduce motion" toggle for visitors whose OS default doesn't match what they want on this site. Reveal-on-scroll is JS-only (a no-JS visitor sees the plain, always-visible layout) and is forced visible under `@media print`.

**Accessibility toolbar.** `js/accessibility.js` injects a floating widget (bottom-right, every page) offering a dyslexia-friendly typeface, a contrast boost, a colour-blind friendly palette, font-size steps, a "read this page aloud" control, and the reduce-motion override above. It's a single **high-contrast toggle**, not a low/high pair — deliberately, since a "low contrast" direction would work against the zero-failure baseline recorded below. Preferences persist in `localStorage` (key `kidscope-a11y`, read/write both wrapped in `try/catch` for blocked storage) and are applied to `<html>` synchronously in `<head>`, before `<body>` exists, so there's no flash of un-adjusted styles on a returning visit.

**Read this page aloud.** Uses the browser's built-in Web Speech API (`speechSynthesis`) — no external service, no audio files. The control only renders if `window.speechSynthesis` exists, so nothing is offered on a browser that can't act on it. It walks `<main>` in DOM order, skipping `aria-hidden` content, `<nav>`, and anything inside a closed `<details>` (the resources page keeps hundreds of collapsed resource links in the DOM — reading those out would be a bug, not a feature), then speaks it one sentence-sized chunk at a time — both to work around Chrome's ~15-second cap on a single utterance and so the currently-read sentence can be highlighted (`.a11y-speaking`, an outline rather than a colour wash so it stays legible under both the contrast and colour-blind modes). It is deliberately not saved to `localStorage`: it's a one-page action, not a persistent preference, and playback is cancelled on navigation (`pagehide`) so it never talks over the next page.

**Colour-blind friendly mode.** A second, independent single toggle (`:root.a11y-colorblind` in `css/kidscope.css`). It darkens `--brand-deep`, `--brand-deeper` and `--focus` into the same blue/vermillion hue families used by the Okabe–Ito colour-blind-safe palette — a published set chosen to stay distinguishable under protanopia, deuteranopia and tritanopia alike — and re-checks each against `--ground` and white text (7.22:1 / 7.57:1 for the new `--brand-deep`, 5.14:1 / 5.39:1 for `--focus`), both above the 4.5:1 AA floor the rest of the site holds. It also forces link underlines sitewide, same as high contrast, so links are never identified by hue alone. If a visitor enables both toggles, high contrast's near-black values win on the properties they share — the black/white axis is unaffected by any form of colour blindness, so that's the safer outcome either way. Same `localStorage` key, same synchronous `<head>` application, no flash.

## Assets

- `img/kidscope-logo.png` (249×81) has a real alpha channel (RGBA). The header and footer logo areas stay white by choice, for legibility, not because the PNG forces it. Displayed at 180px max; going larger makes it look soft.
- `img/hero-classroom.jpg` (2200×1659, ~320KB) is the home page hero photo, resized and compressed from the client-supplied original. It sits under a strong brand-blue gradient (`.hero` in `css/kidscope.css`) via `background-size: cover`, so it crops rather than stretches at every viewport, and keeps the hero's white text and focus ring at their verified contrast.
- `img/hse logo.jpg`, `img/UCC logo.png`, `img/lets grow together.jpg`, `img/Tomar trust.jpg`, `img/niche health project.jpg`, `img/springboard logo.jpg` are the six partner logos as separate files, each an opaque white-background image (none carry transparency). They're laid out as individually linked tiles (`.partner-grid` on the home page) rather than one flat strip.
- `img/partners.png` (635×65, the old flat six-logo strip) is **no longer referenced** anywhere, superseded by the files above. Left on disk rather than deleted.
- `img/favicon.svg` and `img/apple-touch-icon.png` were created for this site. The supplied logo is a 3:1 strip and would be unreadable squashed into a 16px square, so the mark is a blue tile with a white "K".
- **OpenDyslexic** (the accessibility toolbar's dyslexia-friendly typeface) is loaded from Fontsource's jsDelivr CDN, not self-hosted — same "no build step" reasoning as the Google Fonts `<link>` for Lexend. `@font-face` is declared unconditionally in `css/kidscope.css`, but the font is only ever fetched if a visitor actually turns the toggle on (browsers don't download a declared `@font-face` until something on the page matches it). If jsDelivr is ever blocked or unreachable, the toggle still does something visible via the `'Comic Sans MS'` fallback in `--font-dyslexic` rather than silently doing nothing.

## Adding a self-hosted resource PDF

HSE work laptops block Google Drive by category, so resource PDFs are hosted directly in this repo under `pdfs/<category>/` (currently `sleep/`, `toilet-training/`, `food-and-nutrition/`, `physiotherapy/`, `other-information/`) and linked with a plain relative `href` — same origin as the rest of the site, so nothing gets caught by that filter. To add one:

1. Drop the file into the right `pdfs/<category>/` folder (create a new subfolder for a new category), with a slugified filename (lowercase, hyphens, no spaces/`&`/accents).
2. Add a `<li><a class="res-item" href="pdfs/<category>/<file>.pdf" ...>` entry in `resources.html`, copying the markup of an existing entry in that `.res-group` — same `target="_blank"`, `.tag`, and `res-meta` one-line description pattern.
3. **Sleep, Toilet Training and Food and Nutrition are collapsed behind a dropdown** (`<details class="res-dropdown">`/`<summary class="res-toggle">`) since each holds a long list — add new `<li>` entries inside the existing `<ul class="res-list">` nested in that category's `<details>`, and update the resource count in the `<summary>` text (e.g. "Show all 15 resources").
4. If it's a new top-level category, also add its anchor to the `.jump` nav (`resources.html`) and a matching entry to `SEARCH_INDEX` in `js/site-search.js`.
5. This means updating a resource is now a commit + deploy, not a drag-and-drop into a Drive folder — there's no admin upload UI. All resource PDFs are now self-hosted this way; none link to Google Drive any more.

## Adding publications

`research.html` is deliberately empty — no placeholder entries were invented. When the list arrives from Emma and Lynn:

1. Delete the `<div class="empty-state">` block.
2. Uncomment the `<ul class="res-list">` template directly beneath it.
3. Add one `<li>` per publication, following the commented pattern.

---

## Queries for the Kidscope team

These need answers from the clinic — they were not guessed at.

1. **The "Who is involved" text ends mid-sentence.** The brief finishes with *"…delivers the clinic every Thursday during the academic year, with the inter-disciplinary team"*. It is currently published cut at the last complete clause (ending at "academic year"). Please send the full ending. See the HTML comment in `what-we-do.html`.

2. **Research and publications is empty**, per your note that these were still being gathered.

3. **The ISTI speech-therapist link** carries a saved filter (`wpv_view_count=2033`) that may not keep working on their site. Worth checking, and possibly linking their plain search page instead.

4. ~~**Google Drive links.**~~ **Resolved** — HSE work laptops block Google Drive outright (their filtering software blocks the domain by category), so all five original Drive links (Toileting, Sleep, Food & Nutrition, Learn to Move handouts, Hospital Admission guide) have been self-hosted as PDFs under `pdfs/` instead. None link to Google Drive any more.

5. ~~**Better logo files would improve the site.**~~ **Resolved** — the client supplied a transparent Kidscope logo and the six partner logos as separate files; the partner grid is now individually linked to HSE, UCC, Let's Grow Together, Tomar Trust and NICHE Health Project. **Springboard's official URL is still needed** — its tile ships unlinked until that's confirmed (see `.partner-tile--unlinked` in `css/kidscope.css`).

6. **No email address was supplied** — the site lists the phone number only. Is that intentional?

7. **The catchment map appears twice** in the brief (under "Being Referred" and again under Healthy Habits), so it currently shows on both pages. Easy to remove from one if that was not intended.

8. **Nav order** follows your list exactly: What we do → Research and publications → Contact us → Being referred → Resources. "Being referred to Kidscope" may deserve to sit earlier since families look for it most — a one-line change if you want it moved.

## Accessibility checks performed

Verified in-browser across all six pages:

- Zero colour-contrast failures across 314 text elements, tested size-aware (4.5:1 under 24px, 3:1 for large text).
- One `<h1>` per page, `<main>` landmark, working skip-to-content link.
- Heading outline checked on every page: no skipped levels (no `h1` straight to `h3`). Footer headings are `<h2>` inside the `<footer>` landmark, which assistive technology announces as `contentinfo` and therefore keeps separate from page content.
- No horizontal page scroll at 375px; the partner strip scrolls inside its own container.
- Mobile menu opens and closes, responds to Escape, and returns focus to its button.
- Keyboard tab order starts at the skip link, then the logo, then the nav. No positive `tabindex` anywhere.
- All 47 resource links open in a new tab with `rel="noopener noreferrer"` and carry a screen-reader "opens in a new tab" note. The Sleep, Toilet Training and Food and Nutrition lists collapse behind a `<details>`/`<summary>` dropdown (same disclosure pattern as the header menu) so the page doesn't open on a wall of links; each is keyboard-operable and needs no extra ARIA.
- Accessibility toolbar (`js/accessibility.js`) is keyboard-operable via the same native `<details>`/`<summary>` pattern as the header menu (Escape closes it and returns focus to the toggle; outside click closes it). Every control is a real `<button aria-pressed>`, not a styled `<div>`. Font-size steps scale `html`'s root font-size, so the existing 68ch measure and 1.65 line-height scale proportionally rather than just growing the text in place.
- Read-aloud button's label and a `role="status"` line track playback state in plain language ("Read this page aloud" → "Pause reading" → "Carry on reading"), so the state is announced to screen readers without a separate live region. Feature-detected: browsers without `speechSynthesis` never see the control at all, rather than a button that fails silently.
- Colour-blind friendly mode's three redefined colours were checked with the same relative-luminance contrast formula as the rest of this list, not eyeballed: `--brand-deep` 7.22:1 on `--ground` / 7.57:1 white-on-it, `--brand-deeper` 11.02:1 / 11.55:1, `--focus` 5.14:1 / 5.39:1 — all above the 4.5:1 AA floor. Verified across pages (not just a single reload) that the toggle persists on navigation from `index.html` to every other page.
- All new motion (scroll-reveal, dropdown entrances, view transitions) is gated behind `prefers-reduced-motion` and the toolbar's own "Reduce motion" toggle; verified both directions in-browser rather than just reading the media query back.
