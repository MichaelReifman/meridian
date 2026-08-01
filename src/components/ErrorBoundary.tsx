/**
 * The app's last line of defence.
 *
 * A render error anywhere in Meridian would otherwise leave a bare page: React unmounting
 * the tree looks exactly like a sheet that never got printed. This catches it and offers
 * the two recoveries that actually help — retry the render (enough for a transient
 * failure, and it keeps the player's round in memory) and a full reload (the only way out
 * of corrupt module state).
 *
 * Deliberately not styled as a browser error dialog. It is set as an errata notice on the
 * same stock as the rest of the atlas, so a crash reads as part of the volume rather than
 * as a stack trace.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { translate } from '@/i18n';
import type { TranslationKey } from '@/i18n/en';
import { useLocaleStore } from '@/store/localeStore';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The component stack is the only part of this that is not already in the console,
    // and it is what identifies *which* screen threw.
    console.error('[meridian] render failed:', error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ error: null });
  };

  private readonly reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    /* A class cannot hold the translator hook, and subscribing this boundary to the
       locale store would make a language change re-run the render that just crashed.
       The store is read imperatively instead: correct at the moment the notice is
       printed, which is the only moment it is on screen. */
    const locale = useLocaleStore.getState().locale;
    const t = (key: TranslationKey): string => translate(locale, key);

    return (
      <div
        role="alert"
        className="flex h-full w-full items-center justify-center overflow-y-auto bg-paper"
        style={{
          /* Physical on purpose: these are the device's own safe areas, one per edge,
             and a notch does not move when the type changes direction. */
          padding:
            'calc(var(--inset-t) + 1.5rem) calc(var(--inset-r) + 1.25rem)' +
            ' calc(var(--inset-b) + 1.5rem) calc(var(--inset-l) + 1.25rem)',
        }}
      >
        <div className="sheet animate-rise-in w-full max-w-md p-6 sm:p-8">
          <p className="label">{t('error.title')}</p>
          {/* Capitals and letterspacing are dropped in a right-to-left script: `uppercase`
              is inert in Arabic and tracking severs the joining forms. */}
          <h1 className="mt-3 font-display text-xl uppercase leading-snug tracking-[0.14em] text-oxblood rtl:tracking-normal rtl:normal-case">
            {t('error.heading')}
          </h1>
          <div aria-hidden="true" className="rule-double mt-4" />
          {/* The one string on this notice with no key in the dictionary — there is no
              `error.body`, and every other key means something else, so borrowing one
              would print a confidently wrong sentence rather than an untranslated one.
              Left in English until the key set gains an entry for it. */}
          <p className="mt-4 text-sm leading-relaxed text-graphite">
            The round is not lost — daily progress and streaks are stored on this device and
            will still be here.
          </p>

          {error.message && (
            /* Set on the second sheet tone so the machine's own words are visibly a
               quotation rather than part of the notice. The message is whatever the
               runtime produced — Latin script, and never translated — so it is isolated
               from a right-to-left notice around it. */
            <p className="mt-4 max-h-24 overflow-y-auto rounded-sheet border border-rule bg-leaf px-3 py-2 font-mono text-xs text-graphite">
              <bdi>{error.message}</bdi>
            </p>
          )}

          {/* Words with rules under them, matching every other action in the atlas. */}
          <div className="mt-7 flex flex-wrap items-center justify-end gap-6">
            <button
              type="button"
              onClick={this.retry}
              className="ease-swift -my-2 border-b border-ink/25 py-2 text-sm text-ink transition-colors duration-150 hover:border-ink/70"
            >
              {t('error.retry')}
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="ease-swift -my-2 border-b border-oxblood/60 py-2 text-sm font-medium text-oxblood transition-colors duration-150 hover:border-oxblood"
            >
              {t('error.reload')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
