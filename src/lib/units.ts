/**
 * Distance units — a presentation layer over a game that only ever thinks in kilometres.
 *
 * The ring mechanic, the stored `Guess.distanceKm`, the heatmap bands and the share text
 * are all kilometres and stay kilometres. Nothing here is allowed to run before a value
 * is measured or persisted, only after: a shared result whose figures depended on the
 * sharer's settings would stop being comparable between two players, which is the one
 * property the daily is built around.
 *
 * So the conversion is deliberately the last step. `toDisplayDistance` takes a stored
 * kilometre value and hands back a number to print; the caller pairs it with `UNIT_KEY`
 * for the suffix and puts it through `t.num` for the digits.
 */

import type { TranslationKey } from '@/i18n/en';

/** What the player reads. What the game stores is always kilometres. */
export type DistanceUnit = 'km' | 'mi';

/** Choice order for the settings list — the default first. */
export const DISTANCE_UNITS: readonly DistanceUnit[] = ['km', 'mi'] as const;

export const DEFAULT_DISTANCE_UNIT: DistanceUnit = 'km';

/**
 * The international mile, exactly. Written out rather than approximated to 1.609,
 * because the readout is rounded to a tenth below 100 units and a coarse factor would
 * show up as an off-by-one there.
 */
const KM_PER_MILE = 1.609344;

export function isDistanceUnit(value: unknown): value is DistanceUnit {
  return value === 'km' || value === 'mi';
}

/**
 * A stored kilometre distance as a number in the player's chosen unit.
 *
 * Returns a raw number, not a string: rounding and digit shapes belong to the caller,
 * which is the only place that knows the locale and how coarse that particular readout
 * is. Round on the *result* of this call — a "one decimal below 100" rule applied to the
 * kilometre value would change precision at 62 miles instead of at 100.
 */
export function toDisplayDistance(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? km / KM_PER_MILE : km;
}

/** The abbreviation printed against a figure: "km", "mi". */
export const UNIT_KEY: Record<DistanceUnit, TranslationKey> = {
  km: 'play.km',
  mi: 'play.mi',
};

/** The unit's full name, for the settings list where it is the thing being chosen. */
export const UNIT_NAME_KEY: Record<DistanceUnit, TranslationKey> = {
  km: 'units.km',
  mi: 'units.mi',
};
