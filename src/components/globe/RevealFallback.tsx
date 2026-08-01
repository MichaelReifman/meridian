/**
 * The reveal without WebGL (PRD §5).
 *
 * Rendered when a GL context cannot be created, and also when anything inside the
 * globe's canvas throws. Deliberately not an apology: where the globe is a plate that
 * moves, this is the same plate standing still — flag mounted inside a hairline frame,
 * the name engraved beneath it, the particulars ruled off in a table. Same paper, same
 * typography, same information. The game must never dead-end on a device that cannot
 * run three.js.
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

const SAFE_PADDING =
  'calc(var(--inset-t) + 1rem) calc(var(--inset-r) + 1rem)' +
  ' calc(var(--inset-b) + 1rem) calc(var(--inset-l) + 1rem)';

const plural = (n: number): string => (n === 1 ? 'guess' : 'guesses');

/** A flag that 404s should leave the layout alone rather than show a broken icon. */
function hideBrokenFlag(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

/**
 * The outcome, set as an engraved caption.
 *
 * The same words the dialog's accessible name uses, split so the numeral can be set in
 * mono tabular figures — a printed sheet changes face for a count rather than running
 * it into the sentence.
 */
function OutcomeLine({ solved, guessCount }: { solved: boolean; guessCount: number }): JSX.Element {
  if (guessCount === 0) return <>Revealed</>;
  return (
    <>
      {solved ? 'Solved in' : 'Revealed after'}{' '}
      <span className="tabular font-mono text-ink">{guessCount}</span> {plural(guessCount)}
    </>
  );
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
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-paper"
      style={{ padding: SAFE_PADDING }}
    >
      {/* Announced the moment the round ends, independently of the visual card. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div ref={cardRef} className="sheet animate-rise-in relative w-full max-w-md p-6 sm:p-8">
        {/* The flag as the plate: mounted on a margin of paper inside a hairline frame,
            centred over its caption. The frame lives on the image itself so a flag that
            404s takes the whole mount with it rather than leaving an empty box. */}
        <img
          src={flagUrl(target.cca2)}
          alt=""
          onError={hideBrokenFlag}
          decoding="async"
          className="mx-auto h-20 w-auto border border-rule bg-paper p-1.5 shadow-sheet"
        />

        <p className="label mt-6 text-center text-oxblood">
          <OutcomeLine solved={solved} guessCount={guessCount} />
        </p>
        {/* Wraps rather than truncates: letterspaced capitals run wide, and a clipped
            country name is the one thing the reveal cannot afford to do. */}
        <h2 className="mt-2 text-balance text-center font-display text-2xl uppercase leading-tight tracking-[0.14em] text-ink">
          {target.name}
        </h2>

        <div aria-hidden="true" className="rule-double mt-6" />

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          <div className="min-w-0">
            <dt className="label">Capital</dt>
            <dd className="mt-2 truncate text-sm text-ink">{target.capital ?? '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="label">Region</dt>
            <dd className="mt-2 truncate text-sm text-ink">{place}</dd>
          </div>
          <div className="min-w-0">
            <dt className="label">Guesses</dt>
            <dd className="tabular mt-2 font-mono text-sm text-oxblood">{guessCount}</dd>
          </div>
          <div className="min-w-0">
            <dt className="label">Code</dt>
            <dd className="tabular mt-2 font-mono text-sm text-ink">{target.cca3}</dd>
          </div>
        </dl>

        {guessPath.length > 0 && (
          <p className="mt-6 truncate border-t border-rule-soft pt-4 text-xs text-graphite" title={fullPath}>
            <span className="sr-only">Your guesses: </span>
            {guessPath.length > shown.length ? '… → ' : ''}
            {path}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-end gap-5">
          {children}
          <button
            ref={primaryRef}
            type="button"
            onClick={onDone}
            className="ease-swift -my-2 inline-flex items-center gap-2 border-b border-oxblood/60 py-2 text-sm font-medium text-oxblood transition-colors duration-150 hover:border-oxblood"
          >
            Continue
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
