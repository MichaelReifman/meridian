/**
 * The non-colour proximity signal (PRD §4).
 *
 * The heatmap says "warm/cold" in hue; this says the same thing in a number and a word,
 * so a player who cannot separate violet from gold still has full information. Every
 * wrong guess fires both at once.
 */

import { useEffect, useRef, useState } from 'react';
import { formatKm } from '@/lib/geo';

/** Compass points spelled out, because "NE" is read aloud as two letters. */
const COMPASS_WORDS: Record<string, string> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
};

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function CompassArrow({
  bearingDeg,
  distanceKm,
  compass,
}: {
  bearingDeg: number;
  distanceKm: number;
  compass: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  /**
   * Bearings wrap at 360°, but CSS rotation does not: animating 350° → 10° as written
   * would spin the arrow 340° the wrong way. So we track an *unwrapped* angle that can
   * grow past 360 and only ever move by the shortest signed delta.
   */
  const unwrapped = useRef(bearingDeg);
  const [angle, setAngle] = useState(bearingDeg);

  useEffect(() => {
    const delta = ((((bearingDeg - unwrapped.current) % 360) + 540) % 360) - 180;
    unwrapped.current += delta;
    setAngle(unwrapped.current);
  }, [bearingDeg]);

  const words = COMPASS_WORDS[compass] ?? compass;
  const label = `Target is ${formatKm(distanceKm)} kilometres away, to the ${words}.`;

  return (
    <div
      className="pointer-events-none fixed z-30"
      style={{
        right: 'calc(var(--inset-r) + 0.75rem)',
        bottom: 'calc(var(--inset-b) + 0.75rem)',
      }}
      /* The readout changes on every guess and is the primary feedback, so it is worth
         announcing. The child carries the spoken wording; this wrapper only fires. */
      aria-live="polite"
    >
      <div
        role="img"
        aria-label={label}
        className="hud-panel flex items-center gap-3 rounded-xl px-3 py-2"
      >
        {/* Rotating an HTML wrapper rather than the <g> inside: `transform-box` support
            for SVG children is uneven, while HTML transform-origin: 50% 50% is not. */}
        <span
          className="block h-8 w-8 shrink-0 text-gold"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: reducedMotion ? 'none' : 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
          }}
        >
          <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true" focusable="false">
            {/* Notched kite pointing at 0° = north, so the raw bearing is the rotation. */}
            <path d="M12 1.8 L19 21 L12 16.4 L5 21 Z" fill="currentColor" />
          </svg>
        </span>

        <div className="leading-tight">
          <p className="font-mono tabular text-lg text-parchment">
            {formatKm(distanceKm)}
            <span className="ml-1 font-sans text-xs text-muted">km</span>
          </p>
          <p className="text-hud mt-1 uppercase text-cyan">{compass}</p>
        </div>
      </div>
    </div>
  );
}
