/**
 * The record, set as what it actually is: a printed statistical table.
 *
 * One ruled table per mode — label column on the start margin, figures against the end
 * margin in tabular mono, rows divided by hairlines. Still no cards: they would invite
 * comparison between numbers that are not on the same scale.
 *
 * The one figure that is drawn rather than tabulated is the guess distribution, and it
 * earns that because it is the one place where the numbers *are* on a common scale — ten
 * counts of the same thing. It is engraved to the same rules as everything else: ruled
 * rows, a flat block with square ends, no axis and no legend.
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

import {
  bucketIndexFor,
  emptyBuckets,
  HISTOGRAM_BUCKETS,
  type GuessHistogram,
} from '@/db/db';
import { useAllHistograms, useAllStats, useOpenDailyGuessCounts } from '@/db/hooks';
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
  const histograms = useAllHistograms();
  const today = localDateKey();
  const openDailies = useOpenDailyGuessCounts(today);

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
                <ModeStatsTable
                  key={row.mode}
                  stats={row}
                  today={today}
                  /* Matched on `mode` rather than on position. Both arrays come back in
                     GAME_MODES order, but pairing two independent queries by index is a
                     silent mis-attribution the moment either one stops. */
                  histogram={histograms?.find((h) => h.mode === row.mode)}
                  openGuesses={openDailies?.[row.mode] ?? null}
                />
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

function ModeStatsTable({
  stats,
  today,
  histogram,
  openGuesses,
}: {
  stats: ModeStats;
  today: string;
  histogram: GuessHistogram | undefined;
  openGuesses: number | null;
}) {
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

      {/* Sits with the daily figures, above the practice head, because it describes the
          daily and nothing else — an average two rows up, redrawn as the shape it was
          flattened from. */}
      <GuessDistribution histogram={histogram} openGuesses={openGuesses} />

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

/**
 * Exactly ten counts, whatever the stored row turned out to hold.
 *
 * The chart's shape is fixed — nine numbered buckets and a tail — so a short, absent or
 * damaged row must render as an empty chart rather than as a chart with rows missing,
 * which would read as a different distribution instead of as no data.
 */
function bucketsOf(histogram: GuessHistogram | undefined): number[] {
  const counts = emptyBuckets();
  if (histogram === undefined) return counts;
  for (let i = 0; i < HISTOGRAM_BUCKETS; i++) {
    const n = histogram.buckets[i];
    if (Number.isFinite(n)) counts[i] = n;
  }
  return counts;
}

/**
 * The histogram the averages above cannot show: how many solved dailies took each
 * number of guesses.
 *
 * Ruled rows rather than a chart library — bucket down the start margin, a plain
 * oxblood block, the count against the end margin. There is no axis, no gridline and no
 * legend, because a printed figure of ten rows carries its own scale in its labels.
 */
function GuessDistribution({
  histogram,
  openGuesses,
}: {
  histogram: GuessHistogram | undefined;
  openGuesses: number | null;
}): JSX.Element {
  const t = useTranslator();
  const counts = bucketsOf(histogram);
  const total = counts.reduce((sum, n) => sum + n, 0);

  /* Where a round still in play lands if the very next guess is the right one: the
     guesses already spent plus that one. A round that has only just been opened sits at
     zero and therefore marks bucket 1, which is exactly what solving it now would score. */
  const markedIndex = openGuesses === null ? null : bucketIndexFor(openGuesses + 1);

  /* Bars are scaled against the tallest bucket. Against the total they would all be
     slivers once a few dozen rounds are in; against the *range* — (n − min) / (max − min)
     — a record where every bucket happens to be equal would collapse to nothing at all.
     The floor of 1 is for the empty chart, which must divide rather than produce NaN. */
  const peak = Math.max(...counts, 1);

  return (
    <div>
      <div className="mt-7 flex items-baseline justify-between gap-4 border-b border-ink/40 pb-2">
        <h3 className="label">{t('stats.dist.title')}</h3>
        {/* Names the figure column, the way the mode head names its own. */}
        <span className="label shrink-0">{t('stats.solved')}</span>
      </div>

      {/* One translated sentence, not a label built from fragments: a bare "1 … 4" read
          aloud needs to be told which number is the guess count and which is the tally. */}
      <p className="sr-only">{t('stats.dist.a11y')}</p>

      {total === 0 && markedIndex === null ? (
        /* A marginal note, matching the page's other one. Ten ruled zeroes would be a
           chart asserting a shape it has no data for. */
        <p className="mt-4 border-s border-brass ps-4 text-sm leading-relaxed text-graphite">
          {t('stats.dist.empty')}
        </p>
      ) : (
        <>
          <dl className="mt-1">
            {counts.map((count, i) => (
              <BucketRow
                key={i}
                /* The last bucket is a tail, not a value: "10+" is where a geography
                   deduction genuinely lands often enough to need its own row. */
                label={
                  i === HISTOGRAM_BUCKETS - 1
                    ? t('stats.dist.tenPlus', { count: t.num(HISTOGRAM_BUCKETS) })
                    : t.num(i + 1)
                }
                count={count}
                fraction={count / peak}
                marked={i === markedIndex}
              />
            ))}
          </dl>

          {openGuesses !== null && (
            /* The mark is a brass rule, and a rule is a colour. This says the same thing
               in words and a number, which is the rule the whole design follows. */
            <p className="mt-4 border-s border-brass ps-4 text-sm leading-relaxed text-graphite">
              {t('stats.dist.inPlay', { count: t.num(openGuesses) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One bar of the histogram.
 *
 * The whole block is inset by its own marker rule so that a marked row and an unmarked
 * one occupy identical space — the mark appears, nothing moves. That inset is also what
 * sets the figure apart from the ruled table above it, which is correct: this is a
 * plate, not another run of rows.
 */
function BucketRow({
  label,
  count,
  fraction,
  marked,
}: {
  label: string;
  count: number;
  fraction: number;
  marked: boolean;
}): JSX.Element {
  const t = useTranslator();
  return (
    <div
      className={`flex items-center gap-3 border-b border-rule border-s-2 py-2 ps-2.5 ${
        marked ? 'border-s-brass' : 'border-s-transparent'
      }`}
    >
      {/* A numeral, so mono and tabular like every other figure — but sized and spaced as
          a label, which is the column's job. Arabic takes the face and the figures and
          neither the casing nor the tracking. */}
      <dt className="label tabular w-9 shrink-0 font-mono text-ink rtl:normal-case rtl:tracking-normal">
        {/* The tail label carries a `+` beside its digits; isolated so the sign does not
            jump to the far side of the number in a right-to-left run. */}
        <bdi>{label}</bdi>
      </dt>

      {/* Hidden from the reading order: it is the count beside it, drawn. The cell keeps
          its height at zero so an empty row rules the same as a full one. */}
      <div aria-hidden="true" className="flex h-2.5 min-w-0 flex-1 items-stretch">
        {count > 0 && (
          /* Square ends, flat fill, sized from the start margin — `width` is a logical
             measure, so the block grows from the right in Arabic without any mirroring.
             The floor keeps a lone entry against a tall peak visible as a mark rather
             than as nothing. */
          <div className="min-w-[2px] bg-oxblood" style={{ width: `${fraction * 100}%` }} />
        )}
      </div>

      <dd className="tabular w-10 shrink-0 text-end font-mono text-sm text-ink">{t.num(count)}</dd>
    </div>
  );
}
