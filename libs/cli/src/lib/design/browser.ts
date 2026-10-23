import { pathToFileURL } from 'url';

export type Chromium = typeof import('playwright').chromium;

const BROWSER_PACKAGES = ['playwright', 'playwright-core'];

/**
 * The headless Chromium the checker drives, from `playwright` or `playwright-core`, looked up in
 * the checkout first and in this package second. Null when neither resolves.
 */
export const chromiumOf = async (target: string): Promise<Chromium | null> => {
  for (const name of BROWSER_PACKAGES) {
    let path: string;

    try {
      path = require.resolve(name, { paths: [target, __dirname] });
    } catch {
      continue;
    }

    const loaded = (await import(pathToFileURL(path).href)) as {
      chromium?: Chromium;
      default?: { chromium?: Chromium };
    };
    const chromium = loaded.chromium ?? loaded.default?.chromium;

    if (chromium) return chromium;
  }

  return null;
};
