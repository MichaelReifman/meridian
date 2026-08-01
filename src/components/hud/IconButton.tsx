/**
 * The one button shape in the game: a square icon control with a real accessible name.
 *
 * Icons are passed in as children (lucide-react) and are always decorative — the name
 * comes from `label`, which also becomes the pointer tooltip.
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
  tone?: 'default' | 'gold';
}) {
  const toneClasses =
    tone === 'gold'
      ? 'text-gold hover:shadow-gold-glow hover:bg-gold/10'
      : 'text-parchment/85 hover:text-parchment hover:bg-parchment/10';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      /* 44px square: the minimum comfortable touch target, and it keeps every corner
         control on the same grid regardless of which icon is inside. */
      className={`hud-panel pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 ease-swift active:scale-95 ${toneClasses}`}
    >
      {/* The icon never contributes to the accessible name; `label` is the whole name. */}
      <span aria-hidden="true" className="flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}
