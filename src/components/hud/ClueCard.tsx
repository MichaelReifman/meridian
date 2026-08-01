/**
 * The clue, floating at top centre over the edge-to-edge map (PRD §9 Layout).
 *
 * Set as the headline of a printed card: an engraved label naming the task, a rule, then
 * the subject in display caps. Three modes, one card — Country and Capital show text,
 * Flag shows the image and *never* the country name, since printing the name in Flag mode
 * would give the answer away.
 */

import { useTranslator } from '@/i18n';
import type { TranslationKey } from '@/i18n/en';
import type { GameMode } from '@/types/game';

/**
 * The label is not decoration. In Flag mode the image carries `alt=""`, so this line
 * is the only thing announcing what the picture is — it has to say "flag" in words.
 */
const MODE_LABEL: Record<GameMode, TranslationKey> = {
  country: 'play.findCountry',
  capital: 'play.findCapital',
  flag: 'play.findFlag',
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
  const t = useTranslator();
  const isFlag = mode === 'flag';

  return (
    /**
     * Deliberately unpositioned, like GuessCounter.
     *
     * This used to pin itself across the viewport and reserve room for the corner
     * controls with its own inline padding — which is a guess about how wide those
     * controls are, and therefore a guess that a longer translated label invalidates.
     * PlayScreen now flows the whole top band as one flex row, so this only has to say
     * how wide it would like to be and let the row settle the rest.
     */
    <div
      /* Re-keying on the clue replays the entrance animation when the puzzle changes. */
      key={`${mode}:${text}`}
      className="sheet animate-rise-in flex min-w-0 max-w-[30rem] flex-col items-center gap-2.5 px-4 py-3 sm:px-6"
    >
      {/* The rule under the label is what separates the two type sizes — a printed card
          would not reach for a weight change or a tint to do that. */}
      <p className="label w-full border-b border-rule-soft pb-2 text-center">
        {t(MODE_LABEL[mode])}
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
        /* Fraunces carries no Arabic, and Arabic takes neither capitals nor
           letterspacing: `uppercase` is inert there while tracking severs the joining
           forms outright, so both are dropped when the page runs right to left. */
        <p className="text-balance text-center font-display text-xl uppercase leading-snug tracking-[0.14em] text-ink rtl:tracking-normal rtl:normal-case sm:text-2xl">
          {/* In Capital mode the clue is a Latin-script city name the source never
              translates; isolated so an RTL run cannot reorder it against the card. */}
          <bdi>{text}</bdi>
        </p>
      )}
    </div>
  );
}
