/**
 * The record: one card per mode, plus the only destructive control in the game.
 *
 * Everything here is stored on the device and nowhere else, which is why the clear
 * control spells that out and why it takes two deliberate presses.
 */

import { useCallback, useState } from 'react';
import { ArrowLeft, Trash2, TriangleAlert } from 'lucide-react';

import { useAllStats } from '@/db/hooks';
import { clearAllData, currentStreakFor } from '@/db/queries';
import { localDateKey } from '@/lib/daily';
import { useUiStore } from '@/store/uiStore';
import type { GameMode, ModeStats } from '@/types/game';

const MODE_TITLE: Readonly<Record<GameMode, string>> = {
  country: 'Country',
  capital: 'Capital',
  flag: 'Flag',
};

/** An em dash reads as "nothing yet"; a 0 reads as a result the player earned. */
const EMPTY = '—';

function average(total: number, count: number): string {
  if (count <= 0) return EMPTY;
  return (total / count).toFixed(1);
}

export function StatsScreen(): JSX.Element {
  const setScreen = useUiStore((s) => s.setScreen);
  const stats = useAllStats();
  const today = localDateKey();

  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const clear = useCallback(() => {
    setClearing(true);
    // clearAllData never rejects — it degrades to the in-memory store — but the state
    // reset belongs in a finally either way.
    void clearAllData().finally(() => {
      setClearing(false);
      setConfirming(false);
    });
  }, []);

  const played = stats?.reduce((sum, s) => sum + s.dailiesPlayed + s.practicePlayed, 0) ?? 0;

  return (
    <main
      className="h-full overflow-y-auto overflow-x-hidden bg-space"
      style={{
        padding:
          'calc(var(--inset-t) + 1rem) calc(var(--inset-r) + 1.25rem)' +
          ' calc(var(--inset-b) + 2rem) calc(var(--inset-l) + 1.25rem)',
      }}
    >
      <div className="mx-auto w-full max-w-xl">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen('menu')}
            aria-label="Back to menu"
            className="ease-swift flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-hairline text-parchment transition-colors duration-200 hover:bg-parchment/10"
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.75} />
          </button>
          <h1 className="font-display text-2xl leading-none text-parchment">Your record</h1>
        </header>

        {stats === undefined ? (
          <p className="mt-8 text-sm text-muted">Reading your record…</p>
        ) : (
          <>
            {played === 0 && (
              <p className="mt-6 rounded-xl border border-hairline px-4 py-3 text-sm text-muted">
                Nothing recorded yet. Play a daily in any mode and it will show up here —
                streaks are counted per mode, and practice never touches them.
              </p>
            )}

            <div className="mt-6 space-y-3">
              {stats.map((row) => (
                <ModeStatsCard key={row.mode} stats={row} today={today} />
              ))}
            </div>

            <section aria-labelledby="danger" className="mt-8 rounded-2xl border border-hairline p-4">
              <h2 id="danger" className="text-hud font-mono uppercase text-muted">
                This device
              </h2>
              <p className="mt-2 text-sm text-muted">
                Meridian keeps every streak, stat and saved round in this browser. Nothing is
                sent anywhere, and nothing can be recovered once it is erased.
              </p>

              {confirming ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <p className="flex w-full items-center gap-2 text-sm text-gold">
                    <TriangleAlert aria-hidden="true" size={16} strokeWidth={1.75} />
                    Erase every streak, stat and saved round?
                  </p>
                  <button
                    type="button"
                    onClick={clear}
                    disabled={clearing}
                    className="ease-swift rounded-xl bg-gold px-4 py-2.5 text-sm font-medium text-space transition duration-200 hover:brightness-110 disabled:opacity-60"
                  >
                    {clearing ? 'Erasing…' : 'Yes, erase everything'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="ease-swift rounded-xl border border-hairline px-4 py-2.5 text-sm text-parchment transition-colors duration-200 hover:bg-parchment/10"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="ease-swift mt-4 inline-flex items-center gap-2 rounded-xl border border-hairline px-4 py-2.5 text-sm text-parchment transition-colors duration-200 hover:bg-parchment/10"
                >
                  <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
                  Clear all data
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ModeStatsCard({ stats, today }: { stats: ModeStats; today: string }) {
  // The stored streak is only ever written on a solve, so it says nothing about whether
  // the run is still alive; currentStreakFor is what the UI must display.
  const streak = currentStreakFor(stats, today);
  const title = MODE_TITLE[stats.mode];

  return (
    <section aria-labelledby={`stats-${stats.mode}`} className="hud-panel rounded-2xl p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`stats-${stats.mode}`} className="font-display text-lg leading-none text-parchment">
          {title}
        </h2>
        <p className="text-hud font-mono uppercase text-muted">Daily</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        <Stat label="Current streak" value={streak} accent={streak > 0} />
        <Stat label="Max streak" value={stats.maxStreak} />
        <Stat label="Best solve" value={stats.bestGuessCount ?? EMPTY} unit="guesses" />
        <Stat label="Played" value={stats.dailiesPlayed} />
        <Stat label="Solved" value={stats.dailiesSolved} />
        <Stat
          label="Avg guesses"
          value={average(stats.totalGuessesOnSolved, stats.dailiesSolved)}
          hint="on solved dailies"
        />
      </dl>

      <div className="mt-5 border-t border-hairline pt-4">
        <p className="text-hud font-mono uppercase text-muted">Practice</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Stat label="Played" value={stats.practicePlayed} />
          <Stat label="Solved" value={stats.practiceSolved} />
          <Stat
            label="Avg guesses"
            value={average(stats.practiceTotalGuessesOnSolved, stats.practiceSolved)}
            hint="on solved rounds"
          />
        </dl>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  hint,
  accent = false,
}: {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-hud uppercase text-muted">
        {label}
        {hint && <span className="sr-only"> {hint}</span>}
      </dt>
      <dd className={`mt-1.5 font-mono tabular text-xl leading-none ${accent ? 'text-gold' : 'text-parchment'}`}>
        {value}
        {/* The unit belongs to a number. Printing "— guesses" for a stat that has never
            been earned reads as a broken value rather than an absent one. */}
        {unit && value !== EMPTY && (
          <span className="ml-1 font-sans text-xs text-muted">{unit}</span>
        )}
      </dd>
    </div>
  );
}
