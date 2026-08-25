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

Shared: `css/kidscope.css`, `js/nav.js`, `img/`.

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

## Assets

- `img/kidscope-logo.png` (249×81) has a real alpha channel (RGBA). The header and footer logo areas stay white by choice, for legibility, not because the PNG forces it. Displayed at 180px max; going larger makes it look soft.
- `img/hero-classroom.jpg` (2200×1659, ~320KB) is the home page hero photo, resized and compressed from the client-supplied original. It sits under a strong brand-blue gradient (`.hero` in `css/kidscope.css`) via `background-size: cover`, so it crops rather than stretches at every viewport, and keeps the hero's white text and focus ring at their verified contrast.
- `img/hse logo.jpg`, `img/UCC logo.png`, `img/lets grow together.jpg`, `img/Tomar trust.jpg`, `img/niche health project.jpg`, `img/springboard logo.jpg` are the six partner logos as separate files, each an opaque white-background image (none carry transparency). They're laid out as individually linked tiles (`.partner-grid` on the home page) rather than one flat strip.
- `img/partners.png` (635×65, the old flat six-logo strip) is **no longer referenced** anywhere, superseded by the files above. Left on disk rather than deleted.
- `img/favicon.svg` and `img/apple-touch-icon.png` were created for this site. The supplied logo is a 3:1 strip and would be unreadable squashed into a 16px square, so the mark is a blue tile with a white "K".

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

4. **Five links point to Google Drive** (Toileting, Sleep, Food & Nutrition, Learn to Move handouts, Hospital Admission guide). These only work for the public if those folders and files are shared publicly — please check each one in a browser where you are signed out of Google.

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
- All 24 resource links open in a new tab with `rel="noopener noreferrer"` and carry a screen-reader "opens in a new tab" note.
