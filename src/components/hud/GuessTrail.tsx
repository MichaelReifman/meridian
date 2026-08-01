/**
 * The record of guesses so far, bottom-left. A ruled tally: one hairline per entry, the
 * name in ink, the measurements set in tabular figures so the columns hold.
 *
 * The three columns — name, distance, share — mirror with the interface; the figures
 * inside them are formatted for the player's language and stay tabular either way.
 *
 * Percentages here are measured against the whole planet (geo.guessProximityPct), not
 * against the heatmap's contour bands — a guess's score must not appear to change after
 * the fact just because a later guess narrowed the field.
 */

import { useTranslator, type Translator } from '@/i18n';
import { guessProximityPct } from '@/lib/geo';
import type { Country, Guess } from '@/types/game';

/**
 * Kilometres in the player's own numerals.
 *
 * `lib/geo.formatKm` is pinned to en-US and would print Latin digits inside an Arabic
 * tally. Its rounding rule is reproduced here; grouping and digit shapes go to Intl.
 */
function formatKm(t: Translator, km: number): string {
  const digits = km >= 100 ? 0 : 1;
  const rounded = digits === 0 ? Math.round(km) : Math.round(km * 10) / 10;
  return t.num(rounded, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function GuessTrail({
  guesses,
  byId,
}: {
  guesses: readonly Guess[];
  byId: Map<string, Country>;
}) {
  const t = useTranslator();

  if (guesses.length === 0) return null;

  // Newest first. `guesses` is readonly, so copy before reversing in place.
  const newestFirst = guesses.slice().reverse();

  /* Safe-area insets are physical — a notch stays on the side of the device it is on,
     whichever way the type runs — so the logical edge has to pick the matching one. */
  const insetStart = t.dir === 'rtl' ? 'var(--inset-r)' : 'var(--inset-l)';

  return (
    <div
      className="pointer-events-none fixed z-30"
      style={{
        insetInlineStart: `calc(${insetStart} + 0.75rem)`,
        bottom: 'calc(var(--inset-b) + 0.75rem)',
      }}
    >
      <div className="sheet animate-fade-in w-[min(60vw,14rem)] px-3 py-2">
        <p className="label border-b border-rule pb-2">{t('play.guesses')}</p>
        <ol
          aria-label={t('play.a11y.guessTrail')}
          /* Scrollable, so it must take pointer events back — and contain them, or a
             flick past the end of the list would start panning the map underneath. */
          className="pointer-events-auto max-h-[min(38vh,13rem)] overflow-y-auto overscroll-contain"
        >
          {newestFirst.map((guess, i) => {
            const country = byId.get(guess.countryId);
            const name = country ? t.country(country) : guess.countryId;
            return (
              <li
                key={`${guess.countryId}:${newestFirst.length - i}`}
                /* The hairline between rows is the whole structure; the last one is
                   dropped so the tally does not close with a second rule inside the card. */
                className="flex items-baseline gap-2 border-b border-rule-soft py-1.5 last:border-b-0 last:pb-0"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    guess.correct ? 'text-oxblood' : 'text-ink'
                  }`}
                  title={name}
                >
                  {name}
                </span>
                <span className="font-mono tabular shrink-0 text-xs text-graphite">
                  {formatKm(t, guess.distanceKm)}
                  <span className="label ms-0.5">{t('play.km')}</span>
                </span>
                {/* Formatted as a percentage rather than printed with a literal `%`: the
                    sign, its side and the digit shapes all change with the language. */}
                <span className="label font-mono tabular w-10 shrink-0 text-end">
                  {t.num(guessProximityPct(guess.distanceKm) / 100, { style: 'percent' })}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
