import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { createSketch, parseTarget } from './sketch/sketch';
import {
  createSystemModules,
  fileOfModuleId,
  productModuleIdOf,
  productOfModuleId,
  sketchOfModuleId,
} from './system-modules';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-modules-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return { target, system: createSystemModules({ target, config: readConfig(target) ?? {} }) };
};

describe('createSystemModules', () => {
  it('resolves @system imports inside a base part to the parts of the product that draws it', () => {
    const { target, system } = acme();
    const design = join(target, DESIGN_DIR);
    const card = join(design, 'acme-base/components/card/card.ts');
    const inProduct = (product: string) => productModuleIdOf({ file: card, product });

    expect(system.resolveId('@system/components/button', inProduct('acme'))).toBe(
      productModuleIdOf({ file: join(design, 'acme/components/button/button.ts'), product: 'acme' }),
    );
    expect(system.resolveId('@system/components/button', inProduct('acme-base'))).toBe(
      productModuleIdOf({ file: join(design, 'acme-base/components/button/button.ts'), product: 'acme-base' }),
    );
    expect(system.resolveId('@system/fixtures', inProduct('acme'))).toBe(
      productModuleIdOf({ file: join(design, 'acme/fixtures.ts'), product: 'acme' }),
    );
  });

  it('leaves every other import, and imports from outside a product, to Vite', () => {
    const { target, system } = acme();
    const file = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');
    const hero = productModuleIdOf({ file, product: 'acme' });

    expect(system.resolveId('@system/components/missing', hero)).toBeNull();
    expect(system.resolveId('./hero.css?inline', hero)).toBeNull();
    expect(system.resolveId('@system/components/button', join(target, 'other.ts'))).toBeNull();
    expect(system.resolveId('@system/components/button', productModuleIdOf({ file, product: 'nope' }))).toBeNull();
  });

  it('resolves @system imports inside a sketch variant to the parts that variant holds', () => {
    const { target, system } = acme();
    const product = system.productOf('acme');
    const parsed = parseTarget('components/button');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a', 'b'] });

    const design = join(target, DESIGN_DIR);
    const sketch = { target: 'components/button', variant: 'b' };
    const hero = productModuleIdOf({ file: join(design, 'acme/elements/hero/hero.ts'), product: 'acme', sketch });
    const variantButton = join(design, 'acme/sketches/components-button/b/components/button/button.ts');

    expect(system.resolveId('@system/components/button', hero)).toBe(
      productModuleIdOf({ file: variantButton, product: 'acme', sketch }),
    );
    expect(system.partOf({ product: 'acme', part: 'components/button', sketch })?.file).toBe(variantButton);
    expect(
      system.partOf({ product: 'acme', part: 'components/button', sketch: { ...sketch, variant: 'z' } }),
    ).toBeNull();
    expect(system.partOf({ product: 'acme', part: 'components/button' })?.file).toBe(
      join(design, 'acme/components/button/button.ts'),
    );
    expect(sketchOfModuleId(hero)).toEqual(sketch);
    expect(sketchOfModuleId(productModuleIdOf({ file: 'x.ts', product: 'acme' }))).toBeNull();
  });

  it("resolves a part's stylesheet import inside a base part to the product's override, and to a sketch's", () => {
    const { target, system } = acme();
    const design = join(target, DESIGN_DIR);
    const button = join(design, 'acme-base/components/button/button.ts');
    const own = join(design, 'acme/foundations/tokens');

    mkdirSync(own, { recursive: true });
    writeFileSync(join(own, 'tokens.ts'), '');
    writeFileSync(join(own, 'tokens.css'), '');

    const inProduct = (product: string, sketch?: { target: string; variant: string }) =>
      productModuleIdOf({ file: button, product, sketch });

    expect(system.resolveId('@system/foundations/tokens.css?inline', inProduct('acme'))).toBe(
      `${join(own, 'tokens.css')}?inline`,
    );
    expect(system.resolveId('@system/foundations/tokens.css', inProduct('acme-base'))).toBe(
      join(design, 'acme-base/foundations/tokens/tokens.css'),
    );
    expect(system.resolveId('@system/pages/home.css?inline', inProduct('acme'))).toBeNull();

    const product = system.productOf('acme');
    const parsed = parseTarget('foundations/tokens');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a'] });

    expect(
      system.resolveId(
        '@system/foundations/tokens.css?inline',
        inProduct('acme', { target: 'foundations/tokens', variant: 'a' }),
      ),
    ).toBe(`${join(design, 'acme/sketches/foundations-tokens/a/foundations/tokens/tokens.css')}?inline`);
  });

  it('keeps a resolved product until forget', () => {
    const { target, system } = acme();

    expect(system.partOf({ product: 'acme', part: 'components/badge' })).toBeNull();

    mkdirSync(join(target, DESIGN_DIR, 'acme/components/badge'), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, 'acme/components/badge/badge.ts'), '');

    expect(system.partOf({ product: 'acme', part: 'components/badge' })).toBeNull();

    system.forget();

    expect(system.partOf({ product: 'acme', part: 'components/badge' })?.origin).toBe('product');
  });

  it('reads the product and the file back out of a module id', () => {
    const id = productModuleIdOf({ file: '/w/a b/x.ts', product: 'acme base' });

    expect(productOfModuleId(id)).toBe('acme base');
    expect(fileOfModuleId(id)).toBe('/w/a b/x.ts');
    expect(productOfModuleId('/w/x.css?inline')).toBeNull();
  });
});
