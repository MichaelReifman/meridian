/**
 * Persistence: the Dexie database, plus the in-memory fallback that keeps Meridian
 * playable when IndexedDB is not available.
 *
 * IndexedDB is missing or poisoned more often than it looks — private windows with
 * storage blocked, embedded webviews, corporate policy, a corrupt database from a
 * previous version. None of that is worth losing a round over: persistence is a
 * convenience here, not a requirement, so every query in queries.ts routes through
 * `withStorage` and silently degrades to `memoryStore` instead of rejecting.
 */

import Dexie, { type Table } from 'dexie';
import type { GameMode, ModeStats, PuzzleKind, SavedRound } from '@/types/game';

/**
 * A `rounds` row.
 *
 * Dexie can only index top-level properties, and everything worth querying by —
 * kind, mode, day — lives inside the nested `puzzle`. These three columns are
 * therefore denormalised copies that exist purely to be indexable; they are always
 * written from `puzzle` and must never be allowed to diverge from it.
 */
export interface StoredRound extends SavedRound {
  readonly kind: PuzzleKind;
  readonly mode: GameMode;
  readonly dateKey: string;
}

/** Buckets are 1 through 9 guesses, plus a final one standing for ten or more. */
export const HISTOGRAM_BUCKETS = 10;

/**
 * A `histograms` row: how many solved dailies took each number of guesses.
 *
 * Its own store rather than more columns on `modeStats`, because the two are written
 * under different conditions — every finished round moves a counter, only a solved
 * daily moves a bucket — and keeping them apart is what lets the histogram be added
 * as a new table in a new version instead of a migration over existing rows.
 */
export interface GuessHistogram {
  readonly mode: GameMode;
  /**
   * Ten counts. Index i holds solves that took i+1 guesses, except the last, which
   * holds ten or more: a geography deduction has a long enough tail that an unbounded
   * axis would be mostly empty space.
   */
  readonly buckets: readonly number[];
}

export function emptyBuckets(): number[] {
  return new Array<number>(HISTOGRAM_BUCKETS).fill(0);
}

/**
 * The bucket a solve taking `guessCount` guesses belongs in.
 *
 * Clamped at both ends. The last bucket absorbs the tail by design; the first absorbs
 * anything below one, which no real solve can be — a solve costs at least the guess
 * that found it — but a stored row is evidence, not a guarantee, and a bad count must
 * land somewhere rather than write past the end of the array.
 */
export function bucketIndexFor(guessCount: number): number {
  if (!Number.isFinite(guessCount)) return 0;
  const n = Math.trunc(guessCount);
  if (n < 1) return 0;
  return Math.min(n, HISTOGRAM_BUCKETS) - 1;
}

export class MeridianDB extends Dexie {
  /**
   * `declare` rather than a normal field: tsconfig sets `useDefineForClassFields`,
   * so a plain declaration would emit a real `defineProperty` in the constructor
   * that overwrites the Table objects Dexie attaches to the instance, leaving all
   * of these permanently undefined. `declare` emits nothing at all.
   */
  declare modeStats: Table<ModeStats, GameMode>;
  declare rounds: Table<StoredRound, string>;
  declare histograms: Table<GuessHistogram, GameMode>;

  constructor() {
    super('meridian');

    // Version 1 is frozen. Editing a shipped version in place makes the declared
    // schema disagree with what is already on the device, which Dexie answers with a
    // VersionError on open — and an unopenable database is a player's streaks gone.
    // Every later change is a new version with its own upgrade path instead.
    //
    // The secondary indexes on rounds are not all used yet, but adding an index later
    // costs a version bump, so they were declared up front.
    this.version(1).stores({
      modeStats: 'mode',
      rounds: 'key, kind, mode, dateKey, updatedAt, [kind+mode+dateKey]',
    });

    // Version 2 adds the guess histogram. Only the new store is named: Dexie carries
    // every table the spec omits forward from the previous version untouched, so
    // modeStats and rounds — and therefore every streak — are not rewritten at all.
    this.version(2)
      .stores({ histograms: 'mode' })
      .upgrade(async (tx) => {
        // Backfill. Finished dailies are already saved with their whole guess list, so
        // the histogram can be reconstructed exactly for as far back as `rounds` still
        // reaches. Rounds played before that, or evicted since, legitimately start
        // empty: the stats table holds only totals, and a total cannot be un-summed
        // into a distribution without inventing the shape this chart exists to show.
        const byMode = new Map<GameMode, number[]>();
        await tx.table<StoredRound, string>('rounds').each((row) => {
          // Solved dailies only. Practice is a sandbox, and a give-up has no score to
          // place — counting either would describe a different game than the one the
          // player is being shown.
          if (row.kind !== 'daily' || row.status !== 'solved') return;
          const buckets = byMode.get(row.mode) ?? emptyBuckets();
          buckets[bucketIndexFor(row.guesses.length)] += 1;
          byMode.set(row.mode, buckets);
        });

        if (byMode.size === 0) return;
        const rows = Array.from(byMode, ([mode, buckets]) => ({ mode, buckets }));
        await tx.table<GuessHistogram, GameMode>('histograms').bulkPut(rows);
      });
  }
}

export const db = new MeridianDB();

function detectStorage(): boolean {
  try {
    // Guarded because a few engines throw a SecurityError on merely *touching*
    // `indexedDB` when storage is blocked, rather than reporting it as absent.
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Whether rounds and stats are actually being persisted.
 *
 * Deliberately a `let`: feature detection can only rule storage out up front, while
 * a blocked or corrupt database only announces itself on the first real operation.
 * ESM live bindings mean importers see the flip to `false` without any subscription,
 * which is all the UI needs to show a "progress will not be saved" notice.
 */
export let storageAvailable = detectStorage();

/**
 * Errors that mean the database itself is unusable, as opposed to one operation
 * having failed. Hitting any of these once means every later call would fail the
 * same way, so we stop paying the latency and stay in memory for the session.
 */
const FATAL_ERRORS: ReadonlySet<string> = new Set([
  'MissingAPIError',
  'DatabaseClosedError',
  'InvalidStateError',
  'InvalidAccessError',
  'NotFoundError',
  'SecurityError',
  'SchemaError',
  'UpgradeError',
  'VersionError',
  'UnknownError',
  'QuotaExceededError',
]);

let warned = false;

function reportStorageFailure(err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn('[meridian] persistence unavailable, continuing in memory:', err);
}

type MemoryListener = () => void;

const listeners = new Set<MemoryListener>();
let version = 0;

/**
 * The fallback store, and also a read-through cache of what has been read from
 * Dexie this session. Caching reads is what makes a mid-session failure survivable:
 * if the database dies after the app has loaded, the maps already hold the player's
 * stats and current round, so the UI does not suddenly show a reset streak.
 *
 * `touch()` must only be called for writes that Dexie did *not* perform. Dexie's own
 * live queries already notify on real writes, and calling it while serving a read
 * would re-run every subscribed querier in a loop.
 */
export const memoryStore = {
  stats: new Map<GameMode, ModeStats>(),
  rounds: new Map<string, StoredRound>(),
  histograms: new Map<GameMode, GuessHistogram>(),
  touch: (): void => {
    version += 1;
    for (const listener of listeners) listener();
  },
  subscribe: (listener: MemoryListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getVersion: (): number => version,
};

/**
 * Run `run` against the database, falling back to `fallback` if storage is missing
 * or fails. Never rejects — callers get a usable value either way.
 */
export async function withStorage<T>(
  run: (database: MeridianDB) => Promise<T>,
  fallback: () => T,
): Promise<T> {
  if (!storageAvailable) return fallback();
  try {
    return await run(db);
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (FATAL_ERRORS.has(name)) storageAvailable = false;
    reportStorageFailure(err);
    return fallback();
  }
}
