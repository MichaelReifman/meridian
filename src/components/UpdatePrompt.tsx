/**
 * Service worker lifecycle, surfaced to the player.
 *
 * Two moments are worth a word and no more:
 *
 *  · the first visit finishes precaching, so the game is genuinely playable offline —
 *    a claim worth making once, since it is the whole reason the flags are vendored;
 *  · a new build is waiting, which under 'prompt' registration will not take effect
 *    until the page reloads.
 *
 * The update banner persists rather than auto-dismissing, because dismissing it is a
 * decision: the waiting worker holds until the player reloads, and silently timing the
 * offer out would leave them on an old build with no way back to the offer.
 *
 * This component owns registration (vite.config sets injectRegister to null), so it
 * must stay mounted for the life of the app.
 */

import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, X } from 'lucide-react';

import { useTranslator } from '@/i18n';

/**
 * How often to re-check for a new build while the app stays open.
 *
 * The browser only checks on navigation, which for an installed PWA can mean days if
 * Android keeps the process warm. An hour is generous for a game opened once a day and
 * costs one conditional request for a 16 KB file.
 */
const UPDATE_POLL_MS = 60 * 60 * 1000;

const OFFLINE_NOTICE_MS = 3200;

/**
 * Grace period before forcing the reload ourselves, long enough for the waiting worker
 * to take over so the reload lands on the new build rather than re-serving the old one.
 */
const RELOAD_FALLBACK_MS = 1200;

export function UpdatePrompt(): JSX.Element | null {
  const t = useTranslator();

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const check = (): void => {
        // Rejects whenever the network is unavailable, which is the normal state for
        // this app rather than an exceptional one.
        void registration.update().catch(() => undefined);
      };

      const timer = window.setInterval(check, UPDATE_POLL_MS);

      /* Returning to a backgrounded PWA is the moment a check is most likely to find
         something, and on Android it frequently does not involve a fresh navigation. */
      const onVisible = (): void => {
        if (document.visibilityState === 'visible') check();
      };
      document.addEventListener('visibilitychange', onVisible);

      /* Registration outlives this component in practice, but tearing the listeners
         down on unload keeps a hot-reloaded dev session from stacking them up. */
      window.addEventListener('beforeunload', () => {
        window.clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisible);
      });
    },
  });

  const [updating, setUpdating] = useState(false);

  // The offline confirmation is informational, so it behaves like a toast.
  useEffect(() => {
    if (!offlineReady) return;
    const id = window.setTimeout(() => setOfflineReady(false), OFFLINE_NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      /* Sits above the transient Toast's bottom-centre slot so a "Copied" confirmation
         from the reveal cannot land underneath this one. Centred by a full-width flex
         row: `left-1/2` with a translate is the one centring idiom that would not
         survive mirroring. */
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: 'calc(var(--inset-b) + 4.75rem)' }}
    >
      {needRefresh ? (
        <div className="sheet animate-rise-in pointer-events-auto flex max-w-[92vw] items-center gap-3 py-2 pe-2 ps-4">
          <span className="text-sm text-ink">{t('sw.updateReady')}</span>
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              setUpdating(true);
              // Tells the waiting worker to take over. Everything the new build needs is
              // already precached, so the reload that follows is effectively instant.
              void updateServiceWorker(true);
              /* And reload ourselves regardless. The library's reload fires on
                 `controllerchange`, which never happens when the page was opened before
                 any worker existed — without clientsClaim nothing claims it, so on a
                 first-ever session the button would activate the update and then appear
                 to do nothing. Whichever path wins, the page reloads exactly once. */
              window.setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS);
            }}
            /* A hairline-ruled key in oxblood, not a filled pill: printed matter marks
               its primary action with colour and a rule, never with a slab of ink. */
            className="ease-swift inline-flex shrink-0 items-center gap-1.5 rounded-sheet border border-oxblood/45 bg-paper px-3 py-1.5 text-sm text-oxblood transition-colors duration-200 hover:border-oxblood hover:bg-oxblood/5 disabled:opacity-60"
          >
            <Download aria-hidden="true" size={15} strokeWidth={2} />
            {updating ? t('sw.updating') : t('sw.reload')}
          </button>
          <button
            type="button"
            aria-label={t('sw.dismiss')}
            onClick={() => setNeedRefresh(false)}
            className="ease-swift flex h-8 w-8 shrink-0 items-center justify-center rounded-sheet text-graphite transition-colors duration-200 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <div className="sheet animate-rise-in max-w-[80vw] px-4 py-2 text-center text-sm text-ink">
          {t('sw.offlineReady')}
        </div>
      )}
    </div>
  );
}
