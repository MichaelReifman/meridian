/**
 * The reveal without WebGL (PRD §5).
 *
 * Rendered when a GL context cannot be created, and also when anything inside the
 * globe's canvas throws. Deliberately not an apology: where the globe is a plate that
 * moves, this is the same plate standing still — flag mounted inside a hairline frame,
 * the name engraved beneath it, the particulars ruled off in a table. Same paper, same
 * typography, same information. The game must never dead-end on a device that cannot
 * run three.js.
 *
 * Three of the particulars — the capital, the region and the alpha-3 code — are Latin
 * script the source never translates, so each is isolated with `<bdi>`: inside an
 * Arabic run the bidi algorithm would otherwise drag the surrounding punctuation and
 * separators through them.
 */

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslator } from '@/i18n';
import type { TranslationKey } from '@/i18n/en';
import { flagUrl } from '@/lib/paths';
import type { GlobeRevealProps } from './GlobeReveal';

/**
 * How many of the most recent guesses the path strip prints before it elides.
 * A 30-guess round would otherwise push the button below the fold on a phone.
 */
const PATH_LIMIT = 6;

const SAFE_PADDING =
  'calc(var(--inset-t) + 1rem) calc(var(--inset-r) + 1rem)' +
  ' calc(var(--inset-b) + 1rem) calc(var(--inset-l) + 1rem)';

/** A flag that 404s should leave the layout alone rather than show a broken icon. */
function hideBrokenFlag(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

/** Which of the three outcome sentences this round earns. */
function outcomeKey(solved: boolean, guessCount: number): TranslationKey {
  if (guessCount === 0) return 'reveal.revealed';
  return solved ? 'reveal.solvedIn' : 'reveal.revealedAfter';
}

/**
 * The outcome, set as an engraved caption.
 *
 * The same words the dialog's accessible name uses, with the numeral lifted into mono
 * tabular figures — a printed sheet changes face for a count rather than running it into
 * the sentence. The sentence itself is never assembled from pieces: it arrives as one
 * translated string and the `{count}` placeholder is filled with a node instead of with
 * text, so the count lands wherever the language puts it.
 */
function OutcomeLine({ template, count }: { template: string; count: string }): JSX.Element {
  const parts = template.split('{count}');
  if (parts.length !== 2) return <>{template}</>;
  return (
    <>
      {parts[0]}
      <span className="tabular font-mono text-ink">{count}</span>
      {parts[1]}
    </>
  );
}

/**
 * `children` is the shell's slot for Share / Next. It sits ahead of the primary
 * action in the same row so the tab order runs with the text across the actions.
 */
export function RevealFallback({
  target,
  guessPath,
  solved,
  guessCount,
  onDone,
  children,
}: GlobeRevealProps & { readonly children?: ReactNode }): JSX.Element {
  const t = useTranslator();
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const sentence = outcomeKey(solved, guessCount);
  const countText = t.num(guessCount);
  const outcome = t(sentence, { count: countText });
  const name = t.country(target);
  const place = target.subregion || target.region;
  const summary = `${name}. ${outcome}. ${t('reveal.capital')}: ${
    target.capital ?? t('common.none')
  }. ${t('reveal.region')}: ${place}.`;

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // The live region has to be empty when it is inserted: screen readers announce
  // *changes*, and text already present at insertion time is commonly skipped.
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnnouncement(summary));
    return () => cancelAnimationFrame(id);
  }, [summary]);

  // The reveal covers the map, so it behaves as a modal: Escape dismisses and Tab
  // stays inside the card. Without the wrap the next Tab lands on the map beneath,
  // which is still rendered and still focusable.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDone();
        return;
      }
      if (event.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const stops = card.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const outside = !card.contains(active);
      if (event.shiftKey ? active === first || outside : active === last || outside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const shown = guessPath.slice(-PATH_LIMIT);
  /* A sequence arrow, not a bearing: it points the way the strip reads, so it turns
     round when the interface does. */
  const step = t.dir === 'rtl' ? ' ← ' : ' → ';
  const fullPath = guessPath.map((c) => t.country(c)).join(step);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — ${outcome}`}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-paper"
      /* Physical on purpose: one safe-area inset per page edge, and a notch does not
         move when the type changes direction. */
      style={{ padding: SAFE_PADDING }}
    >
      {/* Announced the moment the round ends, independently of the visual card. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div ref={cardRef} className="sheet animate-rise-in relative w-full max-w-md p-6 sm:p-8">
        {/* The flag as the plate: mounted on a margin of paper inside a hairline frame,
            centred over its caption. The frame lives on the image itself so a flag that
            404s takes the whole mount with it rather than leaving an empty box. */}
        <img
          src={flagUrl(target.cca2)}
          alt=""
          onError={hideBrokenFlag}
          decoding="async"
          className="mx-auto h-20 w-auto border border-rule bg-paper p-1.5 shadow-sheet"
        />

        <p className="label mt-6 text-center text-oxblood">
          <OutcomeLine template={t(sentence)} count={countText} />
        </p>
        {/* Wraps rather than truncates: letterspaced capitals run wide, and a clipped
            country name is the one thing the reveal cannot afford to do. Both are
            dropped in Arabic, where `uppercase` is inert and tracking severs the
            joining forms. */}
        <h2 className="mt-2 text-balance text-center font-display text-2xl uppercase leading-tight tracking-[0.14em] text-ink rtl:tracking-normal rtl:normal-case">
          {name}
        </h2>

        <div aria-hidden="true" className="rule-double mt-6" />

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          <div className="min-w-0">
            <dt className="label">{t('reveal.capital')}</dt>
            <dd className="mt-2 truncate text-sm text-ink">
              {target.capital ? <bdi>{target.capital}</bdi> : t('common.none')}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="label">{t('reveal.region')}</dt>
            <dd className="mt-2 truncate text-sm text-ink">
              <bdi>{place}</bdi>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="label">{t('reveal.guesses')}</dt>
            <dd className="tabular mt-2 font-mono text-sm text-oxblood">{countText}</dd>
          </div>
          <div className="min-w-0">
            <dt className="label">{t('reveal.code')}</dt>
            <dd className="tabular mt-2 font-mono text-sm text-ink">
              <bdi>{target.cca3}</bdi>
            </dd>
          </div>
        </dl>

        {guessPath.length > 0 && (
          <p className="mt-6 truncate border-t border-rule-soft pt-4 text-xs text-graphite" title={fullPath}>
            <span className="sr-only">{t('reveal.yourGuesses')}</span>
            {guessPath.length > shown.length ? `…${step}` : ''}
            {shown.map((country, i) => (
              <Fragment key={`${country.id}:${i}`}>
                {i > 0 && step}
                <bdi>{t.country(country)}</bdi>
              </Fragment>
            ))}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-end gap-5">
          {children}
          <button
            ref={primaryRef}
            type="button"
            onClick={onDone}
            className="ease-swift -my-2 inline-flex items-center gap-2 border-b border-oxblood/60 py-2 text-sm font-medium text-oxblood transition-colors duration-150 hover:border-oxblood"
          >
            {t('reveal.continue')}
            {/* An arrow of travel, not a bearing: it points the way the interface reads,
                so it reverses in a right-to-left language. */}
            <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
