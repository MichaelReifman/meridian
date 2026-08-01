/**
 * The title screen: three modes, each offering today's Daily Challenge and unlimited
 * Practice.
 *
 * Per mode it answers the two questions a returning player actually has — how long is
 * my streak, and have I already played today — because both change what the Daily
 * button means. A completed daily is still clickable: it reopens the finished round for
 * review, and the store will not let it be replayed.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ChartColumn, Check, ChevronRight, CircleHelp, Flag, Flame, Globe, Landmark, Shuffle } from 'lucide-react';

import { useModeStats, useSavedRound } from '@/db/hooks';
import { currentStreakFor } from '@/db/queries';
import { dailyPuzzle, localDateKey, msUntilLocalMidnight } from '@/lib/daily';
import { useUiStore } from '@/store/uiStore';
import { GAME_MODES, type GameMode, type PuzzleKind } from '@/types/game';

/**
 * Two wide, low-alpha washes. The PRD's direction is an observatory chart in deep
 * space, and a flat #0B0E1A page is just dark grey — this is what makes it space.
 */
const NEBULA =
  'radial-gradient(58rem 40rem at 12% 4%, rgba(123, 108, 246, 0.18), transparent 62%),' +
  'radial-gradient(46rem 34rem at 92% 96%, rgba(79, 209, 197, 0.11), transparent 60%)';

const MODE_META: Readonly<Record<GameMode, { title: string; blurb: string; icon: ReactNode }>> = {
  country: {
    title: 'Country',
    blurb: 'You are given a name. Find it on the map.',
    icon: <Globe size={20} strokeWidth={1.5} />,
  },
  capital: {
    title: 'Capital',
    blurb: 'You are given a capital city. Find its country.',
    icon: <Landmark size={20} strokeWidth={1.5} />,
  },
  flag: {
    title: 'Flag',
    blurb: 'You are given a flag. Find where it flies.',
    icon: <Flag size={20} strokeWidth={1.5} />,
  },
};

/**
 * Time to the next set of dailies, refreshed every half minute.
 *
 * Deliberately not a ticking clock: a second-by-second countdown on a menu is noise,
 * and it would re-render three live-query subscribers 86,400 times a day.
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
      className="h-full overflow-y-auto overflow-x-hidden bg-space"
      style={{
        padding:
          'calc(var(--inset-t) + 2rem) calc(var(--inset-r) + 1.25rem)' +
          ' calc(var(--inset-b) + 2rem) calc(var(--inset-l) + 1.25rem)',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ backgroundImage: NEBULA }} />

      <div className="relative mx-auto w-full max-w-xl">
        <header className="animate-rise-in text-center">
          <h1 className="font-display text-4xl leading-none tracking-tight text-parchment sm:text-5xl">
            Meridian
          </h1>
          <div aria-hidden="true" className="mx-auto mt-4 h-px w-24 bg-gold/45" />
          <p className="mx-auto mt-4 max-w-sm text-balance text-sm leading-relaxed text-muted">
            A daily geography deduction. Every wrong guess draws a ring the answer must
            lie on — cross them until only one country is left.
          </p>
        </header>

        <ul className="mt-8 space-y-3">
          {GAME_MODES.map((mode) => (
            <li key={mode}>
              <ModeCard mode={mode} today={today} onStart={start} />
            </li>
          ))}
        </ul>

        <nav aria-label="More" className="mt-6 flex items-center justify-center gap-2">
          <FooterLink onClick={() => setScreen('stats')}>
            <ChartColumn aria-hidden="true" size={16} strokeWidth={1.75} />
            Stats
          </FooterLink>
          <FooterLink onClick={() => setScreen('howto')}>
            <CircleHelp aria-hidden="true" size={16} strokeWidth={1.75} />
            How to play
          </FooterLink>
        </nav>

        <p className="mt-6 text-center text-xs text-muted">
          New dailies in <span className="font-mono tabular text-parchment">{countdown}</span>
        </p>
      </div>
    </main>
  );
}

/**
 * One mode's row. A component rather than a loop body because each row needs its own
 * live subscriptions to that mode's stats and to today's saved round.
 */
function ModeCard({
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
    <section aria-labelledby={`mode-${mode}`} className="hud-panel rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-cyan">
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`mode-${mode}`} className="font-display text-xl leading-tight text-parchment">
            {meta.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{meta.blurb}</p>
        </div>

        <p className={`flex shrink-0 items-center gap-1.5 ${streak > 0 ? 'text-gold' : 'text-muted'}`}>
          <span className="sr-only">
            Current daily streak: {streak} {streak === 1 ? 'day' : 'days'}.
          </span>
          <Flame aria-hidden="true" size={15} strokeWidth={1.75} />
          <span aria-hidden="true" className="font-mono tabular text-sm">
            {streak}
          </span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onStart(mode, 'daily')}
          aria-label={
            done
              ? `Review today's ${meta.title} daily challenge, already ${solved ? 'solved' : 'finished'}`
              : `Play today's ${meta.title} daily challenge`
          }
          className={
            done
              ? 'ease-swift inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-hairline px-4 py-2.5 text-sm text-gold transition-colors duration-200 hover:bg-[rgba(232,179,77,0.1)]'
              : 'ease-swift inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-medium text-space transition duration-200 hover:brightness-110'
          }
        >
          {done ? (
            <Check aria-hidden="true" size={16} strokeWidth={2} />
          ) : (
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
          )}
          {done ? 'Daily done' : 'Daily'}
        </button>

        <button
          type="button"
          onClick={() => onStart(mode, 'practice')}
          aria-label={`Start a ${meta.title} practice round`}
          className="ease-swift inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-hairline px-4 py-2.5 text-sm text-parchment transition-colors duration-200 hover:bg-parchment/10"
        >
          <Shuffle aria-hidden="true" size={16} strokeWidth={1.75} />
          Practice
        </button>
      </div>
    </section>
  );
}

function FooterLink({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ease-swift inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm text-parchment transition-colors duration-200 hover:bg-parchment/10"
    >
      {children}
    </button>
  );
}
