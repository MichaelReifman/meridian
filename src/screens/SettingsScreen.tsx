/**
 * Settings, set as a colophon: the language table first, the imprint last.
 *
 * The language list is the one control in Meridian that rewrites the whole document.
 * `setLocale` puts `lang` and `dir` on <html> before it returns, so the interface has
 * already mirrored by the time React re-renders — a direction change that waited on a
 * render pass would flash one frame of the old layout in the new language, which is
 * precisely the seam this page exists to show is absent.
 *
 * Every row names its language in that language's own script. A list of exonyms
 * ("Arabic", "German") is least useful to the person who most needs it: someone who
 * cannot read the current interface is looking for the shape of their own writing.
 */

import type { ReactNode } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

import { useTranslator } from '@/i18n';
import { LOCALES } from '@/i18n/locales';
import { useLocaleStore } from '@/store/localeStore';
import { useUiStore } from '@/store/uiStore';

/**
 * Bumped by hand alongside package.json. A real build stamp would need a `define` in
 * vite.config.ts, and inventing one to print a string on a settings page is not worth
 * a change to the build.
 */
const VERSION = '0.1.0';

/**
 * The engraved treatment, minus the two parts of it that Arabic cannot take: letter
 * spacing severs the joins between letters, and `uppercase` has nothing to act on. The
 * variant beats the base utility on specificity as well as on order, so it holds
 * wherever it is applied — including over the `.label` component class.
 */
const RTL_SAFE_ENGRAVING = 'rtl:normal-case rtl:tracking-normal';

export function SettingsScreen(): JSX.Element {
  const t = useTranslator();
  const setScreen = useUiStore((s) => s.setScreen);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <main
      className="h-full overflow-y-auto overflow-x-hidden bg-paper"
      style={{
        /* Physical sides on purpose. These are safe-area insets — a notch stays on the
           side of the device it is cut into no matter which way the text runs — so this
           is one of the few places a logical property would be the wrong answer. */
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
          {/* "Back" is a direction, not a bearing: it points at the margin the reader
              came from, so it turns around with the text. */}
          <ArrowLeft
            aria-hidden="true"
            size={16}
            strokeWidth={1.75}
            className="rtl:-scale-x-100"
          />
          {t('common.back')}
        </button>

        <header className="mt-8 text-center">
          <h1
            className={`font-display text-xl uppercase leading-none tracking-[0.2em] text-ink sm:text-2xl ${RTL_SAFE_ENGRAVING}`}
          >
            {t('settings.title')}
          </h1>
          <div aria-hidden="true" className="rule-double mt-4" />
        </header>

        <Section id="settings-language" title={t('settings.language')}>
          <ul role="list" className="border-t border-rule">
            {LOCALES.map((meta) => {
              const active = meta.code === locale;
              return (
                <li key={meta.code}>
                  <button
                    type="button"
                    onClick={() => setLocale(meta.code)}
                    aria-label={t('settings.a11y.chooseLanguage', { language: meta.english })}
                    aria-current={active ? 'true' : undefined}
                    /* The mark is a rule in the margin and a printed check — the two
                       ways a chart says "this one". Inactive rows keep the same rule at
                       zero contrast so nothing shifts when the choice moves. */
                    className={`flex w-full items-center gap-4 border-b border-rule border-s-2 py-3 ps-3 text-start transition-colors duration-150 ease-swift hover:bg-leaf ${
                      active ? 'border-s-oxblood' : 'border-s-transparent'
                    }`}
                  >
                    {/* Isolated and explicitly tagged: an Arabic name sitting in an
                        English page (and the reverse) needs its own base direction, and
                        the browser needs `lang` to shape and join it correctly. */}
                    <bdi
                      lang={meta.tag}
                      dir={meta.dir}
                      className={`min-w-0 flex-1 text-sm ${active ? 'text-ink' : 'text-graphite'}`}
                    >
                      {meta.label}
                    </bdi>

                    {/* Suppressed where the endonym already is the English name, rather
                        than printing "English English". */}
                    {meta.label !== meta.english && (
                      <span className="label shrink-0">
                        <bdi>{meta.english}</bdi>
                      </span>
                    )}

                    <Check
                      aria-hidden="true"
                      size={15}
                      strokeWidth={2}
                      className={`shrink-0 ${active ? 'text-oxblood' : 'invisible'}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 text-sm leading-relaxed text-graphite">
            {t('settings.languageNote')}
          </p>
        </Section>

        <Section id="settings-about" title={t('settings.about')}>
          <p
            className={`font-display text-lg uppercase leading-none tracking-[0.14em] text-ink ${RTL_SAFE_ENGRAVING}`}
          >
            {t('app.name')}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-graphite">{t('app.tagline')}</p>

          <dl className="mt-6 border-t border-rule">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
              <dt className={`label ${RTL_SAFE_ENGRAVING}`}>{t('settings.version')}</dt>
              <dd className="tabular shrink-0 font-mono text-sm text-ink">
                {/* A version is a label, not a quantity: it keeps Latin digits in every
                    language, and the whole run is isolated so the separator and the
                    build mode do not reorder around it in Arabic. */}
                <bdi>
                  {VERSION} · {import.meta.env.MODE}
                </bdi>
              </dd>
            </div>
          </dl>
        </Section>
      </div>
    </main>
  );
}

/** A ruled section with an engraved head, matching the other printed pages. */
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section aria-labelledby={id} className="mt-9">
      <h2 id={id} className={`label border-b border-rule pb-2 ${RTL_SAFE_ENGRAVING}`}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
