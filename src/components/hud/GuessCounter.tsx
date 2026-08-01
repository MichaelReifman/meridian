/**
 * Guess count — the score, since fewer guesses is better (PRD §2).
 *
 * Top-right corner, deliberately the smallest thing on screen.
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
      <div className="hud-panel min-w-[3.5rem] rounded-xl px-3 py-2 text-right">
        {/* The visual split of number and label reads as one phrase to a screen reader
            only if we say it once, plainly, and hide the decorative halves. */}
        <span className="sr-only">
          {count} {count === 1 ? 'guess' : 'guesses'} so far
        </span>
        <span
          aria-hidden="true"
          className="block font-mono tabular text-xl leading-none text-parchment"
        >
          {count}
        </span>
        <span aria-hidden="true" className="text-hud mt-1 block uppercase text-muted">
          {count === 1 ? 'Guess' : 'Guesses'}
        </span>
      </div>
    </div>
  );
}
