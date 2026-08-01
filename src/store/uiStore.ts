/**
 * Navigation and presentation state: which screen is showing, which mode and puzzle
 * kind the player has chosen, and whether the OS has asked us to keep motion down.
 *
 * Separate from the round store on purpose — switching screens must never disturb a
 * round in progress, and the round rules must never need to know a screen exists.
 */

import { create } from 'zustand';

import type { GameMode, PuzzleKind } from '@/types/game';

export type Screen = 'menu' | 'play' | 'stats' | 'howto';

export interface UiState {
  readonly screen: Screen;
  readonly mode: GameMode;
  readonly kind: PuzzleKind;
  /** Mirrors `(prefers-reduced-motion: reduce)`, kept live for the length of the session. */
  readonly prefersReducedMotion: boolean;
  setScreen(screen: Screen): void;
  setMode(mode: GameMode): void;
  setKind(kind: PuzzleKind): void;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Null when there is no `matchMedia` at all — SSR, or a node test runner. */
function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

const motionMql = reducedMotionQuery();

export const useUiStore = create<UiState>()((set) => ({
  screen: 'menu',
  mode: 'country',
  kind: 'daily',
  prefersReducedMotion: motionMql?.matches ?? false,
  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setKind: (kind) => set({ kind }),
}));

if (motionMql) {
  const onChange = (event: MediaQueryListEvent): void => {
    useUiStore.setState({ prefersReducedMotion: event.matches });
  };
  // Safari shipped MediaQueryList without addEventListener until 14; the deprecated
  // addListener is the only hook there. Feature-detect rather than sniff the UA.
  if (typeof motionMql.addEventListener === 'function') {
    motionMql.addEventListener('change', onChange);
  } else {
    motionMql.addListener(onChange);
  }
  // Never removed: the store lives as long as the document does, so there is
  // nothing to clean up and no leak to accumulate.
}

/**
 * Read the reduced-motion preference. Use this rather than calling matchMedia at the
 * component level so the whole app agrees within a single render pass.
 */
export function useReducedMotion(): boolean {
  return useUiStore((s) => s.prefersReducedMotion);
}
