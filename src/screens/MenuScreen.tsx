/**
 * The title page: three modes, each offering today's Daily Challenge and unlimited
 * Practice.
 *
 * Composed as the index page of a printed atlas rather than a stack of cards. The three
 * modes are numbered entries separated by hairline rules; the actions are set as words
 * with rules under them, not filled buttons. There is no ornament that does not carry
 * information — the roman numerals index, the rules divide, and everything else is type.
 *
 * Per mode it answers the two questions a returning player actually has: how long is my
 * streak, and have I already played today. A completed daily stays reachable — it
 * reopens the finished round for review, and the store will not let it be replayed.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useModeStats, useSavedRound } from '@/db/hooks';
import { currentStreakFor } from '@/db/queries';
import { dailyPuzzle, localDateKey, msUntilLocalMidnight } from '@/lib/daily';
import { useUiStore } from '@/store/uiStore';
import { GAME_MODES, type GameMode, type PuzzleKind } from '@/types/game';

const MODE_META: Readonly<Record<GameMode, { numeral: string; title: string; blurb: string }>> = {
  country: { numeral: 'I', title: 'Country', blurb: 'A name to place on the map.' },
  capital: { numeral: 'II', title: 'Capital', blurb: 'A city to attribute to its country.' },
  flag: { numeral: 'III', title: 'Flag', blurb: 'A flag to trace to where it flies.' },
};

/**
 * Time to the next set of dailies, refreshed every half minute.
 *
 * Deliberately not a ticking clock: a second-by-second countdown on a title page is
 * noise, and it would re-render three live-query subscribers 86,400 times a day.
 */
function useMidnightCountdown(): string {
  const [remaining, setRemaining] = useState(() => msUntilLocalMidnight());

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(msUntilLocalMidnight()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function MenuScreen(): JSX.Element {
  const setScreen = useUiStore((s) => s.setScreen);
  const setMode = useUiStore((s) => s.setMode);
  const setKind = useUiStore((s) => s.setKind);

  // Recomputed each render on purpose: a session left open across local midnight should
  // pick up the new day's puzzles and streak window without a reload.
  const today = localDateKey();
  const countdown = useMidnightCountdown();

  const start = useCallback(
    (mode: GameMode, kind: PuzzleKind) => {
      setMode(mode);
      setKind(kind);
      setScreen('play');
    },
    [setMode, setKind, setScreen],
  );

  return (
    <main
      className="h-full overflow-y-auto overflow-x-hidden bg-paper"
      style={{
        padding:
          'calc(var(--inset-t) + 2.5rem) calc(var(--inset-r) + 1.5rem)' +
          ' calc(var(--inset-b) + 2rem) calc(var(--inset-l) + 1.5rem)',
      }}
    >
      <div className="mx-auto w-full max-w-lg">
        <header className="animate-rise-in text-center">
          {/* Letterspacing is doing the work a heavier weight would otherwise do, which
              is what keeps the wordmark reading as engraved rather than merely large. */}
          <h1 className="font-display text-[1.75rem] uppercase leading-none tracking-wordmark text-ink sm:text-[2.125rem]">
            Meridian
          </h1>
          <div aria-hidden="true" className="rule-double mx-auto mt-5 w-full max-w-[22rem]" />
          <p className="mx-auto mt-5 max-w-sm text-balance text-sm leading-relaxed text-graphite">
            A daily geography deduction. Every wrong guess draws a ring the answer must lie
            on — cross them until one country is left.
          </p>
        </header>

        {/* A single ruled list, not three cards. The top rule closes the header block. */}
        <ul className="mt-10 border-t border-rule">
          {GAME_MODES.map((mode) => (
            <li key={mode} className="border-b border-rule">
              <ModeEntry mode={mode} today={today} onStart={start} />
            </li>
          ))}
        </ul>

        <nav
          aria-label="More"
          className="mt-8 flex items-center justify-center gap-3 text-sm text-graphite"
        >
          <FooterLink onClick={() => setScreen('stats')}>Stats</FooterLink>
          <span aria-hidden="true" className="text-ink/25">
            ·
          </span>
          <FooterLink onClick={() => setScreen('howto')}>How to play</FooterLink>
        </nav>

        <p className="label mt-6 text-center">
          New dailies in <span className="tabular font-mono text-ink">{countdown}</span>
        </p>
      </div>
    </main>
  );
}

/**
 * One mode's entry. A component rather than a loop body because each row needs its own
 * live subscriptions to that mode's stats and to today's saved round.
 */
function ModeEntry({
  mode,
  today,
  onStart,
}: {
  mode: GameMode;
  today: string;
  onStart(mode: GameMode, kind: PuzzleKind): void;
}) {
  const meta = MODE_META[mode];
  const stats = useModeStats(mode);
  // Cheap and deterministic, but memoised anyway so the saved-round subscription below
  // keys off a stable puzzle for the whole day.
  const puzzle = useMemo(() => dailyPuzzle(mode, today), [mode, today]);
  const saved = useSavedRound(puzzle);

  const streak = stats ? currentStreakFor(stats, today) : 0;
  // `undefined` still means "not read yet", so only a resolved row counts as done.
  const done = saved != null && saved.status !== 'playing';
  const solved = saved?.status === 'solved';

  return (
    <section aria-labelledby={`mode-${mode}`} className="py-5">
      <div className="flex items-baseline gap-4">
        {/* Fixed width so all three numerals align into a column, as an index would. */}
        <span
          aria-hidden="true"
          className="w-7 shrink-0 font-display text-sm uppercase tracking-widest text-brass"
        >
          {meta.numeral}
        </span>

        <h2
          id={`mode-${mode}`}
          className="min-w-0 flex-1 font-display text-lg uppercase leading-none tracking-[0.14em] text-ink"
        >
          {meta.title}
        </h2>

        {done ? (
          <span className="label shrink-0 text-oxblood">{solved ? 'Solved' : 'Revealed'}</span>
        ) : streak > 0 ? (
          <span className="label shrink-0 text-brass">
            <span className="sr-only">
              Current daily streak: {streak} {streak === 1 ? 'day' : 'days'}.
            </span>
            <span aria-hidden="true">
              Streak <span className="tabular font-mono text-ink">{streak}</span>
            </span>
          </span>
        ) : null}
      </div>

      <p className="mt-2 pl-11 text-sm leading-relaxed text-graphite">{meta.blurb}</p>

      <div className="mt-3 flex items-center gap-5 pl-11">
        <EntryAction
          onClick={() => onStart(mode, 'daily')}
          emphasis={!done}
          label={
            done
              ? `Review today's ${meta.title} daily challenge, already ${solved ? 'solved' : 'finished'}`
              : `Play today's ${meta.title} daily challenge`
          }
        >
          {done ? 'Review' : 'Daily'}
        </EntryAction>

        <EntryAction
          onClick={() => onStart(mode, 'practice')}
          label={`Start a ${meta.title} practice round`}
        >
          Practice
        </EntryAction>
      </div>
    </section>
  );
}

/**
 * An action set as a word with a rule under it.
 *
 * `py-2 -my-2` keeps the visible rule tight against the text while the hit area stays a
 * comfortable size on a phone — the trap with text-as-button is a 16px-tall target.
 */
function EntryAction({
  onClick,
  label,
  emphasis = false,
  children,
}: {
  onClick(): void;
  label: string;
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`ease-swift -my-2 border-b py-2 text-sm transition-colors duration-150 ${
        emphasis
          ? 'border-oxblood/60 font-medium text-oxblood hover:border-oxblood'
          : 'border-ink/25 text-ink hover:border-ink/70'
      }`}
    >
      {children}
    </button>
  );
}

function FooterLink({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ease-swift -my-2 border-b border-ink/25 py-2 text-sm text-ink transition-colors duration-150 hover:border-ink/70"
    >
      {children}
    </button>
  );
}
