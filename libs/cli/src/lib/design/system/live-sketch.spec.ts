import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../paths';
import { designCompare, ShootStates } from './compare-command';
import { liveSketchOf } from './live-compare';
import { resolveProduct } from './resolve-product';
import { createSketch, Sketch } from './sketch/sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-live-sketch-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

describe('liveSketchOf', () => {
  it('finds the part file of a sketch variant, or says why not', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const file = join(sketch.dir, 'a/elements/hero/hero.ts');

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'export default {};');

    expect(liveSketchOf({ product, part: 'elements/hero', variant: 'a' })).toEqual({
      file,
      drawn: { target: sketch.target, variant: 'a' },
    });
    expect(liveSketchOf({ product, part: 'elements/hero', variant: 'z' })).toContain('has no variant "z"');
    expect(liveSketchOf({ product, part: 'elements/nope', variant: 'a' })).toBe('no open sketch targets elements/nope');
  });
});

describe('design compare --sketch', () => {
  it('refuses --sketch without --live', async () => {
    const target = acme();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const shoot = vi.fn<ShootStates>(async () => 'stop');
    const base = ['pages/home', '--product', 'acme', '--url', 'http://x', '--sketch', 'a'];

    expect(await designCompare({ target, argv: base, invocation: 'et design', shoot })).toBe(2);
    expect(shoot).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
