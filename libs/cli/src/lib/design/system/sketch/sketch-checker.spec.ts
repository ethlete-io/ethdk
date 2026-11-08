import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { ruleProblemsOf } from '../check-system';
import { resolveProduct } from '../resolve-product';
import { createSketch, Sketch } from './sketch';
import { createSketchChecker, openSketchListingAt } from './sketch-checker';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-checker-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

describe('createSketchChecker', () => {
  const check = createSketchChecker();

  afterAll(() => check.close());

  it('answers what the checks find on this thread, once for listings asked at once, and fails an unknown product', async () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;

    writeFileSync(join(sketch.dir, 'b/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    const first = check({ target, product: 'acme' });
    const second = check({ target, product: 'acme' });

    expect(second).toBe(first);
    expect(await first).toEqual(openSketchListingAt({ target, product: 'acme' }));
    expect((await first).variants.map(({ variant, problems }) => [variant, problems.map(({ rule }) => rule)])).toEqual([
      ['a', []],
      ['b', ['HARD-CODED-COLOUR']],
    ]);
    await expect(check({ target, product: 'nope' })).rejects.toThrow(/nope/);
  }, 120_000);

  it('answers the rule problems of the files as they are when each check runs', async () => {
    const target = acme();
    const productOf = () =>
      resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const hero = productOf().parts.find(({ name }) => name === 'hero');

    expect(await check.rules({ target, product: 'acme' })).toEqual(ruleProblemsOf(productOf()));

    writeFileSync(join(hero?.file ?? '', '..', 'hero.css'), '.acme-hero { color: #fff; }');

    const edited = await check.rules({ target, product: 'acme' });

    expect(edited).toEqual(ruleProblemsOf(productOf()));
    expect(edited.map(({ rule }) => rule)).toContain('HARD-CODED-COLOUR');
    await expect(check.rules({ target, product: 'nope' })).rejects.toThrow(/nope/);
  }, 120_000);
});
