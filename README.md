# Meridian

A daily geography deduction game. Click a country on the map to guess a target — country, capital, or flag — and get pulled closer with every wrong guess, until the globe itself reveals the answer.

Installable PWA, fully offline after install, no accounts, no server, zero recurring cost.

Built from [`geography-deduction-game-prd.md`](geography-deduction-game-prd.md).

---

## Quick start

```bash
npm install && npm run data && npm run flags && npm run icons && npm run dev
```

The three generation steps are one-time — their output is gitignored and rebuilt on demand:

| Script | Output | Notes |
|---|---|---|
| `npm run data` | `public/data/world-50m.json`, `src/data/countries.generated.ts` | Country roster + boundaries |
| `npm run flags` | `public/flags/*.webp` | 195 flags, downloaded once and re-encoded |
| `npm run icons` | `public/icons/*` | PWA icon set |
| `npm run test` | — | Geo maths and daily-seeding invariants |
| `npm run build` | `dist/` | `tsc -b && vite build` |

## How it plays

Pick a mode, then Daily or Practice.

| Mode | Clue | You click |
|---|---|---|
| Country | Country name | That country's shape |
| Capital | Capital city name | The country it belongs to |
| Flag | Flag image | The country it belongs to |

Guesses are unlimited; your score is the guess count. Every wrong guess fires **both** feedback signals at once:

- **The heatmap** draws a *ring*. Your guess comes back with an exact distance, so the answer lies somewhere on a circle that far from the country you clicked — and the map lights that circle up, right around the world. Guess again elsewhere and a second ring appears; only the places satisfying **both** stay lit. A third normally pins it. This is trilateration: you fix the answer the way you'd fix a position from two landmarks.
- **The compass** gives a bearing arrow, a compass point in words, and a live distance in kilometres from your last guess toward the answer.

The field is centred on your **guesses**, never on the answer — see [Why the heatmap is not a hot-or-cold blob](#why-the-heatmap-is-not-a-hot-or-cold-blob).

Proximity is never conveyed by colour alone: the ramp runs violet → cyan → gold, rising monotonically in luminance so it survives greyscale and the common forms of colour blindness, and the arrow and distance readout carry the same information independently.

On a solve or a give-up, the flat map crossfades into a rotating 3D globe that flies to the answer and drops a glowing pin.

### Why the heatmap is not a hot-or-cold blob

The obvious design — tint every country by how close it is to the answer — hands the game away. The answer is then the brightest country on the map after a single wrong guess, so you just click the brightest thing you can see. Flattening the gradient doesn't save it either: a uniformly filled disc still betrays its own centre.

**Any field centred on the answer reveals the answer.** So the field is centred on the guesses instead. Each wrong guess contributes a ring, and a country is scored by its *worst* residual across every ring, because a candidate has to satisfy all the constraints at once rather than merely one of them.

Values are then quantised into `HEAT_BANDS` flat steps. That is not cosmetic: a continuous ramp would still make the answer the single brightest country, since it alone has a residual of exactly zero. Banding puts it in a flat colour shared with everything else near the intersection, so there is no brightest pixel to hunt for — and the contours happen to read like an antique chart, which is the look the design wants anyway.

The tolerance floor (`TOLERANCE_MIN_KM`) is the number that governs fairness, and it was tuned by simulating 500 played-out rounds per parameter set:

| after | countries sharing the answer's top band | answer uniquely brightest |
|---|---|---|
| 1 guess | ~14 (median) | ~1% of rounds |
| 2 guesses | ~2 | — |
| 3 guesses | ~1 | — |

Median solve is 3 guesses, mean 3.6. `tests/geo.test.mjs` asserts the ~1% bound directly against the real 195-country roster, so the old failure mode cannot come back unnoticed.

## Architecture

```
scripts/          build-time data pipeline (Node, run manually — not part of `npm run build`)
src/
  types/game.ts   domain contracts — everything is written against these
  lib/geo.ts      great-circle maths + the proximity field   ← the mathematical core
  lib/ramp.ts     heatmap colour ramp, shared by SVG map and WebGL globe
  lib/daily.ts    date-seeded deterministic puzzle selection
  lib/share.ts    Wordle-style share text
  data/           generated country roster
  db/             Dexie (IndexedDB) — stats, streaks, saved rounds
  store/          zustand — round state machine + UI state
  components/map/    react-simple-maps, hit-testing, pan/zoom, heatmap
  components/hud/    corner chrome — clue, compass, guess trail
  components/globe/  react-three-fiber reveal (lazy-loaded)
  screens/        menu, play, stats, how-to
  theme/          design tokens
```

`three.js` and `react-three-fiber` are code-split into a `globe` chunk and lazy-loaded, so the map boots without paying for WebGL.

## Data

| Source | Licence | Used for |
|---|---|---|
| [Natural Earth](https://www.naturalearthdata.com/) Admin-0 via `world-atlas` | Public domain | Country boundaries (50m) |
| [`world-countries`](https://github.com/mledoze/countries) | ODbL | Names, capitals, ISO codes |
| [flagcdn.com](https://flagcdn.com/) | Free, no key | Flags, vendored at build time |

**195 playable countries** — UN member and observer states. Territories and disputed regions (Kosovo, Western Sahara, Northern Cyprus, Somaliland, Taiwan, Greenland, Puerto Rico, …) render as inert terrain: visible for orientation, never clickable, never a target.

### Three data hazards the pipeline exists to handle

Each of these silently corrupts the game if ignored, and none is visible without checking:

1. **Duplicate ISO ids.** Natural Earth emits two features under numeric `036` — Australia, and *Ashmore and Cartier Is.*, a 3 km² uninhabited reef. Keying a `Map` by id keeps whichever arrives last, turning Australia into an islet off its own coast. Every feature sharing an id is merged.

2. **Scattered territories.** Admin-0 folds overseas departments into the parent state, so France carries Guadeloupe, Martinique, Guyane, Réunion and Mayotte and its true spherical centroid lands in the Atlantic ~400 km off Spain. Distance feedback keyed on that would be actively misleading. Instead each country gets a **main-cluster centroid**: polygons more than 3000 km from the largest one are dropped, and the rest are averaged in 3D so the result behaves correctly across the antimeridian. France returns to central France; the USA lands in Kansas rather than mid-Pacific; Fiji and Kiribati aren't flung into Africa.

3. **Unclickable micro-states.** Tuvalu has no geometry at all at 50m; 38 more UN members are far too small to tap at world zoom. Every country under 12,000 km² also gets a marker whose hit radius scales inversely with zoom, so it stays a ~14px target at any magnification. Tuvalu's centroid is recovered from the 10m topology.

`npm run data` prints a centroid spot-check table and fails the build on any duplicate name, duplicate capital, or out-of-range coordinate.

## Storage

Local only — Dexie/IndexedDB, no accounts, no cloud sync, matching the PRD's zero-recurring-cost constraint. Streaks are per-mode and reset at **local** midnight. Where storage is unavailable (private browsing, blocked storage), the game degrades to in-memory state and stays fully playable.

Streak arithmetic uses local calendar dates rather than millisecond subtraction, so a DST transition can't silently break a streak.

## Deploy

Static. `npm run build`, then deploy `dist/` to Vercel or GitHub Pages. `vercel.json` sets SPA rewrites and immutable caching for hashed assets. There is no backend and nothing to configure.

## Non-goals for v1

No multiplayer, no accounts or cross-device sync, no modes beyond the three, no unit toggle (km only).
