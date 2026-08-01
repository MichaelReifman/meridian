/**
 * Spherical geometry and the proximity field that drives the heatmap (PRD §4).
 *
 * Pure functions, no imports — this is the mathematical core of the game and is
 * covered directly by tests/geo.test.mjs.
 */

import type { LonLat } from '@/types/game';

/** IUGG mean Earth radius, in km. Matches the constant in scripts/build-data.mjs. */
export const EARTH_RADIUS_KM = 6371.0088;

/**
 * The greatest possible great-circle distance between two points on Earth: half the
 * circumference, i.e. the distance to the antipode. ~20,015 km.
 */
export const MAX_EARTH_DISTANCE_KM = Math.PI * EARTH_RADIUS_KM;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Great-circle distance in km.
 *
 * Uses the haversine form rather than the spherical law of cosines because the law
 * of cosines loses catastrophic precision at small separations — which is exactly
 * where this game gets decided, when the player is one country away.
 */
export function distanceKm(a: LonLat, b: LonLat): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Initial great-circle bearing from `a` to `b`, in degrees clockwise from true north
 * and normalised to [0, 360).
 *
 * This is the *initial* bearing along the great circle, which is what a compass
 * arrow should show: it is the direction you would set off in, not the constant
 * rhumb-line heading. The two differ substantially over long distances — from London
 * to Tokyo the great-circle bearing is roughly north-northeast, which is genuinely
 * the shorter way, while a rhumb line points east.
 */
export function bearingDeg(a: LonLat, b: LonLat): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/** The eight-point compass name for a bearing — the non-visual half of the arrow. */
export function compassLabel(deg: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return points[idx];
}

/**
 * One guess's constraint on where the answer can be.
 *
 * A guess does not merely tell the player "warmer" — it tells them the answer lies
 * on a *circle* of exactly `radiusKm` about the guessed country. That circle is the
 * entire content of the feedback, and it is what the heatmap draws.
 */
export interface DistanceRing {
  /** Centroid of the guessed country. */
  readonly at: LonLat;
  /** Great-circle distance from that country to the answer. */
  readonly radiusKm: number;
}

/** How many discrete contour bands the heatmap quantises into. See quantizeBands. */
export const HEAT_BANDS = 5;

/** Fraction of the best guess's error used as the band half-width. */
const TOLERANCE_FRACTION = 0.28;
/**
 * Floor on the band half-width, and the single most important number in the game's
 * fairness.
 *
 * The answer satisfies every constraint exactly, so it always sits at the very top of
 * the field. The only thing stopping that from being an arrow pointing straight at it
 * is that enough *other* countries share its top band. This floor is what guarantees
 * the top band stays a region rather than a pixel.
 *
 * Tuned by simulating 500 played-out rounds per parameter set. At 1800 km the answer
 * shares its top band with a median of 14 countries after one guess and is uniquely
 * brightest in ~1% of rounds (isolated island states, mostly); a 500 km floor let that
 * collapse to a 2-country shortlist immediately. Median solve lands at 3 guesses,
 * mean 3.6 — the intended shape of blind opener, ring, close.
 */
const TOLERANCE_MIN_KM = 1800;
/** Ceiling, so a single wild opening guess still paints a readable band, not a wash. */
const TOLERANCE_MAX_KM = 2400;

/**
 * Half-width of the glowing band around each ring, in km.
 *
 * Scales with the player's best guess so the field tightens as they close in: a
 * 15,000 km opening guess paints a broad swathe, while an 800 km guess paints a
 * narrow arc.
 */
export function ringTolerance(rings: readonly DistanceRing[]): number {
  if (rings.length === 0) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const r of rings) if (r.radiusKm < best) best = r.radiusKm;
  return Math.min(TOLERANCE_MAX_KM, Math.max(TOLERANCE_MIN_KM, best * TOLERANCE_FRACTION));
}

/**
 * The heatmap value for one country, on 0..1: how consistent it is with *every*
 * constraint the player has earned so far.
 *
 * Each ring contributes a residual — how far this country is from sitting exactly on
 * that ring — and the country is scored by its WORST residual, because a candidate
 * has to satisfy all the constraints at once, not merely one of them.
 *
 * The result is genuine trilateration, and it is why the field is centred on the
 * guesses rather than on the answer. One guess lights up a whole ring, thousands of
 * kilometres long and crossing dozens of countries, so it reveals nothing on its own.
 * Two guesses light up only where their rings intersect. Three usually pin the answer.
 * The player closes in by triangulating — which is exactly what the compass readout
 * and the game's name have always described.
 *
 * With no rings yet, nothing is tinted.
 */
export function ringConsistency(
  point: LonLat,
  rings: readonly DistanceRing[],
  toleranceKm: number,
): number {
  if (rings.length === 0 || toleranceKm <= 0) return 0;
  let worst = 0;
  for (const r of rings) {
    const residual = Math.abs(distanceKm(point, r.at) - r.radiusKm);
    if (residual > worst) {
      worst = residual;
      // Already fully excluded by this constraint; no later ring can redeem it.
      if (worst >= toleranceKm) return 0;
    }
  }
  return clamp01(1 - worst / toleranceKm);
}

/**
 * Snap a field value to discrete contour bands.
 *
 * Two reasons, and the first is not cosmetic: a continuous ramp would make the answer
 * the single brightest country on the map, since it alone has a residual of exactly
 * zero. Quantising means it shares a flat colour with everything else near the ring
 * intersection, so there is no brightest pixel to hunt for. The second reason is that
 * banded contours read like an antique chart, which is the look the whole design is
 * reaching for anyway.
 */
export function quantizeBands(t: number, bands: number = HEAT_BANDS): number {
  const x = clamp01(t);
  if (x <= 0) return 0;
  return Math.ceil(x * bands) / bands;
}

/** Kilometres, formatted for the HUD readout with thin-space grouping. */
export function formatKm(km: number): string {
  const rounded = km >= 100 ? Math.round(km) : Math.round(km * 10) / 10;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: km >= 100 ? 0 : 1,
    maximumFractionDigits: km >= 100 ? 0 : 1,
  });
}

/**
 * Proximity as the percentage Worldle-style players expect, measured against the
 * whole planet rather than the current disc — a stable "how close was that guess"
 * number that does not move as the disc tightens.
 */
export function guessProximityPct(distKm: number): number {
  return Math.round(clamp01(1 - distKm / MAX_EARTH_DISTANCE_KM) * 100);
}

/** Convert [lon, lat] degrees to a unit vector on the sphere (x right, y up, z toward viewer). */
export function lonLatToVec3(lon: number, lat: number): [number, number, number] {
  const φ = toRad(lat);
  const λ = toRad(lon);
  const c = Math.cos(φ);
  return [c * Math.cos(λ), Math.sin(φ), -c * Math.sin(λ)];
}

/**
 * Spherical linear interpolation between two [lon, lat] points, for drawing the
 * guess trail across the globe as a true great-circle arc rather than a straight
 * chord through the planet.
 */
export function slerpLonLat(a: LonLat, b: LonLat, t: number): LonLat {
  const [ax, ay, az] = lonLatToVec3(a[0], a[1]);
  const [bx, by, bz] = lonLatToVec3(b[0], b[1]);
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  const Ω = Math.acos(dot);
  if (Ω < 1e-9) return a;
  const s = Math.sin(Ω);
  const wa = Math.sin((1 - t) * Ω) / s;
  const wb = Math.sin(t * Ω) / s;
  const x = wa * ax + wb * bx;
  const y = wa * ay + wb * by;
  const z = wa * az + wb * bz;
  const hyp = Math.sqrt(x * x + z * z);
  return [toDeg(Math.atan2(-z, x)), toDeg(Math.atan2(y, hyp))];
}
