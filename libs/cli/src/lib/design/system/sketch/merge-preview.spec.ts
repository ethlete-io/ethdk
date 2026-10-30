import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { mergePreviewOf } from './merge-preview';
import { createSketch, Sketch } from './sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-preview-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

describe('mergePreviewOf', () => {
  it('lists each element and page that uses a changed part, also through another part', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      merge: 'override',
      product,
      sketch: { layer: 'components', name: 'button' },
      variants: ['a'],
    }) as Sketch;

    expect(mergePreviewOf({ product, sketch, variant: 'a' })).toEqual({
      changed: ['components/button'],
      shared: [],
      affected: ['elements/hero', 'pages/home'],
    });
  });

  it('lists nobody for a new part', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'banner' }, variants: ['a'] }) as Sketch;

    expect(mergePreviewOf({ product, sketch, variant: 'a' })).toEqual({
      changed: ['elements/banner'],
      shared: [],
      affected: [],
    });
  });

  it('leaves out the components between a change and a page', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({ product, sketch: { layer: 'components', name: 'card' }, variants: ['a'] }) as Sketch;

    expect(mergePreviewOf({ product, sketch, variant: 'a' }).affected).toEqual(['pages/home']);
  });

  it('lists a page that uses a changed part through a plain module of its folder', () => {
    const target = acme();
    const page = join(target, DESIGN_DIR, 'acme/pages/promo');

    mkdirSync(join(page, 'shared'), { recursive: true });
    writeFileSync(join(page, 'promo.ts'), "import { label } from './shared/promo-data';\nexport default label;\n");
    writeFileSync(
      join(page, 'shared/promo-data.ts'),
      "import button from '@system/components/button';\nexport const label = button;\n",
    );

    const product = resolveAcme(target);
    const sketch = createSketch({
      merge: 'override',
      product,
      sketch: { layer: 'components', name: 'button' },
      variants: ['a'],
    }) as Sketch;

    expect(mergePreviewOf({ product, sketch, variant: 'a' }).affected).toContain('pages/promo');
  });

  it('names each part that imports a shared/ file the variant edits, and the pages that show it', () => {
    const target = acme();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    mkdirSync(join(target, DESIGN_DIR, 'acme/shared'));
    writeFileSync(join(target, DESIGN_DIR, 'acme/shared/tone.ts'), 'export const tone = 1;\n');
    writeFileSync(
      hero,
      `import { tone } from '@shared/tone';\n${readFileSync(hero, 'utf8')}\nexport const t = tone;\n`,
    );

    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'foundations', name: 'palette' },
      variants: ['a', 'b'],
    }) as Sketch;

    mkdirSync(join(sketch.dir, 'a/shared'));
    writeFileSync(join(sketch.dir, 'a/shared/tone.ts'), 'export const tone = 2;\n');
    mkdirSync(join(sketch.dir, 'b/shared'));
    writeFileSync(join(sketch.dir, 'b/shared/tone.ts'), 'export const tone = 1;\n');

    expect(mergePreviewOf({ product, sketch, variant: 'a' })).toEqual({
      changed: ['elements/hero', 'foundations/palette'],
      shared: ['elements/hero'],
      affected: ['pages/home'],
    });
    expect(mergePreviewOf({ product, sketch, variant: 'b' }).shared).toEqual([]);
  });
});
