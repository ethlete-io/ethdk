import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { StatePictures } from './accepted-pictures';
import { openPointsOf, PartOpenPointsAnswer } from './open-points-runner';
import { recordSettledBuildReady } from './record-settled';
import { openPointsInWorker } from './open-points.fixtures';
import { createPartPictureCache } from './part-picture-cache';
import { partKeyOf, resolveProduct } from './resolve-product';
import { startSlowRunner } from './slow-run';
import { partHashOf } from './sketch/baseline';
import { openEditSketch } from './sketch/edit-sketch';
import { changedOutsideSketchOf, readMerged, recordMerged } from './sketch/merged-parts';
import { gitExec } from '../../git-test-env.fixtures';

const CHIP = 'components/chip';

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

  it('blocks each part of a product without a harness definitely, not as pending', async () => {
    const { target, config } = staleChip();
    const bare = { ...config, products: { acme: { ...config.products.acme, harness: undefined } } };
    const bareProduct = () => resolveProduct({ target, name: 'acme', config: bare.products.acme });
    const runner = startSlowRunner({
      target,
      configOf: () => bare,
      log: () => undefined,
      intervalMs: 3_600_000,
      runners: { controlState: async () => [], droppedProps: async () => [], actionLost: async () => [] },
    });

    await runner.poll();
    await runner.poll();
    runner.stop();

    const answer = openPointsOf({ product: bareProduct(), part: 'components/chip' }) as PartOpenPointsAnswer;
    const kinds = answer.buildReady.ready ? [] : answer.buildReady.blockers.map((blocker) => blocker.kind);

    expect(kinds).toContain('no-harness');
    expect(kinds).not.toContain('pending');
    expect(kinds).not.toContain('stale-record');
  });

  it('opens the new-only sketch of an edit with no old design once and reports it once over several polls', async () => {
    const { target, dir, config } = staleChip();
    const bare = { ...config, products: { acme: { ...config.products.acme, harness: undefined } } };
    const chip = join(dir, 'components/chip/chip.ts');
    const lines: string[] = [];

    writeFileSync(chip, 'export default definePart({ states: { default: {} } });\n');
    recordMerged({
      product: resolveProduct({ target, name: 'acme', config: bare.products.acme }),
      parts: ['components/chip'],
    });
    writeFileSync(chip, 'export default definePart({ states: { hover: {}, default: {} } });\n');
    gitExec(['init', '-q'], { cwd: target });
    gitExec(['add', '.'], { cwd: target });
    gitExec(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'edit'], { cwd: target });
    gitExec(['rm', '-r', '--cached', '-q', join(dir, 'components/chip')], { cwd: target });
    gitExec(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'untrack'], { cwd: target });
    writeFileSync(chip, 'export default definePart({ states: { hover: {}, active: {}, default: {} } });\n');

    const runner = startSlowRunner({
      target,
      configOf: () => bare,
      log: (line) => lines.push(line),
      intervalMs: 3_600_000,
    });

    for (let poll = 0; poll < 4; poll++) await runner.poll();
    runner.stop();

    const sketchFile = join(dir, 'sketches', 'components-chip.edit', 'sketch.json');

    expect(lines.filter((line) => line.startsWith('EDIT-OLD-NOT-FOUND'))).toHaveLength(1);
    expect(existsSync(sketchFile)).toBe(true);

    const sketch = JSON.parse(readFileSync(sketchFile, 'utf8'));

    expect([sketch.status, Object.keys(sketch.variantInfo)]).toEqual(['ready', ['new']]);
  });

  it('deletes an untracked edit sketch whose edit HEAD already holds and leaves merged.json to design check', async () => {
    const { target, dir, config } = staleChip();
    const bare = { ...config, products: { acme: { ...config.products.acme, harness: undefined } } };
    const product = () => resolveProduct({ target, name: 'acme', config: bare.products.acme });
    const chip = join(dir, 'components/chip/chip.ts');
    const commit = () =>
      gitExec(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'edit'], { cwd: target });

    writeFileSync(chip, 'export default definePart({ states: { default: {} } });\n');
    recordMerged({ product: product(), parts: ['components/chip'] });
    gitExec(['init', '-q'], { cwd: target });
    gitExec(['add', '.'], { cwd: target });
    commit();
    writeFileSync(chip, 'export default definePart({ states: { hover: {}, default: {} } });\n');
    expect(typeof openEditSketch({ target, product: product(), part: 'components/chip' })).toBe('object');
    gitExec(['add', chip], { cwd: target });
    commit();

    const lines: string[] = [];
    const runner = startSlowRunner({
      target,
      configOf: () => bare,
      log: (line) => lines.push(line),
      intervalMs: 3_600_000,
    });

    const mergedBefore = readMerged(dir)['components/chip'];

    await runner.poll();
    runner.stop();

    expect(existsSync(join(dir, 'sketches', 'components-chip.edit'))).toBe(false);
    expect(readMerged(dir)['components/chip']).toBe(mergedBefore);
    expect(mergedBefore).not.toBe(partHashOf({ product: product(), dir: join(dir, 'components/chip') }));
    expect(lines).toEqual([]);
  });

  it('writes no tracked file for a committed direct edit and its committed edit sketch', async () => {
    const { target, dir, config } = staleChip();
    const bare = { ...config, products: { acme: { ...config.products.acme, harness: undefined } } };
    const product = () => resolveProduct({ target, name: 'acme', config: bare.products.acme });
    const chip = join(dir, 'components/chip/chip.ts');
    const commitAll = () => {
      gitExec(['add', '.'], { cwd: target });
      gitExec(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'edit'], { cwd: target });
    };

    writeFileSync(chip, 'export default definePart({ states: { default: {} } });\n');
    writeFileSync(join(target, '.gitignore'), '.ethlete/cache/\n.ethlete/design/*/pictures.json\n');
    gitExec(['init', '-q'], { cwd: target });
    recordMerged({ product: product(), parts: ['components/chip'] });
    commitAll();
    writeFileSync(chip, 'export default definePart({ states: { hover: {}, default: {} } });\n');
    expect(typeof openEditSketch({ target, product: product(), part: 'components/chip' })).toBe('object');
    commitAll();

    const runner = startSlowRunner({ target, configOf: () => bare, log: () => undefined, intervalMs: 3_600_000 });

    for (let poll = 0; poll < 3; poll++) await runner.poll();
    runner.stop();

    expect(gitExec(['status', '--porcelain', '--untracked-files=no'], { cwd: target, encoding: 'utf8' })).toBe('');
    expect(existsSync(join(dir, 'sketches', 'components-chip.edit', 'sketch.json'))).toBe(true);
  });

  const directEdit = async (now: StatePictures) => {
    const { target, dir, config } = staleChip();
    const bare = { ...config, products: { acme: { ...config.products.acme, harness: undefined } } };
    const product = () => resolveProduct({ target, name: 'acme', config: bare.products.acme });
    const chip = join(dir, 'components/chip/chip.ts');
    const writeCache = (states: StatePictures) => {
      const current = product();
      const part = current.parts.find((each) => partKeyOf(each) === CHIP);

      if (!part) throw new Error('no chip');

      createPartPictureCache({ target, product: current }).write({
        part,
        partHash: partHashOf({ product: current, dir: join(dir, CHIP) }),
        states,
      });
    };

    writeFileSync(chip, 'export default definePart({ states: { default: {} } });\n');
    writeFileSync(join(target, '.gitignore'), '.ethlete/cache/\n.ethlete/design/*/pictures.json\n');
    gitExec(['init', '-q'], { cwd: target });
    recordMerged({ product: product(), parts: [CHIP] });
    writeCache({ default: 'a1' });
    gitExec(['add', '.'], { cwd: target });
    gitExec(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'merged'], { cwd: target });
    writeFileSync(chip, 'export default definePart({ states: { default: {} } });\n// direct edit\n');
    writeCache(now);

    const lines: string[] = [];
    const runner = startSlowRunner({
      target,
      configOf: () => bare,
      log: (line) => lines.push(line),
      intervalMs: 3_600_000,
    });

    for (let poll = 0; poll < 3; poll++) await runner.poll();
    runner.stop();

    const tracked = gitExec(['status', '--porcelain', '--untracked-files=no'], { cwd: target, encoding: 'utf8' })
      .split('\n')
      .filter((line) => line && !line.endsWith('chip.ts'));
    const answer = (await openPointsInWorker({ product: product(), part: CHIP })) as PartOpenPointsAnswer;
    const here = openPointsOf({ product: product(), part: CHIP }) as PartOpenPointsAnswer;
    const kindsOf = ({ points }: PartOpenPointsAnswer) => points.map(({ kind }) => kind);

    return { lines, tracked, answer, here, kindsOf, product };
  };

  it('shows no open point for a direct edit that draws as before while it runs, and writes no tracked file', async () => {
    const { lines, tracked, answer, here, kindsOf, product } = await directEdit({ default: 'a1' });

    expect(lines).toEqual([`HELD acme ${CHIP}: changed outside a sketch, every state draws as before`]);
    expect(tracked).toEqual([]);
    expect([here.directEdit, kindsOf(here)]).toEqual([false, expect.not.arrayContaining(['direct-edit'])]);
    expect([answer.directEdit, kindsOf(answer)]).toEqual([false, expect.not.arrayContaining(['direct-edit'])]);
    expect(changedOutsideSketchOf(product())).toEqual([CHIP]);
  });

  it('still shows a direct edit that draws differently as open while it runs', async () => {
    const { lines, tracked, answer, here, kindsOf } = await directEdit({ default: 'b2' });

    expect(lines[0]).toBe(`PICTURES CHANGED acme ${CHIP}: default`);
    expect(tracked).toEqual([]);
    expect(kindsOf(here)).toContain('direct-edit');
    expect(kindsOf(answer)).toContain('direct-edit');
  });
});
