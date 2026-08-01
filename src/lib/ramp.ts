/**
 * The heatmap colour ramp, shared by the SVG map and the WebGL globe.
 *
 * Stops are read once from the CSS custom properties in src/theme/tokens.css so the
 * palette has exactly one source of truth: changing --ramp-* there changes both
 * renderers. Interpolation happens in linear-light sRGB rather than gamma-encoded
 * sRGB, which keeps the violet→cyan and cyan→gold transitions from dipping muddy
 * through their midpoints.
 */

import type { RampStop } from '@/types/game';

const HEX6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
/** CSS Color 4 allows both `rgb(11 14 26)` and legacy `rgb(11, 14, 26)`, with optional alpha. */
const RGB_FN = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*(?:[,/].*)?\)$/i;

/**
 * Parse any of the colour forms our tokens can take into 0..255 channels.
 *
 * It has to handle `rgb()` as well as hex because the palette tokens are stored as
 * channel triples for Tailwind's sake and composed back with `rgb(var(--x-rgb))` —
 * so `getComputedStyle` hands back `rgb(11 14 26)`, not `#0b0e1a`. A hex-only parser
 * silently turns the entire globe magenta.
 */
export function parseCssColor(value: string): [number, number, number] {
  const v = value.trim();

  const fn = RGB_FN.exec(v);
  if (fn) {
    return [
      Math.round(Math.min(255, Math.max(0, Number(fn[1])))),
      Math.round(Math.min(255, Math.max(0, Number(fn[2])))),
      Math.round(Math.min(255, Math.max(0, Number(fn[3])))),
    ];
  }

  const six = HEX6.exec(v);
  if (six) return [parseInt(six[1], 16), parseInt(six[2], 16), parseInt(six[3], 16)];

  const three = HEX3.exec(v);
  if (three) {
    return [
      parseInt(three[1] + three[1], 16),
      parseInt(three[2] + three[2], 16),
      parseInt(three[3] + three[3], 16),
    ];
  }

  return [255, 0, 255]; // loud magenta — a missing or unparseable token should be obvious
}

/** Normalise any supported colour form to `#rrggbb`, which three.js always accepts. */
export function toHexColor(value: string): string {
  const [r, g, b] = parseCssColor(value);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const srgbToLinear = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (c: number): number => {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

let cachedStops: RampStop[] | null = null;

/** Ramp stops in document order, resolved from CSS variables on first use. */
export function rampStops(): RampStop[] {
  if (cachedStops) return cachedStops;
  const fallbacks = ['#7b6cf6', '#4fd1c5', '#e8b34d'];
  const read = (name: string, fallback: string): string => {
    if (typeof getComputedStyle !== 'function') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v.trim() || fallback;
  };
  cachedStops = fallbacks.map((fallback, i) => ({
    at: i / (fallbacks.length - 1),
    rgb: parseCssColor(read(`--ramp-${i}`, fallback)),
  }));
  return cachedStops;
}

/**
 * Sample the ramp at t ∈ [0, 1]. Returns an `rgb()` string ready for `fill`.
 *
 * `t` here is the *shaped* proximity from geo.shapeProximity, not the raw linear
 * value — the shaping is applied by the caller so the globe can reuse identical
 * numbers when it tints its own surface.
 */
export function rampColor(t: number): string {
  const [r, g, b] = rampRgb(t);
  return `rgb(${r} ${g} ${b})`;
}

/** As rampColor, but returns the raw channel triple for three.js consumers. */
export function rampRgb(t: number): [number, number, number] {
  const stops = rampStops();
  const x = t < 0 ? 0 : t > 1 ? 1 : t;

  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (x >= stops[i].at && x <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }

  const span = hi.at - lo.at;
  const f = span === 0 ? 0 : (x - lo.at) / span;

  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = srgbToLinear(lo.rgb[c]);
    const b = srgbToLinear(hi.rgb[c]);
    out[c] = linearToSrgb(a + (b - a) * f);
  }
  return out;
}

/** Reset the memoised stops. Only needed by tests that swap the tokens. */
export function _resetRampCache(): void {
  cachedStops = null;
}
