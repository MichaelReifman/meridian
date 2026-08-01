/**
 * The clue, floating at top centre over the edge-to-edge map (PRD §9 Layout).
 *
 * Three modes, one card: Country and Capital show text, Flag shows the image and
 * *never* the country name — printing the name in Flag mode would give the answer away.
 */

import type { GameMode } from '@/types/game';

/**
 * The label is not decoration. In Flag mode the image carries `alt=""`, so this line
 * is the only thing announcing what the picture is — it has to say "flag" in words.
 */
const MODE_LABEL: Record<GameMode, string> = {
  country: 'Find this country',
  capital: 'Find this capital',
  flag: 'Find this flag',
};

export function ClueCard({
  mode,
  text,
  flagSrc,
}: {
  mode: GameMode;
  text: string;
  flagSrc?: string;
}) {
  const isFlag = mode === 'flag';

  return (
    <div
      /* Purely informational, so it must not swallow drags aimed at the map beneath. */
      className="pointer-events-none fixed left-1/2 z-30 -translate-x-1/2"
      style={{ top: 'calc(var(--inset-t) + 0.75rem)' }}
    >
      <div
        /* Re-keying on the clue replays the entrance animation when the puzzle changes. */
        key={`${mode}:${text}`}
        className="hud-panel animate-rise-in flex max-w-[min(92vw,30rem)] flex-col items-center gap-2 rounded-2xl px-5 py-3"
      >
        <p className="text-hud font-sans uppercase text-cyan/85">{MODE_LABEL[mode]}</p>

        {isFlag && flagSrc ? (
          /* Fixed box height (112px wide at the common 4:3 flag ratio) so the card does
             not resize under the fonts when a differently-proportioned flag decodes. */
          <span className="flex min-h-[5.25rem] items-center justify-center">
            <img
              src={flagSrc}
              alt=""
              width={112}
              className="h-auto w-28 rounded-md shadow-hud ring-1 ring-hairline"
              loading="eager"
              decoding="async"
              /* Native image drag would start a ghost drag instead of panning the map. */
              draggable={false}
            />
          </span>
        ) : (
          <p className="text-balance text-center font-display text-2xl leading-tight text-parchment sm:text-3xl">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
