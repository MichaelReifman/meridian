/**
 * Every read and write the game performs, and the streak rules that make the Daily
 * Challenge worth returning to (PRD §3).
 *
 * The stats maths lives in one pure function, `applyResult`, so the Dexie path and
 * the in-memory fallback path cannot drift apart.
 */

import {
  bucketIndexFor,
  emptyBuckets,
  HISTOGRAM_BUCKETS,
  memoryStore,
  withStorage,
  type GuessHistogram,
  type StoredRound,
} from '@/db/db';
import {
  GAME_MODES,
  type GameMode,
  type Guess,
  type ModeStats,
  type Puzzle,
  type PuzzleKind,
  type RoundStatus,
  type SavedRound,
} from '@/types/game';

function makeKey(kind: PuzzleKind, mode: GameMode, dateKey: string, seq: number): string {
  return `${kind}:${mode}:${dateKey}:${seq}`;
}

export function roundKey(p: Puzzle): string {
  return makeKey(p.kind, p.mode, p.dateKey, p.seq);
}

function emptyStats(mode: GameMode): ModeStats {
  return {
    mode,
    currentStreak: 0,
    maxStreak: 0,
    lastSolvedDate: null,
    dailiesPlayed: 0,
    dailiesSolved: 0,
    totalGuessesOnSolved: 0,
    bestGuessCount: null,
    practicePlayed: 0,
    practiceSolved: 0,
    practiceTotalGuessesOnSolved: 0,
  };
}

function emptyHistogram(mode: GameMode): GuessHistogram {
  return { mode, buckets: emptyBuckets() };
}

/**
 * True for the one kind of result the histogram describes.
 *
 * The chart is a picture of the Daily Challenge alone. Practice deals unlimited
 * puzzles and would swamp the shape, and a give-up produced no guess count to place.
 */
function countsInHistogram(kind: PuzzleKind, solved: boolean): boolean {
  return kind === 'daily' && solved;
}

/** `prev` with one solve added to its bucket. Pure, like `applyResult`. */
function addSolve(prev: GuessHistogram, guessCount: number): GuessHistogram {
  // Rebuilt onto a fresh full-length array rather than spread from `prev`. The counts
  // are cumulative and never recomputed, so a single non-number arriving from a stored
  // row would turn into a NaN on the next `+= 1` and stay one forever.
  const buckets = emptyBuckets();
  for (let i = 0; i < HISTOGRAM_BUCKETS; i++) {
    const carried = prev.buckets[i];
    if (Number.isFinite(carried)) buckets[i] = carried;
  }
  buckets[bucketIndexFor(guessCount)] += 1;
  return { mode: prev.mode, buckets };
}

/** Parse a `YYYY-MM-DD` key into local midnight on that calendar day. */
function localDateFromKey(key: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (parts === null) return null;
  const d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateKey(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The calendar day before `dateKey`, in the player's own timezone.
 *
 * Done by calendar arithmetic, never by subtracting 86,400,000 ms. Two days a year
 * are 23 or 25 hours long, and the ms approach lands on the wrong date on both of
 * them — which would silently break a player's streak twice a year, at the exact
 * moment they had done nothing wrong.
 */
function previousDateKey(dateKey: string): string | null {
  const d = localDateFromKey(dateKey);
  if (d === null) return null;
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

/**
 * The one place the stats rules live. Pure, and returns `prev` *by identity* when
 * nothing should change, which callers use to skip the write entirely.
 */
function applyResult(
  prev: ModeStats,
  kind: PuzzleKind,
  dateKey: string,
  guessCount: number,
  solved: boolean,
): ModeStats {
  // Practice is a sandbox: it may never touch the streak or any daily counter.
  if (kind === 'practice') {
    return {
      ...prev,
      practicePlayed: prev.practicePlayed + 1,
      practiceSolved: prev.practiceSolved + (solved ? 1 : 0),
      practiceTotalGuessesOnSolved:
        prev.practiceTotalGuessesOnSolved + (solved ? guessCount : 0),
    };
  }

  if (!solved) {
    // Giving up costs the attempt but not the streak. A streak is broken by a missed
    // DAY, which currentStreakFor() detects on read — there is nothing to reset here.
    return { ...prev, dailiesPlayed: prev.dailiesPlayed + 1 };
  }

  // Idempotency. recordResult is called again whenever a solved daily is reloaded
  // and re-finalised, and a second call must not inflate the counters or the streak.
  if (prev.lastSolvedDate === dateKey) return prev;

  const continued = prev.lastSolvedDate !== null && prev.lastSolvedDate === previousDateKey(dateKey);
  const currentStreak = continued ? prev.currentStreak + 1 : 1;

  return {
    ...prev,
    currentStreak,
    maxStreak: Math.max(prev.maxStreak, currentStreak),
    lastSolvedDate: dateKey,
    dailiesPlayed: prev.dailiesPlayed + 1,
    dailiesSolved: prev.dailiesSolved + 1,
    totalGuessesOnSolved: prev.totalGuessesOnSolved + guessCount,
    bestGuessCount:
      prev.bestGuessCount === null ? guessCount : Math.min(prev.bestGuessCount, guessCount),
  };
}

/**
 * The streak the UI must display.
 *
 * `currentStreak` is only ever written on a solve, so a stored 7 says nothing about
 * whether the run is still alive. A streak survives exactly as long as the last
 * solve was today or yesterday; anything older means a day was missed and the run
 * is already over, even though nothing has been written since.
 */
export function currentStreakFor(stats: ModeStats, today: string): number {
  if (stats.lastSolvedDate === null) return 0;
  if (stats.lastSolvedDate === today) return stats.currentStreak;
  if (stats.lastSolvedDate === previousDateKey(today)) return stats.currentStreak;
  return 0;
}

export async function loadRound(p: Puzzle): Promise<SavedRound | undefined> {
  const key = roundKey(p);
  return withStorage(
    async (database) => {
      const row = await database.rounds.get(key);
      if (row !== undefined) memoryStore.rounds.set(key, row);
      return row;
    },
    () => memoryStore.rounds.get(key),
  );
}

export async function saveRound(
  puzzle: Puzzle,
  guesses: readonly Guess[],
  status: RoundStatus,
): Promise<void> {
  const row: StoredRound = {
    key: roundKey(puzzle),
    puzzle,
    // Copied, not aliased: the store keeps mutating its own guess list, and both the
    // structured clone and the memory fallback must capture this moment, not a view.
    guesses: [...guesses],
    status,
    updatedAt: Date.now(),
    kind: puzzle.kind,
    mode: puzzle.mode,
    dateKey: puzzle.dateKey,
  };
  await withStorage<void>(
    async (database) => {
      await database.rounds.put(row);
      memoryStore.rounds.set(row.key, row);
    },
    () => {
      memoryStore.rounds.set(row.key, row);
      memoryStore.touch();
    },
  );
}

export async function getStats(mode: GameMode): Promise<ModeStats> {
  return withStorage(
    async (database) => {
      const stats = (await database.modeStats.get(mode)) ?? emptyStats(mode);
      memoryStore.stats.set(mode, stats);
      return stats;
    },
    () => memoryStore.stats.get(mode) ?? emptyStats(mode),
  );
}

/** All three modes, always, in GAME_MODES order — absent rows come back zeroed. */
export async function getAllStats(): Promise<ModeStats[]> {
  return withStorage(
    async (database) => {
      const rows = await database.modeStats.bulkGet([...GAME_MODES]);
      return GAME_MODES.map((mode, i) => {
        const stats = rows[i] ?? emptyStats(mode);
        memoryStore.stats.set(mode, stats);
        return stats;
      });
    },
    () => GAME_MODES.map((mode) => memoryStore.stats.get(mode) ?? emptyStats(mode)),
  );
}

export async function recordResult(
  puzzle: Puzzle,
  guessCount: number,
  solved: boolean,
): Promise<void> {
  // Sanitised at the door: a NaN reaching totalGuessesOnSolved would poison the
  // average permanently, since stats are cumulative and never recomputed.
  const guesses = Number.isFinite(guessCount) ? Math.max(0, Math.trunc(guessCount)) : 0;

  await withStorage<void>(
    async (database) => {
      // One transaction over both tables, not two writes: they are two projections of
      // the same event, and a failure between them would leave a record that disagrees
      // with itself. It is also a transaction rather than a read-then-write because two
      // results landing together (an autosave racing the round's own finalise) would
      // otherwise both read the same `prev` and one increment would vanish.
      const next = await database.transaction(
        'rw',
        database.modeStats,
        database.histograms,
        async () => {
          const prev = (await database.modeStats.get(puzzle.mode)) ?? emptyStats(puzzle.mode);
          const updated = applyResult(prev, puzzle.kind, puzzle.dateKey, guesses, solved);
          // Identity means applyResult rejected this result as one already recorded —
          // which is exactly the condition under which the histogram must not count it
          // again either. Deriving the bucket write from the same signal is what keeps
          // recordResult idempotent per round now that it writes two tables.
          if (updated === prev) return { stats: prev, histogram: undefined };
          await database.modeStats.put(updated);

          if (!countsInHistogram(puzzle.kind, solved)) {
            return { stats: updated, histogram: undefined };
          }
          const prevHist =
            (await database.histograms.get(puzzle.mode)) ?? emptyHistogram(puzzle.mode);
          const histogram = addSolve(prevHist, guesses);
          await database.histograms.put(histogram);
          return { stats: updated, histogram };
        },
      );
      memoryStore.stats.set(puzzle.mode, next.stats);
      if (next.histogram !== undefined) memoryStore.histograms.set(puzzle.mode, next.histogram);
    },
    () => {
      const prev = memoryStore.stats.get(puzzle.mode) ?? emptyStats(puzzle.mode);
      const next = applyResult(prev, puzzle.kind, puzzle.dateKey, guesses, solved);
      if (next === prev) return;
      memoryStore.stats.set(puzzle.mode, next);
      if (countsInHistogram(puzzle.kind, solved)) {
        const prevHist = memoryStore.histograms.get(puzzle.mode) ?? emptyHistogram(puzzle.mode);
        memoryStore.histograms.set(puzzle.mode, addSolve(prevHist, guesses));
      }
      memoryStore.touch();
    },
  );
}

/** All three modes, always, in GAME_MODES order — absent rows come back zeroed. */
export async function getAllHistograms(): Promise<GuessHistogram[]> {
  return withStorage(
    async (database) => {
      const rows = await database.histograms.bulkGet([...GAME_MODES]);
      return GAME_MODES.map((mode, i) => {
        const histogram = rows[i] ?? emptyHistogram(mode);
        memoryStore.histograms.set(mode, histogram);
        return histogram;
      });
    },
    () => GAME_MODES.map((mode) => memoryStore.histograms.get(mode) ?? emptyHistogram(mode)),
  );
}

/**
 * Guesses made so far in each mode's still-unfinished daily for `dateKey`, or null
 * where there is no such round.
 *
 * Read from `rounds` rather than the game store because the store abandons its round
 * the moment the play screen unmounts — by the time the record is on screen there is
 * nothing left in memory to ask.
 */
export async function getOpenDailyGuessCounts(
  dateKey: string,
): Promise<Readonly<Record<GameMode, number | null>>> {
  // Dailies are one per day by definition, so their seq is always 0.
  const keys = GAME_MODES.map((mode) => makeKey('daily', mode, dateKey, 0));
  const rows = await withStorage(
    async (database) => database.rounds.bulkGet(keys),
    () => keys.map((key) => memoryStore.rounds.get(key)),
  );

  // Spelled out rather than built by cast: GameMode is a closed union, so a fourth mode
  // would fail to compile here instead of silently returning a partial record.
  const open: Record<GameMode, number | null> = { country: null, capital: null, flag: null };
  GAME_MODES.forEach((mode, i) => {
    const row = rows[i];
    if (row !== undefined && row.status === 'playing') open[mode] = row.guesses.length;
  });
  return open;
}

/** True once today's daily for `mode` has been solved or given up on. */
export async function isDailyComplete(mode: GameMode, dateKey: string): Promise<boolean> {
  // Dailies are one per day by definition, so their seq is always 0.
  const key = makeKey('daily', mode, dateKey, 0);
  const status = await withStorage(
    async (database) => (await database.rounds.get(key))?.status,
    () => memoryStore.rounds.get(key)?.status,
  );
  return status === 'solved' || status === 'revealed';
}

export async function clearAllData(): Promise<void> {
  memoryStore.stats.clear();
  memoryStore.rounds.clear();
  memoryStore.histograms.clear();
  memoryStore.touch();
  await withStorage<void>(
    (database) =>
      database.transaction(
        'rw',
        database.modeStats,
        database.rounds,
        database.histograms,
        async () => {
          await database.modeStats.clear();
          await database.rounds.clear();
          await database.histograms.clear();
        },
      ),
    () => undefined,
  );
}
