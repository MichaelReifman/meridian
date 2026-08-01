/**
 * The record of guesses so far, bottom-left.
 *
 * Percentages here are measured against the whole planet (geo.guessProximityPct), not
 * against the heatmap's contour bands — a guess's score must not appear to change after
 * the fact just because a later guess narrowed the field.
 */

import { formatKm, guessProximityPct } from '@/lib/geo';
import type { Country, Guess } from '@/types/game';

export function GuessTrail({
  guesses,
  byId,
}: {
  guesses: readonly Guess[];
  byId: Map<string, Country>;
}) {
  if (guesses.length === 0) return null;

  // Newest first. `guesses` is readonly, so copy before reversing in place.
  const newestFirst = guesses.slice().reverse();

  return (
    <div
      className="pointer-events-none fixed z-30"
      style={{
        left: 'calc(var(--inset-l) + 0.75rem)',
        bottom: 'calc(var(--inset-b) + 0.75rem)',
      }}
    >
      <div className="hud-panel animate-fade-in w-[min(60vw,14rem)] rounded-xl px-3 py-2">
        <p className="text-hud mb-1.5 uppercase text-muted">Guesses</p>
        <ol
          aria-label="Guesses so far, newest first"
          /* Scrollable, so it must take pointer events back — and contain them, or a
             flick past the end of the list would start panning the map underneath. */
          className="pointer-events-auto max-h-[min(38vh,13rem)] space-y-1.5 overflow-y-auto overscroll-contain"
        >
          {newestFirst.map((guess, i) => {
            const country = byId.get(guess.countryId);
            return (
              <li
                key={`${guess.countryId}:${newestFirst.length - i}`}
                className="flex items-baseline gap-2"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    guess.correct ? 'text-gold' : 'text-parchment/85'
                  }`}
                  title={country?.name ?? guess.countryId}
                >
                  {country?.name ?? guess.countryId}
                </span>
                <span className="font-mono tabular shrink-0 text-xs text-muted">
                  {formatKm(guess.distanceKm)}
                  <span className="ml-0.5 font-sans">km</span>
                </span>
                <span className="font-mono tabular w-9 shrink-0 text-right text-xs text-cyan/85">
                  {guessProximityPct(guess.distanceKm)}%
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
