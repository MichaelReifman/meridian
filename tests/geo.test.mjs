/**
 * Tests for the spherical geometry and proximity field in src/lib/geo.ts.
 *
 * The Node test runner cannot import TypeScript, so the maths is re-derived here
 * from the same formulae rather than imported. That is deliberate: an independent
 * transcription catches transcription errors, which is most of what can go wrong in
 * a file of closed-form geometry. Any change to geo.ts must be mirrored below, and
 * the known-answer checks (real city pairs, real antipodes) are what keep the two
 * copies honest.
 *
 * Run with `npm test`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* ─── Re-derived from src/lib/geo.ts ─────────────────────────────────────── */

const EARTH_RADIUS_KM = 6371.0088;
const MAX_EARTH_DISTANCE_KM = Math.PI * EARTH_RADIUS_KM;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

function distanceKm([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingDeg([lon1, lat1], [lon2, lat2]) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function compassLabel(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/* The trilateration field — mirrors src/lib/geo.ts. Each wrong guess contributes a
   ring ("the answer is exactly this far from here"); a country is scored by its WORST
   residual across every ring, because a candidate has to satisfy all of them at once. */
const HEAT_BANDS = 5;
const TOLERANCE_FRACTION = 0.28;
const TOLERANCE_MIN_KM = 1800;
const TOLERANCE_MAX_KM = 2400;

function ringTolerance(rings) {
  if (rings.length === 0) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const r of rings) if (r.radiusKm < best) best = r.radiusKm;
  return Math.min(TOLERANCE_MAX_KM, Math.max(TOLERANCE_MIN_KM, best * TOLERANCE_FRACTION));
}

function ringConsistency(point, rings, toleranceKm) {
  if (rings.length === 0 || toleranceKm <= 0) return 0;
  let worst = 0;
  for (const r of rings) {
    const residual = Math.abs(distanceKm(point, r.at) - r.radiusKm);
    if (residual > worst) {
      worst = residual;
      if (worst >= toleranceKm) return 0;
    }
  }
  return clamp01(1 - worst / toleranceKm);
}

function quantizeBands(t, bands = HEAT_BANDS) {
  const x = clamp01(t);
  if (x <= 0) return 0;
  return Math.ceil(x * bands) / bands;
}

/** The ring a wrong guess at `from` produces, given the answer at `target`. */
const ringFor = (from, target) => ({ at: from, radiusKm: distanceKm(from, target) });

const guessProximityPct = (distKm) =>
  Math.round(clamp01(1 - distKm / MAX_EARTH_DISTANCE_KM) * 100);

/**
 * The generated roster, parsed straight out of the TypeScript source the same way
 * scripts/fetch-flags.mjs does — the fairness check below has to run against the real
 * 195 countries, because whether the answer stands alone on a ring depends entirely
 * on how the actual centroids are distributed.
 */
function readCountries() {
  const src = readFileSync(
    new URL('../src/data/countries.generated.ts', import.meta.url),
    'utf8',
  );
  const start = src.indexOf('] = ') + 4;
  const end = src.lastIndexOf('] as const') + 1;
  assert.ok(start > 4 && end > start, 'could not parse countries.generated.ts');
  return JSON.parse(src.slice(start, end));
}

/* ─── Fixtures ───────────────────────────────────────────────────────────── */

const LONDON = [-0.1276, 51.5072];
const PARIS = [2.3522, 48.8566];
const TOKYO = [139.6917, 35.6895];
const NAIROBI = [36.8219, -1.2921];
const LIMA = [-77.0428, -12.0464];
const SYDNEY = [151.2093, -33.8688];
/** The exact antipode of London: longitude flipped by 180°, latitude negated. */
const ANTI_LONDON = [LONDON[0] + 180, -LONDON[1]];

/** Assert `actual` is within `pct` percent of `expected`. */
function withinPct(actual, expected, pct, label) {
  const tolerance = Math.abs(expected) * (pct / 100);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ±${pct}% but got ${actual}`,
  );
}

/* ─── distanceKm ─────────────────────────────────────────────────────────── */

test('distanceKm matches known city pairs within 1%', () => {
  withinPct(distanceKm(LONDON, PARIS), 344, 1, 'London→Paris');
  withinPct(distanceKm(LONDON, TOKYO), 9560, 1, 'London→Tokyo');
  withinPct(distanceKm(PARIS, NAIROBI), 6485, 1, 'Paris→Nairobi');
});

test('distanceKm reaches half the circumference at the antipode', () => {
  withinPct(distanceKm(LONDON, ANTI_LONDON), 20015, 1, 'London→antipode');
  // Nothing on the sphere can be further apart than this, which is the normaliser
  // guessProximityPct divides by.
  assert.ok(distanceKm(LONDON, ANTI_LONDON) <= MAX_EARTH_DISTANCE_KM + 1e-6);
});

test('distanceKm is zero for identical points and symmetric otherwise', () => {
  assert.equal(distanceKm(TOKYO, TOKYO), 0);
  assert.equal(distanceKm(LONDON, LIMA), distanceKm(LIMA, LONDON));
});

test('distanceKm keeps precision at the small separations the endgame turns on', () => {
  // ~1.1 km apart. The spherical law of cosines loses most of its significant
  // digits here; haversine must not.
  const a = [0, 0];
  const b = [0, 0.01];
  withinPct(distanceKm(a, b), 1.1119, 0.5, 'sub-kilometre pair');
  assert.ok(distanceKm(a, b) > 0, 'a real separation must never collapse to zero');
});

/* ─── bearingDeg ─────────────────────────────────────────────────────────── */

test('bearing from London to Paris points east-south-east', () => {
  const b = bearingDeg(LONDON, PARIS);
  withinPct(b, 148, 3, 'London→Paris bearing');
  assert.equal(compassLabel(b), 'SE');
});

test('bearing is an initial great-circle heading, so it is not symmetric', () => {
  const forward = bearingDeg(LONDON, PARIS);
  const back = bearingDeg(PARIS, LONDON);
  const naiveReverse = (forward + 180) % 360;
  // Signed difference in (-180, 180].
  const delta = Math.abs((((back - naiveReverse + 540) % 360) - 180));
  assert.ok(delta > 0.5, `expected convergence, got ${delta}° between ${back} and ${naiveReverse}`);

  // Over a long, high-latitude path the asymmetry is dramatic — this is why the
  // arrow must use the initial bearing rather than a rhumb line.
  const out = bearingDeg(LONDON, TOKYO);
  const home = bearingDeg(TOKYO, LONDON);
  assert.ok(out < 90, `London→Tokyo should set off north of east, got ${out}°`);
  assert.ok(Math.abs((((home - ((out + 180) % 360) + 540) % 360) - 180)) > 10);
});

test('bearing is normalised to [0, 360) in every quadrant', () => {
  for (const pair of [
    [LONDON, PARIS],
    [PARIS, LONDON],
    [TOKYO, LIMA],
    [LIMA, NAIROBI],
    [NAIROBI, ANTI_LONDON],
  ]) {
    const b = bearingDeg(pair[0], pair[1]);
    assert.ok(b >= 0 && b < 360, `bearing out of range: ${b}`);
  }
});

test('compassLabel covers all eight points and wraps at 360', () => {
  assert.equal(compassLabel(0), 'N');
  assert.equal(compassLabel(360), 'N');
  assert.equal(compassLabel(359), 'N');
  assert.equal(compassLabel(45), 'NE');
  assert.equal(compassLabel(90), 'E');
  assert.equal(compassLabel(180), 'S');
  assert.equal(compassLabel(270), 'W');
  assert.equal(compassLabel(315), 'NW');
});

/* ─── the trilateration field ────────────────────────────────────────────── */

test('nothing is tinted before the first guess', () => {
  // Not even the answer, which is the whole point (PRD §4).
  assert.equal(ringTolerance([]), 0);
  assert.equal(ringConsistency(TOKYO, [], 2000), 0);
  assert.equal(ringConsistency(TOKYO, [ringFor(LONDON, TOKYO)], 0), 0);
});

test('the answer satisfies every ring exactly', () => {
  const rings = [LONDON, PARIS, NAIROBI, LIMA].map((p) => ringFor(p, TOKYO));
  const tol = ringTolerance(rings);
  assert.equal(ringConsistency(TOKYO, rings, tol), 1);
});

test('a country off the ring is dark, however close it is to the guess', () => {
  // The decisive difference from a hot-or-cold field: proximity to the GUESS earns
  // nothing. Paris is next door to London and still fails London's ring.
  const rings = [ringFor(LONDON, TOKYO)];
  const tol = ringTolerance(rings);
  assert.equal(ringConsistency(PARIS, rings, tol), 0);
  assert.ok(distanceKm(PARIS, LONDON) < 400, 'fixture must actually be near the guess');
});

test('a country is scored by its WORST ring, not its best', () => {
  // Sitting perfectly on one ring must never rescue a country that flunks another —
  // this is the difference between "satisfies all my constraints" and "is warm".
  const target = TOKYO;
  const rings = [ringFor(LONDON, target), ringFor(LIMA, target)];
  const tol = ringTolerance(rings);
  const residuals = (p) => rings.map((r) => Math.abs(distanceKm(p, r.at) - r.radiusKm));

  // Derived from the real roster rather than assumed: the country that sits closest to
  // London's ring while missing Lima's by the widest margin.
  let probe = null;
  let bestSpread = -Infinity;
  for (const c of readCountries()) {
    const p = [c.lon, c.lat];
    const [rLondon, rLima] = residuals(p);
    const spread = rLima - rLondon;
    if (rLondon < tol && spread > bestSpread) {
      bestSpread = spread;
      probe = p;
    }
  }
  assert.ok(probe, 'no country sits near London’s ring — fixture is degenerate');

  const [rLondon, rLima] = residuals(probe);
  assert.ok(rLima > rLondon, 'probe must be lopsided to be meaningful');
  assert.equal(ringConsistency(probe, rings, tol), clamp01(1 - Math.max(rLondon, rLima) / tol));
  // A "best ring" rule would have lit it up; the max rule must not.
  assert.ok(
    clamp01(1 - Math.min(rLondon, rLima) / tol) > ringConsistency(probe, rings, tol),
    'the max rule must score strictly darker than a min rule would',
  );
});

test('adding a ring can only ever darken a country, never brighten it', () => {
  const target = TOKYO;
  const probes = [PARIS, NAIROBI, LIMA, SYDNEY, [126.978, 37.5665] /* Seoul */];
  const path = [LONDON, PARIS, NAIROBI];
  for (const probe of probes) {
    let previous = Number.POSITIVE_INFINITY;
    const rings = [];
    for (const from of path) {
      rings.push(ringFor(from, target));
      // Held at a fixed tolerance so this isolates the max-residual rule from the
      // separate question of the band width narrowing.
      const t = ringConsistency(probe, rings, 2000);
      assert.ok(t <= previous + 1e-12, `adding a ring brightened a country: ${previous} → ${t}`);
      previous = t;
    }
  }
});

test('the band width is monotonically non-increasing across a sequence of guesses', () => {
  const target = TOKYO;
  // Deliberately includes a guess *worse* than the one before it (Lima, after
  // Nairobi) — the bands must hold at the running minimum rather than widening.
  const path = [LONDON, PARIS, NAIROBI, LIMA, [126.978, 37.5665] /* Seoul */];
  const rings = [];
  let previous = Number.POSITIVE_INFINITY;
  const errors = path.map((p) => distanceKm(p, target));
  assert.ok(errors[3] > errors[2], 'fixture must contain a regression to be meaningful');

  for (const from of path) {
    rings.push(ringFor(from, target));
    const tol = ringTolerance(rings);
    assert.ok(tol <= previous + 1e-12, `bands widened: ${previous} → ${tol}`);
    previous = tol;
  }
});

test('quantizeBands collapses the field to a fixed number of flat steps', () => {
  assert.equal(quantizeBands(0), 0);
  assert.equal(quantizeBands(-1), 0);
  assert.equal(quantizeBands(1), 1);
  assert.equal(quantizeBands(2), 1);
  const seen = new Set();
  for (let t = 0; t <= 1.0001; t += 0.001) seen.add(quantizeBands(clamp01(t)));
  assert.equal(seen.size, HEAT_BANDS + 1, 'exactly one dark step plus HEAT_BANDS lit steps');
  // Any two values inside the same step must be indistinguishable — this is what stops
  // the answer, whose residual is exactly zero, from being the brightest pixel.
  assert.equal(quantizeBands(1), quantizeBands(1 - 1 / HEAT_BANDS + 1e-6));
});

/* The regression test for the bug this mechanic replaced: a field centred on the
   answer made the answer the single brightest country on the map after one wrong
   guess, so a player could simply click the brightest thing they could see. */
test('one wrong guess must not leave the answer uniquely brightest', () => {
  const countries = readCountries();
  const points = countries.map((c) => [c.lon, c.lat]);

  let uniqueTells = 0;
  let sampled = 0;
  // A deterministic spread of target/guess pairs across the whole roster.
  for (let ti = 0; ti < countries.length; ti += 1) {
    const target = points[ti];
    const gi = (ti * 71 + 13) % countries.length; // coprime stride — no clustering
    if (gi === ti) continue;
    const rings = [ringFor(points[gi], target)];
    const tol = ringTolerance(rings);
    const targetBand = quantizeBands(ringConsistency(target, rings, tol));
    assert.equal(targetBand, 1, 'the answer must always be in the top band');

    const sharing = points.filter(
      (p) => quantizeBands(ringConsistency(p, rings, tol)) >= targetBand - 1e-9,
    ).length;
    if (sharing === 1) uniqueTells++;
    sampled++;
  }

  const rate = uniqueTells / sampled;
  // The old disc scored 1.0 here by construction. Isolated island states can still
  // stand alone on a ring, so this is a rate bound, not an absolute guarantee.
  assert.ok(
    rate < 0.08,
    `answer was uniquely brightest in ${(rate * 100).toFixed(1)}% of single-guess rounds`,
  );
});

/* ─── guessProximityPct ──────────────────────────────────────────────────── */

test('guessProximityPct is planet-relative and clamped to 0..100', () => {
  assert.equal(guessProximityPct(0), 100);
  assert.equal(guessProximityPct(MAX_EARTH_DISTANCE_KM), 0);
  assert.equal(guessProximityPct(MAX_EARTH_DISTANCE_KM * 2), 0, 'must clamp, not go negative');
  assert.equal(guessProximityPct(MAX_EARTH_DISTANCE_KM / 2), 50);

  // Stable as the disc tightens: it depends only on the guess, never on the field.
  const pct = guessProximityPct(distanceKm(LONDON, TOKYO));
  assert.ok(pct > 50 && pct < 55, `London→Tokyo should read just over half, got ${pct}`);
  assert.equal(pct, guessProximityPct(distanceKm(TOKYO, LONDON)));
});
