/**
 * The round itself: an edge-to-edge chart with the whole HUD floating in the corners
 * (PRD §9 Layout — there is no toolbar).
 *
 * This screen owns three things the other modules deliberately do not: which puzzle is
 * being played, when the reveal is on screen, and what the reveal's actions do.
 *
 * Direction: the HUD mirrors and the map does not. The corner furniture is positioned
 * with `inset-inline-*`, so the way out sits at the top-start corner in every language;
 * the map host is pinned to `dir="ltr"` because a coastline is not a layout and must
 * never be flipped.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ArrowLeft, Flag, Globe, Maximize2, Share2, Shuffle } from 'lucide-react';

import { ClueCard } from '@/components/hud/ClueCard';
import { CompassArrow } from '@/components/hud/CompassArrow';
import { CountrySearch } from '@/components/hud/CountrySearch';
import { GuessCounter } from '@/components/hud/GuessCounter';
import { GuessTrail } from '@/components/hud/GuessTrail';
import { IconButton } from '@/components/hud/IconButton';
import { Toast } from '@/components/hud/Toast';
import { WorldMap } from '@/components/map/WorldMap';
import { useCountryLookup } from '@/components/map/useCountryLookup';
import type { GlobeRevealProps } from '@/components/globe/GlobeReveal';
import { useTranslator } from '@/i18n';
import type { TranslationKey } from '@/i18n/en';
import { clueFor, dailyPuzzle, practicePuzzle } from '@/lib/daily';
import { compassLabel } from '@/lib/geo';
import { buildShareText, shareResult } from '@/lib/share';
import {
  selectGuessedIds,
  selectLastGuess,
  selectRings,
  selectTarget,
  useGameStore,
} from '@/store/gameStore';
import { useUiStore } from '@/store/uiStore';
import type { Country, GameMode } from '@/types/game';

const MODE_TITLE: Readonly<Record<GameMode, TranslationKey>> = {
  country: 'menu.mode.country',
  capital: 'menu.mode.capital',
  flag: 'menu.mode.flag',
};

/**
 * The reveal, as the shell sees it: whatever `React.lazy` handed back for
 * `GlobeReveal`, which also accepts the Share / Next slot as children.
 */
export type RevealComponent = ComponentType<
  GlobeRevealProps & { readonly children?: ReactNode }
>;

/**
 * How far the guess list has to be lifted to clear the map's own zoom cluster.
 *
 * That cluster is 3 × 40 px of buttons plus a 1rem inset, and GuessTrail pins itself to
 * the same corner — see the wrapper below for why this is a number here rather than an
 * edit to either component.
 */
const TRAIL_LIFT = '8.75rem';

export function PlayScreen({ reveal: Reveal }: { reveal: RevealComponent }): JSX.Element {
  const t = useTranslator();
  const mode = useUiStore((s) => s.mode);
  const kind = useUiStore((s) => s.kind);
  const setScreen = useUiStore((s) => s.setScreen);

  const round = useGameStore((s) => s.round);
  const targetRevealed = useGameStore((s) => s.targetRevealed);
  const startRound = useGameStore((s) => s.startRound);
  const submitGuess = useGameStore((s) => s.submitGuess);
  const giveUp = useGameStore((s) => s.giveUp);
  const dismissReveal = useGameStore((s) => s.dismissReveal);
  const resetRound = useGameStore((s) => s.reset);
  const target = useGameStore(selectTarget);
  const lastGuess = useGameStore(selectLastGuess);
  const guessedIds = useGameStore(selectGuessedIds);
  const rings = useGameStore(selectRings);

  const { byId } = useCountryLookup();

  /** Bumped to deal the next practice puzzle; daily rounds ignore it entirely. */
  const [seq, setSeq] = useState(0);
  /** Targets already dealt this session, so successive practice rounds do not repeat. */
  const seenRef = useRef<readonly string[]>([]);
  /** True when the player has asked to see a finished round's reveal a second time. */
  const [replay, setReplay] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const mapHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const puzzle =
      kind === 'daily' ? dailyPuzzle(mode) : practicePuzzle(mode, seq, seenRef.current);
    seenRef.current = [...seenRef.current, puzzle.targetId];
    setReplay(false);
    /* A daily that has already been finished today needs no special case here: the store
       rehydrates its saved guesses and status and comes up with the reveal already
       showing, so it can be reviewed but never replayed. */
    void startRound(puzzle);
  }, [mode, kind, seq, startRound]);

  // Leaving the screen abandons the in-memory round only; the saved copy is untouched,
  // so re-entering a daily picks it up exactly where it was left.
  useEffect(() => () => resetRound(), [resetRound]);

  const backToMenu = useCallback(() => setScreen('menu'), [setScreen]);
  const nextPractice = useCallback(() => setSeq((n) => n + 1), []);
  const showResult = useCallback(() => setReplay(true), []);
  const closeReveal = useCallback(() => {
    setReplay(false);
    dismissReveal();
  }, [dismissReveal]);
  const clearToast = useCallback(() => setToast(null), []);

  const resetLabel = t('play.resetView');
  const resetMapView = useCallback(() => {
    /* WorldMap owns its own pan/zoom state and exposes no imperative handle, and its
       topology is fetched by URL — so remounting it to reset the view would re-download
       and re-parse 739 KB of TopoJSON and blank the map mid-round. Driving the control
       it already renders is instant.

       The accessible name is still the join, but it is now a translated one, so the
       name is read from the same dictionary key the map labels its control with rather
       than hard-coded. Matched by walking the buttons instead of building an attribute
       selector, because a translation may legitimately contain a quote. If the name ever
       drifts this quietly does nothing rather than throwing. */
    const host = mapHostRef.current;
    if (!host) return;
    for (const button of Array.from(host.querySelectorAll('button'))) {
      if (button.getAttribute('aria-label') === resetLabel) {
        button.click();
        return;
      }
    }
  }, [resetLabel]);

  const handleShare = useCallback(() => {
    // Read the round at click time rather than closing over it, so this handler stays
    // stable across every guess.
    const current = useGameStore.getState().round;
    if (!current) return;
    void shareResult(buildShareText(current)).then((outcome) => {
      /* A successful hand-off to the platform share sheet announces itself — the sheet
         is the confirmation — so only the two outcomes the player cannot otherwise see
         are spoken. That is also exactly the pair the dictionary carries. */
      setToast(
        outcome === 'copied'
          ? t('reveal.copied')
          : outcome === 'failed'
            ? t('reveal.shareFailed')
            : null,
      );
    });
  }, [t]);

  /** The guess order as countries, for the reveal's great-circle trail. */
  const guessPath = useMemo<readonly Country[]>(() => {
    if (!round) return [];
    const path: Country[] = [];
    for (const guess of round.guesses) {
      const country = byId.get(guess.countryId);
      if (country) path.push(country);
    }
    return path;
  }, [round, byId]);

  /* Safe-area insets describe physical edges — a notch does not move when the interface
     mirrors — so the start corner has to pick up the left inset in English and the right
     one in Arabic. `inset-inline-start` alone would place the control correctly and then
     clear the wrong edge. */
  const insetStart = t.dir === 'rtl' ? 'var(--inset-r)' : 'var(--inset-l)';
  const insetEnd = t.dir === 'rtl' ? 'var(--inset-l)' : 'var(--inset-r)';

  if (!round || !target) {
    return (
      <main className="flex h-full w-full items-center justify-center overflow-hidden bg-paper">
        <p className="text-sm text-graphite">{t('sw.updating')}</p>
      </main>
    );
  }

  const clue = clueFor(round.puzzle);
  /**
   * `clueFor` lives in the game layer and knows nothing about language, so it hands back
   * the canonical English name. Country and Flag clues name a country, and countries are
   * translated — a Spanish player asked to find "Bangladesh" rather than "Bangladés" is
   * being shown the wrong string. A Capital clue is left exactly as it comes: the source
   * data carries no city-name translations, which is why ClueCard isolates it with <bdi>.
   */
  const clueText = target && clue.kind !== 'capital' ? t.country(target) : clue.text;
  const playing = round.status === 'playing';
  const finished = !playing;

  return (
    <main className="relative h-full w-full overflow-hidden bg-paper">
      <h1 className="sr-only">
        {t('play.title', {
          mode: t(MODE_TITLE[round.puzzle.mode]),
          kind: t(round.puzzle.kind === 'daily' ? 'menu.daily' : 'menu.practice'),
        })}
      </h1>

      {/**
       * The whole top band, laid out as one flex row.
       *
       * Every piece of this used to position itself independently against the viewport,
       * which meant each one had to guess how much room the others needed: the controls
       * cleared the counter with a hardcoded 4.25rem, and the clue reserved the corners
       * with a hardcoded inline padding. Both guesses were measured against one language
       * at one font size, so the redesign's taller counter put the controls on top of it
       * and a longer label put the clue underneath it.
       *
       * Flowing them instead — back at the start, clue taking the slack, counter and
       * controls stacked at the end — hands the arithmetic to the browser. Nothing can
       * overlap at any width, in any language, however long a translated label runs.
       *
       * Chrome comes first in the DOM so the corner controls precede the map's 195
       * focusable countries in the tab order; stacking is z-index, not document order.
       */}
      <div
        className="pointer-events-none fixed inset-x-0 z-30 flex items-start gap-3"
        style={{
          top: 'calc(var(--inset-t) + 0.75rem)',
          paddingInlineStart: `calc(${insetStart} + 0.75rem)`,
          paddingInlineEnd: `calc(${insetEnd} + 0.75rem)`,
        }}
      >
        <div className="shrink-0">
          <IconButton label={t('play.back')} onClick={backToMenu}>
            {/* Directional: "back" is toward the start margin, which is the other way
                round in Arabic. The compass arrow, by contrast, must never be flipped. */}
            <ArrowLeft size={18} strokeWidth={1.75} className="rtl:-scale-x-100" />
          </IconButton>
        </div>

        {/* `min-w-0` so the clue may shrink rather than force the row wider than the
            viewport — without it a long country name pushes the controls off-screen.
            The search stacks under the clue and takes the column's full width; its
            suggestion list is absolutely positioned, so this column's height is still
            just the clue's and the row's no-overlap guarantee is untouched. */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <ClueCard mode={clue.kind} text={clueText} flagSrc={clue.flagSrc} />

          {/**
           * Capital and Flag modes only, and this condition is the feature.
           *
           * In Country mode the clue *is* the country's name, so a field that accepts a
           * typed name accepts the answer verbatim and the round stops being a deduction.
           * In Capital and Flag mode the clue is a city or an image, and naming the
           * country it belongs to is the thing the player is being asked to know — the
           * field only spares them hunting for it on the chart.
           *
           * Withdrawn once the round is over for the same reason the give-up control is:
           * nothing on a finished board takes a guess.
           */}
          {playing && round.puzzle.mode !== 'country' && (
            <CountrySearch guessedIds={guessedIds} onGuess={submitGuess} />
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <GuessCounter count={round.guesses.length} />
          <IconButton label={resetLabel} onClick={resetMapView}>
            <Maximize2 size={17} strokeWidth={1.75} />
          </IconButton>
          {playing ? (
            <IconButton label={t('play.giveUp')} onClick={giveUp}>
              <Flag size={17} strokeWidth={1.75} />
            </IconButton>
          ) : (
            <IconButton label={t('play.showResult')} onClick={showResult} tone="gold">
              <Globe size={17} strokeWidth={1.75} />
            </IconButton>
          )}
        </div>
      </div>

      {/* The one element on the screen that must not mirror. Geography is not a layout:
          a bearing, a coastline and the order of the continents are the same facts in
          every language, so the chart is pinned left-to-right whatever <html> says. */}
      <div ref={mapHostRef} dir="ltr" className="absolute inset-0">
        <WorldMap
          targetId={round.puzzle.targetId}
          rings={rings}
          guessedIds={guessedIds}
          lastGuessId={lastGuess?.countryId ?? null}
          disabled={finished}
          onGuess={submitGuess}
        />
      </div>

      {/* GuessTrail and the map's zoom cluster both pin themselves to the bottom-start
          corner, and the trail is the taller of the two — left alone it covers the zoom
          buttons the moment a guess is made. Neither component takes a position, but a
          `transform` makes an element the containing block for its `fixed` descendants,
          so this degenerate 0×0 box relocates the trail without touching either file. */}
      <div
        className="pointer-events-none fixed start-0 z-30 h-0 w-0"
        style={{ bottom: TRAIL_LIFT, transform: 'translateZ(0)' }}
      >
        <GuessTrail guesses={round.guesses} byId={byId} />
      </div>

      {/* Both signals fire together on every wrong guess (PRD §4): the heatmap above and
          this arrow. A correct guess has no direction to point in, and the reveal is
          covering the map by then anyway. */}
      {lastGuess && !lastGuess.correct && (
        <CompassArrow
          bearingDeg={lastGuess.bearingDeg}
          distanceKm={lastGuess.distanceKm}
          compass={compassLabel(lastGuess.bearingDeg)}
        />
      )}

      {finished && (targetRevealed || replay) && (
        // `fallback={null}` on purpose: the finished map is already on screen behind the
        // overlay, so a spinner would only flash over a perfectly good picture.
        <Suspense fallback={null}>
          <Reveal
            target={target}
            guessPath={guessPath}
            solved={round.status === 'solved'}
            guessCount={round.guesses.length}
            onDone={closeReveal}
          >
            <RevealAction onClick={handleShare}>
              <Share2 aria-hidden="true" size={16} strokeWidth={1.75} />
              {t('reveal.share')}
            </RevealAction>
            {/* A finished daily must never offer another daily in the same mode today,
                so practice gets a next round and the daily gets the way out. */}
            {round.puzzle.kind === 'practice' ? (
              <RevealAction onClick={nextPractice}>
                <Shuffle aria-hidden="true" size={16} strokeWidth={1.75} />
                {t('reveal.nextRound')}
              </RevealAction>
            ) : (
              <RevealAction onClick={backToMenu}>
                <ArrowLeft
                  aria-hidden="true"
                  size={16}
                  strokeWidth={1.75}
                  className="rtl:-scale-x-100"
                />
                {t('common.back')}
              </RevealAction>
            )}
          </Reveal>
        </Suspense>
      )}

      {/* Last in the DOM so it wins the z-50 tie against the reveal overlay. */}
      <Toast message={toast} onDone={clearToast} />
    </main>
  );
}

/**
 * A secondary action in the reveal's row: a word with a rule under it, which is the only
 * button shape printed matter has. The row therefore reads as a line of type rather than
 * a strip of controls, and hierarchy is carried by wording and order, not by fill.
 *
 * `py-2 -my-2` buys a comfortable tap target without pushing the rule away from the word.
 */
function RevealAction({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="action -my-2 inline-flex items-center gap-2 py-2 text-sm"
    >
      {children}
    </button>
  );
}
