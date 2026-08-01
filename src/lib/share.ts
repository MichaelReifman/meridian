/**
 * The Wordle-style shareable result (PRD §6).
 *
 * The hard constraint is that a shared result must be *readable by someone who has
 * not played yet*. Nothing here may name the country, its capital, its flag or its
 * centroid — see `buildShareText` for the spoiler audit.
 */

import { guessProximityPct } from '@/lib/geo';
import { asset } from '@/lib/paths';
import type { GameMode, RoundState } from '@/types/game';

/**
 * Where a shared result points people.
 *
 * Resolved from the running origin rather than a hard-coded domain, so the same build
 * links correctly from a preview deploy, a custom domain or a LAN dev host. It must
 * include the deployment base: the app is served from a subdirectory on GitHub Pages,
 * and origin alone would send every recipient to the parent site instead of the game.
 */
const CANONICAL_URL = 'https://michaelreifman.github.io/meridian/';

export const SHARE_URL: string =
  typeof window !== 'undefined' && window.location.protocol.startsWith('http')
    ? `${window.location.origin}${asset('')}`
    : CANONICAL_URL;

const MODE_LABEL: Readonly<Record<GameMode, string>> = {
  country: 'Country',
  capital: 'Capital',
  flag: 'Flag',
};

/** Width of the proximity trail, in block characters. */
const BAR_CELLS = 10;
const FILLED = '█';
const EMPTY = '░';

/** The gold pin from the reveal, in text form. Only ever printed on a solve. */
const TARGET_MARKER = '🟡';

/** Guesses are unlimited, so the score reads `n/∞` rather than Wordle's `n/6`. */
const UNLIMITED = '∞';

/**
 * One row of the trail: a filled bar whose length encodes how close that guess was.
 *
 * The full bar is reserved for an exact solve. Rounding instead of flooring would
 * hand a 97%-close near-miss the same ten blocks as the answer, which reads as a
 * win that never happened.
 */
function proximityBar(pct: number): string {
  const clamped = pct < 0 ? 0 : pct > 100 ? 100 : pct;
  const filled =
    clamped >= 100
      ? BAR_CELLS
      : Math.min(BAR_CELLS - 1, Math.floor((clamped / 100) * BAR_CELLS));
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_CELLS - filled);
}

/**
 * The shareable summary of a round: mode, day, score and a proximity trail.
 *
 * Spoiler audit — of everything a `Guess` carries, only `distanceKm` is used, and
 * only after `guessProximityPct` has bucketed it to a whole percent (~200 km of
 * resolution). `countryId` and `bearingDeg` are deliberately never emitted: a
 * distance published alongside its bearing would let a reader triangulate the answer
 * from a single row, which is precisely the leak this format has to avoid.
 */
export function buildShareText(round: RoundState): string {
  const { puzzle, guesses, status } = round;

  const when = puzzle.kind === 'daily' ? puzzle.dateKey : 'Practice';
  const score = status === 'revealed' ? 'X' : String(guesses.length);

  const trail = guesses.map((g) => {
    const pct = guessProximityPct(g.distanceKm);
    const solved = g.correct && status === 'solved';
    // Right-align the percentage so the bars and numbers stay in two clean columns
    // even in the proportional fonts most chat apps render shared text in.
    const readout = `${String(pct).padStart(3, ' ')}%`;
    return `${proximityBar(pct)} ${readout}${solved ? ` ${TARGET_MARKER}` : ''}`;
  });

  const lines: string[] = [
    `Meridian · ${MODE_LABEL[puzzle.mode]} · ${when}`,
    `${score}/${UNLIMITED}`,
  ];
  if (trail.length > 0) lines.push('', ...trail);
  lines.push('', SHARE_URL);

  return lines.join('\n');
}

/** True for the rejection the Web Share API raises when the user dismisses the sheet. */
function isAbort(err: unknown): boolean {
  // Not `err instanceof DOMException`: Safari has historically rejected with a
  // plain Error, and DOMException is not defined in every environment this module
  // may be evaluated in. The `name` is the part every implementation agrees on.
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

/**
 * Copy fallback for browsers without the async clipboard — chiefly iOS Safari
 * before 13.4, and any browser on an insecure origin, where `navigator.clipboard`
 * is simply absent.
 */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;

  const restoreFocus = document.activeElement;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('aria-hidden', 'true');
  ta.setAttribute('tabindex', '-1');
  // The element has to be rendered and non-zero-sized for iOS to allow a selection,
  // so it cannot be `display: none` or `width: 0`. Fixed-positioning it at 1×1 with
  // zero opacity keeps it invisible without scrolling the page or shifting layout.
  ta.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);

  let ok = false;
  try {
    ta.focus({ preventScroll: true });
    ta.select();
    // iOS Safari ignores select() on its own; an explicit range is what actually
    // takes there, and it is harmless everywhere else.
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    ta.remove();
    // Hand the keyboard back to whatever the player was on — losing focus to a
    // removed node would strand keyboard navigation at the top of the document.
    if (restoreFocus instanceof HTMLElement) restoreFocus.focus({ preventScroll: true });
  }
  return ok;
}

/**
 * Share the result, degrading through every mechanism the browser offers.
 *
 * `"shared"` also covers a dismissed share sheet: the player was given the choice
 * and declined it, so quietly copying to their clipboard instead would be both a
 * surprise and a lie in the UI.
 */
export async function shareResult(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      if (isAbort(err)) return 'shared';
      // Anything else — NotAllowedError outside a user gesture, an unsupported
      // payload — is a real failure of this path, so fall through and copy.
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Denied permission or a non-focused document; the legacy path still works.
    }
  }

  return legacyCopy(text) ? 'copied' : 'failed';
}
