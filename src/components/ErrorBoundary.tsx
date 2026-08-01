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

    return (
      <div
        role="alert"
        className="flex h-full w-full items-center justify-center overflow-y-auto bg-paper"
        style={{
          padding:
            'calc(var(--inset-t) + 1.5rem) calc(var(--inset-r) + 1.25rem)' +
            ' calc(var(--inset-b) + 1.5rem) calc(var(--inset-l) + 1.25rem)',
        }}
      >
        <div className="sheet animate-rise-in w-full max-w-md p-6 sm:p-8">
          <p className="label">Errata</p>
          <h1 className="mt-3 font-display text-xl uppercase leading-snug tracking-[0.14em] text-oxblood">
            Meridian hit an error
          </h1>
          <div aria-hidden="true" className="rule-double mt-4" />
          <p className="mt-4 text-sm leading-relaxed text-graphite">
            The round is not lost — daily progress and streaks are stored on this device and
            will still be here.
          </p>

          {error.message && (
            /* Set on the second sheet tone so the machine's own words are visibly a
               quotation rather than part of the notice. */
            <p className="mt-4 max-h-24 overflow-y-auto rounded-sheet border border-rule bg-leaf px-3 py-2 font-mono text-xs text-graphite">
              {error.message}
            </p>
          )}

          {/* Words with rules under them, matching every other action in the atlas. */}
          <div className="mt-7 flex flex-wrap items-center justify-end gap-6">
            <button
              type="button"
              onClick={this.retry}
              className="ease-swift -my-2 border-b border-ink/25 py-2 text-sm text-ink transition-colors duration-150 hover:border-ink/70"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="ease-swift -my-2 border-b border-oxblood/60 py-2 text-sm font-medium text-oxblood transition-colors duration-150 hover:border-oxblood"
            >
              Reload Meridian
            </button>
          </div>
        </div>
      </div>
    );
  }
}
