import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
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
  stylesheetModuleIdOf,
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
    expect(system.resolveId('./missing.css?inline', hero)).toBeNull();
    expect(system.resolveId('@system/components/button', join(target, 'other.ts'))).toBeNull();
    expect(system.resolveId('@system/components/button', productModuleIdOf({ file, product: 'nope' }))).toBeNull();
  });

  it('resolves @system imports inside a sketch variant to the parts that variant holds', () => {
    const { target, system } = acme();
    const product = system.productOf('acme');
    const parsed = parseTarget('components/button');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ merge: 'override', product, sketch: parsed, variants: ['a', 'b'] });

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

  it('reads sketches from sketchesRoot instead of the product folder', () => {
    const { target, system } = acme();
    const product = system.productOf('acme');
    const parsed = parseTarget('components/button');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ merge: 'override', product, sketch: parsed, variants: ['a'] });

    const empty = mkdtempSync(join(tmpdir(), 'cli-design-root-'));
    const elsewhere = createSystemModules({ target, config: readConfig(target) ?? {}, sketchesRoot: empty });
    const sketch = { target: 'components/button', variant: 'a' };

    expect(system.sketchesOf('acme')).toHaveLength(1);
    expect(elsewhere.sketchesOf('acme')).toEqual([]);
    expect(elsewhere.partOf({ product: 'acme', part: 'components/button', sketch })).toBeNull();
  });

  it("resolves @shared/ inside a sketch variant to the sketch's shared folder, and keeps a relative helper in the product", () => {
    const { target, system } = acme();
    const product = system.productOf('acme');
    const parsed = parseTarget('elements/hero');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a'] });

    const design = join(target, DESIGN_DIR);
    const sketchDir = join(design, 'acme/sketches/elements-hero');
    const sketch = { target: 'elements/hero', variant: 'a' };
    const hero = productModuleIdOf({ file: join(sketchDir, 'a/elements/hero/hero.ts'), product: 'acme', sketch });

    mkdirSync(join(sketchDir, 'shared/data'), { recursive: true });
    writeFileSync(join(sketchDir, 'shared/comments.ts'), 'export const comments = [];\n');
    writeFileSync(join(sketchDir, 'shared/data/index.ts'), 'export const data = 1;\n');
    writeFileSync(join(sketchDir, 'a/elements/hero/helper.ts'), 'export const helper = 1;\n');

    expect(system.resolveId('@shared/comments', hero)).toBe(
      productModuleIdOf({ file: join(sketchDir, 'shared/comments.ts'), product: 'acme', sketch }),
    );
    expect(system.resolveId('@shared/data', hero)).toBe(
      productModuleIdOf({ file: join(sketchDir, 'shared/data/index.ts'), product: 'acme', sketch }),
    );
    expect(system.resolveId('@shared/missing', hero)).toBeNull();
    expect(
      system.resolveId(
        '@shared/comments',
        productModuleIdOf({ file: join(design, 'acme/elements/hero/hero.ts'), product: 'acme' }),
      ),
    ).toBeNull();
    expect(system.resolveId('./helper', hero)).toBe(
      productModuleIdOf({ file: join(sketchDir, 'a/elements/hero/helper.ts'), product: 'acme', sketch }),
    );
    expect(system.resolveId('./helper.ts?raw', hero)).toBeNull();
    expect(system.resolveId('./hero.css', hero)).toBe(
      productModuleIdOf({ file: join(sketchDir, 'a/elements/hero/hero.css'), product: 'acme', sketch }),
    );
  });

  it("resolves @shared/ inside a merged part to the product's shared folder, and a sketch's own file first", () => {
    const { target, system } = acme();
    const product = system.productOf('acme');
    const parsed = parseTarget('elements/hero');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    const design = join(target, DESIGN_DIR);
    const hero = productModuleIdOf({ file: join(design, 'acme/elements/hero/hero.ts'), product: 'acme' });

    mkdirSync(join(design, 'acme/shared'), { recursive: true });
    writeFileSync(join(design, 'acme/shared/sheet.ts'), 'export const sheet = 1;\n');
    writeFileSync(join(design, 'acme/shared/sheet.css'), '.sheet {}\n');

    expect(system.resolveId('@shared/sheet', hero)).toBe(
      productModuleIdOf({ file: join(design, 'acme/shared/sheet.ts'), product: 'acme' }),
    );
    expect(system.resolveId('@shared/sheet.css?inline', hero)).toBe(
      stylesheetModuleIdOf({
        file: join(design, 'acme/shared/sheet.css'),
        query: 'inline',
        product: 'acme',
        sketch: null,
      }),
    );
    expect(system.resolveId('@shared/missing', hero)).toBeNull();

    createSketch({ product, sketch: parsed, variants: ['a'] });

    const sketchDir = join(design, 'acme/sketches/elements-hero');
    const sketch = { target: 'elements/hero', variant: 'a' };
    const sketched = productModuleIdOf({ file: join(sketchDir, 'a/elements/hero/hero.ts'), product: 'acme', sketch });

    expect(system.resolveId('@shared/sheet', sketched)).toBe(
      productModuleIdOf({ file: join(design, 'acme/shared/sheet.ts'), product: 'acme', sketch }),
    );

    mkdirSync(join(sketchDir, 'shared'), { recursive: true });
    writeFileSync(join(sketchDir, 'shared/sheet.ts'), 'export const sheet = 2;\n');

    expect(system.resolveId('@shared/sheet', sketched)).toBe(
      productModuleIdOf({ file: join(sketchDir, 'shared/sheet.ts'), product: 'acme', sketch }),
    );
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
      `${join(own, 'tokens.css')}?inline&design-product=acme`,
    );
    expect(system.resolveId('@system/foundations/tokens.css', inProduct('acme-base'))).toBe(
      `${join(design, 'acme-base/foundations/tokens/tokens.css')}?design-product=acme-base`,
    );
    expect(system.resolveId('@system/pages/home.css?inline', inProduct('acme'))).toBeNull();

    const product = system.productOf('acme');
    const parsed = parseTarget('foundations/tokens');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ merge: 'override', product, sketch: parsed, variants: ['a'] });

    expect(
      system.resolveId(
        '@system/foundations/tokens.css?inline',
        inProduct('acme', { target: 'foundations/tokens', variant: 'a' }),
      ),
    ).toBe(
      `${join(design, 'acme/sketches/foundations-tokens/a/foundations/tokens/tokens.css')}?inline&design-product=acme&design-sketch=foundations%2Ftokens&design-variant=a`,
    );
  });

  it('resolves @assets/ to the product, then its base, with a sketch variant first, and rewrites url(@assets/) in a stylesheet', () => {
    const { target, system } = acme();
    const design = join(target, DESIGN_DIR);
    const write = (path: string) => {
      mkdirSync(join(design, path, '..'), { recursive: true });
      writeFileSync(join(design, path), path);
    };

    write('acme/assets/mark.png');
    write('acme/assets/icons/dot.svg');
    write('acme-base/assets/mark.png');
    write('acme-base/assets/base.webp');

    const card = join(design, 'acme-base/components/card/card.ts');
    const inAcme = productModuleIdOf({ file: card, product: 'acme' });

    expect(system.resolveId('@assets/mark.png', inAcme)).toBe(`${join(design, 'acme/assets/mark.png')}?url`);
    expect(system.resolveId('@assets/icons/dot.svg?raw', inAcme)).toBe(
      `${join(design, 'acme/assets/icons/dot.svg')}?raw`,
    );
    expect(system.resolveId('@assets/base.webp', inAcme)).toBe(`${join(design, 'acme-base/assets/base.webp')}?url`);
    expect(system.resolveId('@assets/mark.png', productModuleIdOf({ file: card, product: 'acme-base' }))).toBe(
      `${join(design, 'acme-base/assets/mark.png')}?url`,
    );
    expect(system.resolveId('@assets/missing.png', inAcme)).toBeNull();
    expect(system.resolveId('@assets/../config.json', inAcme)).toBeNull();

    const product = system.productOf('acme');
    const parsed = parseTarget('elements/hero');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a'] });
    write('acme/sketches/elements-hero/a/assets/mark.png');

    const sketch = { target: 'elements/hero', variant: 'a' };
    const inVariant = productModuleIdOf({ file: card, product: 'acme', sketch });

    expect(system.resolveId('@assets/mark.png', inVariant)).toBe(
      `${join(design, 'acme/sketches/elements-hero/a/assets/mark.png')}?url`,
    );
    expect(system.resolveId('@assets/base.webp', inVariant)).toBe(`${join(design, 'acme-base/assets/base.webp')}?url`);

    const css = ".a { background: url('@assets/mark.png'); } .b { src: url(@assets/missing.woff2); }";
    const stylesheet = (sketched?: typeof sketch) =>
      join(design, 'acme/elements/hero/hero.css') +
      productModuleIdOf({ file: '', product: 'acme', sketch: sketched }).replace('?', '?inline&');

    expect(system.withAssetUrls(css, stylesheet())).toBe(
      `.a { background: url("/@fs${join(design, 'acme/assets/mark.png')}"); } .b { src: url(@assets/missing.woff2); }`,
    );
    expect(system.withAssetUrls(css, stylesheet(sketch))).toContain(
      `url("/@fs${join(design, 'acme/sketches/elements-hero/a/assets/mark.png')}")`,
    );
    expect(system.withAssetUrls(css, join(design, 'acme/elements/hero/hero.css'))).toBeNull();
  });

  it('lists the stylesheets of the default tokens part when a product names none', () => {
    const { target, system } = acme();

    expect(system.tokenStylesheetsOf({ product: 'acme' })).toEqual([
      join(target, DESIGN_DIR, 'acme-base/foundations/tokens/tokens.css'),
    ]);
  });

  it('lists the stylesheets of every part a product names as tokens, in order, skips a missing one, and takes a sketch variant first', () => {
    const { target } = acme();
    const design = join(target, DESIGN_DIR);
    const configFile = join(design, 'config.json');
    const config = JSON.parse(readFileSync(configFile, 'utf8'));

    config.products.acme.tokens = [
      'foundations/palette',
      'foundations/missing',
      'foundations/tokens',
      'foundations/fresh',
    ];
    writeFileSync(configFile, JSON.stringify(config));

    const system = createSystemModules({ target, config: readConfig(target) ?? {} });
    const product = system.productOf('acme');
    const parsed = parseTarget('foundations/fresh');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a'] });

    const palette = join(design, 'acme/foundations/palette/palette.css');
    const tokens = join(design, 'acme-base/foundations/tokens/tokens.css');

    expect(system.tokenStylesheetsOf({ product: 'acme' })).toEqual([palette, tokens]);
    expect(
      system.tokenStylesheetsOf({ product: 'acme', sketch: { target: 'foundations/fresh', variant: 'a' } }),
    ).toEqual([palette, tokens, join(design, 'acme/sketches/foundations-fresh/a/foundations/fresh/fresh.css')]);
    expect(system.tokenStylesheetsOf({ product: 'acme-base' })).toEqual([tokens]);
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
