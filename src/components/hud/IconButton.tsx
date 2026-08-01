/**
 * The one button shape in the game: a square, hairline-ruled key sitting on the chart,
 * with a real accessible name.
 *
 * Icons are passed in as children (lucide-react) and are always decorative — the name
 * comes from `label`, which also becomes the pointer tooltip.
 *
 * The key itself is a square and mirrors for free. Flipping the glyph is deliberately
 * *not* done here: only the caller knows whether its icon means a direction of travel
 * (which reverses in a right-to-left interface) or a bearing, a flag or a globe (which
 * never do), so `rtl:-scale-x-100` belongs on the icon that is passed in.
 */

import type { ReactNode } from 'react';

export function IconButton({
  label,
  onClick,
  children,
  tone = 'default',
}: {
  label: string;
  onClick(): void;
  children: ReactNode;
  /* The tone names are the caller's contract and are left alone; what changed is what
     they paint — 'gold' is now the oxblood key reserved for the round's own result. */
  tone?: 'default' | 'gold';
}) {
  const toneClasses =
    tone === 'gold'
      ? 'text-oxblood hover:border-oxblood hover:bg-oxblood/5'
      : 'text-ink hover:border-ink/45 hover:bg-ink/5';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      /* 44px square: the minimum comfortable touch target, and it keeps every corner
         control on the same grid regardless of which icon is inside. Pressing it sinks
         the key into the page rather than shrinking it — paper has no bounce. */
      className={`sheet ease-swift pointer-events-auto flex h-11 w-11 items-center justify-center transition-colors duration-200 active:shadow-pressed ${toneClasses}`}
    >
      {/* The icon never contributes to the accessible name; `label` is the whole name. */}
      <span aria-hidden="true" className="flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}
