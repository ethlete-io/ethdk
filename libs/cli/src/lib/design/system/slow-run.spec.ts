import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { openPointsOf, PartOpenPointsAnswer } from './open-points-runner';
import { recordSettledBuildReady } from './record-settled';
import { warmOpenPointsWorker } from './open-points-worker.fixtures';
import { resolveProduct } from './resolve-product';
import { startSlowRunner } from './slow-run';

const harness = { app: 'apps/acme', map: 'apps/acme/src/map.ts', baseBranch: 'x' };

const staleChip = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-slow-run-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, 'apps/acme/src'), { recursive: true });
  writeFileSync(join(target, 'apps/acme/src/chip.component.ts'), '@Component({})\nexport class Chip {}\n');

  const dir = join(target, DESIGN_DIR, 'acme');

  mkdirSync(join(dir, 'components/chip'), { recursive: true });
  writeFileSync(
    join(dir, 'components/chip/chip.ts'),
    "export default definePart({ implements: 'apps/acme/src/chip.component.ts', controls: {}, states: {} });\n",
  );
  writeFileSync(
    join(dir, 'ready.json'),
    JSON.stringify({ 'components/chip': { hash: 'h', at: '2026-11-06T00:00:00Z', actions: ['open'] } }),
  );

  const loaded = readConfig(target) ?? {};
  const config = { ...loaded, products: { acme: { ...loaded.products?.['acme'], harness } } };
  const product = () => resolveProduct({ target, name: 'acme', config: config.products.acme });

  return { target, dir, config, product };
};

describe('the slow runner of the design server', { timeout: 60_000 }, () => {
  warmOpenPointsWorker();

  it('records the check record of a settled part whose checks are green, without a design check', async () => {
    const { target, dir, config, product } = staleChip();
    const buildReadyOf = () =>
      (openPointsOf({ product: product(), part: 'components/chip' }) as PartOpenPointsAnswer).buildReady;

    expect(buildReadyOf().ready).toBe(false);

    const runner = startSlowRunner({
      target,
      configOf: () => config,
      log: () => undefined,
      intervalMs: 3_600_000,
      runners: {
        specs: async () => [],
        start: async () => ({ url: 'http://app', stop: async () => undefined }),
        live: async () => [],
        visibleChange: async () => new Map(),
        controlState: async () => [],
        droppedProps: async () => [],
        actionLost: async () => [],
      },
      record: (request) =>
        recordSettledBuildReady({ ...request, actionsOf: async () => [], declaredActionsOf: async () => ['open'] }),
    });

    await runner.poll();
    await runner.poll();
    runner.stop();

    expect(buildReadyOf()).toEqual({ ready: true });
    expect(JSON.parse(readFileSync(join(dir, 'ready.json'), 'utf8'))['components/chip'].actions).toEqual(['open']);
  });

  it('records an unlinked part with its declared actions through the default checks', async () => {
    const { target, dir, config, product } = staleChip();

    writeFileSync(
      join(dir, 'components/chip/chip.ts'),
      "import { definePart } from '@design-system';\nexport default definePart({ controls: {}, states: {} });\n",
    );

    const runner = startSlowRunner({
      target,
      configOf: () => config,
      log: () => undefined,
      intervalMs: 3_600_000,
      runners: { controlState: async () => [], droppedProps: async () => [], actionLost: async () => [] },
    });

    await runner.poll();
    await runner.poll();
    runner.stop();

    expect(openPointsOf({ product: product(), part: 'components/chip' })).toMatchObject({
      buildReady: { ready: true },
    });
    expect(JSON.parse(readFileSync(join(dir, 'ready.json'), 'utf8'))['components/chip'].actions).toEqual([]);
  });
});
