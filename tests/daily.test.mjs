/**
 * Tests for the deterministic daily-puzzle selection in src/lib/daily.ts.
 *
 * The Node test runner cannot import TypeScript, so the date handling and the PRNG
 * are re-derived here and the roster is read straight out of countries.generated.ts
 * with the same text parse scripts/fetch-flags.mjs uses. The point of the exercise
 * is the *properties* — determinism, per-mode independence, full uniform coverage —
 * which hold for any faithful transcription and break loudly for an unfaithful one.
 *
 * Run with `npm test`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED = path.resolve(__dirname, '..', 'src', 'data', 'countries.generated.ts');

/** Read the generated roster without a TypeScript loader — same parse as fetch-flags.mjs. */
function readRoster() {
  const src = fs.readFileSync(GENERATED, 'utf8');
  const start = src.indexOf('] = ') + 4;
  const end = src.lastIndexOf('] as const') + 1;
  if (start < 4 || end <= start) {
    throw new Error('could not parse countries.generated.ts — run `npm run data` first');
  }
  return JSON.parse(src.slice(start, end));
}

const COUNTRIES = readRoster();
const MODES = ['country', 'capital', 'flag'];

/* ─── Re-derived from src/lib/daily.ts ───────────────────────────────────── */

const pad2 = (n) => (n < 10 ? `0${n}` : String(n));

const localDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const msUntilLocalMidnight = (now) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).getTime() -
  now.getTime();

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return () => {
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

const PRNG_WARMUP = 12;
const DAILY_SEED = 'meridian/daily/v1';

function seededStream(seed) {
  const h = xmur3(seed);
  const next = sfc32(h(), h(), h(), h());
  for (let i = 0; i < PRNG_WARMUP; i++) next();
  return next;
}

function uniformIndex(next, n) {
  const limit = Math.floor(4294967296 / n) * n;
  let x = next();
  while (x >= limit) x = next();
  return x % n;
}

function dailyPuzzle(mode, dateKey) {
  const next = seededStream(`${DAILY_SEED}/${dateKey}/${mode}`);
  const target = COUNTRIES[uniformIndex(next, COUNTRIES.length)];
  return { mode, kind: 'daily', dateKey, targetId: target.id, seq: 0 };
}

/** `count` consecutive local date keys starting at 2000-01-01. */
function dateKeys(count) {
  const keys = new Array(count);
  for (let i = 0; i < count; i++) keys[i] = localDateKey(new Date(2000, 0, 1 + i));
  return keys;
}

/* ─── Roster ─────────────────────────────────────────────────────────────── */

test('the generated roster is the 195-country v1 set with unique ids', () => {
  assert.equal(COUNTRIES.length, 195);
  assert.equal(new Set(COUNTRIES.map((c) => c.id)).size, 195);
  assert.equal(new Set(COUNTRIES.map((c) => c.cca2)).size, 195);
  for (const c of COUNTRIES) {
    assert.match(c.id, /^\d{3}$/, `${c.name} has a malformed ISO numeric id`);
    assert.match(c.cca2, /^[a-z]{2}$/, `${c.name} has a malformed cca2 (used in the flag path)`);
  }
});

/* ─── localDateKey ───────────────────────────────────────────────────────── */

test('localDateKey reads local calendar fields, never UTC', () => {
  assert.equal(localDateKey(new Date(2026, 0, 1, 0, 0, 0)), '2026-01-01');
  assert.equal(localDateKey(new Date(2026, 0, 1, 23, 59, 59)), '2026-01-01');
  assert.equal(localDateKey(new Date(2026, 11, 31, 23, 30)), '2026-12-31');
  // Zero padding — an unpadded month would sort wrongly and break the streak key.
  assert.equal(localDateKey(new Date(2026, 8, 9, 12)), '2026-09-09');
});

test('localDateKey agrees with the local calendar for a year of instants', () => {
  for (let i = 0; i < 400; i++) {
    // 00:15 local: the hour where a toISOString-based key silently reports the
    // previous day for every player west of Greenwich.
    const d = new Date(2026, 0, 1 + i, 0, 15);
    assert.equal(
      localDateKey(d),
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    );
    assert.match(localDateKey(d), /^\d{4}-\d{2}-\d{2}$/);
  }
});

/* ─── msUntilLocalMidnight ───────────────────────────────────────────────── */

test('msUntilLocalMidnight lands exactly on the next local midnight', () => {
  for (const now of [
    new Date(2026, 0, 1, 0, 0, 0, 1),
    new Date(2026, 2, 8, 1, 30),
    new Date(2026, 6, 15, 12, 0, 0),
    new Date(2026, 10, 1, 1, 30),
    new Date(2026, 11, 31, 23, 59, 59, 999),
  ]) {
    const ms = msUntilLocalMidnight(now);
    assert.ok(ms > 0, `countdown must be positive, got ${ms}`);
    // A DST fall-back day is genuinely 25 hours long, so the bound is not 24.
    assert.ok(ms <= 25 * 3600 * 1000, `countdown implausibly long: ${ms}`);

    const then = new Date(now.getTime() + ms);
    assert.equal(then.getHours(), 0);
    assert.equal(then.getMinutes(), 0);
    assert.equal(then.getSeconds(), 0);
    assert.equal(then.getMilliseconds(), 0);
    assert.notEqual(localDateKey(then), localDateKey(now), 'it must roll the day over');
  }
});

/* ─── Determinism ────────────────────────────────────────────────────────── */

test('the same date and mode always yield the same country', () => {
  for (const key of dateKeys(50)) {
    for (const mode of MODES) {
      const first = dailyPuzzle(mode, key);
      for (let i = 0; i < 5; i++) {
        assert.deepEqual(dailyPuzzle(mode, key), first);
      }
    }
  }
});

test('a daily puzzle is well-formed', () => {
  const p = dailyPuzzle('capital', '2026-08-01');
  assert.equal(p.kind, 'daily');
  assert.equal(p.seq, 0);
  assert.equal(p.mode, 'capital');
  assert.equal(p.dateKey, '2026-08-01');
  assert.ok(
    COUNTRIES.some((c) => c.id === p.targetId),
    'the target must be a playable country',
  );
});

test('consecutive days are uncorrelated — no runs of the same answer', () => {
  const keys = dateKeys(2000);
  let repeats = 0;
  for (const mode of MODES) {
    let prev = null;
    for (const key of keys) {
      const id = dailyPuzzle(mode, key).targetId;
      if (id === prev) repeats++;
      prev = id;
    }
  }
  // Chance alone gives ~6000/195 ≈ 31 back-to-back repeats; a poorly warmed PRNG
  // seeded on near-identical strings gives clusters far above that.
  assert.ok(repeats < 80, `too many back-to-back repeats: ${repeats}`);
});

/* ─── Per-mode independence ──────────────────────────────────────────────── */

test('the three modes are drawn independently and differ on almost every day', () => {
  const keys = dateKeys(1000);
  let allDistinct = 0;
  const pairCollisions = { 'country/capital': 0, 'country/flag': 0, 'capital/flag': 0 };

  for (const key of keys) {
    const [country, capital, flag] = MODES.map((m) => dailyPuzzle(m, key).targetId);
    if (country !== capital && country !== flag && capital !== flag) allDistinct++;
    if (country === capital) pairCollisions['country/capital']++;
    if (country === flag) pairCollisions['country/flag']++;
    if (capital === flag) pairCollisions['capital/flag']++;
  }

  // Independent draws over 195 countries collide on ~1.5% of days; that is expected
  // and harmless. What would not be is a shared or offset stream, which shows up
  // here as either 0 collisions (a forced permutation) or a flood of them.
  assert.ok(allDistinct / keys.length > 0.95, `only ${allDistinct}/${keys.length} days distinct`);
  for (const [pair, n] of Object.entries(pairCollisions)) {
    assert.ok(n < keys.length * 0.05, `${pair} collided on ${n} days — modes are not independent`);
  }
});

/* ─── Uniform coverage ───────────────────────────────────────────────────── */

test('every one of the 195 countries appears over ~20,000 days, in every mode', () => {
  const keys = dateKeys(20000);

  for (const mode of MODES) {
    const counts = new Map(COUNTRIES.map((c) => [c.id, 0]));
    for (const key of keys) {
      const id = dailyPuzzle(mode, key).targetId;
      counts.set(id, counts.get(id) + 1);
    }

    const missing = [...counts].filter(([, n]) => n === 0).map(([id]) => id);
    assert.deepEqual(missing, [], `${mode}: countries never drawn in 20,000 days`);

    // No difficulty weighting and no modulo bias: with an expected 102.6 draws each
    // and σ ≈ 10.1, a ±5σ band is loose enough never to flake but tight enough to
    // catch a tail that a `% 195` would have starved.
    const tallies = [...counts.values()];
    assert.ok(Math.min(...tallies) > 52, `${mode}: starved country, min ${Math.min(...tallies)}`);
    assert.ok(Math.max(...tallies) < 153, `${mode}: favoured country, max ${Math.max(...tallies)}`);
  }
});

test('the tail of the roster is drawn as often as the head', () => {
  // The specific failure a modulo would cause: 2^32 is not a multiple of 195, so the
  // first entries would win the extra slots and the last entries would go short.
  const keys = dateKeys(20000);
  const half = Math.floor(COUNTRIES.length / 2);
  const headIds = new Set(COUNTRIES.slice(0, half).map((c) => c.id));

  let head = 0;
  let tail = 0;
  for (const key of keys) {
    for (const mode of MODES) {
      if (headIds.has(dailyPuzzle(mode, key).targetId)) head++;
      else tail++;
    }
  }
  const skew = Math.abs(head - tail) / (head + tail);
  assert.ok(skew < 0.02, `head/tail skew of ${(skew * 100).toFixed(2)}% suggests modulo bias`);
});
