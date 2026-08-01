/**
 * Matching a typed country name against the roster.
 *
 * Kept out of the component and free of React so the ranking rules can be reasoned
 * about — and argued with — on their own. The component decides how a suggestion looks;
 * this file decides whether it is a suggestion at all.
 *
 * The bar is deliberately high. A guess costs the player their score, so a list that
 * offers a country the query does not plausibly name is worse than an empty one: it
 * invites a mis-tap that the round then charges for. Nothing here is fuzzy — no edit
 * distance, no transposition tolerance, no subsequence matching. A country appears only
 * if the query is literally a leading or interior run of one of its names.
 */

import type { Country } from '@/types/game';

/**
 * Every Unicode mark, not just the Latin combining range.
 *
 * NFD decomposes far more than accented Latin: `أ` (U+0623) decomposes to bare alef plus
 * a combining hamza, so stripping marks folds the Arabic alef variants together as a
 * side effect. Someone typing `الجزائر` with a plain alef reaches the same row as the
 * dictionary's spelling, which is the same courtesy `España` → `espana` extends to
 * Spanish.
 */
const MARKS = /\p{M}/gu;

/**
 * A dash joins two words and is read as a gap: someone typing `guinea bissau` means
 * Guinea-Bissau, so the dash becomes the space they typed. Matched by Unicode category
 * rather than by listing the dashes, which is the same rule stated once instead of five
 * code points that are easy to mistake for each other on sight.
 */
const WORD_BREAKS = /\p{Pd}/gu;

/**
 * Everything else — apostrophes, brackets, the full stops in `Congo (Rep. Dem.)`. These
 * sit *inside* a word rather than between two, so they are dropped rather than spaced:
 * dropping lets `cote divoire` reach Côte d'Ivoire, which spacing would not.
 */
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

/**
 * Fold a name or a query to the form both sides are compared in.
 *
 * Without this half the roster is unreachable in Spanish, French and Portuguese: nobody
 * types the accent on a phone keyboard, and `Espana` does not match `España` as a
 * substring of anything.
 */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(WORD_BREAKS, ' ')
    .replace(PUNCTUATION, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** One country the query plausibly names, and how well. */
export interface Suggestion {
  readonly country: Country;
  readonly score: number;
}

/** The whole name, typed out. */
const SCORE_EXACT = 3;
/** The name begins with the query — what a player halfway through a word has typed. */
const SCORE_PREFIX = 2;
/** The query appears inside the name, e.g. `zealand` for New Zealand. */
const SCORE_SUBSTRING = 1;
const SCORE_NONE = 0;

/**
 * Below this, an interior match is noise rather than intent: a single letter is inside
 * most of the 195 names, so it would rank an arbitrary seven of them above nothing at
 * all. Prefix and exact matching still work from the first keystroke, which is what a
 * player typing `c` actually means.
 */
const MIN_SUBSTRING_QUERY = 2;

function scoreName(query: string, name: string): number {
  if (name === query) return SCORE_EXACT;
  if (name.startsWith(query)) return SCORE_PREFIX;
  if (query.length >= MIN_SUBSTRING_QUERY && name.includes(query)) return SCORE_SUBSTRING;
  return SCORE_NONE;
}

/** A country's rank, plus the tie-breakers, kept together while sorting. */
interface Ranked {
  readonly suggestion: Suggestion;
  readonly length: number;
  readonly key: string;
}

/**
 * The countries `query` plausibly names, best first, at most `limit` of them.
 *
 * Matched against the localised name *and* the English one, because a player who knows
 * the country as "Germany" should not have to produce "Alemania" to reach it — and
 * because the English name is the only spelling the app can guarantee exists for all
 * 195 rows.
 */
export function searchCountries(
  query: string,
  countries: readonly Country[],
  localisedName: (country: Country) => string,
  limit: number,
): Suggestion[] {
  const q = normalise(query);
  if (q.length === 0 || limit <= 0) return [];

  const ranked: Ranked[] = [];
  for (const country of countries) {
    const local = normalise(localisedName(country));
    const english = normalise(country.name);
    const score = Math.max(scoreName(q, local), scoreName(q, english));
    if (score === SCORE_NONE) continue;
    ranked.push({ suggestion: { country, score }, length: local.length, key: local });
  }

  /* Shortest first within a rank, so `ind` offers India above Indonesia: the shorter
     name is the larger share of what was typed. The final comparison is on the folded
     name rather than a locale collation — it only has to be stable and deterministic,
     and by then the two entries are equally good answers. */
  ranked.sort((a, b) => {
    if (a.suggestion.score !== b.suggestion.score) return b.suggestion.score - a.suggestion.score;
    if (a.length !== b.length) return a.length - b.length;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return ranked.slice(0, limit).map((r) => r.suggestion);
}
