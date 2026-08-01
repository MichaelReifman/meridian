# Geography Deduction Game — Product Requirements Document

**Working title:** *Meridian* (placeholder — a daily geography deduction game)
**Format:** Installable PWA, zero recurring cost
**One-liner:** Click a country on the map to guess a target — country, capital, or flag — and get pulled closer with every wrong guess, until the globe itself reveals the answer.

---

## 1. Core Concept

Each round gives the player a clue (a country name to locate, a capital city, or a flag) and a 2D world map. The player clicks their best guess. Every wrong guess reveals **both** a proximity heatmap across the whole map and a directional arrow + distance readout pointing toward the true answer. Guesses are unlimited; the score is the guess count. On a correct guess (or give-up), the map dissolves into a rotating 3D globe that flies to the answer and drops a glowing pin — the game's signature moment.

## 2. Modes

Three separate modes, selected before play — not mixed within a round:

| Mode | Clue shown | What you click |
|---|---|---|
| **Country** | Country name | The country's shape on the map |
| **Capital** | Capital city name | The country that city belongs to |
| **Flag** | Flag image | The country that flag belongs to |

## 3. Daily Challenge + Practice

- **Daily Challenge:** one official puzzle per mode per day, identical for every player (date-seeded, deterministic — no server needed). Tracks a streak per mode. Resets at local midnight. Produces a shareable result (see §6).
- **Practice:** unlimited random puzzles in any mode, any time. Tracks lifetime stats (average guesses, best streak) but doesn't affect the daily streak.

## 4. Feedback Mechanics

Both signals fire together on every wrong guess:

- **Heatmap glow:** every country on the map tints along a proximity gradient from the guessed country's centroid to the target's centroid (great-circle distance, normalized against the furthest possible point on Earth for that guess).
- **Arrow + distance:** a HUD-style compass arrow and a live distance readout (km) point from your last guess toward the true answer.

**Accessibility note:** the heatmap gradient will use a blue→gold scale rather than red→green, so it reads correctly for the most common forms of color blindness — the arrow + distance readout is also fully non-color-dependent, so proximity is never conveyed by color alone.

## 5. The Reveal (signature moment)

On solve or give-up: the flat map crossfades into a rotating 3D globe (WebGL). The camera flies in on the target location, drops a glowing pin, and traces a faint trail connecting your guess path across the globe's surface. This is the one place the "dramatic dark cosmic" direction gets to be loud — everywhere else stays disciplined.

## 6. Sharing & Stats *(assumption — flagged for your review)*

I'm defaulting to a Wordle-style shareable result (mode, date, guess count, no map spoilers) since the daily-challenge format all but calls for it, and to **local-only** stats/streaks (IndexedDB, no accounts/cloud sync) since it keeps this at zero recurring cost and matches your existing stack pattern (Luma already uses Dexie this way). Flag if you want cross-device sync instead — that would mean introducing a free-tier backend (e.g. Supabase) and is a real scope increase.

## 7. Data

- **Boundaries:** Natural Earth Admin-0 country geometry (public domain), simplified for mobile performance.
- **Flags:** flagcdn.com's free static SVG/PNG flag set (no key, no cost).
- **Country set:** the ~195 UN member/observer states for v1. Micro-territories and disputed regions excluded from v1 to avoid data-quality and sensitivity issues — can revisit later.
- **Units:** kilometers by default (no unit toggle in v1).

## 8. Tech Stack

- **Framework:** React + Vite, installable PWA (Vite PWA plugin / Workbox for offline + service worker)
- **2D map:** `react-simple-maps` (d3-geo under the hood) for the flat projection and click hit-testing
- **3D globe:** `react-three-fiber` / three.js for the reveal moment only — kept out of the critical render path until it's needed
- **Storage:** Dexie (IndexedDB) for stats, streaks, and cached daily-puzzle state
- **Hosting:** static deploy on Vercel or GitHub Pages free tier — no server, no recurring cost

## 9. Visual Design System — "Dark Cosmic"

Deliberately steering away from the generic near-black-plus-one-neon-accent look — going for something closer to an antique observatory chart rendered in deep space, not a flat dark-mode UI.

- **Palette:**
  - `#0B0E1A` — deep space navy (base, not pure black)
  - `#161B2E` — panel/chrome surface
  - `#E8B34D` — warm gold (correct answers, the reveal pin, streaks)
  - `#4FD1C5` — cool cyan (globe atmosphere glow, secondary accent)
  - `#7B6CF6` — soft violet (heatmap "cold" end, ambient nebula texture)
  - `#F4F1EA` — off-white (primary text, used sparingly against the dark base)
- **Type:**
  - Display: **Fraunces** (has real antique-atlas/observatory character) — used only for the mode titles and the reveal moment, with restraint
  - Body/UI: **Inter** — clean, quiet, gets out of the way
  - HUD numerals (distance, guess count): **JetBrains Mono** with tabular figures — reinforces the "triangulating a location" feel of the readout
- **Layout:** the map fills the viewport edge-to-edge; all chrome (mode badge, guess counter, distance readout) floats as minimal HUD elements in the corners rather than living in a toolbar
- **Motion:** the globe reveal is the one orchestrated, showpiece animation. Everything else — heatmap transitions, guess feedback — is quick and understated. `prefers-reduced-motion` disables the globe spin and camera fly-in in favor of a simple crossfade.

## 10. Non-Goals for v1

- No multiplayer / head-to-head
- No accounts or cross-device sync
- No additional modes (rivers, landmarks, cities-beyond-capitals) — good v2 candidates
- No unit toggle (km only)

## 11. Open Decisions Made Unilaterally (please flag disagreements)

1. Local-only storage, no accounts — see §6
2. Wordle-style share text as the sharing mechanic — see §6
3. Natural Earth + flagcdn.com as data sources — free, no key, no attribution burden beyond a footer credit
4. ~195-country v1 scope, excluding territories/disputed regions
5. Blue→gold heatmap instead of red→green, for accessibility

---

*Next step: hand this to Claude Code in a fresh session with ultracode/high effort — the 2D map + click hit-testing + heatmap is the core loop to get right first; the 3D globe reveal is a good candidate for a focused follow-up pass once the core loop feels good.*
