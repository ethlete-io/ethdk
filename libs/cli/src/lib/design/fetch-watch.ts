import { Subscription, tap, timer } from 'rxjs';

export const FETCH_STALL_MS = 20_000;

export type ModuleFetcher = Pick<
  import('vite', { with: { 'resolution-mode': 'import' } }).DevEnvironment,
  'fetchModule'
>;

type Fetch = { id: string; started: number };

const secondsOf = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

const processCpuMs = () => {
  const { user, system } = process.cpuUsage();

  return (user + system) / 1000;
};

/**
 * Fails every vite module fetch of `environment` once no fetch settled for `stallMs`, with an error that names
 * each fetch still pending and how long it waits; a later fetch of a module whose fetch never settled fails at once.
 * A blocked event loop is reported instead of counted as a stall, as a suspended process when it used under a quarter of
 * that time in CPU (the machine slept), and each failure is reported (stderr by default). Returns a function that removes the watch.
 */
export const watchModuleFetches = (
  environment: ModuleFetcher,
  options: { stallMs?: number; now?: () => number; cpuMs?: () => number; report?: (line: string) => void } = {},
) => {
  const {
    stallMs = FETCH_STALL_MS,
    now = Date.now,
    cpuMs = processCpuMs,
    report = (line: string) => void process.stderr.write(`${line}\n`),
  } = options;
  const original = environment.fetchModule;
  const fetch = original.bind(environment);
  const pending = new Set<Fetch>();
  const hung = new Map<string, number>();
  let settledAt = now();
  let unblockedAt = 0;

  const fail = (message: string) => {
    report(message);

    return new Error(message);
  };

  const waitingAt = (at: number) =>
    [...pending]
      .sort((a, b) => a.started - b.started)
      .map((each) => `${each.id} (${secondsOf(at - each.started)})`)
      .join(', ');

  const stall = (fetching: Fetch, quiet: number) => {
    const waiting = waitingAt(now());

    pending.delete(fetching);
    hung.set(fetching.id, fetching.started);

    return fail(
      `design-explore: no vite module fetch settled for ${secondsOf(quiet)}; failing ${fetching.id}, pending: ${waiting}`,
    );
  };

  environment.fetchModule = (...args) => {
    const [id] = args;
    const hungSince = hung.get(id);

    if (hungSince !== undefined)
      return Promise.reject(
        fail(`design-explore: the vite module fetch of ${id} still hangs after ${secondsOf(now() - hungSince)}`),
      );

    const fetching: Fetch = { id, started: now() };
    let check: Subscription | undefined;

    pending.add(fetching);

    const fetched = fetch(...args).finally(() => {
      pending.delete(fetching);
      hung.delete(id);
      settledAt = now();
    });
    const stalled = new Promise<never>((_, reject) => {
      const wait = (ms: number) => {
        const due = now() + ms;
        const cpuAt = cpuMs();

        check = timer(ms)
          .pipe(
            tap(() => {
              const at = now();

              if (at - due >= stallMs && unblockedAt < due) {
                unblockedAt = at;

                const late = at - due + ms;
                const used = cpuMs() - cpuAt;

                report(
                  used < late / 4
                    ? `design-explore: the design server was suspended for ${secondsOf(late)} (it used ${secondsOf(used)} of CPU: the machine slept or the process was stopped); pending vite module fetches: ${waitingAt(at)}`
                    : `design-explore: the design server's event loop was blocked for ${secondsOf(late)}; pending vite module fetches: ${waitingAt(at)}`,
                );
              }

              const quiet = at - Math.max(settledAt, fetching.started, unblockedAt);

              if (quiet < stallMs) wait(stallMs - quiet);
              else reject(stall(fetching, quiet));
            }),
          )
          .subscribe();
      };

      wait(stallMs);
    });

    return Promise.race([fetched, stalled]).finally(() => check?.unsubscribe());
  };

  return () => {
    environment.fetchModule = original;
  };
};
