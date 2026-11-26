import { Chromium, chromiumOf } from './browser';

export type ChromiumOf = typeof chromiumOf;
type Browser = Awaited<ReturnType<Chromium['launch']>>;

/**
 * A `chromiumOf` whose `launch` starts one Chromium per distinct `args` for every draw queue that asks it, so a process
 * keeps one browser root per flag set. Each launch returns a lease; its `close` ends that browser only when its last
 * lease closes.
 */
export const sharedChromiumOf = (resolveChromium: ChromiumOf = chromiumOf): ChromiumOf => {
  let resolved: ReturnType<ChromiumOf> | null = null;
  const browsers = new Map<string, Promise<Browser>>();
  const leases = new Map<string, number>();

  const leaseOf = (args: string, open: Browser): Browser => {
    let closed = false;

    return new Proxy(open, {
      get: (target, key) => {
        if (key === 'close') {
          return async () => {
            if (closed) return;

            closed = true;

            const left = (leases.get(args) ?? 1) - 1;

            leases.set(args, left);

            if (left > 0) return;

            browsers.delete(args);
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
      const key = JSON.stringify(options?.args ?? []);
      const launching = browsers.get(key) ?? found.chromium.launch(options);
      const forget = () => {
        if (browsers.get(key) === launching) browsers.delete(key);
      };

      browsers.set(key, launching);
      launching.catch(forget);

      const open = await launching;

      leases.set(key, (leases.get(key) ?? 0) + 1);
      open.once('disconnected', forget);

      return leaseOf(key, open);
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
