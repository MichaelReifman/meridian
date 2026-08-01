/**
 * The rules.
 *
 * The one thing this page has to land is that a guess draws a *ring*, not a hot-or-cold
 * blob: the distance readout says the answer is exactly that far away, and the lit band
 * is every place that could be true of. Players who read it as "warmer/colder" will
 * wonder why the glow is nowhere near their guess, so the ring has to be named early
 * and the intersection idea stated plainly.
 */

import { useMemo, type ReactNode } from 'react';
import { ArrowLeft, Compass, Flag, Globe, Landmark, Radar } from 'lucide-react';

import { rampColor } from '@/lib/ramp';
import { useUiStore } from '@/store/uiStore';

/**
 * The ramp as a CSS gradient.
 *
 * Sampled at eleven points rather than handed the three stops directly: ramp.ts
 * interpolates in linear light, CSS gradients interpolate in gamma-encoded sRGB, and
 * the two disagree visibly through the violet→cyan midpoint. Sampling reproduces the
 * real ramp closely enough that the legend matches the map.
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
      className="h-full overflow-y-auto overflow-x-hidden bg-space"
      style={{
        padding:
          'calc(var(--inset-t) + 1rem) calc(var(--inset-r) + 1.25rem)' +
          ' calc(var(--inset-b) + 2rem) calc(var(--inset-l) + 1.25rem)',
      }}
    >
      <div className="mx-auto w-full max-w-xl">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen('menu')}
            aria-label="Back to menu"
            className="ease-swift flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-hairline text-parchment transition-colors duration-200 hover:bg-parchment/10"
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.75} />
          </button>
          <h1 className="font-display text-2xl leading-none text-parchment">How to play</h1>
        </header>

        <p className="mt-6 text-sm leading-relaxed text-muted">
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
          <p className="mt-3 text-sm text-muted">
            Modes are never mixed inside a round, and each keeps its own daily streak.
          </p>
        </Section>

        <Section title="Every wrong guess tells you two things">
          <div className="flex gap-3">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-cyan">
              <Radar size={18} strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-parchment">A ring you can cross-reference</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Your guess comes back with a distance, and that distance is exact — so the
                answer lies somewhere on a <em className="not-italic text-parchment">ring</em> that
                far from the country you clicked. The map lights that ring up, right around the
                world. One guess narrows things enormously and still gives nothing away.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Guess again somewhere else and a second ring appears. Only the places that
                satisfy <em className="not-italic text-parchment">both</em> stay lit — usually a
                shortlist. A third normally pins it. You are triangulating, the way you would
                fix a position from two landmarks.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div
              aria-hidden="true"
              className="h-3 w-full rounded-full border border-hairline"
              style={{ backgroundImage: gradient }}
            />
            <div className="mt-2 flex items-baseline justify-between text-hud uppercase text-muted">
              <span>Off the ring</span>
              <span className="text-gold">On every ring</span>
            </div>
            <p className="sr-only">
              Colour ramp: violet where a country only just satisfies your distances, through
              cyan, to gold where it satisfies all of them.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The bands are deliberately coarse, and they get narrower as your guesses get
              closer. Nothing is tinted before your first guess.
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-gold">
              <Compass size={18} strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-parchment">An arrow and a distance</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                A compass arrow and a live kilometre readout point from your last guess toward
                the answer. It carries the same information as the colour, in words and
                numbers — nothing in Meridian is ever conveyed by colour alone.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Daily and Practice">
          <p className="text-sm leading-relaxed text-muted">
            The <span className="text-parchment">Daily Challenge</span> is one puzzle per mode
            per day, identical for everyone and generated from the date alone — there is no
            server. Solve it and the streak for that mode grows; miss a day and it resets. The
            day rolls over at your own local midnight.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            <span className="text-parchment">Practice</span> deals unlimited random puzzles. It
            keeps its own lifetime counters and never touches a daily streak.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The answer is always one of the 195 sovereign states. Territories and disputed
            areas are drawn as inert land: never clickable, never the answer.
          </p>
        </Section>

        <Section title="Keyboard">
          <dl className="space-y-2 text-sm">
            <Shortcut keys="Tab">Step through the map, country by country.</Shortcut>
            <Shortcut keys="Enter or Space">Guess the focused country.</Shortcut>
            <Shortcut keys="Esc">Leave a round, or dismiss the reveal.</Shortcut>
            <Shortcut keys="?">Open this page.</Shortcut>
          </dl>
        </Section>

        <footer className="mt-10 border-t border-hairline pt-5 text-xs leading-relaxed text-muted">
          <p>
            Country outlines from{' '}
            <a
              href="https://www.naturalearthdata.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan underline underline-offset-2"
            >
              Natural Earth
            </a>{' '}
            (public domain). Flags from{' '}
            <a
              href="https://flagcdn.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan underline underline-offset-2"
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
    <section className="mt-8">
      <h2 className="font-display text-lg leading-none text-parchment">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Mode({ icon, name, children }: { icon: ReactNode; name: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-cyan">
        {icon}
      </span>
      <p className="min-w-0 text-sm leading-relaxed text-muted">
        <span className="text-parchment">{name}.</span> {children}
      </p>
    </li>
  );
}

function Shortcut({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <dt className="font-mono text-xs text-gold">{keys}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
  );
}
