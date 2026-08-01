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
 *
 * Direction: every indent here is a logical property, so in Arabic the numeral column,
 * the hanging indent under it and the actions all move to the right-hand margin without
 * a single mirrored rule. The numerals themselves are an index, not prose — they stay
 * Latin and upright in every language.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useModeStats, useSavedRound } from '@/db/hooks';
import { currentStreakFor } from '@/db/queries';
import { translate, useTranslator, type Translator } from '@/i18n';
import type { TranslationKey } from '@/i18n/en';
import { dailyPuzzle, localDateKey, msUntilLocalMidnight } from '@/lib/daily';
import { useUiStore } from '@/store/uiStore';
import { GAME_MODES, type GameMode, type PuzzleKind } from '@/types/game';

const MODE_META: Readonly<
  Record<GameMode, { numeral: string; title: TranslationKey; blurb: TranslationKey }>
> = {
  country: { numeral: 'I', title: 'menu.mode.country', blurb: 'menu.blurb.country' },
  capital: { numeral: 'II', title: 'menu.mode.capital', blurb: 'menu.blurb.capital' },
  flag: { numeral: 'III', title: 'menu.mode.flag', blurb: 'menu.blurb.flag' },
};

/**
 * The engraved treatment for display type.
 *
 * Fraunces has no Arabic coverage, so Arabic falls back to a system serif — that part is
 * accepted. What cannot be accepted is the letterspacing: `uppercase` is simply a no-op
 * on Arabic, but tracking pulls the cursive joins apart and leaves the word in pieces.
 * Both are therefore withheld from a right-to-left run rather than applied blindly.
 */
function engraved(dir: 'ltr' | 'rtl', tracking: string): string {
  return dir === 'rtl' ? '' : `uppercase ${tracking}`;
}

/**
 * Milliseconds to the next set of dailies, refreshed every half minute.
 *
 * Deliberately not a ticking clock: a second-by-second countdown on a title page is
 * noise, and it would re-render three live-query subscribers 86,400 times a day.
 */
function useMidnightRemaining(): number {
  const [remaining, setRemaining] = useState(() => msUntilLocalMidnight());

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(msUntilLocalMidnight()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return remaining;
}

/**
 * "5h 2m" in the player's own language and digits.
 *
 * Intl's unit style rather than a literal "h" and "m": those abbreviations are English,
 * and Arabic wants both its own suffixes and its own numerals. A duration is a
 * formatting problem rather than a translation one, which is why it is solved here and
 * not with a dictionary key.
 */
function formatRemaining(t: Translator, ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const m = t.num(minutes, { style: 'unit', unit: 'minute', unitDisplay: 'narrow' });
  if (hours <= 0) return m;
  return `${t.num(hours, { style: 'unit', unit: 'hour', unitDisplay: 'narrow' })} ${m}`;
}

export function MenuScreen(): JSX.Element {
  const t = useTranslator();
  const setScreen = useUiStore((s) => s.setScreen);
  const setMode = useUiStore((s) => s.setMode);
  const setKind = useUiStore((s) => s.setKind);

  // Recomputed each render on purpose: a session left open across local midnight should
  // pick up the new day's puzzles and streak window without a reload.
  const today = localDateKey();
  const remaining = useMidnightRemaining();

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
      /* Physical on purpose: a notch stays where it is when the interface mirrors, so
         the safe-area insets are matched to the edges they actually describe. */
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
          <h1
            className={`font-display text-[1.75rem] leading-none text-ink sm:text-[2.125rem] ${engraved(
              t.dir,
              'tracking-wordmark',
            )}`}
          >
            {t('app.name')}
          </h1>
          <div aria-hidden="true" className="rule-double mx-auto mt-5 w-full max-w-[22rem]" />
          <p className="mx-auto mt-5 max-w-sm text-balance text-sm leading-relaxed text-graphite">
            {t('app.tagline')}
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

        {/* `flex-wrap` earns its keep here: three entries that fit on one line in English
            do not in German, and a clipped navigation is worse than a second line. */}
        <nav
          aria-label={t('menu.a11y.more')}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-graphite"
        >
          <FooterLink onClick={() => setScreen('stats')}>{t('menu.stats')}</FooterLink>
          <Separator />
          <FooterLink onClick={() => setScreen('howto')}>{t('menu.howto')}</FooterLink>
          <Separator />
          <FooterLink onClick={() => setScreen('settings')}>{t('menu.settings')}</FooterLink>
        </nav>

        <Countdown t={t} remaining={remaining} />
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
  const t = useTranslator();
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
  // The mode's name is interpolated into whole accessible sentences below, never joined
  // to fragments — word order around it is exactly what changes between languages.
  const name = t(meta.title);

  return (
    <section aria-labelledby={`mode-${mode}`} className="py-5">
      <div className="flex items-baseline gap-4">
        {/* Fixed width so all three numerals align into a column, as an index would. The
            column follows the flex direction to the start margin; the numeral itself is
            Latin in every language and never mirrors. */}
        <span
          aria-hidden="true"
          className="w-7 shrink-0 font-display text-sm uppercase tracking-widest text-brass"
        >
          {meta.numeral}
        </span>

        <h2
          id={`mode-${mode}`}
          className={`min-w-0 flex-1 font-display text-lg leading-none text-ink ${engraved(
            t.dir,
            'tracking-[0.14em]',
          )}`}
        >
          {name}
        </h2>

        {done ? (
          <span className="label shrink-0 text-oxblood">
            {solved ? t('menu.solved') : t('menu.revealed')}
          </span>
        ) : streak > 0 ? (
          <span className="label shrink-0 text-brass">
            <span className="sr-only">{t('menu.a11y.streak', { count: t.num(streak) })}</span>
            <span aria-hidden="true">
              {t('menu.streak')}{' '}
              <span className="tabular font-mono text-ink">{t.num(streak)}</span>
            </span>
          </span>
        ) : null}
      </div>

      <p className="mt-2 ps-11 text-sm leading-relaxed text-graphite">{t(meta.blurb)}</p>

      <div className="mt-3 flex items-center gap-5 ps-11">
        <EntryAction
          onClick={() => onStart(mode, 'daily')}
          emphasis={!done}
          label={
            done
              ? t('menu.a11y.reviewDaily', { mode: name })
              : t('menu.a11y.playDaily', { mode: name })
          }
        >
          {done ? t('menu.review') : t('menu.daily')}
        </EntryAction>

        <EntryAction
          onClick={() => onStart(mode, 'practice')}
          label={t('menu.a11y.practice', { mode: name })}
        >
          {t('menu.practice')}
        </EntryAction>
      </div>
    </section>
  );
}

/**
 * The countdown line, with only the figures set in the tabular face.
 *
 * The split is on the *template* and never on the finished sentence: `{time}` sits in a
 * different position in every language, so slicing around the placeholder is the only
 * way to reach the numerals without assuming English word order. The sentence stays a
 * single translated unit either way.
 */
function Countdown({ t, remaining }: { t: Translator; remaining: number }): JSX.Element {
  const [before = '', after = ''] = translate(t.locale, 'menu.countdown').split('{time}');

  return (
    <p className="label mt-6 text-center">
      {before}
      <span className="tabular font-mono text-ink">{formatRemaining(t, remaining)}</span>
      {after}
    </p>
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

function Separator(): JSX.Element {
  return (
    <span aria-hidden="true" className="text-ink/25">
      ·
    </span>
  );
}
