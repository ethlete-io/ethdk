type FakeMediaQueryList = MediaQueryList & { matches: boolean };

type MediaQueryListener = (event: MediaQueryListEvent) => void;

const WIDTH_FEATURE_PATTERN = /\((min|max)-width:\s*(\d+(?:\.\d+)?)px\)/g;

const matchesWidth = (query: string, width: number) => {
  let matched = false;
  let result = true;

  for (const [, feature, value] of query.matchAll(WIDTH_FEATURE_PATTERN)) {
    matched = true;
    result = result && (feature === 'min' ? width >= Number(value) : width <= Number(value));
  }

  return matched ? result : null;
};

export type FakeMatchMedia = {
  /** Flips one exact query string and notifies its listeners, whether or not the value changed. */
  setMatches: (query: string, matches: boolean) => void;
  /**
   * Re-evaluates every `(min-width: …px)` / `(max-width: …px)` query against `px` and notifies the
   * ones whose result changed. Queries without a width feature keep whatever `setMatches` gave them.
   */
  setViewportWidth: (px: number) => void;
  /** Puts the real `window.matchMedia` back. Also runs automatically when the test finishes. */
  restore: () => void;
};

/**
 * Installs a controllable `window.matchMedia` for the current test, so a spec can drive breakpoint
 * state (`injectObserveBreakpoint`, overlay strategy switching, a control's bottom-sheet mode)
 * instead of the inert global mock that never matches. Restores itself when the test finishes.
 *
 * Install it before the first `TestBed` inject that reads a media query - i.e. in `beforeEach`,
 * before creating a fixture. The breakpoint observer's root provider binds `defaultView.matchMedia`
 * once, at first inject, so a fake installed after that is silently ignored.
 */
export const fakeMatchMedia = (): FakeMatchMedia => {
  const lists = new Map<string, FakeMediaQueryList>();
  const listeners = new Map<string, Set<MediaQueryListener>>();
  let viewportWidth: number | null = null;

  const notify = (query: string, matches: boolean) => {
    for (const listener of listeners.get(query) ?? []) {
      listener({ matches, media: query } as MediaQueryListEvent);
    }
  };

  const matchMedia = (query: string): FakeMediaQueryList => {
    const existing = lists.get(query);

    if (existing) return existing;

    const list = {
      media: query,
      matches: (viewportWidth === null ? null : matchesWidth(query, viewportWidth)) ?? false,
      addEventListener: (_: string, listener: MediaQueryListener) => {
        const forQuery = listeners.get(query) ?? new Set<MediaQueryListener>();
        forQuery.add(listener);
        listeners.set(query, forQuery);
      },
      removeEventListener: (_: string, listener: MediaQueryListener) => {
        listeners.get(query)?.delete(listener);
      },
    } as unknown as FakeMediaQueryList;

    lists.set(query, list);

    return list;
  };

  const originalMatchMedia = window.matchMedia;
  window.matchMedia = matchMedia as typeof window.matchMedia;

  const restore = () => {
    window.matchMedia = originalMatchMedia;
  };

  onTestFinished(restore);

  return {
    setMatches: (query, matches) => {
      matchMedia(query).matches = matches;
      notify(query, matches);
    },
    setViewportWidth: (px) => {
      viewportWidth = px;

      for (const [query, list] of lists) {
        const next = matchesWidth(query, px);

        if (next === null || next === list.matches) continue;

        list.matches = next;
        notify(query, next);
      }
    },
    restore,
  };
};
