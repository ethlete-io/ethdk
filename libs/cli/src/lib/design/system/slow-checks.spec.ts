import { appendFileSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { StateShot } from './compare-command';
import { designHashOf } from './design-hash';
import { Problem } from './problem';
import { partKeyOf, resolveProduct } from './resolve-product';
import { RULE_BASELINE_FILE } from './rule-baseline';
import { slowInputsOf, slowProblemsOf, staleSlowPartsOf, writeSlowResults } from './slow-checks';
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
        harness: { app: 'apps/acme', map: 'apps/acme/src/map.ts', specs: 'apps/acme/vite.config.mts', baseBranch: 'x' },
      },
    });

  return { target, product };
};

const problem = { rule: 'APP-SPEC', file: 'apps/acme/src/chip.component.spec.ts', message: 'fails: chip' };

describe('slowProblemsOf', { timeout: 30_000 }, () => {
  it('is pending without a result, answers the stored problems, and is pending again once an input changes', () => {
    const { target, product } = acme();

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toBe('pending');

    writeSlowResults({
      product: product(),
      hashes: Object.fromEntries(
        Object.entries(slowInputsOf({ product: product() })).map(([part, { hash }]) => [part, hash]),
      ),
      results: new Map([['components/chip', [problem]]]),
    });

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toEqual([problem]);
    expect(slowProblemsOf({ product: product(), part: '(product)' })).toEqual([]);
    expect(staleSlowPartsOf(product())).toEqual([]);

    appendFileSync(join(target, 'apps/acme/src/chip.component.ts'), '// changed\n');

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toBe('pending');
    expect(staleSlowPartsOf(product())).toEqual(['components/chip', '(product)']);
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

    expect(inputs['components/chip']?.rules).toEqual(['CONTROL-STATE', 'DROPPED-PROP']);
    expect(inputs['(product)']?.rules).toEqual(['ACTION-LOST']);
    expect(inputs['components/button']).toBeUndefined();
  });

  it('runs the draw rules without a harness, stores them per part, and build-ready skips a baselined hit', async () => {
    const { target, dir, product, chipFile } = drawable();
    const hit = (at: string) => ({ rule: 'CONTROL-STATE', file: chipFile, message: `control "${at}" is drawn`, at });
    const results = await runSlowChecks({
      target,
      config: readConfig(target) ?? {},
      product: product(),
      runners: {
        controlState: async ({ parts }) => (parts?.includes('components/chip') ? [hit('section'), hit('product')] : []),
        droppedProps: async () => [],
        actionLost: async () => [],
      },
    });

    expect(results.get('components/chip')?.map((problem) => problem.at)).toEqual(['section', 'product']);
    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toHaveLength(2);

    writeFileSync(
      join(dir, RULE_BASELINE_FILE),
      JSON.stringify({ 'CONTROL-STATE': { 'components/chip: section': { finding: '489', sketch: 'x' } } }),
    );

    expect(slowProblemsOf({ product: product(), part: 'components/chip' })).toEqual([
      { ...hit('product'), file: '.ethlete/design/acme/components/chip/chip.ts' },
    ]);
  });
});

describe('a design-only change in the slow set', { timeout: 30_000 }, () => {
  const implemented = (dir: string, hash: string) =>
    writeFileSync(
      join(dir, 'implemented.json'),
      JSON.stringify({ 'components/chip': { hash, at: '2026-11-06T00:00:00Z' } }),
    );

  const designHash = (product: ReturnType<ReturnType<typeof acme>['product']>) =>
    designHashOf({ product, part: product.parts.find((part) => partKeyOf(part) === 'components/chip')! }).hash;

  const runners = (shots: StateShot[]) => ({
    specs: async () => [],
    droppedProps: async () => [],
    controlState: async () => [],
    start: async () => ({ url: 'http://app', stop: async () => undefined }),
    shoot: async () => ({ states: {}, shots }),
    visibleChange: async () => new Map<string, Problem[]>(),
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

  it('does not compare a part that was never implemented', () => {
    const { product } = acme();

    expect(slowInputsOf({ product: product() })['components/chip']?.rules).not.toContain('COMPARE');
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
