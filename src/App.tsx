/**
 * The shell.
 *
 * Meridian is a single surface, not a site: there is one map, one round, and four
 * mutually exclusive views over them. A router would add history entries the game has
 * no meaning for (a back button that half-rewinds a round is worse than none), so the
 * screen is simply a field in the UI store.
 *
 * The globe reveal is the only lazy boundary. three.js, @react-three/fiber and the
 * topojson client together dwarf everything else in the bundle and are needed exactly
 * once per round, at the end — so `lazy` here is what keeps the first paint of the map
 * cheap. It is loaded, not rendered, at this level: PlayScreen owns the Suspense
 * boundary so that fetching the chunk cannot blank the map the player is looking at.
 */

import { lazy, useEffect } from 'react';

import { HowToScreen } from '@/screens/HowToScreen';
import { MenuScreen } from '@/screens/MenuScreen';
import { PlayScreen } from '@/screens/PlayScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { useGameStore } from '@/store/gameStore';
import { useUiStore } from '@/store/uiStore';

const GlobeReveal = lazy(async () => ({
  default: (await import('@/components/globe/GlobeReveal')).GlobeReveal,
}));

/** True for the elements where a bare keystroke means "type this", not "do this". */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function App(): JSX.Element {
  const screen = useUiStore((s) => s.screen);

  /* Global shortcuts. Read through getState() rather than subscribing: this listener
     is attached once for the life of the document, and re-binding it on every screen
     change would race with the reveal's own key handling. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      // A modifier means the player is talking to the browser, not to the game.
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextEntry(event.target)) return;

      /* The reveal is a modal with its own Escape handling and its own focus trap. Both
         listeners live on `window`, and this one was registered first, so it would win
         the race and back out to the menu instead of dismissing the card. Deferring to
         it whenever it is on screen is the only ordering-independent fix. */
      if (useGameStore.getState().targetRevealed) return;

      const { screen: current, setScreen } = useUiStore.getState();

      if (event.key === 'Escape' && current !== 'menu') {
        event.preventDefault();
        setScreen('menu');
        return;
      }
      // `?` is shift-/ on most layouts, so match the produced character rather than the
      // physical key — that keeps it working on layouts where ? is unshifted.
      if (event.key === '?' && current !== 'howto') {
        event.preventDefault();
        setScreen('howto');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (screen === 'play') return <PlayScreen reveal={GlobeReveal} />;
  if (screen === 'stats') return <StatsScreen />;
  if (screen === 'howto') return <HowToScreen />;
  return <MenuScreen />;
}
