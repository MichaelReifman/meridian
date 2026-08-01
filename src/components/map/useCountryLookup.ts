/**
 * The join between the Natural Earth topology and Meridian's 195 playable countries.
 *
 * The topology and the country table agree on ISO 3166-1 numeric codes, but they do
 * not agree on how those codes are *typed*: topojson feature ids arrive as `"036"`
 * when the source stringifies them and as `36` when a bundler or JSON round-trip has
 * coerced them to numbers, and a bare `String(36)` loses the zero padding that the
 * generated table uses. A mismatch here has no visible symptom — the country simply
 * stops being clickable — so every id crossing this boundary is normalised in one
 * place.
 */

import { COUNTRIES } from '@/data/countries.generated';
import type { Country } from '@/types/game';

/**
 * Normalise any spelling of an ISO numeric code to the zero-padded 3-character form
 * used as `Country.id`. Returns `''` for ids the topology omits (five disputed and
 * non-state features carry no id at all), which never matches a playable country.
 */
export function toCountryId(id: string | number | undefined): string {
  if (id === undefined) return '';
  const raw = typeof id === 'number' ? String(id) : id.trim();
  return raw.length >= 3 ? raw : raw.padStart(3, '0');
}

/**
 * Built once at module scope: `COUNTRIES` is generated, frozen data, so there is
 * nothing per-component to derive and nothing that can go stale.
 */
const BY_ID: Map<string, Country> = new Map(COUNTRIES.map((c) => [c.id, c]));

/**
 * The legal guess set. Everything in `INERT_IDS` is excluded from `COUNTRIES` by the
 * build script, so membership here is the single authority on "is this clickable" —
 * no second exclusion list to keep in sync.
 */
const PLAYABLE_IDS: ReadonlySet<string> = new Set(BY_ID.keys());

function isPlayable(id: string | number | undefined): boolean {
  return PLAYABLE_IDS.has(toCountryId(id));
}

export interface CountryLookup {
  byId: Map<string, Country>;
  playableIds: ReadonlySet<string>;
  isPlayable(id: string | number | undefined): boolean;
}

const LOOKUP: CountryLookup = { byId: BY_ID, playableIds: PLAYABLE_IDS, isPlayable };

/**
 * Stable across every render and every consumer, so it can sit in the dependency
 * array of the heatmap memo without ever invalidating it.
 */
export function useCountryLookup(): CountryLookup {
  return LOOKUP;
}
