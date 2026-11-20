"use client";

import { Component, type ReactNode } from "react";

/** Last line of defence: a broken WebGL/driver path must not blank the page. */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-items-center px-6 text-center">
        <div className="cut border border-line bg-panel p-6">
          <p className="font-display text-xs font-bold uppercase tracking-[0.24em] text-codm">
            Filter Lab
          </p>
          <h1 className="mt-2 font-title text-4xl font-black uppercase">Something glitched</h1>
          <p className="mt-3 text-sm text-mute">
            The editor hit an error. Your saved looks are still on this device — reload to try again.
          </p>
          <pre className="mt-4 overflow-auto bg-black/50 p-2 text-left font-mono text-[10px] text-mute">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => location.reload()}
            className="cut-sm mt-4 min-h-12 bg-codm px-6 font-display text-base font-extrabold uppercase text-black"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
