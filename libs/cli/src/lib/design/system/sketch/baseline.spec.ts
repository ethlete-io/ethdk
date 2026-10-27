import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { partFilesOf } from '../product';
import { resolveProduct } from '../resolve-product';
import { baselineOf, conflictsOf } from './baseline';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-baseline-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const productDir = (target: string) => join(target, DESIGN_DIR, 'acme');

describe('baselineOf', () => {
  it('hashes each resolved part folder and the fixtures', () => {
    const baseline = baselineOf(resolveAcme(acme()));

    expect(Object.keys(baseline).sort()).toEqual([
      'components/button',
      'components/card',
      'elements/hero',
      'fixtures.ts',
      'foundations/palette',
      'foundations/tokens',
      'pages/home',
    ]);
    expect(baseline['elements/hero']).toMatch(/^[0-9a-f]{16}$/u);
  });
});

describe('conflictsOf', () => {
  it('names the parts a variant replaces that changed, came or went in the product', () => {
    const target = acme();
    const baseline = baselineOf(resolveAcme(target));
    const variant = productDir(target);
    const { parts } = partFilesOf(variant);
    const conflicts = () => conflictsOf({ product: resolveAcme(target), baseline, parts, fixtures: true });

    expect(conflicts()).toEqual([]);

    writeFileSync(join(productDir(target), 'elements/hero/hero.css'), '.acme-hero {}');
    rmSync(join(productDir(target), 'pages/home'), { recursive: true });
    writeFileSync(join(productDir(target), 'fixtures.ts'), 'export default {};');

    expect(conflicts()).toEqual(['elements/hero', 'pages/home', 'fixtures.ts']);

    mkdirSync(join(productDir(target), 'components/badge'));
    writeFileSync(join(productDir(target), 'components/badge/badge.ts'), 'export default 1;');

    expect(
      conflictsOf({
        product: resolveAcme(target),
        baseline,
        parts: [{ layer: 'components', name: 'badge', file: join(variant, 'components/badge/badge.ts') }],
        fixtures: false,
      }),
    ).toEqual(['components/badge']);
  });
});
