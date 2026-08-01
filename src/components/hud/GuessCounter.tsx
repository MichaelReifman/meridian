/**
 * Guess count — the score, since fewer guesses is better (PRD §2).
 *
 * Top-right corner, deliberately the smallest thing on screen: a single instrument
 * readout, the figure over a rule with its unit engraved beneath.
 */

export function GuessCounter({ count }: { count: number }) {
  return (
    <div
      className="pointer-events-none fixed z-30"
      style={{
        top: 'calc(var(--inset-t) + 0.75rem)',
        right: 'calc(var(--inset-r) + 0.75rem)',
      }}
    >
      <div className="sheet min-w-[3.5rem] px-3 py-2 text-center">
        {/* The visual split of number and label reads as one phrase to a screen reader
            only if we say it once, plainly, and hide the decorative halves. */}
        <span className="sr-only">
          {count} {count === 1 ? 'guess' : 'guesses'} so far
        </span>
        <span aria-hidden="true" className="block font-mono tabular text-2xl leading-none text-ink">
          {count}
        </span>
        <span
          aria-hidden="true"
          className="label mt-1.5 block border-t border-rule-soft pt-1.5"
        >
          {count === 1 ? 'Guess' : 'Guesses'}
        </span>
      </div>
    </div>
  );
}
