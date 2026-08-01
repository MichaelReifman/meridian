/**
 * Guess count — the score, since fewer guesses is better (PRD §2).
 *
 * Deliberately the smallest thing on screen: a single instrument readout, the figure
 * over a rule with its unit engraved beneath. The figure goes through the locale's own
 * numerals, so an Arabic round counts in ٥ rather than in 5.
 */

import { useTranslator } from '@/i18n';

/**
 * Deliberately unpositioned.
 *
 * This used to pin itself to the top inline-end corner, which meant the controls that
 * sit under it had to guess its height — and when the redesign added a rule and a label
 * beneath the figure, that guess became an overlap. The screen that owns the corner now
 * flows both in one column, so nothing has to know how tall this is.
 */
export function GuessCounter({ count }: { count: number }) {
  const t = useTranslator();

  return (
    <div className="sheet min-w-[3.5rem] px-3 py-2 text-center">
      {/* The visual split of number and label reads as one phrase to a screen reader
          only if we say it once, plainly, and hide the decorative halves. One key with
          the count substituted in, never a number glued to a word: the two swap order
          between languages. */}
      <span className="sr-only">{t('play.guessesCount', { count: t.num(count) })}</span>
      <span aria-hidden="true" className="block font-mono tabular text-2xl leading-none text-ink">
        {t.num(count)}
      </span>
      <span aria-hidden="true" className="label mt-1.5 block border-t border-rule-soft pt-1.5">
        {t('play.guesses')}
      </span>
    </div>
  );
}
