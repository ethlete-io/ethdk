import { VERSION } from '@angular/core';

/**
 * Free-form build information about the application itself - version, commit SHA, environment name,
 * anything else a bug report should carry. The SDK cannot derive any of it, so it is handed in via
 * `provideQueryDevtools({ about })`.
 */
export type QueryDevtoolsAppInfo = Record<string, string | number | boolean>;

export type QueryDevtoolsAbout = {
  /** Loaded `@ethlete/*` packages by short name (`core`, `query`, `components`), each a real version. */
  ethlete: Record<string, string>;
  angular: string;
  app: QueryDevtoolsAppInfo | null;
};

const ethlete: Record<string, string> = {};

let app: QueryDevtoolsAppInfo | null = null;

/** What `window.ethlete` exposes - the same object {@link queryDevtoolsAbout} returns. */
const publish = () => {
  if (typeof window === 'undefined') return;

  (window as unknown as Record<string, unknown>)['ethlete'] = queryDevtoolsAbout();
};

/**
 * Records that an `@ethlete/*` package is loaded, and at which version. Each lib passes its own
 * generated constant; a package that is never imported never reports one, which is what makes the
 * list "what is actually loaded" rather than "what is declared as a peer dependency".
 */
export const registerEthleteVersion = (name: string, version: string) => {
  ethlete[name] = version;
  publish();
};

export const setQueryDevtoolsAppInfo = (info: QueryDevtoolsAppInfo | undefined) => {
  app = info ?? null;
  publish();
};

/**
 * Everything the devtools know about what is running: the loaded `@ethlete/*` versions, the Angular
 * version, and whatever the application handed to `provideQueryDevtools({ about })`.
 *
 * Also mirrored onto `window.ethlete` - the same idea as Angular's `window.ng`, so the versions behind
 * a bug report can be read straight from the console without opening the panel.
 */
export const queryDevtoolsAbout = (): QueryDevtoolsAbout => ({
  ethlete: { ...ethlete },
  angular: VERSION.full,
  app,
});
