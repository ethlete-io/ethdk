import { DesignConfig } from '../design-config';
import { AppStateAddress } from '../shot';
import { ShotUnprocessableError } from '../thumb';
import { WarmDraw } from '../warm-draw';
import { ShootStates, shootStatesWith } from './compare-command';
import { harnessStaleOf } from './harness-map';
import { StartHarnessServer, startHarnessServer, withHarnessUrl } from './harness-server';
import { createHarnessWatch, HarnessWatch } from './harness-watch';
import { oneProductOf } from './sketch/cli-args';

/**
 * Shoots one state of a part in the product's harness app as `design compare` shoots its app side, on a harness watch
 * build kept until `close`. A state compare cannot shoot fails with its reason as a `ShotUnprocessableError`.
 */
export const createAppStateShots = (options: {
  target: string;
  config: DesignConfig;
  warm: WarmDraw;
  start?: StartHarnessServer;
  shoot?: ShootStates;
}) => {
  const { target, config } = options;
  const shoot = options.shoot ?? shootStatesWith(options.warm);
  let harness: HarnessWatch | null = null;
  const start: StartHarnessServer =
    options.start ??
    (async ({ product }) => {
      harness ??= createHarnessWatch({ target });

      const served = await harness.current(product);

      if (served === null) return startHarnessServer({ target, product });

      return typeof served === 'string' ? served : { url: served.url, root: served.root, stop: async () => undefined };
    });

  return {
    shotOf: async ({ product: asked, part, state, preset }: AppStateAddress) => {
      const product = oneProductOf({ target, config, asked });

      if (typeof product === 'string') throw new ShotUnprocessableError(product);

      const stale = harnessStaleOf({ target, product });

      if (stale !== null) throw new ShotUnprocessableError(stale);

      const result = await withHarnessUrl({
        target,
        product,
        url: undefined,
        start,
        run: (url, root) =>
          shoot({ target, config, product, part, url, only: [state], preset, appOnly: true, appRoot: root }),
      });

      if (typeof result === 'string') throw new ShotUnprocessableError(result);

      const shot = result.shots.find((candidate) => candidate.state === state);

      if (!shot) throw new ShotUnprocessableError(`the app harness drew no "${state}" of ${part}`);
      if ('problem' in shot) throw new ShotUnprocessableError(shot.problem);

      return shot.app;
    },
    close: async () => {
      const stopping = harness;

      harness = null;
      await stopping?.stop();
    },
  };
};
