import { Subscription, timer } from 'rxjs';
import { OpenPointsAnswer, OpenPointsRequest } from './open-points-runner';
import { ResolvedProduct } from './resolve-product';

export type OpenPointsWarmer = {
  /** Warms the open points again once the watched files have settled for `settleMs`. */
  changed: () => void;
  /** Answers `request` after the warm run in flight, starting a pending run first. */
  ask: (request: OpenPointsRequest) => Promise<OpenPointsAnswer>;
  close: () => void;
};

/**
 * Computes the open points of every product in the background, at once and after each change, so an ask finds them
 * cached. `warm` and `ask` must share one open-points cache.
 */
export const createOpenPointsWarmer = ({
  productsOf,
  warm,
  ask,
  settleMs = 300,
}: {
  productsOf: () => ResolvedProduct[];
  warm: (product: ResolvedProduct) => Promise<unknown>;
  ask: (request: OpenPointsRequest) => Promise<OpenPointsAnswer>;
  settleMs?: number;
}): OpenPointsWarmer => {
  let pending: Subscription | null = null;
  let running: Promise<void> | null = null;
  let changedWhileRunning = false;
  let closed = false;

  const productsOrNone = () => {
    try {
      return productsOf();
    } catch {
      return [];
    }
  };

  const warmAll = async () => {
    for (const product of productsOrNone()) await warm(product).catch(() => undefined);
  };

  const run = () => {
    pending?.unsubscribe();
    pending = null;
    running = warmAll().finally(() => {
      running = null;

      if (!changedWhileRunning) return;

      changedWhileRunning = false;
      arm(settleMs);
    });
  };

  const arm = (ms: number) => {
    if (closed) return;

    pending?.unsubscribe();
    pending = timer(ms).subscribe(run);
  };

  arm(0);

  return {
    changed: () => {
      if (running) changedWhileRunning = true;
      else arm(settleMs);
    },
    ask: async (request) => {
      if (pending && !running) run();

      await running;

      return ask(request);
    },
    close: () => {
      closed = true;
      pending?.unsubscribe();
      pending = null;
    },
  };
};
