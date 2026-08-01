/**
 * The round itself: an edge-to-edge chart with the whole HUD floating in the corners
 * (PRD §9 Layout — there is no toolbar).
 *
 * This screen owns three things the other modules deliberately do not: which puzzle is
 * being played, when the reveal is on screen, and what the reveal's actions do.
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
import { GuessCounter } from '@/components/hud/GuessCounter';
import { GuessTrail } from '@/components/hud/GuessTrail';
import { IconButton } from '@/components/hud/IconButton';
import { Toast } from '@/components/hud/Toast';
import { WorldMap } from '@/components/map/WorldMap';
import { useCountryLookup } from '@/components/map/useCountryLookup';
import type { GlobeRevealProps } from '@/components/globe/GlobeReveal';
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

const MODE_LABEL: Readonly<Record<GameMode, string>> = {
  country: 'Country',
  capital: 'Capital',
  flag: 'Flag',
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

  const resetMapView = useCallback(() => {
    /* WorldMap owns its own pan/zoom state and exposes no imperative handle, and its
       topology is fetched by URL — so remounting it to reset the view would re-download
       and re-parse 739 KB of TopoJSON and blank the map mid-round. Driving the control
       it already renders is instant. The accessible name is the join; if it ever changes
       this quietly does nothing rather than throwing. */
    mapHostRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-label="Reset map view"]')
      ?.click();
  }, []);

  const handleShare = useCallback(() => {
    // Read the round at click time rather than closing over it, so this handler stays
    // stable across every guess.
    const current = useGameStore.getState().round;
    if (!current) return;
    void shareResult(buildShareText(current)).then((outcome) => {
      setToast(
        outcome === 'shared'
          ? 'Result shared'
          : outcome === 'copied'
            ? 'Result copied to clipboard'
            : 'Sharing is not available in this browser',
      );
    });
  }, []);

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

  if (!round || !target) {
    return (
      <main className="flex h-full w-full items-center justify-center overflow-hidden bg-paper">
        <p className="text-sm text-graphite">Preparing the chart…</p>
      </main>
    );
  }

  const clue = clueFor(round.puzzle);
  const playing = round.status === 'playing';
  const finished = !playing;
  const kindLabel = round.puzzle.kind === 'daily' ? 'Daily Challenge' : 'Practice';

  return (
    <main className="relative h-full w-full overflow-hidden bg-paper">
      <h1 className="sr-only">
        Meridian — {MODE_LABEL[round.puzzle.mode]} {kindLabel}
      </h1>

      {/* Chrome first in the DOM so the corner controls come before the map's 195
          focusable countries in the tab order. Stacking is decided by z-index, not by
          document order, so the map still paints underneath. */}
      <div
        className="fixed z-30"
        style={{ top: 'calc(var(--inset-t) + 0.75rem)', left: 'calc(var(--inset-l) + 0.75rem)' }}
      >
        <IconButton label="Back to menu" onClick={backToMenu}>
          <ArrowLeft size={18} strokeWidth={1.75} />
        </IconButton>
      </div>

      <GuessCounter count={round.guesses.length} />

      {/* Stacked below the guess counter, which pins itself to this same corner. */}
      <div
        className="pointer-events-none fixed z-30 flex flex-col items-end gap-2"
        style={{ top: 'calc(var(--inset-t) + 4.25rem)', right: 'calc(var(--inset-r) + 0.75rem)' }}
      >
        {/* Not "Reset map view": that is the exact accessible name of the control this
            forwards to, and two buttons answering to one name is a trap for anyone
            navigating by name. */}
        <IconButton label="Recentre the map" onClick={resetMapView}>
          <Maximize2 size={17} strokeWidth={1.75} />
        </IconButton>
        {playing ? (
          <IconButton label="Give up and reveal the answer" onClick={giveUp}>
            <Flag size={17} strokeWidth={1.75} />
          </IconButton>
        ) : (
          <IconButton label="Show the result again" onClick={showResult} tone="gold">
            <Globe size={17} strokeWidth={1.75} />
          </IconButton>
        )}
      </div>

      <div ref={mapHostRef} className="absolute inset-0">
        <WorldMap
          targetId={round.puzzle.targetId}
          rings={rings}
          guessedIds={guessedIds}
          lastGuessId={lastGuess?.countryId ?? null}
          disabled={finished}
          onGuess={submitGuess}
        />
      </div>

      <ClueCard mode={clue.kind} text={clue.text} flagSrc={clue.flagSrc} />

      {/* GuessTrail and the map's zoom cluster both pin themselves to the bottom-left
          corner, and the trail is the taller of the two — left alone it covers the zoom
          buttons the moment a guess is made. Neither component takes a position, but a
          `transform` makes an element the containing block for its `fixed` descendants,
          so this degenerate 0×0 box relocates the trail without touching either file. */}
      <div
        className="pointer-events-none fixed left-0 z-30 h-0 w-0"
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
              Share
            </RevealAction>
            {/* A finished daily must never offer another daily in the same mode today,
                so practice gets a next round and the daily gets the way out. */}
            {round.puzzle.kind === 'practice' ? (
              <RevealAction onClick={nextPractice}>
                <Shuffle aria-hidden="true" size={16} strokeWidth={1.75} />
                Next round
              </RevealAction>
            ) : (
              <RevealAction onClick={backToMenu}>
                <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
                Menu
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
