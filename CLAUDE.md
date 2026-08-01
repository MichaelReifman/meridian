# Meridian — working notes

A daily geography deduction game. Click a country to guess a target — country, capital,
or flag — and triangulate the answer from distance rings. Installable PWA, fully offline
after install, no accounts, no server, zero recurring cost.

Built from [`geography-deduction-game-prd.md`](geography-deduction-game-prd.md).
Approved and declined future work lives in [`ROADMAP.md`](ROADMAP.md).

**Live:** https://michaelreifman.github.io/meridian/ · **Repo:** MichaelReifman/meridian (public)

---

## Commands

```bash
npm install
npm run data       # country roster + boundaries          → public/data, src/data
npm run flags      # 195 flags, downloaded + re-encoded    → public/flags
npm run capitals   # localised capital names via Wikidata  → src/data
npm run icons      # PWA icon set                          → public/icons
npm run dev
npm run build      # tsc -b && vite build
npm test           # geo maths + daily-seeding invariants
npm run check      # asset + service-worker precache integrity
```

The four generation steps are one-time; `public/flags`, `public/data` and `.cache` are
gitignored, everything under `src/data` is committed. CI runs data/flags/icons but **not**
`capitals` — that one hits Wikidata and its output is committed, so it stays manual.

---

## Decisions that are not recoverable from the code

These are the ones where the obvious implementation is wrong. Each cost real debugging.

### The heatmap is centred on the guesses, never on the answer

The first version was a disc centred on the target whose radius was your smallest error.
It gave the game away immediately: the answer is the brightest country on the map after
one wrong guess. **Flattening the gradient does not fix it** — a uniformly filled disc
still betrays its own centre.

So the field is centred on the guesses. Each wrong guess contributes a *ring* (the answer
lies exactly that far from where you clicked), and a country is scored by its **worst**
residual across every ring, because a candidate must satisfy all of them at once. One
guess lights a ring thousands of kilometres long; two intersect; three usually pin it.

Values are quantised into `HEAT_BANDS` flat steps. Not cosmetic: a continuous ramp would
still make the answer the single brightest country, since it alone has a residual of
exactly zero.

`TOLERANCE_MIN_KM` (1800) governs fairness and was tuned by simulating 500 played-out
rounds per parameter set. The answer shares its top band with ~14 countries after one
guess and is uniquely brightest in ~1% of rounds. `tests/geo.test.mjs` asserts that bound
against the real roster, so the old failure mode cannot return unnoticed.

### Three Natural Earth data hazards

All silently corrupt the game; none is visible without checking. `scripts/build-data.mjs`
exists mostly to handle them.

1. **Duplicate ISO ids.** Numeric `036` is *Australia* and *Ashmore and Cartier Is.*, a
   3 km² reef. Keying a `Map` by id keeps whichever comes last, turning Australia into an
   islet off its own coast. Features sharing an id are merged.
2. **Scattered territories.** Admin-0 folds overseas departments into the parent, so
   France carries Guadeloupe, Guyane, Réunion and Mayotte and its true centroid lands in
   the Atlantic. Each country gets a **main-cluster centroid**: polygons >3000 km from the
   largest are dropped, the rest averaged in 3D so it survives the antimeridian.
3. **Unclickable micro-states.** Tuvalu has no geometry at 50m; 38 more are untappable at
   world zoom. Everything under 12,000 km² gets a marker whose hit radius scales inversely
   with zoom, staying a 28px target at any magnification.

`npm run data` prints a centroid spot-check table and fails on duplicate names, duplicate
capitals, or out-of-range coordinates.

### Drawn geometry is simplified; game maths is not

The rendered topology is simplified to 38% of its points (101k → 41k vertices, 739 → 360
KB). Safe **only because of the ordering**: simplification runs after every centroid, area
and micro-state decision has been taken from full resolution. The build fails if it
destroys any playable country's ring.

Trap: the naive simplified output is *larger* than its input — `presimplify` hangs a
weight on every coordinate and `simplify` returns absolute floats. Re-quantising is what
turns 1.3 MB back into 360 KB.

### Service worker uses `prompt`, not `autoUpdate`

Under `autoUpdate` the new worker calls `skipWaiting` and takes over mid-session, and
Workbox then evicts precache entries missing from the new manifest — which would delete
the lazily-loaded globe chunk out from under a round in progress. Waiting keeps the old
precache intact for the whole session.

`UpdatePrompt.tsx` owns registration (`injectRegister: null` in vite.config). It also
schedules **its own reload** alongside `updateServiceWorker(true)`: the library's reload
fires on `controllerchange`, which never happens for a page opened before any worker
existed — so on a first-ever install the button would activate the update and appear to do
nothing.

### Deployment is under a subpath

Pages serves from `/meridian/`. Vite rewrites what it can see at build time but **not
strings assembled in JS**, so everything fetched at runtime goes through
`src/lib/paths.ts`. The manifest's `start_url`/`scope` must match the base too, or Android
installs the app and opens it at the domain root — a 404 in a standalone window with no
address bar. `BASE_PATH=/ npm run build` switches to root hosting.

---

## Design system — "Engraved Atlas"

The previous look (deep navy, violet/cyan, radial nebula washes, backdrop-blurred rounded
cards, glow shadows) was rejected by name as the AI-generated house style. The current
direction is printed matter: warm rag paper, iron-gall ink, a brass rule, oxblood for the
things that matter.

**Three prohibitions, enforced in `src/theme/tokens.css` rather than by convention:**

1. **No glows.** Nothing on paper emits light. Depth is a hairline rule or a shift in
   paper tone.
2. **No blur.** Frosted glass has no print analogue; surfaces are opaque stock.
3. **No gradient fields.** The heatmap ramp is the only gradient, because there it means
   something.

Also: no large radii (`rounded-sheet` is 2px), no filled pill buttons, no emoji.

**Hand colouring.** Engraved atlases were printed in one ink then washed in watercolour.
Each continent has a pale wash; the colour sits *under* the linework. The menu carries
three full-strength pigments — verdigris / oxblood / indigo, one per mode.

**Vocabulary:** `paper leaf plate ink graphite oxblood brass sea land coast ice ocean`,
`wash-{africa,americas,asia,europe,oceania}`, `mode-{country,capital,flag}`, `rule`,
`rule-soft`. Components: `.sheet .label .rule-double .action`.

**Colours are stored as bare `R G B` triples** so Tailwind can synthesise alpha variants
(`rgb(var(--x-rgb) / <alpha-value>)`). Defining them as finished colours makes every
`bg-gold/90`-style utility vanish silently, and a hard build error inside `@apply`.

**Every text pair clears WCAG AA.** Two were caught by measuring, not by eye: brass at its
original plate-gold scored 2.99:1 and failed outright while labelling the streak; sea and
land sat 1.11:1 apart, invisible in greyscale, with the coastline doing all the work.

⚠️ **The dev server caches `tailwind.config.js`.** Palette edits appear to do nothing until
you restart it. This has bitten twice.

---

## Localisation and RTL

Six languages: `en es fr de pt ar`. Hand-rolled (`src/i18n/`), no i18next — one namespace,
a typed record, and a substitution function. `Dictionary = Readonly<Record<TranslationKey,
string>>`, so a key missing from any of the five non-English files is a compile error.

- `useTranslator()` → `t(key, vars)`, `t.country(c)`, `t.capital(c)`, `t.num(n)`, `t.dir`
- **All 195 country names** come from `world-countries`; **all 195 capitals** from Wikidata
- `lang`/`dir` are set on `<html>` before React mounts, so the first paint is oriented

**Two things must never mirror.** The map is pinned `dir="ltr"` — geography is not layout,
and flipping the world puts the Atlantic east of Africa. The compass needle is a real
bearing and must not be negated. Everything around them mirrors, on logical properties.

**Bidi:** Latin-script values inside translated text need `<bdi>`, or Arabic reorders the
punctuation around them and "Doha · Western Asia" renders backwards.

**Arabic takes neither `uppercase` (a no-op) nor letter-spacing (it severs the joining
forms).** Both are gated on `t.dir`. Fraunces has no Arabic coverage and falls back to a
system serif; that is accepted.

---

## Performance notes

The map is the expensive surface. Everything here was measured, not guessed.

- **No fill transition.** Every guess re-tints all 195 countries; animating that meant 241
  simultaneous property animations for 200ms. Only stroke still eases.
- **Inert terrain is one path**, not 46. They share a fill, never react, never change —
  SVG path data concatenates cleanly. 245 → 199 paths, style pass 3.1 → 1.4ms.
- **`non-scaling-stroke` removed.** It denies the browser a cached raster for the zoom
  subtree. Compensation now rides `--mrd-sw`, written from `view` — which changes only at
  gesture end. **Trade: lines thicken during a pinch and snap back after.** Currently under
  evaluation on a real phone; reverting is one constant.
- **Micro-marker counter-scale is a CSS custom property**, not React state — otherwise 39
  components re-render every gesture frame.
- **Globe texture halves on screens ≤520px.** 2048×1024 is two megapixels to paint and
  upload for a globe never drawn wider than ~360px.

---

## The globe

A copperplate sphere on paper. Continents are painted to an offscreen canvas in plate
carrée and wrapped — which is exactly what `THREE.SphereGeometry`'s own UVs are, so no
offset or flip is needed.

⚠️ **Do not tag that texture sRGB.** These shaders write straight to the framebuffer with
no colour-management epilogue, so three decodes to linear and nothing re-encodes — the
whole globe renders several stops too dark. `NoColorSpace` is the contract the whole file
follows (see `tokenRgb01`).

No atmosphere shell, no starfield. Both were artefacts of the dark direction, and additive
blending on a cream ground blows out to white regardless.

Camera framing decides whether it reads as a plate or a close-up: at 38° fov a unit sphere
subtends `asin(1/z)`, so ending at 2.35 cropped the limb away entirely. 4.9 puts the
silhouette at ~62% of frame height.

---

## Layout

The play screen's top band is **one flex row** — back, clue, then counter and controls
stacked at the end. It was three independently-positioned elements, each guessing how much
room the others needed with hardcoded offsets; both guesses went stale (a taller counter
put the controls on top of it). Flowing them hands the arithmetic to the browser, so
nothing can collide at any width or in any language.

---

## Gotchas worth remembering

- **Chained shell commands.** A `grep` with no match returns non-zero and silently skips
  the rest of an `&&` chain — this swallowed a `git commit` once while still printing
  "pushed".
- **The browser pane's screenshot canvas can differ from the real viewport.** Trust DOM
  measurements over the image when they disagree.
- **Search must never appear in Country mode.** The clue *is* the country name, so a search
  field lets you type the answer verbatim. Capital and Flag only. See ROADMAP.md.
- **Daily must stay global.** Region filtering applies to practice only, or the
  shared-result premise breaks.
- **Distances are stored in km always.** The unit preference is a display conversion, and
  the share text stays metric or results stop being comparable.
