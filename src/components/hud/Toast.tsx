/**
 * Transient bottom-centre confirmation ("Copied to clipboard").
 *
 * The owner keeps the message in state and clears it in `onDone`; this component only
 * decides when "brief" is up.
 */

import { useEffect, useRef } from 'react';

const DISMISS_MS = 2200;

export function Toast({ message, onDone }: { message: string | null; onDone(): void }) {
  /**
   * Held in a ref so an inline `onDone` closure — the common case — does not restart
   * the countdown on every parent render and leave the toast up indefinitely.
   */
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (message === null) return;
    const id = window.setTimeout(() => onDoneRef.current(), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [message]);

  return (
    <div
      /* The live region stays mounted and empty between toasts: assistive tech only
         announces mutations *inside* an existing region, so one that appears together
         with its text is frequently missed. */
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2"
      style={{ bottom: 'calc(var(--inset-b) + 1.25rem)' }}
    >
      {message !== null && (
        <div
          key={message}
          className="hud-panel animate-rise-in max-w-[80vw] rounded-full px-4 py-2 text-center text-sm text-parchment"
        >
          {message}
        </div>
      )}
    </div>
  );
}
