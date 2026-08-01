/**
 * The clue, floating at top centre over the edge-to-edge map (PRD §9 Layout).
 *
 * Set as the headline of a printed card: an engraved label naming the task, a rule, then
 * the subject in display caps. Three modes, one card — Country and Capital show text,
 * Flag shows the image and *never* the country name, since printing the name in Flag mode
 * would give the answer away.
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
        className="sheet animate-rise-in flex max-w-[min(92vw,30rem)] flex-col items-center gap-2.5 px-6 py-3"
      >
        {/* The rule under the label is what separates the two type sizes — a printed card
            would not reach for a weight change or a tint to do that. */}
        <p className="label w-full border-b border-rule-soft pb-2 text-center">
          {MODE_LABEL[mode]}
        </p>

        {isFlag && flagSrc ? (
          /* Fixed box height (112px wide at the common 4:3 flag ratio) so the card does
             not resize under the fonts when a differently-proportioned flag decodes. */
          <span className="flex min-h-[5.25rem] items-center justify-center">
            {/* A tipped-in plate: hairline frame, a hair of paper showing as the mount. */}
            <span className="border border-rule bg-paper p-1">
              <img
                src={flagSrc}
                alt=""
                width={112}
                className="block h-auto w-28"
                loading="eager"
                decoding="async"
                /* Native image drag would start a ghost drag instead of panning the map. */
                draggable={false}
              />
            </span>
          </span>
        ) : (
          <p className="text-balance text-center font-display text-xl uppercase leading-snug tracking-[0.14em] text-ink sm:text-2xl">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
