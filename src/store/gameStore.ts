/**
 * The round state machine (PRD §1, §4).
 *
 * This store owns every rule that decides what a guess means: the running guess
 * list, the distance rings the heatmap is drawn from, and the single moment a round
 * leaves `playing`. It is deliberately free of React so the rules stay testable and
 * so the map, the HUD and the globe can all read the same authoritative round.
 *
 * Persistence is a side effect, never a dependency: every write is fire-and-forget
 * with its rejection swallowed, because a browser that has evicted IndexedDB or is
 * in private mode must still be able to play.
 */

import { create } from 'zustand';

import { COUNTRIES } from '@/data/countries.generated';
import { loadRound, recordResult, saveRound } from '@/db/queries';
import { bearingDeg, distanceKm } from '@/lib/geo';
import type { DistanceRing } from '@/lib/geo';
import type { Country, Guess, LonLat, Puzzle, RoundState } from '@/types/game';

/** id → country, so a click handler never scans 195 entries. */
const COUNTRY_BY_ID: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((c) => [c.id, c] as const),
);

const pointOf = (c: Country): LonLat => [c.lon, c.lat];

/**
 * Identifies a round for this session's "already recorded" bookkeeping. Mirrors the
 * `SavedRound.key` format so the two agree, but it is only ever used in memory —
 * the database owns its own key.
 */
const roundKey = (p: Puzzle): string => `${p.kind}:${p.mode}:${p.dateKey}:${p.seq}`;

/**
 * Rounds whose result has already reached the stats table, either because we
 * recorded it this session or because we rehydrated a round that was finished
 * before the page reloaded. Guards the "exactly once per round" rule.
 */
const settledKeys = new Set<string>();

/**
 * Monotonically increasing token identifying the most recent `startRound` call.
 * Rehydration is asynchronous, so a fast mode switch can land a stale saved round
 * on top of a newer puzzle unless the resolved read checks that it is still current.
 */
let startToken = 0;

/** Storage is a nicety. A rejected write must never surface as a broken round. */
function fireAndForget(op: () => Promise<unknown>): void {
  try {
    void op().catch(() => undefined);
  } catch {
    // A synchronous throw (e.g. Dexie refusing to open) is equally non-fatal.
  }
}

/**
 * The player's smallest error so far, or undefined before the first guess. Drives the
 * heatmap's band width and the "closest yet" readout.
 *
 * Derived rather than persisted — `SavedRound` stores only the guesses, and taking
 * the minimum over the whole list reproduces the running minimum exactly, since the
 * running minimum of a prefix is the minimum of that prefix.
 */
function smallestErrorKm(guesses: readonly Guess[]): number | undefined {
  let best: number | undefined;
  for (const g of guesses) {
    if (best === undefined || g.distanceKm < best) best = g.distanceKm;
  }
  return best;
}

export interface GameState {
  readonly round: RoundState | null;
  /** True once the reveal (globe fly-in, or its reduced-motion crossfade) should show. */
  readonly targetRevealed: boolean;
  /** Begin `puzzle`, rehydrating a previously saved round for it when one exists. */
  startRound(puzzle: Puzzle): Promise<void>;
  submitGuess(countryId: string): void;
  giveUp(): void;
  dismissReveal(): void;
  reset(): void;
}

export const useGameStore = create<GameState>()((set, get) => {
  /** Write the round through to storage; the caller has already applied it to state. */
  const persist = (round: RoundState): void => {
    fireAndForget(() => saveRound(round.puzzle, round.guesses, round.status));
  };

  /** Record the outcome of a round that has just left `playing`, at most once. */
  const settle = (round: RoundState): void => {
    const key = roundKey(round.puzzle);
    if (settledKeys.has(key)) return;
    settledKeys.add(key);
    fireAndForget(() =>
      recordResult(round.puzzle, round.guesses.length, round.status === 'solved'),
    );
  };

  return {
    round: null,
    targetRevealed: false,

    async startRound(puzzle) {
      const token = ++startToken;
      const fresh: RoundState = {
        puzzle,
        guesses: [],
        status: 'playing',
        fieldRadiusKm: undefined,
      };
      // Show the empty board immediately; the disk read below only ever upgrades it.
      set({ round: fresh, targetRevealed: false });

      // Typed off `loadRound` itself so this tolerates either null or undefined for
      // "no saved round", whichever the storage layer settles on.
      let saved: Awaited<ReturnType<typeof loadRound>> | undefined;
      try {
        saved = await loadRound(puzzle);
      } catch {
        saved = undefined;
      }

      if (token !== startToken) return; // a newer round started while we were reading

      // A saved row whose target has drifted (regenerated data, changed seed) is not
      // this puzzle; discard it rather than silently playing yesterday's answer.
      if (!saved || saved.puzzle.targetId !== puzzle.targetId) {
        // Deliberately not written before the read: an eager save would race the
        // load and could blank a round the player is midway through.
        persist(fresh);
        return;
      }

      const finished = saved.status !== 'playing';
      if (finished) {
        // Its result reached the stats table in the session that finished it.
        settledKeys.add(roundKey(puzzle));
      }
      set({
        round: {
          puzzle,
          guesses: saved.guesses,
          status: saved.status,
          fieldRadiusKm: smallestErrorKm(saved.guesses),
        },
        targetRevealed: finished,
      });
    },

    submitGuess(countryId) {
      const { round } = get();
      if (!round || round.status !== 'playing') return;

      const guessed = COUNTRY_BY_ID.get(countryId);
      if (!guessed) return; // inert terrain, or an id outside the playable 195
      // A double-tap on the same country must not inflate the score.
      if (round.guesses.some((g) => g.countryId === countryId)) return;

      const target = COUNTRY_BY_ID.get(round.puzzle.targetId);
      if (!target) return;

      const correct = guessed.id === target.id;
      const from = pointOf(guessed);
      const to = pointOf(target);
      const guess: Guess = {
        countryId,
        // Measured from the guess *toward* the answer, which is the direction the
        // compass arrow points and the number the HUD reads out.
        distanceKm: correct ? 0 : distanceKm(from, to),
        bearingDeg: correct ? 0 : bearingDeg(from, to),
        correct,
      };

      const previous = round.fieldRadiusKm ?? Number.POSITIVE_INFINITY;
      const next: RoundState = {
        puzzle: round.puzzle,
        guesses: [...round.guesses, guess],
        status: correct ? 'solved' : 'playing',
        // Never grows: the contour bands narrow as the player closes in.
        fieldRadiusKm: Math.min(previous, guess.distanceKm),
      };

      set({ round: next, targetRevealed: correct });
      persist(next);
      if (correct) settle(next);
    },

    giveUp() {
      const { round } = get();
      if (!round || round.status !== 'playing') return;

      // No guess is appended: giving up is not an attempt, and the guess count is
      // the score.
      const next: RoundState = { ...round, status: 'revealed' };
      set({ round: next, targetRevealed: true });
      persist(next);
      settle(next);
    },

    dismissReveal() {
      set({ targetRevealed: false });
    },

    reset() {
      // Abandons the in-memory round only; whatever was saved stays saved, so
      // returning to a daily picks it up where it was left.
      startToken++;
      set({ round: null, targetRevealed: false });
    },
  };
});

/* ------------------------------------------------------------------ selectors */

export function selectTarget(s: GameState): Country | null {
  if (!s.round) return null;
  return COUNTRY_BY_ID.get(s.round.puzzle.targetId) ?? null;
}

export function selectLastGuess(s: GameState): Guess | null {
  const guesses = s.round?.guesses;
  if (!guesses || guesses.length === 0) return null;
  return guesses[guesses.length - 1];
}

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();
/**
 * Memoised on the guess array's identity. zustand v5 compares selector results with
 * Object.is, so returning a fresh Set on every call would re-render — and in a
 * `useSyncExternalStore` subscriber, loop — on every unrelated store change.
 */
const guessedIdCache = new WeakMap<readonly Guess[], ReadonlySet<string>>();

export function selectGuessedIds(s: GameState): ReadonlySet<string> {
  const guesses = s.round?.guesses;
  if (!guesses || guesses.length === 0) return EMPTY_IDS;
  const cached = guessedIdCache.get(guesses);
  if (cached) return cached;
  const ids: ReadonlySet<string> = new Set(guesses.map((g) => g.countryId));
  guessedIdCache.set(guesses, ids);
  return ids;
}

const EMPTY_RINGS: readonly DistanceRing[] = [];
/**
 * Memoised on the guess array's identity, for the same reason as `selectGuessedIds`:
 * a fresh array each call would fail zustand's Object.is comparison and re-render the
 * map — and re-tinting 195 countries is the most expensive thing the app does.
 */
const ringCache = new WeakMap<readonly Guess[], readonly DistanceRing[]>();

/**
 * The heatmap's input: one ring per *wrong* guess, each saying "the answer is exactly
 * this far from here".
 *
 * The correct guess is excluded deliberately. It would contribute a zero-radius ring
 * centred on the answer, which is precisely the leak this mechanic replaced — and it
 * would briefly paint a bullseye on the target in the frame before the reveal mounts.
 */
export function selectRings(s: GameState): readonly DistanceRing[] {
  const guesses = s.round?.guesses;
  if (!guesses || guesses.length === 0) return EMPTY_RINGS;
  const cached = ringCache.get(guesses);
  if (cached) return cached;
  const rings: DistanceRing[] = [];
  for (const g of guesses) {
    if (g.correct) continue;
    const c = COUNTRY_BY_ID.get(g.countryId);
    if (c) rings.push({ at: pointOf(c), radiusKm: g.distanceKm });
  }
  ringCache.set(guesses, rings);
  return rings;
}

/** The closest guess so far — the tightest constraint the player has earned. */
export function selectBestGuess(s: GameState): Guess | null {
  const guesses = s.round?.guesses;
  if (!guesses || guesses.length === 0) return null;
  let best = guesses[0];
  for (const g of guesses) {
    // Strict `<` keeps the earliest of equally good guesses, so the marker does not
    // hop between two countries that happen to be equidistant.
    if (g.distanceKm < best.distanceKm) best = g;
  }
  return best;
}
