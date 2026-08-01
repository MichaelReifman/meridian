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
 *
 * The dial is the one part of the HUD that does not mirror. A bearing of 40° is 40° in
 * every language: the panel around the instrument flips with the interface, the instrument
 * itself is held to `dir="ltr"` and its rotation is never negated.
 */

import { useEffect, useRef, useState } from 'react';

import { useTranslator, type Translator } from '@/i18n';

/** Eight points of the rose; the four cardinals are engraved longer and in ink. */
const TICK_DEGREES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Kilometres in the player's own numerals.
 *
 * `lib/geo.formatKm` is pinned to en-US, which would print Latin digits and a comma
 * inside an Arabic readout. The rounding rule is reproduced here — coarse above 100 km,
 * one decimal below it — and the grouping and digit shapes are left to Intl.
 */
function formatKm(t: Translator, km: number): string {
  const digits = km >= 100 ? 0 : 1;
  const rounded = digits === 0 ? Math.round(km) : Math.round(km * 10) / 10;
  return t.num(rounded, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

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
  const t = useTranslator();
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

  const km = formatKm(t, distanceKm);
  const label = t('play.a11y.bearing', { distance: km, compass });

  /* Safe-area insets are physical — a notch stays on the side of the device it is on,
     whichever way the type runs — so the logical edge has to pick the matching one. */
  const insetEnd = t.dir === 'rtl' ? 'var(--inset-l)' : 'var(--inset-r)';

  return (
    <div
      className="pointer-events-none fixed z-30"
      style={{
        insetInlineEnd: `calc(${insetEnd} + 0.75rem)`,
        bottom: 'calc(var(--inset-b) + 0.75rem)',
      }}
      /* The readout changes on every guess and is the primary feedback, so it is worth
         announcing. The child carries the spoken wording; this wrapper only fires. */
      aria-live="polite"
    >
      <div role="img" aria-label={label} className="sheet flex items-center gap-2.5 px-3 py-2">
        {/* Geography, not layout: the instrument is held left-to-right so neither the rose
            nor the needle can be mirrored by the interface around them. */}
        <span dir="ltr" className="relative block h-9 w-9 shrink-0">
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
              for SVG children is uneven, while HTML transform-origin: 50% 50% is not.
              The angle is a real-world bearing and is used exactly as measured — never
              negated, whatever direction the interface runs in. */}
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

        <div className="border-s border-rule-soft ps-2.5 leading-tight">
          <p className="font-mono tabular text-lg text-ink">
            {km}
            <span className="label ms-1">{t('play.km')}</span>
          </p>
          {/* The compass point arrives as a Latin abbreviation the data never localises,
              so it is isolated from the surrounding run. */}
          <p className="label mt-1.5 border-t border-rule-soft pt-1.5 text-ink">
            <bdi>{compass}</bdi>
          </p>
        </div>
      </div>
    </div>
  );
}
