import { appendFileSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { resolveProduct } from './resolve-product';
import { slowInputsOf, slowProblemsOf, staleSlowPartsOf, writeSlowResults } from './slow-checks';

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
