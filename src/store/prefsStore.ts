/**
 * Player preferences that are not the language: the distance unit, and the region
 * practice draws from.
 *
 * A store of its own rather than a second concern bolted onto the locale store. Locale
 * is special — it rewrites `lang` and `dir` on the document before React ever renders,
 * and it must stay a module whose only job is that. Everything else the player merely
 * *prefers* now has an obvious place to be added, and adding one is a field plus a
 * setter rather than a new file and a new storage key.
 *
 * Persisted to localStorage like the locale, and for the same reason: these are read on
 * the first render of the title page, and an IndexedDB round-trip would mean a frame of
 * kilometres for someone who chose miles. One JSON object under one key, so a later
 * preference costs no extra storage entry and no extra migration.
 *
 * Reads are defensive on every field independently. A blob written by a newer build, or
 * hand-edited, should cost at most the one preference it broke.
 */

import { create } from 'zustand';

import type { TranslationKey } from '@/i18n/en';
import {
  DEFAULT_DISTANCE_UNIT,
  isDistanceUnit,
  type DistanceUnit,
} from '@/lib/units';
import type { Country } from '@/types/game';

/* ─── Regions ────────────────────────────────────────────────────────────── */

/**
 * The practice filter.
 *
 * The five named values are the roster's own `region` strings verbatim, so the filter is
 * a comparison rather than a mapping table that could drift from the data. They are
 * identifiers here and never printed — `REGION_KEY` is what a screen shows.
 */
export type RegionFilter = 'all' | 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania';

/** Selector order: the default first, then alphabetically by the English name. */
export const REGION_FILTERS: readonly RegionFilter[] = [
  'all',
  'Africa',
  'Americas',
  'Asia',
  'Europe',
  'Oceania',
] as const;

/** How a region is named on screen. The raw roster string is never user-visible. */
export const REGION_KEY: Readonly<Record<RegionFilter, TranslationKey>> = {
  all: 'region.all',
  Africa: 'region.africa',
  Americas: 'region.americas',
  Asia: 'region.asia',
  Europe: 'region.europe',
  Oceania: 'region.oceania',
};

export function isRegionFilter(value: unknown): value is RegionFilter {
  // The key map is the membership test, so a region can never be added to one and
  // forgotten in the other.
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(REGION_KEY, value);
}

/**
 * Whether a country belongs to the filtered pool.
 *
 * Lives beside the preference rather than in the game layer so there is exactly one
 * statement of what the filter means; practice puzzle selection imports it.
 */
export function matchesRegion(country: Country, filter: RegionFilter): boolean {
  return filter === 'all' || country.region === filter;
}

/* ─── Persistence ────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'meridian.prefs';

interface PersistedPrefs {
  readonly unit: DistanceUnit;
  readonly practiceRegion: RegionFilter;
}

const DEFAULTS: PersistedPrefs = {
  unit: DEFAULT_DISTANCE_UNIT,
  practiceRegion: 'all',
};

function readPrefs(): PersistedPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;
    const record = parsed as Record<string, unknown>;
    return {
      unit: isDistanceUnit(record.unit) ? record.unit : DEFAULTS.unit,
      practiceRegion: isRegionFilter(record.practiceRegion)
        ? record.practiceRegion
        : DEFAULTS.practiceRegion,
    };
  } catch {
    // Private browsing throws on access, and a truncated write throws on parse. Either
    // way the defaults are a working app.
    return DEFAULTS;
  }
}

function writePrefs(prefs: PersistedPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // A failed write costs the preference on next launch, never the current session.
  }
}

/* ─── Store ──────────────────────────────────────────────────────────────── */

export interface PrefsState {
  /** Display only. Distances are measured, stored and shared in kilometres. */
  readonly unit: DistanceUnit;
  /** Practice draws from this region. The daily never reads it — see the note below. */
  readonly practiceRegion: RegionFilter;
  setUnit(unit: DistanceUnit): void;
  setPracticeRegion(region: RegionFilter): void;
}

const initial = readPrefs();

export const usePrefsStore = create<PrefsState>()((set, get) => ({
  unit: initial.unit,
  practiceRegion: initial.practiceRegion,
  setUnit(unit) {
    if (!isDistanceUnit(unit)) return;
    set({ unit });
    writePrefs({ unit, practiceRegion: get().practiceRegion });
  },
  setPracticeRegion(region) {
    if (!isRegionFilter(region)) return;
    set({ practiceRegion: region });
    writePrefs({ unit: get().unit, practiceRegion: region });
  },
}));

/** The chosen unit, for the components that render a distance. */
export function useDistanceUnit(): DistanceUnit {
  return usePrefsStore((s) => s.unit);
}

/**
 * The practice region, read outside React.
 *
 * Dealing a puzzle happens in an effect, not in a render, so it should read the current
 * value rather than subscribe to it. **Only the practice path may call this.** The Daily
 * Challenge is derived from the date and the mode alone and must stay global: a daily
 * narrowed to one region would no longer be the same puzzle for everyone, and the shared
 * result — the whole premise — would mean nothing.
 */
export function currentPracticeRegion(): RegionFilter {
  return usePrefsStore.getState().practiceRegion;
}
