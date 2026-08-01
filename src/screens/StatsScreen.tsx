/**
 * The record, set as what it actually is: a printed statistical table.
 *
 * One ruled table per mode — label column left, figures right against the margin in
 * tabular mono, rows divided by hairlines. No cards and no bars, because neither adds
 * anything a ruled row does not, and both would invite comparison between numbers that
 * are not on the same scale.
 *
 * Everything here is stored on the device and nowhere else, which is why the clear
 * control spells that out and why it takes two deliberate presses.
 */

import { useCallback, useState } from 'react';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

import { useAllStats } from '@/db/hooks';
import { clearAllData, currentStreakFor } from '@/db/queries';
import { localDateKey } from '@/lib/daily';
import { useUiStore } from '@/store/uiStore';
import type { GameMode, ModeStats } from '@/types/game';

/** Numerals index the three tables in the same order the title page lists the modes. */
const MODE_META: Readonly<Record<GameMode, { numeral: string; title: string }>> = {
  country: { numeral: 'I', title: 'Country' },
  capital: { numeral: 'II', title: 'Capital' },
  flag: { numeral: 'III', title: 'Flag' },
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
      className="h-full overflow-y-auto overflow-x-hidden bg-paper"
      style={{
        padding:
          'calc(var(--inset-t) + 1rem) calc(var(--inset-r) + 1.25rem)' +
          ' calc(var(--inset-b) + 2rem) calc(var(--inset-l) + 1.25rem)',
      }}
    >
      <div className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={() => setScreen('menu')}
          aria-label="Back to menu"
          /* `py-3 -mb-3` keeps the 44 px tap target the icon control used to have while
             the rule stays where a printed cross-reference would put it. */
          className="action -mb-3 inline-flex items-center gap-2 py-3 text-sm"
        >
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
          Back
        </button>

        <header className="mt-8 text-center">
          <h1 className="font-display text-xl uppercase leading-none tracking-[0.2em] text-ink sm:text-2xl">
            Your record
          </h1>
          <div aria-hidden="true" className="rule-double mt-4" />
        </header>

        {stats === undefined ? (
          <p className="mt-8 text-sm text-graphite">Reading your record…</p>
        ) : (
          <>
            {played === 0 && (
              /* A marginal note rather than a boxed panel: an empty table is still a
                 table, and it should stay the thing on the page. */
              <p className="mt-8 border-l border-brass pl-4 text-sm leading-relaxed text-graphite">
                Nothing recorded yet. Play a daily in any mode and it will show up here —
                streaks are counted per mode, and practice never touches them.
              </p>
            )}

            <div className="mt-9">
              {stats.map((row) => (
                <ModeStatsTable key={row.mode} stats={row} today={today} />
              ))}
            </div>

            <section aria-labelledby="danger" className="mt-12 border-t border-rule pt-6">
              <h2 id="danger" className="label">
                This device
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-graphite">
                Meridian keeps every streak, stat and saved round in this browser. Nothing is
                sent anywhere, and nothing can be recovered once it is erased.
              </p>

              {confirming ? (
                <div className="mt-5">
                  <p className="flex items-start gap-2 text-sm text-oxblood">
                    <TriangleAlert
                      aria-hidden="true"
                      size={16}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0"
                    />
                    Erase every streak, stat and saved round?
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <button
                      type="button"
                      onClick={clear}
                      disabled={clearing}
                      className="action -my-2 border-oxblood/60 py-2 text-sm text-oxblood disabled:opacity-60"
                    >
                      {clearing ? 'Erasing…' : 'Yes, erase everything'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="action -my-2 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="action -my-2 py-2 text-sm text-oxblood"
                  >
                    Clear all data
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ModeStatsTable({ stats, today }: { stats: ModeStats; today: string }) {
  // The stored streak is only ever written on a solve, so it says nothing about whether
  // the run is still alive; currentStreakFor is what the UI must display.
  const streak = currentStreakFor(stats, today);
  const meta = MODE_META[stats.mode];

  return (
    <section aria-labelledby={`stats-${stats.mode}`} className="mt-10 first:mt-0">
      {/* Heavier than the row hairlines, so the block reads as one table with a head
          rather than as a run of unrelated lines. */}
      <div className="flex items-baseline gap-4 border-b border-ink/40 pb-2">
        <span
          aria-hidden="true"
          className="w-7 shrink-0 font-display text-sm uppercase tracking-widest text-brass"
        >
          {meta.numeral}
        </span>
        <h2
          id={`stats-${stats.mode}`}
          className="min-w-0 flex-1 font-display text-base uppercase leading-none tracking-[0.14em] text-ink"
        >
          {meta.title}
        </h2>
        <span className="label shrink-0">Daily</span>
      </div>

      <dl>
        <Row label="Current streak" value={streak} accent={streak > 0} />
        <Row label="Max streak" value={stats.maxStreak} />
        <Row label="Best solve" value={stats.bestGuessCount ?? EMPTY} unit="guesses" />
        <Row label="Played" value={stats.dailiesPlayed} />
        <Row label="Solved" value={stats.dailiesSolved} />
        <Row
          label="Avg guesses"
          value={average(stats.totalGuessesOnSolved, stats.dailiesSolved)}
          hint="on solved dailies"
        />
      </dl>

      <p className="label mt-7 border-b border-ink/40 pb-2">Practice</p>
      <dl>
        <Row label="Played" value={stats.practicePlayed} />
        <Row label="Solved" value={stats.practiceSolved} />
        <Row
          label="Avg guesses"
          value={average(stats.practiceTotalGuessesOnSolved, stats.practiceSolved)}
          hint="on solved rounds"
        />
      </dl>
    </section>
  );
}

/**
 * One ruled row: label left, figure right against the margin.
 *
 * The div between `dl` and its `dt`/`dd` is what lets a row be ruled as a unit, and is
 * explicitly permitted — the description-list semantics are unchanged.
 */
function Row({
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
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
      <dt className="label">
        {label}
        {hint && <span className="sr-only"> {hint}</span>}
      </dt>
      <dd className={`tabular shrink-0 font-mono text-sm ${accent ? 'text-oxblood' : 'text-ink'}`}>
        {value}
        {/* The unit belongs to a number. Printing "— guesses" for a stat that has never
            been earned reads as a broken value rather than an absent one. */}
        {unit && value !== EMPTY && <span className="label ml-1.5">{unit}</span>}
      </dd>
    </div>
  );
}
