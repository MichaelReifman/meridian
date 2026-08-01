/**
 * React bindings for the persistence layer.
 *
 * Each hook wraps the matching function in queries.ts rather than querying Dexie
 * directly, so components get the same zeroed-row and fallback behaviour the rest of
 * the app does.
 */

import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { memoryStore, type GuessHistogram } from '@/db/db';
import {
  getAllHistograms,
  getAllStats,
  getOpenDailyGuessCounts,
  getStats,
  loadRound,
  roundKey,
} from '@/db/queries';
import type { GameMode, ModeStats, Puzzle, SavedRound } from '@/types/game';

/**
 * Re-render trigger for the no-IndexedDB fallback.
 *
 * Dexie's live queries observe the *database*, so while queries.ts is serving from
 * its in-memory maps nothing would ever tell React that a write happened. Threading
 * this counter through each dependency array re-runs the querier on every fallback
 * write, which keeps one code path for both storage modes instead of two.
 */
function useMemoryVersion(): number {
  return useSyncExternalStore(
    memoryStore.subscribe,
    memoryStore.getVersion,
    memoryStore.getVersion,
  );
}

/** Undefined only on the first render, before the query resolves. */
export function useModeStats(mode: GameMode): ModeStats | undefined {
  const version = useMemoryVersion();
  return useLiveQuery(() => getStats(mode), [mode, version]);
}

/** All three modes in GAME_MODES order; undefined until the first read resolves. */
export function useAllStats(): ModeStats[] | undefined {
  const version = useMemoryVersion();
  return useLiveQuery(() => getAllStats(), [version]);
}

/** All three modes in GAME_MODES order; undefined until the first read resolves. */
export function useAllHistograms(): GuessHistogram[] | undefined {
  const version = useMemoryVersion();
  return useLiveQuery(() => getAllHistograms(), [version]);
}

/**
 * Guesses so far in each mode's unfinished daily for `dateKey`, null where none is
 * open. Undefined only on the first render, before the query resolves.
 */
export function useOpenDailyGuessCounts(
  dateKey: string,
): Readonly<Record<GameMode, number | null>> | undefined {
  const version = useMemoryVersion();
  return useLiveQuery(() => getOpenDailyGuessCounts(dateKey), [dateKey, version]);
}

/**
 * The saved state for `puzzle`, if any.
 *
 * Three-valued on purpose: `undefined` means "not known yet" and should render as
 * loading, while `null` means "asked, and there is nothing saved" — including the
 * case where there is no puzzle to ask about. Collapsing the two would make a fresh
 * round flicker through the resumed-round UI on every mount.
 */
export function useSavedRound(puzzle: Puzzle | null): SavedRound | undefined | null {
  const version = useMemoryVersion();
  const key = puzzle === null ? null : roundKey(puzzle);
  return useLiveQuery(async () => {
    if (puzzle === null) return null;
    return (await loadRound(puzzle)) ?? null;
  }, [key, version]);
}
