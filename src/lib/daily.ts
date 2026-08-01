/**
 * Puzzle selection — the deterministic Daily Challenge and the random Practice draw.
 *
 * The daily has to be identical on every device with no server to arbitrate, so it
 * is computed from nothing but the local calendar date and the mode. That makes the
 * PRNG choice load-bearing rather than cosmetic: see the notes on `seededStream` and
 * `uniformIndex` for the two places a naive implementation silently goes wrong.
 */

import { COUNTRIES } from '@/data/countries.generated';
import { flagUrl } from '@/lib/paths';
import { matchesRegion, type RegionFilter } from '@/store/prefsStore';
import type { Country, GameMode, Puzzle } from '@/types/game';

/* ─── Local calendar ─────────────────────────────────────────────────────── */

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** The local calendar day as `YYYY-MM-DD` — the daily puzzle's only identity. */
export function localDateKey(d: Date = new Date()): string {
  // Deliberately NOT toISOString(). That converts to UTC first, so every player
  // west of Greenwich would be served yesterday's puzzle for the first hours of
  // their day and every player east of it tomorrow's — and their streak would
  // break at a boundary they never see. Reading the local fields directly is the
  // whole point: the daily rolls over at the player's own midnight.
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Milliseconds until the next local midnight, for the "next puzzle in…" countdown. */
export function msUntilLocalMidnight(now: Date = new Date()): number {
  // Building the next day through the Date(y, m, d) constructor lets the engine
  // normalise month/year rollover *and* apply whatever UTC offset is actually in
  // force on that future date. Adding a flat 86,400,000 ms would be an hour wrong
  // on both DST transition days, which is exactly when a countdown is scrutinised.
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/* ─── Seeded PRNG ────────────────────────────────────────────────────────── */

/**
 * xmur3 — hashes a string into a stream of well-mixed 32-bit seed words.
 *
 * A string hash alone is not a usable random source (its low bits stay correlated
 * for similar inputs, and consecutive dates are about as similar as inputs get), so
 * it is used only to seed a real generator below.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (): number => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * sfc32 — 128 bits of state, passes PractRand, and uses only operations that are
 * exact in JavaScript (Math.imul-free int32 adds and shifts), so it produces
 * bit-identical output on every engine. That last property is the requirement:
 * two players must derive the same country from the same date.
 *
 * Returns a uint32 rather than a float — `uniformIndex` needs the raw integer.
 */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
}

/** Outputs discarded before the stream is used. See `seededStream`. */
const PRNG_WARMUP = 12;

function seededStream(seed: string): () => number {
  const h = xmur3(seed);
  const next = sfc32(h(), h(), h(), h());
  // sfc32's first handful of outputs still carry the shape of the seed material.
  // Without this warm-up, seeds that differ in one character — "…/2026-08-01/" vs
  // "…/2026-08-02/" — can land on visibly related first draws, which would show up
  // as runs of same-region answers on consecutive days.
  for (let i = 0; i < PRNG_WARMUP; i++) next();
  return next;
}

/** A uniformly distributed index in [0, n). */
function uniformIndex(next: () => number, n: number): number {
  // Rejection sampling rather than `next() % n`: 2^32 is not a multiple of 195, so
  // a plain modulo gives the first (2^32 mod 195) entries of the roster an extra
  // chance on every draw and permanently under-represents the tail — Zambia and
  // Zimbabwe would come up measurably less often than Afghanistan. Discarding the
  // ragged top slice of the 32-bit range makes every index exactly equally likely.
  const limit = Math.floor(4294967296 / n) * n;
  let x = next();
  while (x >= limit) x = next();
  return x % n;
}

/* ─── Puzzles ────────────────────────────────────────────────────────────── */

/**
 * Namespaced and versioned so the answer set can be deliberately reshuffled later
 * without colliding with any other seeded feature. Changing this string changes
 * every past and future daily, so it is effectively frozen.
 */
const DAILY_SEED = 'meridian/daily/v1';

/**
 * The Daily Challenge puzzle for a mode on a local calendar day.
 *
 * A uniform draw over all 195 countries — no difficulty weighting, no curated pool,
 * no day-of-week tiering. Tuvalu is exactly as likely as Brazil, by explicit choice.
 */
export function dailyPuzzle(mode: GameMode, dateKey: string = localDateKey()): Puzzle {
  // The mode is baked into the seed string rather than taken as successive draws
  // from one shared stream, so the three modes are genuinely independent: solving
  // Country tells you nothing about today's Flag answer, and adding a fourth mode
  // later would not disturb the existing three.
  const next = seededStream(`${DAILY_SEED}/${dateKey}/${mode}`);
  const target = COUNTRIES[uniformIndex(next, COUNTRIES.length)];
  return { mode, kind: 'daily', dateKey, targetId: target.id, seq: 0 };
}

/**
 * A random Practice puzzle. Unseeded by design — practice must never be predictable
 * and never touches the daily streak.
 *
 * `exclude` holds the targets already seen this session so consecutive rounds do not
 * repeat.
 */
export function practicePuzzle(
  mode: GameMode,
  seq: number,
  exclude: readonly string[] = [],
  region: RegionFilter = 'all',
): Puzzle {
  /**
   * The region filter narrows practice only. `dailyPuzzle` deliberately takes no such
   * parameter: the daily is the same puzzle for everyone, and a filtered daily would
   * quietly break the premise that two players can compare the same result.
   */
  const inRegion = COUNTRIES.filter((c) => matchesRegion(c, region));
  const blocked = new Set(exclude);
  const remaining = inRegion.filter((c) => !blocked.has(c.id));
  /* Degrade rather than throw: a session that has seen everything should keep dealing,
     just without the no-repeat guarantee. The fallback is the REGION's pool rather than
     the whole roster — Oceania is fourteen countries, so this branch is reached in a
     couple of minutes, and falling back to all 195 there would silently cancel the
     filter the player just set. */
  const pool: readonly Country[] = remaining.length > 0 ? remaining : inRegion;
  const safe: readonly Country[] = pool.length > 0 ? pool : COUNTRIES;
  const target = safe[Math.floor(Math.random() * safe.length)];
  return { mode, kind: 'practice', dateKey: localDateKey(), targetId: target.id, seq };
}

/* ─── Roster lookup ──────────────────────────────────────────────────────── */

const BY_ID: ReadonlyMap<string, Country> = new Map(COUNTRIES.map((c) => [c.id, c]));

/** Look up a playable country by ISO 3166-1 numeric id. Inert land is never present. */
export function countryById(id: string): Country | undefined {
  return BY_ID.get(id);
}

/** The country a puzzle points at. Throws if the roster no longer contains it. */
export function targetOf(puzzle: Puzzle): Country {
  const country = countryById(puzzle.targetId);
  if (!country) {
    // Reachable in exactly one way: a round persisted under an older roster whose
    // ids have since changed. Name the offending puzzle so the caller can drop it.
    throw new Error(
      `Meridian: puzzle ${puzzle.kind}/${puzzle.mode}/${puzzle.dateKey}#${puzzle.seq} ` +
        `references unknown country id "${puzzle.targetId}" — discard this saved round.`,
    );
  }
  return country;
}

/** The clue to present for a puzzle, per mode (PRD §2). */
export function clueFor(puzzle: Puzzle): { kind: GameMode; text: string; flagSrc?: string } {
  const country = targetOf(puzzle);
  switch (puzzle.mode) {
    case 'country':
      return { kind: 'country', text: country.name };
    case 'capital':
      // `capital` is nullable in the schema, so fall back through the full list
      // before surrendering — an empty clue would be an unplayable round.
      return { kind: 'capital', text: country.capital ?? country.capitals[0] ?? country.name };
    case 'flag':
      // `text` doubles as the image's alt text and the screen-reader clue. A flag
      // with no accessible name makes the mode unplayable without sight, and the
      // country's name is not a spoiler here — *locating* it is the entire puzzle.
      return { kind: 'flag', text: country.name, flagSrc: flagUrl(country.cca2) };
  }
}
