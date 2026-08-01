/**
 * The app's last line of defence.
 *
 * A render error anywhere in Meridian would otherwise leave a black screen: the body
 * is `bg-space`, so React unmounting the tree looks exactly like a page that never
 * loaded. This catches it and offers the two recoveries that actually help — retry the
 * render (enough for a transient failure, and it keeps the player's round in memory)
 * and a full reload (the only way out of corrupt module state).
 *
 * Deliberately not styled as a browser error dialog: the same cosmic panel the rest of
 * the game uses, so a crash reads as part of the instrument rather than a stack trace.
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
        className="flex h-full w-full items-center justify-center overflow-y-auto bg-space"
        style={{
          padding:
            'calc(var(--inset-t) + 1.5rem) calc(var(--inset-r) + 1.25rem)' +
            ' calc(var(--inset-b) + 1.5rem) calc(var(--inset-l) + 1.25rem)',
        }}
      >
        <div className="hud-panel animate-rise-in w-full max-w-md rounded-2xl p-6 sm:p-8">
          <p className="text-hud font-mono uppercase text-gold">Lost the signal</p>
          <h1 className="font-display mt-2 text-2xl leading-tight text-parchment">
            Meridian hit an error
          </h1>
          <p className="mt-3 text-sm text-muted">
            The round is not lost — daily progress and streaks are stored on this device and
            will still be here.
          </p>

          {error.message && (
            <p className="mt-4 max-h-24 overflow-y-auto rounded-lg border border-hairline bg-space px-3 py-2 font-mono text-xs text-muted">
              {error.message}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="ease-swift rounded-full border border-hairline px-4 py-2.5 text-sm text-parchment transition-colors duration-200 hover:bg-parchment/10"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="ease-swift rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-space transition duration-200 hover:brightness-110"
            >
              Reload Meridian
            </button>
          </div>
        </div>
      </div>
    );
  }
}
