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
 */

import { useMemo, type ReactNode } from 'react';
import { ArrowLeft, Compass, Flag, Globe, Landmark, Radar } from 'lucide-react';

import { rampColor } from '@/lib/ramp';
import { useUiStore } from '@/store/uiStore';

/**
 * The ramp as a CSS gradient — the only gradient in the app, and the only place one is
 * warranted, because here it is the subject rather than decoration.
 *
 * Sampled at eleven points rather than handed the three stops directly: ramp.ts
 * interpolates in linear light, CSS gradients interpolate in gamma-encoded sRGB, and the
 * two disagree visibly through the brass midpoint. Sampling reproduces the real ramp
 * closely enough that the legend matches the map.
 */
function useRampGradient(): string {
  return useMemo(() => {
    const steps = 10;
    const stops: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      stops.push(`${rampColor(t)} ${Math.round(t * 100)}%`);
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, []);
}

export function HowToScreen(): JSX.Element {
  const setScreen = useUiStore((s) => s.setScreen);
  const gradient = useRampGradient();

  return (
    <main
      className="h-full overflow-y-auto overflow-x-hidden bg-paper"
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
          aria-label="Back to menu"
          /* `py-3 -mb-3` keeps the 44 px tap target the icon control used to have while
             the rule stays where a printed cross-reference would put it. */
          className="action -mb-3 inline-flex items-center gap-2 py-3 text-sm"
        >
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
          Back
        </button>

        <header className="mt-8 text-center">
          <h1 className="font-display text-xl uppercase leading-none tracking-[0.2em] text-ink sm:text-2xl">
            How to play
          </h1>
          <div aria-hidden="true" className="rule-double mt-4" />
        </header>

        <p className="mt-6 text-sm leading-relaxed text-graphite">
          You are shown a clue. Click the country you think it points to. Guesses are
          unlimited — your score is how many it took, so fewer is better. You can give up
          at any time and the answer will be revealed. Distances are in kilometres.
        </p>

        <Section title="The three modes">
          <ul className="space-y-3">
            <Mode icon={<Globe size={18} strokeWidth={1.5} />} name="Country">
              The clue is the country&rsquo;s name.
            </Mode>
            <Mode icon={<Landmark size={18} strokeWidth={1.5} />} name="Capital">
              The clue is a capital city. Find the country it belongs to.
            </Mode>
            <Mode icon={<Flag size={18} strokeWidth={1.5} />} name="Flag">
              The clue is a flag. Find where it flies.
            </Mode>
          </ul>
          <p className="mt-3 text-sm text-graphite">
            Modes are never mixed inside a round, and each keeps its own daily streak.
          </p>
        </Section>

        <Section title="Every wrong guess tells you two things">
          <div className="flex gap-3">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-brass">
              <Radar size={18} strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-sm uppercase tracking-[0.14em] text-ink">
                A ring you can cross-reference
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite">
                Your guess comes back with a distance, and that distance is exact — so the
                answer lies somewhere on a <em className="not-italic text-ink">ring</em> that
                far from the country you clicked. The map inks that ring in, right around the
                world. One guess narrows things enormously and still gives nothing away.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-graphite">
                Guess again somewhere else and a second ring appears. Only the places that
                satisfy <em className="not-italic text-ink">both</em> stay inked — usually a
                shortlist. A third normally pins it. You are triangulating, the way you would
                fix a position from two landmarks.
              </p>
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
                <span className="label">Off the ring</span>
                <span className="label text-oxblood">On every ring</span>
              </div>
            </div>
            <p className="sr-only">
              Colour ramp: pale straw where a country only just satisfies your distances,
              through brass, to deep oxblood where it satisfies all of them.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-graphite">
              The bands are deliberately coarse, and they get narrower as your guesses get
              closer. Nothing is tinted before your first guess.
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-brass">
              <Compass size={18} strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-sm uppercase tracking-[0.14em] text-ink">
                An arrow and a distance
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite">
                A compass arrow and a live kilometre readout point from your last guess toward
                the answer. It carries the same information as the colour, in words and
                numbers — nothing in Meridian is ever conveyed by colour alone.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Daily and Practice">
          <p className="text-sm leading-relaxed text-graphite">
            The <span className="text-ink">Daily Challenge</span> is one puzzle per mode per
            day, identical for everyone and generated from the date alone — there is no
            server. Solve it and the streak for that mode grows; miss a day and it resets. The
            day rolls over at your own local midnight.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-graphite">
            <span className="text-ink">Practice</span> deals unlimited random puzzles. It
            keeps its own lifetime counters and never touches a daily streak.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-graphite">
            The answer is always one of the 195 sovereign states. Territories and disputed
            areas are drawn as inert land: never clickable, never the answer.
          </p>
        </Section>

        <Section title="Keyboard">
          <dl className="border-t border-rule text-sm">
            <Shortcut keys="Tab">Step through the map, country by country.</Shortcut>
            <Shortcut keys="Enter or Space">Guess the focused country.</Shortcut>
            <Shortcut keys="Esc">Leave a round, or dismiss the reveal.</Shortcut>
            <Shortcut keys="?">Open this page.</Shortcut>
          </dl>
        </Section>

        <footer className="mt-10 border-t border-rule pt-5 text-xs leading-relaxed text-graphite">
          <p>
            Country outlines from{' '}
            <a
              href="https://www.naturalearthdata.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-oxblood underline underline-offset-2"
            >
              Natural Earth
            </a>{' '}
            (public domain). Flags from{' '}
            <a
              href="https://flagcdn.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-oxblood underline underline-offset-2"
            >
              flagcdn.com
            </a>
            .
          </p>
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
        {keys}
      </dt>
      <dd className="text-graphite">{children}</dd>
    </div>
  );
}
