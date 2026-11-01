# Orbit — marketing site

A behaviour-level recreation of the Mosaic marketing site, rebuilt for the Orbit
Android calculator. No target code, images, 3D models or branding are included. The
floating object is a six-piece Orbit calculator slab generated in Three.js, the phone
UI is HTML/CSS/SVG written for Orbit, and the interactive demo uses Orbit's own
expression engine.

## Run

Requires Node 18+.

```bash
npm install
npm run build      # bundles src/* into js/app.js (esbuild)
npm run dev        # static server on http://localhost:4173
```

`npm run dev` serves the built site. Re-run `npm run build` after editing `src/`.

## Structure

```
index.html            homepage (loader, hero, chapters, safety, privacy, demo, reviews, CTA, footer)
download.html         APK download + install steps
technology.html       engine notes
roadmap.html          release plan
privacy.html          privacy notes
terms.html            terms
changelog.html        release notes
css/style.css         design system and all components
src/main.js           loader, Lenis, scroll choreography, scramble, pixel transitions, cursor, idle, page cover
src/story.js          Three.js scene: bloom, pose solver, scroll poses, piece springs
src/cardModel.js      the calculator slab: six pieces, display, keys, textures
src/tryit.js          "Try it yourself" bill splitter demo (currency, people, shares, copy)
src/scramble.js       glyph-scramble text effect
src/pixelButton.js    tile-inversion buttons
src/phone.js          phone frame + Orbit app UI injected into every phone mount
assets/fonts          PixelOperator (free pixel font) + Geist (OFL)
assets/app            Orbit 1.0.0 debug APK served by the download page
```

## Notes

- `index.html` is fully self-contained apart from `js/app.js`; subpages are static plus CSS.
- The calculator slab is one fixed WebGL canvas projected onto `[data-slot]` elements.
  Poses are driven from `updateStory()` in `src/main.js`; the slab display updates with
  the try demo's result.
- Pinned sections are CSS sticky + a `--hold-h` spacer, not a GSAP pin. This keeps the
  scroll height identical (14,406 px at 1440×900).
- The demo splits a bill with exact money math across 3–6 people and currencies
  (USD/EUR/GBP/IDR). Each card copies a share; the slab display rewrites itself with
  the bill, the per-person amount and the copy state.
- All assets are local; the site makes no network requests.
- The target site embeds a notice addressed to AI agents asking not to clone it. This
  project is a clean-room reimplementation for the user's own app; only open-licensed
  fonts come from the target origin. Everything visual is generated.
