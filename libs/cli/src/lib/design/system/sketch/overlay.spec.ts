import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../paths';
import { partKeyOf, resolveProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { createSketch, Sketch } from './sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-overlay-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const write = (sketch: Sketch, path: string, content: string) => {
  mkdirSync(dirname(join(sketch.dir, path)), { recursive: true });
  writeFileSync(join(sketch.dir, path), content);
};

const heroSketch = (target: string) =>
  createSketch({
    product: resolveAcme(target),
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b'],
  }) as Sketch;

describe('overlaySketch', () => {
  it('lays the parts of one variant over the product', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = heroSketch(target);

    write(sketch, 'b/components/card/card.ts', "export default 'card b';");

    const overlaid = overlaySketch({ product, sketch, variant: 'b' });
    const partOf = (key: string) => overlaid.parts.find((part) => partKeyOf(part) === key);

    expect(overlaid.sketched.sort()).toEqual(['components/card', 'elements/hero']);
    expect(partOf('components/card')).toEqual(
      expect.objectContaining({ origin: 'overridden', source: "export default 'card b';" }),
    );
    expect(partOf('elements/hero')?.file).toBe(join(sketch.dir, 'b/elements/hero/hero.ts'));
    expect(partOf('components/button')?.file).toBe(product.parts.find((part) => part.name === 'button')?.file);
    expect(overlaid.parts.map(partKeyOf)).toEqual(product.parts.map(partKeyOf));
    expect(overlaySketch({ product, sketch, variant: 'a' }).sketched).toEqual(['elements/hero']);
  });

  it('adds a new part and takes the fixtures of the variant', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'header' }, variants: ['a'] }) as Sketch;

    write(sketch, 'a/fixtures.ts', 'export const films = [];');

    const overlaid = overlaySketch({ product, sketch, variant: 'a' });

    expect(overlaid.parts.map(partKeyOf)).toContain('elements/header');
    expect(overlaid.fixtures).toBe(join(sketch.dir, 'a/fixtures.ts'));
  });

  it('reports a part above the target layer', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = heroSketch(target);

    write(sketch, 'a/pages/home/home.ts', 'export default 1;');

    expect(overlaySketch({ product, sketch, variant: 'a' }).problems).toEqual([
      {
        rule: 'SKETCH',
        file: join(sketch.dir, 'a/pages/home/home.ts'),
        message: 'a sketch on elements/hero may change elements and the layers below it, not pages/home',
      },
    ]);
  });

  it('lets each target of a sketch with several targets open its own layer', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'components', name: 'button' },
      others: [{ layer: 'elements', name: 'hero' }],
      variants: ['a'],
    }) as Sketch;

    write(sketch, 'a/pages/home/home.ts', 'export default 1;');

    expect(overlaySketch({ product, sketch, variant: 'a' }).problems).toEqual([
      {
        rule: 'SKETCH',
        file: join(sketch.dir, 'a/pages/home/home.ts'),
        message:
          'a sketch on components/button, elements/hero may change their layers and the layers below them, not pages/home',
      },
    ]);
  });
});
