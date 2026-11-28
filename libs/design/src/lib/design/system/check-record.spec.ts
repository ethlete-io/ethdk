import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { actionFailuresOf, recordCheckedBuildReady, slowWaitingLineOf } from './check-record';
import { openPointsOf, PartOpenPointsAnswer } from './open-points-runner';
import { resolveProduct } from './resolve-product';
import { SlowRunners } from './slow-run';

const harness = { app: 'apps/app-a', map: 'apps/app-a/src/map.ts' };

const runners: Partial<SlowRunners> = {
  specs: async () => [],
  start: async () => ({ url: 'http://app', stop: async () => undefined }),
  live: async () => [],
  controlState: async () => [],
  droppedProps: async () => [],
  actionLost: async () => [],
  stateInner: async () => [],
  shoot: async () => ({ states: {}, shots: [] }),
};

const staleChip = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-check-record-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, 'apps/app-a/src'), { recursive: true });
  writeFileSync(join(target, 'apps/app-a/src/chip.component.ts'), '@Component({})\nexport class Chip {}\n');

  const dir = join(target, DESIGN_DIR, 'acme');

  mkdirSync(join(dir, 'components/chip'), { recursive: true });
  writeFileSync(
    join(dir, 'components/chip/chip.ts'),
    "export default definePart({ implements: 'apps/app-a/src/chip.component.ts', controls: {}, describe: {}, states: {} });\n",
  );
  writeFileSync(
    join(dir, 'ready.json'),
    JSON.stringify({ 'components/chip': { hash: 'h', at: '2026-11-06T00:00:00Z' } }),
  );

  const loaded = readConfig(target) ?? {};
  const config = { ...loaded, products: { acme: { ...loaded.products?.['acme'], harness } } };

  return { target, config, product: () => resolveProduct({ target, name: 'acme', config: config.products.acme }) };
};

describe('the check record of a part-scoped design check', { timeout: 60_000 }, () => {
  it('runs the pending slow rules of a harness part, so a stale record settles instead of staying pending', async () => {
    const { target, config, product } = staleChip();
    const part = 'components/chip';
    const buildReadyOf = () => (openPointsOf({ product: product(), part }) as PartOpenPointsAnswer).buildReady;

    expect(buildReadyOf()).toMatchObject({ ready: false, blockers: [{ kind: 'stale-record' }, { kind: 'pending' }] });

    await recordCheckedBuildReady({
      target,
      config,
      product: product(),
      parts: [part],
      settle: [part],
      inputs: { pointsOf: () => [], problemsOf: () => [] },
      runners,
      actionsOf: async () => [],
      declaredActionsOf: async () => [],
    });

    expect(buildReadyOf()).toEqual({ ready: true });
  });

  it('counts the failed actions of a part it left without a record, so the check does not call the part clean', async () => {
    const { target, config, product } = staleChip();
    const part = 'components/chip';
    const failures = [
      'drawing button "Sucheninstudio,Titlebar" (19.) pointer focus FAILED locator.click: Timeout 15000ms exceeded.',
      'comments-mode button "Kommentarzuareset" FAILED the design draws no element of this name - it draws button "Kommentarzua" in components/comment-target, button "Kommentarzub" in components/comment-target: the accessible names differ',
    ];

    const results = await recordCheckedBuildReady({
      target,
      config,
      product: product(),
      parts: [part],
      settle: [part],
      inputs: { pointsOf: () => [], problemsOf: () => [] },
      runners,
      actionsOf: async () => failures,
      declaredActionsOf: async () => [],
    });

    expect(actionFailuresOf({ product: product(), recorded: results })).toEqual([{ part, failures }]);
  });

  it('counts no failed action for a part whose record holds', async () => {
    const { target, config, product } = staleChip();
    const part = 'components/chip';

    const results = await recordCheckedBuildReady({
      target,
      config,
      product: product(),
      parts: [part],
      settle: [part],
      inputs: { pointsOf: () => [], problemsOf: () => [] },
      runners,
      actionsOf: async () => [],
      declaredActionsOf: async () => [],
    });

    expect(actionFailuresOf({ product: product(), recorded: results })).toEqual([]);
  });

  it('blocks a part on the slow problem the check found, instead of leaving it pending', async () => {
    const { target, config, product } = staleChip();
    const part = 'components/chip';
    const problem = {
      rule: 'DROPPED-PROP',
      file: join(target, DESIGN_DIR, 'acme/components/chip/chip.ts'),
      message: 'the app drops the prop label',
    };
    const found: [string, string[]][] = [];

    const results = await recordCheckedBuildReady({
      target,
      config,
      product: product(),
      parts: [part],
      settle: [part],
      inputs: { pointsOf: () => [], problemsOf: () => [] },
      runners: { ...runners, droppedProps: async () => [problem] },
      actionsOf: async () => [],
      declaredActionsOf: async () => [],
      onSlowProblems: (at, problems) => found.push([at, problems.map(({ rule }) => rule)]),
    });

    expect(results.get(part)).toMatchObject({
      ready: false,
      blockers: [{ kind: 'problem', text: 'DROPPED-PROP: the app drops the prop label' }],
    });
    expect(found).toEqual([[part, ['DROPPED-PROP']]]);
  });

  it('leaves a whole-product check pending and names the commands that settle it', async () => {
    const { target, config, product } = staleChip();
    const part = 'components/chip';

    const results = await recordCheckedBuildReady({
      target,
      config,
      product: product(),
      parts: [part],
      settle: [],
      inputs: { pointsOf: () => [], problemsOf: () => [] },
      runners,
    });

    expect(results.get(part)).toMatchObject({
      ready: false,
      blockers: [{ kind: 'pending' }],
    });
    expect(slowWaitingLineOf({ product: 'acme', count: 1 })).toBe(
      'PENDING acme: 1 part waits for slow rules - run design serve or design check --product acme --part <part>',
    );
    expect(slowWaitingLineOf({ product: 'acme', count: 3 })).toContain('3 parts wait');
  });
});
