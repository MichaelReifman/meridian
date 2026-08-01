/**
 * The record, set as what it actually is: a printed statistical table.
 *
 * One ruled table per mode — label column on the start margin, figures against the end
 * margin in tabular mono, rows divided by hairlines. No cards and no bars, because
 * neither adds anything a ruled row does not, and both would invite comparison between
 * numbers that are not on the same scale.
 *
 * Direction: the two columns swap sides wholesale in Arabic, which `justify-between`
 * does on its own once nothing in the row is pinned to a physical edge. The figures keep
 * the tabular mono face and still go through `t.num`, so they read in the reader's own
 * numerals without losing the column alignment the table depends on.
 *
 * Everything here is stored on the device and nowhere else, which is why the clear
 * control spells that out and why it takes two deliberate presses.
 */

import { useCallback, useState } from 'react';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

import { useAllStats } from '@/db/hooks';
import { clearAllData, currentStreakFor } from '@/db/queries';
import { useTranslator, type Translator } from '@/i18n';
import type { TranslationKey } from '@/i18n/en';
import { localDateKey } from '@/lib/daily';
import { useUiStore } from '@/store/uiStore';
import type { GameMode, ModeStats } from '@/types/game';

/** Numerals index the three tables in the same order the title page lists the modes. */
const MODE_META: Readonly<Record<GameMode, { numeral: string; title: TranslationKey }>> = {
  country: { numeral: 'I', title: 'menu.mode.country' },
  capital: { numeral: 'II', title: 'menu.mode.capital' },
  flag: { numeral: 'III', title: 'menu.mode.flag' },
};

/**
 * An em dash reads as "nothing yet"; a 0 reads as a result the player earned.
 *
 * The same glyph the dictionary carries as `common.none`, kept here as a module constant
 * because it is also the sentinel the unit suffix tests against — a value, not copy.
 */
const EMPTY = '—';

/**
 * Display type withholds its engraving from a right-to-left run: `uppercase` is a no-op
 * on Arabic and letterspacing severs the cursive joins, leaving the word in pieces.
 */
function engraved(dir: 'ltr' | 'rtl', tracking: string): string {
  return dir === 'rtl' ? '' : `uppercase ${tracking}`;
}

function average(t: Translator, total: number, count: number): string {
  if (count <= 0) return EMPTY;
  return t.num(total / count, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function StatsScreen(): JSX.Element {
  const t = useTranslator();
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
      /* Physical on purpose: a notch stays where it is when the interface mirrors, so
         the safe-area insets are matched to the edges they actually describe. */
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
          aria-label={t('play.back')}
          /* `py-3 -mb-3` keeps the 44 px tap target the icon control used to have while
             the rule stays where a printed cross-reference would put it. */
          className="action -mb-3 inline-flex items-center gap-2 py-3 text-sm"
        >
          {/* Directional: an arrow meaning "back" points at the start margin, which is
              the right-hand one in Arabic. */}
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} className="rtl:-scale-x-100" />
          {t('common.back')}
        </button>

        <header className="mt-8 text-center">
          <h1
            className={`font-display text-xl leading-none text-ink sm:text-2xl ${engraved(
              t.dir,
              'tracking-[0.2em]',
            )}`}
          >
            {t('stats.title')}
          </h1>
          <div aria-hidden="true" className="rule-double mt-4" />
        </header>

        {stats === undefined ? (
          <p className="mt-8 text-sm text-graphite">{t('sw.updating')}</p>
        ) : (
          <>
            {played === 0 && (
              /* A marginal note rather than a boxed panel: an empty table is still a
                 table, and it should stay the thing on the page. The rule hangs off the
                 start margin, so it moves with the text. */
              <p className="mt-8 border-s border-brass ps-4 text-sm leading-relaxed text-graphite">
                {t('stats.empty')}
              </p>
            )}

            <div className="mt-9">
              {stats.map((row) => (
                <ModeStatsTable key={row.mode} stats={row} today={today} />
              ))}
            </div>

            <section aria-labelledby="danger" className="mt-12 border-t border-rule pt-6">
              <h2 id="danger" className="label">
                {t('stats.clear')}
              </h2>

              {/* The consequence is stated in both states rather than only after the
                  first press: it is the same sentence either way, so hoisting it out of
                  the branch warns before the press and avoids printing it twice. */}
              <p
                className={`mt-3 flex items-start gap-2 text-sm leading-relaxed ${
                  confirming ? 'text-oxblood' : 'text-graphite'
                }`}
              >
                {confirming && (
                  <TriangleAlert
                    aria-hidden="true"
                    size={16}
                    strokeWidth={1.75}
                    className="mt-0.5 shrink-0"
                  />
                )}
                {t('stats.clearConfirm')}
              </p>

              {confirming ? (
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <button
                    type="button"
                    onClick={clear}
                    disabled={clearing}
                    className="action -my-2 border-oxblood/60 py-2 text-sm text-oxblood disabled:opacity-60"
                  >
                    {clearing ? t('sw.updating') : t('stats.clearYes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="action -my-2 py-2 text-sm"
                  >
                    {t('stats.clearNo')}
                  </button>
                </div>
              ) : (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="action -my-2 py-2 text-sm text-oxblood"
                  >
                    {t('stats.clear')}
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
  const t = useTranslator();
  // The stored streak is only ever written on a solve, so it says nothing about whether
  // the run is still alive; currentStreakFor is what the UI must display.
  const streak = currentStreakFor(stats, today);
  const meta = MODE_META[stats.mode];

  return (
    <section aria-labelledby={`stats-${stats.mode}`} className="mt-10 first:mt-0">
      {/* Heavier than the row hairlines, so the block reads as one table with a head
          rather than as a run of unrelated lines. */}
      <div className="flex items-baseline gap-4 border-b border-ink/40 pb-2">
        {/* An index, not prose: Latin and upright in every language. Only its column
            moves, and the flex direction moves it. */}
        <span
          aria-hidden="true"
          className="w-7 shrink-0 font-display text-sm uppercase tracking-widest text-brass"
        >
          {meta.numeral}
        </span>
        <h2
          id={`stats-${stats.mode}`}
          className={`min-w-0 flex-1 font-display text-base leading-none text-ink ${engraved(
            t.dir,
            'tracking-[0.14em]',
          )}`}
        >
          {t(meta.title)}
        </h2>
        <span className="label shrink-0">{t('stats.daily')}</span>
      </div>

      <dl>
        <Row label={t('stats.currentStreak')} value={t.num(streak)} accent={streak > 0} />
        <Row label={t('stats.maxStreak')} value={t.num(stats.maxStreak)} />
        <Row
          label={t('stats.bestSolve')}
          value={stats.bestGuessCount != null ? t.num(stats.bestGuessCount) : EMPTY}
          unit={t('play.guesses')}
        />
        <Row label={t('stats.played')} value={t.num(stats.dailiesPlayed)} />
        <Row label={t('stats.solved')} value={t.num(stats.dailiesSolved)} />
        <Row
          label={t('stats.avgGuesses')}
          value={average(t, stats.totalGuessesOnSolved, stats.dailiesSolved)}
          hint={t('stats.daily')}
        />
      </dl>

      <p className="label mt-7 border-b border-ink/40 pb-2">{t('stats.practice')}</p>
      <dl>
        <Row label={t('stats.played')} value={t.num(stats.practicePlayed)} />
        <Row label={t('stats.solved')} value={t.num(stats.practiceSolved)} />
        <Row
          label={t('stats.avgGuesses')}
          value={average(t, stats.practiceTotalGuessesOnSolved, stats.practiceSolved)}
          hint={t('stats.practice')}
        />
      </dl>
    </section>
  );
}

/**
 * One ruled row: label on the start margin, figure against the end margin.
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
        {/* Two rows in this section carry the same label; the hint is what tells a
            screen reader which table it is in. */}
        {hint && <span className="sr-only"> {hint}</span>}
      </dt>
      <dd className={`tabular shrink-0 font-mono text-sm ${accent ? 'text-oxblood' : 'text-ink'}`}>
        {value}
        {/* The unit belongs to a number. Printing "— guesses" for a stat that has never
            been earned reads as a broken value rather than an absent one. */}
        {unit && value !== EMPTY && <span className="label ms-1.5">{unit}</span>}
      </dd>
    </div>
  );
}
