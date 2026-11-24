import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { StateShot } from './compare-command';
import { designHashOf } from './design-hash';
import { Problem } from './problem';
import { RULE_BASELINE_FILE } from './rule-baseline';
import { partKeyOf, resolveProduct, type ResolvedProduct } from './resolve-product';
import {
  readSlowCache,
  slowCacheFileOf,
  slowInputsOf,
  slowProblemsOf,
  staleSlowPartsOf,
  unjudgedStateWarningsOf,
  writeSlowResults,
} from './slow-checks';
import { runSlowChecks } from './slow-run';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-slow-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, 'apps/acme/src'), { recursive: true });
  writeFileSync(
    join(target, 'apps/acme/src/chip.component.ts'),
    "@Component({ selector: 'acme-chip' })\nexport class Chip {}\n",
  );

  const chip = join(target, DESIGN_DIR, 'acme/components/chip');

  mkdirSync(chip, { recursive: true });
  writeFileSync(
    join(chip, 'chip.ts'),
    "export default definePart({ implements: 'apps/acme/src/chip.component.ts', states: { default: {} } });\n",
  );

  const product = () =>
    resolveProduct({
      target,
      name: 'acme',
      config: {
        ...readConfig(target)?.products?.['acme'],
        harness: { app: 'apps/acme', map: 'apps/acme/src/map.ts', specs: 'apps/acme/vite.config.mts' },
      },
    });

  return { target, product };
};

const problem = { rule: 'APP-SPEC', file: 'apps/acme/src/chip.component.spec.ts', message: 'fails: chip' };

describe('slow cache of worktrees sharing node_modules', () => {
  it('keeps the result of one checkout out of another', () => {
    const first = acme();
    const second = acme();

    mkdirSync(join(first.target, 'node_modules'), { recursive: true });
    symlinkSync(join(first.target, 'node_modules'), join(second.target, 'node_modules'));

    const part = 'components/chip';
    const hashes = { [part]: 'h' };

    writeSlowResults({ product: first.product(), hashes, results: new Map() });
    writeSlowResults({ product: second.product(), hashes, results: new Map([[part, [problem]]]) });

    expect(slowCacheFileOf(first.product())).not.toBe(slowCacheFileOf(second.product()));
    expect(readSlowCache(first.product())[part]?.hash).toBe('h');
    expect(readSlowCache(second.product())[part]).toBeUndefined();
  });
});

describe('slowProblemsOf', { timeout: 30_000 }, () => {
  const storeAll = (product: () => ResolvedProduct, results: Map<string, Problem[]>) =>
    writeSlowResults({
      product: product(),
      hashes: Object.fromEntries(
        Object.entries(slowInputsOf({ product: product() })).map(([part, { hash }]) => [part, hash]),
      ),
      results,
    });

  it('is pending without a result, answers a stored pass, and is pending again once an input changes', () => {
    const { target, product } = acme();

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toBe('pending');

    storeAll(product, new Map());

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toEqual([]);
    expect(staleSlowPartsOf(product())).toEqual([]);

    appendFileSync(join(target, 'apps/acme/src/chip.component.ts'), '// changed\n');

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toBe('pending');
    expect(staleSlowPartsOf(product())).toEqual(['components/chip', '(product)']);
  });

  it('does not keep a failure: it stays pending, so the next run reruns it and a pass is then stored', () => {
    const { product } = acme();

    storeAll(product, new Map([['components/chip', [problem]]]));

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toBe('pending');
    expect(staleSlowPartsOf(product())).toEqual(['components/chip']);

    storeAll(product, new Map());

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toEqual([]);
  });

  it('drops a stored pass when the same inputs then fail', () => {
    const { product } = acme();

    storeAll(product, new Map());
    storeAll(product, new Map([['components/chip', [problem]]]));

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toBe('pending');
  });

  it('ignores a failure an older run stored', () => {
    const { product } = acme();

    storeAll(product, new Map());

    const file = slowCacheFileOf(product());
    const cache = JSON.parse(readFileSync(file, 'utf8'));

    cache['components/chip'].problems = [problem];
    writeFileSync(file, JSON.stringify(cache));

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toBe('pending');
  });

  it('stores a part whose only problems are baselined, so it is not pending forever', () => {
    const { target, product } = acme();
    const baselined: Problem = {
      rule: 'CONTROL-STATE',
      file: join(DESIGN_DIR, 'acme/components/chip/chip.ts'),
      message: 'section has no control state',
      at: 'section',
    };

    writeFileSync(
      join(target, DESIGN_DIR, 'acme', RULE_BASELINE_FILE),
      JSON.stringify({ 'CONTROL-STATE': { 'components/chip: section': { finding: '489', sketch: 'components/x' } } }),
    );
    storeAll(product, new Map([['components/chip', [baselined]]]));

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toEqual([]);
  });

  it('answers no problems for a part no slow rule checks', () => {
    const { product } = acme();

    expect(slowProblemsOf({ product: product(), part: 'components/button' })).toEqual([]);
  });
});

describe('the draw rules in the slow set', { timeout: 30_000 }, () => {
  const drawable = () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-slow-draw-'));

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

    const product = () =>
      resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const chipFile = join(dir, 'components/chip/chip.ts');

    return { target, dir, product, chipFile };
  };

  it('checks CONTROL-STATE on a part that declares controls, DROPPED-PROP on a linked one, ACTION-LOST on the product', () => {
    const { product } = drawable();
    const inputs = slowInputsOf({ product: product() });

    expect(inputs['components/chip']?.rules).toEqual([
      'CONTROL-STATE',
      'DROPPED-PROP',
      'STATE-NO-SOURCE',
      'STATE-UNDESIGNED',
    ]);
    expect(inputs['(product)']?.rules).toEqual(['ACTION-LOST']);
    expect(inputs['components/button']).toBeUndefined();
  });

  it('hashes only the asked parts, at the hashes of a whole run, unless the product is asked', () => {
    const { product } = drawable();
    const whole = slowInputsOf({ product: product() });

    expect(slowInputsOf({ product: product(), only: ['components/chip'] })).toEqual({
      'components/chip': whole['components/chip'],
    });
    expect(slowInputsOf({ product: product(), only: ['components/chip', '(product)'] })).toEqual(whole);
  });

  it('keys the product inputs on the recorded actions, not on the rest of ready.json', () => {
    const { dir, product } = drawable();
    const productHash = () => slowInputsOf({ product: product() })['(product)']?.hash;
    const writeReady = (chip: object) =>
      writeFileSync(
        join(dir, 'ready.json'),
        JSON.stringify({
          'components/chip': { hash: 'h', at: '2026-11-06T00:00:00Z', actions: ['open'] },
          'components/button': { hash: 'b', at: '2026-11-06T00:00:00Z', actions: ['press'], ...chip },
        }),
      );

    writeReady({});
    const before = productHash();

    writeReady({ hash: 'other', at: '2026-11-18T09:00:00Z', by: 'et design check', cmd: 'check', pid: 42 });
    expect(productHash()).toBe(before);

    writeReady({ actions: ['press', 'release'] });
    expect(productHash()).not.toBe(before);
  });

  it('runs the draw rules without a harness, and keeps no failing result', async () => {
    const { target, product, chipFile } = drawable();
    const hit = (at: string) => ({ rule: 'CONTROL-STATE', file: chipFile, message: `control "${at}" is drawn`, at });
    const results = await runSlowChecks({
      target,
      config: readConfig(target) ?? {},
      product: product(),
      runners: {
        controlState: async ({ parts }) => (parts?.includes('components/chip') ? [hit('section'), hit('product')] : []),
        droppedProps: async () => [],
        actionLost: async () => [],
        stateInner: async () => [],
      },
    });

    expect(results.get('components/chip')?.map((problem) => problem.at)).toEqual(['section', 'product']);
    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toBe('pending');
  });
});

describe('a design-only change in the slow set', { timeout: 30_000 }, () => {
  const implemented = (dir: string, hash: string) =>
    writeFileSync(
      join(dir, 'implemented.json'),
      JSON.stringify({ 'components/chip': { hash, at: '2026-11-06T00:00:00Z', states: {}, files: {}, app: {} } }),
    );

  const designHash = (product: ReturnType<ReturnType<typeof acme>['product']>) =>
    designHashOf({ product, part: product.parts.find((part) => partKeyOf(part) === 'components/chip')! }).hash;

  const runners = (shots: StateShot[]) => ({
    specs: async () => [],
    droppedProps: async () => [],
    controlState: async () => [],
    start: async () => ({ url: 'http://app', stop: async () => undefined }),
    shoot: async () => ({ states: {}, shots }),
  });

  it('starts the compare for a part whose design moved on after it was implemented', () => {
    const { target, product } = acme();
    const dir = join(target, DESIGN_DIR, 'acme');

    implemented(dir, 'older');

    const inputs = slowInputsOf({ product: product() })['components/chip'];

    expect(inputs?.rules).toContain('COMPARE');
    expect(inputs?.rules).not.toContain('SDK-ERROR');
    expect(inputs?.designOnly).toBe(true);

    implemented(dir, designHash(product()));

    const same = slowInputsOf({ product: product() })['components/chip'];

    expect(same?.rules).toEqual(expect.arrayContaining(['COMPARE', 'SDK-ERROR']));
    expect(same?.designOnly).toBeUndefined();
  });

  it('compares a part that was never implemented for its overlay panes only', async () => {
    const { target, product } = acme();
    const inputs = slowInputsOf({ product: product() })['components/chip'];

    expect(inputs?.rules).toContain('COMPARE');
    expect(inputs?.panesOnly).toBe(true);

    const results = await runSlowChecks({
      target,
      config: readConfig(target) ?? {},
      product: product(),
      parts: ['components/chip'],
      runners: runners([
        { state: 'open', problem: 'the design draws 1 overlay pane, the app opened 0', missingPanes: true },
        { state: 'direct-edit', problem: 'no "Gründe" trigger', undrivable: true },
        { state: 'default', design: Buffer.from('a'), app: Buffer.from('b') },
      ]),
    });

    expect((results.get('components/chip') ?? []).map(({ rule, message }) => [rule, message])).toEqual([
      ['COMPARE', 'open: the design draws 1 overlay pane, the app opened 0'],
    ]);
  });

  it('fails a state the app cannot drive and names the app component, and ignores a pixel difference', async () => {
    const { target, product } = acme();

    implemented(join(target, DESIGN_DIR, 'acme'), 'older');

    const results = await runSlowChecks({
      target,
      config: readConfig(target) ?? {},
      product: product(),
      parts: ['components/chip'],
      runners: runners([
        { state: 'direct-edit', problem: 'no "Gründe" trigger', undrivable: true },
        { state: 'default', problem: 'drawn differently' },
      ]),
    });
    const problems = results.get('components/chip') ?? [];

    expect(problems).toHaveLength(1);
    expect(problems[0]?.rule).toBe('COMPARE');
    expect(problems[0]?.message).toContain('direct-edit');
    expect(problems[0]?.message).toContain('apps/acme/src/chip.component.ts');
  });

  it('warns on every check of each state it could not judge, also one the design-only compare does not fail', async () => {
    const { target, product } = acme();

    implemented(join(target, DESIGN_DIR, 'acme'), 'older');

    await runSlowChecks({
      target,
      config: readConfig(target) ?? {},
      product: product(),
      parts: ['components/chip'],
      runners: runners([
        { state: 'open', problem: 'the app opens no overlay pane' },
        { state: 'default', design: Buffer.from('a'), app: Buffer.from('b') },
      ]),
    });

    const warnings = () => unjudgedStateWarningsOf({ product: product(), parts: ['components/chip'] });

    expect(warnings()).toEqual([
      'WARNING acme components/chip: state open cannot be judged - the app opens no overlay pane',
    ]);
    expect(warnings()).toEqual(warnings());
  });

  it('passes a design-only change whose states are all drivable', async () => {
    const { target, product } = acme();

    implemented(join(target, DESIGN_DIR, 'acme'), 'older');

    const results = await runSlowChecks({
      target,
      config: readConfig(target) ?? {},
      product: product(),
      parts: ['components/chip'],
      runners: runners([{ state: 'default', design: Buffer.from('a'), app: Buffer.from('b') }]),
    });

    expect(results.get('components/chip') ?? []).toEqual([]);
  });
});
