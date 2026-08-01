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

export class MeridianDB extends Dexie {
  /**
   * `declare` rather than a normal field: tsconfig sets `useDefineForClassFields`,
   * so a plain declaration would emit a real `defineProperty` in the constructor
   * that overwrites the Table objects Dexie attaches to the instance, leaving both
   * of these permanently undefined. `declare` emits nothing at all.
   */
  declare modeStats: Table<ModeStats, GameMode>;
  declare rounds: Table<StoredRound, string>;

  constructor() {
    super('meridian');

    // Version 1, and the only version. The secondary indexes on rounds are not all
    // used yet, but adding an index later costs a schema version bump and an
    // upgrade path for every existing player, so they are declared up front.
    this.version(1).stores({
      modeStats: 'mode',
      rounds: 'key, kind, mode, dateKey, updatedAt, [kind+mode+dateKey]',
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
