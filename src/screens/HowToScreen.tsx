/**
 * The rules, set as the explanatory page of a manual: a plate title over a double rule,
 * section heads as engraved labels, and one boxed legend for the only thing on the page
 * that colour actually explains.
 *
 * The one thing this page has to land is that a guess draws a *ring*, not a hot-or-cold
 * blob: the distance readout says the answer is exactly that far away, and the inked band
 * is every place that could be true of. Players who read it as "warmer/colder" will
 * wonder why the ink is nowhere near their guess, so the ring has to be named early and
 * the intersection idea stated plainly.
 *
 * Direction: everything on this page is prose and mirrors with it. The one judgement
 * call is the colour ramp, and it is argued at `useRampGradient`.
 */

import { useMemo, type ReactNode } from 'react';
import { ArrowLeft, Compass, Flag, Globe, Landmark, Radar } from 'lucide-react';

import { useTranslator } from '@/i18n';
import { rampColor } from '@/lib/ramp';
import { useUiStore } from '@/store/uiStore';

/**
 * Display type withholds its engraving from a right-to-left run: `uppercase` is a no-op
 * on Arabic and letterspacing severs the cursive joins, leaving the word in pieces.
 */
function engraved(dir: 'ltr' | 'rtl', tracking: string): string {
  return dir === 'rtl' ? '' : `uppercase ${tracking}`;
}

/**
 * The ramp as a CSS gradient — the only gradient in the app, and the only place one is
 * warranted, because here it is the subject rather than decoration.
 *
 * Sampled at eleven points rather than handed the three stops directly: ramp.ts
 * interpolates in linear light, CSS gradients interpolate in gamma-encoded sRGB, and the
 * two disagree visibly through the brass midpoint. Sampling reproduces the real ramp
 * closely enough that the legend matches the map.
 *
 * The gradient *does* reverse in Arabic, and that is the opposite decision from the map
 * for a reason. The map is a picture of the world, where left and right are facts. This
 * bar is a scale: it has no geography in it, it is read rather than looked at, and its
 * two ends are labelled by `justify-between`, which puts "off the ring" at the start
 * margin and "on every ring" at the end margin. If the ink kept running left-to-right
 * while the labels mirrored, the legend would describe itself backwards — pale ink under
 * the word for saturated. So the ink runs the way the eye does.
 */
function useRampGradient(dir: 'ltr' | 'rtl'): string {
  return useMemo(() => {
    const steps = 10;
    const stops: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const fraction = i / steps;
      stops.push(`${rampColor(fraction)} ${Math.round(fraction * 100)}%`);
    }
    return `linear-gradient(${dir === 'rtl' ? 'to left' : 'to right'}, ${stops.join(', ')})`;
  }, [dir]);
}

export function HowToScreen(): JSX.Element {
  const t = useTranslator();
  const setScreen = useUiStore((s) => s.setScreen);
  const gradient = useRampGradient(t.dir);

  return (
    <main
      className="h-full overflow-y-auto overflow-x-hidden bg-paper"
      /* Physical on purpose: a notch stays where it is when the interface mirrors, so
         the safe-area insets are matched to the edges they actually describe. */
      style={{
        padding:
          'calc(var(--inset-t) + 1rem) calc(var(--inset-r) + 1.25rem)' +
          ' calc(var(--inset-b) + 2rem) calc(var(--inset-l) + 1.25rem)',
      }}
    >
      <div className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={() => setScreen('menu')}
          aria-label={t('play.back')}
          /* `py-3 -mb-3` keeps the 44 px tap target the icon control used to have while
             the rule stays where a printed cross-reference would put it. */
          className="action -mb-3 inline-flex items-center gap-2 py-3 text-sm"
        >
          {/* Directional: an arrow meaning "back" points at the start margin, which is
              the right-hand one in Arabic. */}
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} className="rtl:-scale-x-100" />
          {t('common.back')}
        </button>

        <header className="mt-8 text-center">
          <h1
            className={`font-display text-xl leading-none text-ink sm:text-2xl ${engraved(
              t.dir,
              'tracking-[0.2em]',
            )}`}
          >
            {t('howto.title')}
          </h1>
          <div aria-hidden="true" className="rule-double mt-4" />
        </header>

        <p className="mt-6 text-sm leading-relaxed text-graphite">{t('howto.intro')}</p>

        <Section title={t('howto.modes')}>
          <ul className="space-y-3">
            <Mode icon={<Globe size={18} strokeWidth={1.5} />} name={t('menu.mode.country')}>
              {t('howto.modeCountry')}
            </Mode>
            <Mode icon={<Landmark size={18} strokeWidth={1.5} />} name={t('menu.mode.capital')}>
              {t('howto.modeCapital')}
            </Mode>
            <Mode icon={<Flag size={18} strokeWidth={1.5} />} name={t('menu.mode.flag')}>
              {t('howto.modeFlag')}
            </Mode>
          </ul>
          <p className="mt-3 text-sm text-graphite">{t('howto.modesNote')}</p>
        </Section>

        <Section title={t('howto.signals')}>
          <div className="flex gap-3">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-brass">
              <Radar size={18} strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h3
                className={`font-display text-sm text-ink ${engraved(t.dir, 'tracking-[0.14em]')}`}
              >
                {t('howto.ringTitle')}
              </h3>
              {/* Each paragraph is one key. The word "ring" used to be set in ink inside
                  the sentence, but emphasis that has to be positioned inside a translated
                  string cannot survive re-ordering — the sentence is the unit now. */}
              <p className="mt-2 text-sm leading-relaxed text-graphite">{t('howto.ringBody')}</p>
              <p className="mt-2 text-sm leading-relaxed text-graphite">{t('howto.ringBody2')}</p>
            </div>
          </div>

          <div className="mt-5">
            {/* Boxed and ruled, the way a chart's key is: it is a legend, not a divider. */}
            <div className="border border-rule bg-plate p-3">
              <div
                aria-hidden="true"
                className="h-3 w-full border border-rule"
                style={{ backgroundImage: gradient }}
              />
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <span className="label">{t('howto.rampOff')}</span>
                <span className="label text-oxblood">{t('howto.rampOn')}</span>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-graphite">{t('howto.rampNote')}</p>
          </div>

          <div className="mt-6 flex gap-3">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-brass">
              <Compass size={18} strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h3
                className={`font-display text-sm text-ink ${engraved(t.dir, 'tracking-[0.14em]')}`}
              >
                {t('howto.arrowTitle')}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite">{t('howto.arrowBody')}</p>
            </div>
          </div>
        </Section>

        <Section title={t('howto.dailyTitle')}>
          <p className="text-sm leading-relaxed text-graphite">{t('howto.dailyBody')}</p>
          <p className="mt-3 text-sm leading-relaxed text-graphite">{t('howto.practiceBody')}</p>
          <p className="mt-3 text-sm leading-relaxed text-graphite">{t('howto.scopeBody')}</p>
        </Section>

        <Section title={t('howto.keyboard')}>
          <dl className="border-t border-rule text-sm">
            <Shortcut keys="Tab">{t('howto.keyTab')}</Shortcut>
            <Shortcut keys="Enter / Space">{t('howto.keyEnter')}</Shortcut>
            <Shortcut keys="Esc">{t('howto.keyEscape')}</Shortcut>
            <Shortcut keys="?">{t('howto.keyHelp')}</Shortcut>
          </dl>
        </Section>

        <footer className="mt-10 border-t border-rule pt-5 text-xs leading-relaxed text-graphite">
          <p>{t('howto.credits')}</p>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="label border-b border-rule pb-2">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Mode({ icon, name, children }: { icon: ReactNode; name: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-brass">
        {icon}
      </span>
      <p className="min-w-0 text-sm leading-relaxed text-graphite">
        {/* A glossary entry, not a sentence built from parts: the stop belongs to the
            term and stays inside its run, so it cannot drift to the far margin. */}
        <span className="text-ink">{name}.</span> {children}
      </p>
    </li>
  );
}

/** A ruled row per shortcut; the key itself is set as a printed keycap. */
function Shortcut({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule py-2.5">
      <dt className="shrink-0 rounded-sheet border border-rule bg-leaf px-1.5 py-0.5 font-mono text-xs text-ink">
        {/* Key names are printed on the hardware in Latin and are not translated, so in
            an Arabic run they are an embedded left-to-right island — isolated, or the
            bidi algorithm reorders "Enter / Space" around the slash. */}
        <bdi>{keys}</bdi>
      </dt>
      <dd className="text-graphite">{children}</dd>
    </div>
  );
}
