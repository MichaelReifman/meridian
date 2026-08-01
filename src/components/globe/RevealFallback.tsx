/**
 * The reveal without WebGL (PRD §5).
 *
 * Rendered when a GL context cannot be created, and also when anything inside the
 * globe's canvas throws. Deliberately not an apology: the same cosmic ground, the
 * same typography and the same information as the globe overlay, composed as one
 * card. The game must never dead-end on a device that cannot run three.js.
 */

import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { flagUrl } from '@/lib/paths';
import type { GlobeRevealProps } from './GlobeReveal';

/**
 * How many of the most recent guesses the path strip prints before it elides.
 * A 30-guess round would otherwise push the button below the fold on a phone.
 */
const PATH_LIMIT = 6;

/**
 * Two wide, low-alpha washes standing in for the globe's nebula. Without them a flat
 * card on #0B0E1A reads as an error dialog rather than as the end of a round.
 */
const NEBULA =
  'radial-gradient(56rem 40rem at 16% 10%, rgba(123, 108, 246, 0.18), transparent 62%),' +
  'radial-gradient(44rem 34rem at 86% 92%, rgba(79, 209, 197, 0.13), transparent 60%)';

const SAFE_PADDING =
  'calc(var(--inset-t) + 1rem) calc(var(--inset-r) + 1rem)' +
  ' calc(var(--inset-b) + 1rem) calc(var(--inset-l) + 1rem)';

const plural = (n: number): string => (n === 1 ? 'guess' : 'guesses');

/** A flag that 404s should leave the layout alone rather than show a broken icon. */
function hideBrokenFlag(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

/**
 * `children` is the shell's slot for Share / Next. It sits ahead of the primary
 * action in the same row so the tab order runs left to right across the actions.
 */
export function RevealFallback({
  target,
  guessPath,
  solved,
  guessCount,
  onDone,
  children,
}: GlobeRevealProps & { readonly children?: ReactNode }): JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const outcome = solved
    ? `Solved in ${guessCount} ${plural(guessCount)}`
    : guessCount > 0
      ? `Revealed after ${guessCount} ${plural(guessCount)}`
      : 'Revealed';
  const place = target.subregion || target.region;
  const summary = `${target.name}. ${outcome}. Capital: ${target.capital ?? 'none listed'}. Region: ${place}.`;

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // The live region has to be empty when it is inserted: screen readers announce
  // *changes*, and text already present at insertion time is commonly skipped.
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnnouncement(summary));
    return () => cancelAnimationFrame(id);
  }, [summary]);

  // The reveal covers the map, so it behaves as a modal: Escape dismisses and Tab
  // stays inside the card. Without the wrap the next Tab lands on the map beneath,
  // which is still rendered and still focusable.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDone();
        return;
      }
      if (event.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const stops = card.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const outside = !card.contains(active);
      if (event.shiftKey ? active === first || outside : active === last || outside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const shown = guessPath.slice(-PATH_LIMIT);
  const path = shown.map((c) => c.name).join(' → ');
  const fullPath = guessPath.map((c) => c.name).join(' → ');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${target.name} — ${outcome}`}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-space"
      style={{ padding: SAFE_PADDING }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: NEBULA }} />

      {/* Announced the moment the round ends, independently of the visual card. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div ref={cardRef} className="hud-panel animate-rise-in relative w-full max-w-md rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <img
            src={flagUrl(target.cca2)}
            alt=""
            onError={hideBrokenFlag}
            decoding="async"
            className="h-12 w-auto shrink-0 rounded-md border border-hairline shadow-hud"
          />
          <div className="min-w-0">
            <p className="text-hud tabular font-mono uppercase text-gold">{outcome}</p>
            <h2 className="font-display mt-1 truncate text-3xl leading-tight text-parchment">{target.name}</h2>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-hairline pt-5">
          <div className="min-w-0">
            <dt className="text-hud font-mono uppercase text-muted">Capital</dt>
            <dd className="mt-1 truncate text-sm text-parchment">{target.capital ?? '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-hud font-mono uppercase text-muted">Region</dt>
            <dd className="mt-1 truncate text-sm text-parchment">{place}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-hud font-mono uppercase text-muted">Guesses</dt>
            <dd className="tabular mt-1 font-mono text-sm text-gold">{guessCount}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-hud font-mono uppercase text-muted">Code</dt>
            <dd className="tabular mt-1 font-mono text-sm text-parchment">{target.cca3}</dd>
          </div>
        </dl>

        {guessPath.length > 0 && (
          <p className="mt-5 truncate text-xs text-muted" title={fullPath}>
            <span className="sr-only">Your guesses: </span>
            {guessPath.length > shown.length ? '… → ' : ''}
            {path}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {children}
          <button
            ref={primaryRef}
            type="button"
            onClick={onDone}
            className="ease-swift inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-space transition-colors duration-200 hover:bg-gold/90"
          >
            Continue
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
