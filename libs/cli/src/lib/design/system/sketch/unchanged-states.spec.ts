import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { createSketch, Sketch, variantDirOf } from './sketch';
import { PictureOf } from '../../merge-compare';
import { SketchPartLoader, unchangedStatesOf } from './unchanged-states';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-unchanged-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;

  return { product, sketch, hero: resolve(variantDirOf(sketch, 'a'), 'elements', 'hero') };
};

const counting = () => {
  const calls: string[] = [];
  const load: SketchPartLoader = async ({ file }) => {
    calls.push(file);

    const source = readFileSync(file, 'utf8');
    const styles = readFileSync(resolve(dirname(file), 'hero.css'), 'utf8');

    return {
      default: {
        states: source.includes('fresh:')
          ? { default: { title: 'Dune' }, fresh: { title: 'New' } }
          : { default: { title: 'Dune' } },
        render: ({ title }: { title: string }) => ({
          body: source.includes('spaced') ? `<h1>  ${title}</h1>` : `<h1>${title}</h1>`,
          styles,
        }),
      },
    };
  };

  return { calls, load };
};

describe('unchangedStatesOf', () => {
  it('names a state the variant renders the same', async () => {
    const { product, sketch } = acme();

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual(['default']);
  });

  it('leaves out a state whose styles the variant changed', async () => {
    const { product, sketch, hero } = acme();

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero { color: red; }');

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual([]);
  });

  it('names a state whose styles changed when every frame draws the same pixels', async () => {
    const { product, sketch, hero } = acme();
    const drawn: string[] = [];
    const pictureOf =
      (pixels: (variant: string | null) => string): PictureOf =>
      async ({ sketch: on, state }) => {
        drawn.push(`${state} ${on?.variant ?? 'now'}`);

        return { png: Buffer.from(pixels(on?.variant ?? null)), marks: [] };
      };

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero-empty { color: red; }');

    expect(
      await unchangedStatesOf({
        product,
        sketch,
        variant: 'a',
        load: counting().load,
        pictureOf: pictureOf(() => 'x'),
      }),
    ).toEqual(['default']);
    expect(drawn.sort()).toEqual(['default a', 'default now']);

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero { color: red; }');

    expect(
      await unchangedStatesOf({
        product,
        sketch,
        variant: 'a',
        load: counting().load,
        pictureOf: pictureOf((variant) => variant ?? 'now'),
      }),
    ).toEqual([]);
  });

  describe('when only the markup differs', () => {
    const spaced = () => {
      const made = acme();
      const file = resolve(made.hero, 'hero.ts');

      writeFileSync(file, `${readFileSync(file, 'utf8')}\n// spaced\n`);

      return made;
    };
    const pictureOf =
      (pixels: (variant: string | null) => string): PictureOf =>
      async ({ sketch: on }) => ({ png: Buffer.from(pixels(on?.variant ?? null)), marks: [] });

    it('names a state when every frame draws the same pixels', async () => {
      const { product, sketch } = spaced();

      expect(
        await unchangedStatesOf({
          product,
          sketch,
          variant: 'a',
          load: counting().load,
          pictureOf: pictureOf(() => 'x'),
        }),
      ).toEqual(['default']);
    });

    it('leaves out a state when a frame draws other pixels', async () => {
      const { product, sketch } = spaced();

      expect(
        await unchangedStatesOf({
          product,
          sketch,
          variant: 'a',
          load: counting().load,
          pictureOf: pictureOf((variant) => variant ?? 'now'),
        }),
      ).toEqual([]);
    });

    it('leaves out a state without a pixel compare', async () => {
      const { product, sketch } = spaced();

      expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual([]);
    });
  });

  it('leaves out a state that is new in the variant', async () => {
    const { product, sketch, hero } = acme();
    const file = resolve(hero, 'hero.ts');

    writeFileSync(file, `${readFileSync(file, 'utf8')}\n// fresh: {}\n`);

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual(['default']);
  });

  it('renders again only after a file changes', async () => {
    const { product, sketch, hero } = acme();
    const { calls, load } = counting();

    await unchangedStatesOf({ product, sketch, variant: 'a', load });
    await unchangedStatesOf({ product, sketch, variant: 'a', load });

    expect(calls).toHaveLength(2);

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero { color: red; }');

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load })).toEqual([]);
    expect(calls).toHaveLength(4);
  });
});
