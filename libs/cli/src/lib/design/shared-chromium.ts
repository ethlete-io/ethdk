import { Chromium, chromiumOf } from './browser';

export type ChromiumOf = typeof chromiumOf;
type Browser = Awaited<ReturnType<Chromium['launch']>>;

/**
 * A `chromiumOf` whose `launch` starts one Chromium for every draw queue that asks it, so a process keeps one browser
 * root. Each launch returns a lease; its `close` ends the browser only when the last lease closes.
 */
export const sharedChromiumOf = (resolveChromium: ChromiumOf = chromiumOf): ChromiumOf => {
  let resolved: ReturnType<ChromiumOf> | null = null;
  let browser: Promise<Browser> | null = null;
  let leases = 0;

  const leaseOf = (open: Browser): Browser => {
    let closed = false;

    return new Proxy(open, {
      get: (target, key) => {
        if (key === 'close') {
          return async () => {
            if (closed) return;

            closed = true;
            leases--;

            if (leases > 0) return;

            browser = null;
            await target.close();
          };
        }

        const value = Reflect.get(target, key, target) as unknown;

        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };

  return async (target) => {
    resolved ??= resolveChromium(target);

    const found = await resolved;

    if (!found) return null;

    const launch = (async (options?: Parameters<Chromium['launch']>[0]) => {
      const launching = (browser ??= found.chromium.launch(options));

      launching.catch(() => {
        if (browser === launching) browser = null;
      });

      const open = await launching;

      leases++;
      open.once('disconnected', () => {
        if (browser === launching) browser = null;
      });

      return leaseOf(open);
    }) as Chromium['launch'];

    const chromium = new Proxy(found.chromium, {
      get: (target, key) => {
        if (key === 'launch') return launch;

        const value = Reflect.get(target, key, target) as unknown;

        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    return { from: found.from, chromium };
  };
};
