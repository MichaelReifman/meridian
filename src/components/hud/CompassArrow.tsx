/**
 * The non-colour proximity signal (PRD §4).
 *
 * The heatmap says "warm/cold" in ink density; this says the same thing in a number and a
 * word, so proximity is never carried by colour alone and a player who cannot separate
 * the ends of the ramp still has full information. Every wrong guess fires both at once.
 *
 * Drawn as a bearing indicator off an instrument face: an engraved dial that stays put and
 * a brass needle that swings against it. Two layers, because a dial whose tick marks
 * rotate with the needle is not a compass.
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

/** Eight points of the rose; the four cardinals are engraved longer and in ink. */
const TICK_DEGREES = [0, 45, 90, 135, 180, 225, 270, 315];

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
      <div role="img" aria-label={label} className="sheet flex items-center gap-2.5 px-3 py-2">
        <span className="relative block h-9 w-9 shrink-0">
          {/* The fixed face: ring and rose. Never rotates, so the needle reads against it. */}
          <svg
            viewBox="0 0 36 36"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--rule)" strokeWidth="1" />
            {TICK_DEGREES.map((deg) => (
              <line
                key={deg}
                x1="18"
                y1="3.2"
                x2="18"
                y2={deg % 90 === 0 ? 7 : 5.4}
                stroke={deg % 90 === 0 ? 'var(--ink)' : 'var(--brass)'}
                strokeWidth="1"
                transform={`rotate(${deg} 18 18)`}
              />
            ))}
          </svg>

          {/* Rotating an HTML wrapper rather than the <g> inside: `transform-box` support
              for SVG children is uneven, while HTML transform-origin: 50% 50% is not. */}
          <span
            className="absolute inset-0 block"
            style={{
              transform: `rotate(${angle}deg)`,
              transition: reducedMotion ? 'none' : 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
            }}
          >
            <svg
              viewBox="0 0 36 36"
              className="h-full w-full"
              aria-hidden="true"
              focusable="false"
            >
              {/* Brass points at the target; the counterweight is inked back so the two
                  halves cannot be confused at 36px. */}
              <path d="M18 8.5 L20.3 18.6 L15.7 18.6 Z" fill="var(--brass)" />
              <path d="M18 27.5 L20.3 17.4 L15.7 17.4 Z" fill="rgb(var(--ink-rgb) / 0.38)" />
              <circle
                cx="18"
                cy="18"
                r="1.7"
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth="0.9"
              />
            </svg>
          </span>
        </span>

        <div className="border-l border-rule-soft pl-2.5 leading-tight">
          <p className="font-mono tabular text-lg text-ink">
            {formatKm(distanceKm)}
            <span className="label ml-1">km</span>
          </p>
          <p className="label mt-1.5 border-t border-rule-soft pt-1.5 text-ink">{compass}</p>
        </div>
      </div>
    </div>
  );
}
