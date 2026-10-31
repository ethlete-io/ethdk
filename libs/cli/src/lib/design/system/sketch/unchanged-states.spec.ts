import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { createSketch, sharedDirOf, Sketch, variantDirOf } from './sketch';
import { PictureOf } from '../../merge-compare';
import { forgetUnchangedStates, SketchPartLoader, unchangedStatesOf } from './unchanged-states';

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
        frame: (body: string) => (source.includes('framed') ? `<div class="frame">${body}</div>` : body),
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

  it('leaves out a state whose demo frame the variant changed', async () => {
    const { product, sketch, hero } = acme();
    const file = resolve(hero, 'hero.ts');

    writeFileSync(file, `${readFileSync(file, 'utf8')}\n// framed\n`);

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual([]);
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

    it('checks fresh screenshots after a transient failure without a source edit', async () => {
      const { product, sketch } = spaced();
      let failed = true;
      let shots = 0;
      const pictureOf: PictureOf = async () => {
        shots++;
        if (failed) throw new Error('temporary screenshot failure');

        return { png: Buffer.from('same'), marks: [] };
      };
      const options = { product, sketch, variant: 'a', load: counting().load, pictureOf };

      expect(await unchangedStatesOf(options)).toEqual([]);
      failed = false;
      expect(await unchangedStatesOf(options)).toEqual(['default']);
      expect(shots).toBe(4);
    });

    it('does not reuse a matching image result for a later screenshot session', async () => {
      const { product, sketch } = spaced();
      const options = { product, sketch, variant: 'a', load: counting().load };

      expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
      expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual([]);
    });

    describe('with keepPictures', () => {
      it('reuses the pixel compare until a source changes', async () => {
        const { product, sketch, hero } = spaced();
        const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };

        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual([
          'default',
        ]);

        writeFileSync(resolve(hero, 'hero.css'), 'h1 { color: red; }\n');

        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual(
          [],
        );
      });

      it('compares again after forgetUnchangedStates', async () => {
        const { product, sketch } = spaced();
        const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };

        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
        forgetUnchangedStates();
        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual(
          [],
        );
      });

      it('does not keep a result whose draw failed', async () => {
        const { product, sketch } = spaced();
        let failed = true;
        const flaky: PictureOf = async () => {
          if (failed) throw new Error('temporary screenshot failure');

          return { png: Buffer.from('same'), marks: [] };
        };
        const options = { product, sketch, variant: 'a', load: counting().load, pictureOf: flaky, keepPictures: true };

        expect(await unchangedStatesOf(options)).toEqual([]);
        failed = false;
        expect(await unchangedStatesOf(options)).toEqual(['default']);
      });
    });
  });

  describe('when the markup only renders in a browser', () => {
    const browserOnly: SketchPartLoader = async (options) => {
      const loaded = (await counting().load(options)) as { default: Record<string, unknown> };

      return {
        default: {
          ...loaded.default,
          render: () => {
            throw new ReferenceError('location is not defined');
          },
        },
      };
    };
    const pictureOf =
      (pixels: (variant: string | null) => string): PictureOf =>
      async ({ sketch: on }) => ({ png: Buffer.from(pixels(on?.variant ?? null)), marks: [] });

    it('names a state when every frame draws the same pixels', async () => {
      const { product, sketch } = acme();

      expect(
        await unchangedStatesOf({ product, sketch, variant: 'a', load: browserOnly, pictureOf: pictureOf(() => 'x') }),
      ).toEqual(['default']);
    });

    it('leaves out a state when a frame draws other pixels', async () => {
      const { product, sketch } = acme();

      expect(
        await unchangedStatesOf({
          product,
          sketch,
          variant: 'a',
          load: browserOnly,
          pictureOf: pictureOf((variant) => variant ?? 'now'),
        }),
      ).toEqual([]);
    });

    it('leaves out a state without a pixel compare', async () => {
      const { product, sketch } = acme();

      expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: browserOnly })).toEqual([]);
    });

    it('leaves out a state that is new in the variant', async () => {
      const { product, sketch, hero } = acme();
      const file = resolve(hero, 'hero.ts');

      writeFileSync(file, `${readFileSync(file, 'utf8')}\n// fresh: {}\n`);

      expect(
        await unchangedStatesOf({ product, sketch, variant: 'a', load: browserOnly, pictureOf: pictureOf(() => 'x') }),
      ).toEqual(['default']);
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

  it('renders again after a file in the sketch shared folder changes', async () => {
    const { product, sketch } = acme();
    const shared = resolve(sharedDirOf(sketch), 'data.ts');
    const { calls, load: counted } = counting();
    const load: SketchPartLoader = async (options) => {
      const loaded = (await counted(options)) as { default: { render: (props: unknown) => { body: string } } };
      const spaced = options.sketch !== null && readFileSync(shared, 'utf8').includes('spaced');

      return {
        default: {
          ...loaded.default,
          render: (props: unknown) => ({ ...loaded.default.render(props), ...(spaced ? { body: 'spaced' } : {}) }),
        },
      };
    };

    mkdirSync(dirname(shared), { recursive: true });
    writeFileSync(shared, 'export const rows = [];');

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load })).toEqual(['default']);

    writeFileSync(shared, 'export const rows = []; // spaced');

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load })).toEqual([]);
    expect(calls).toHaveLength(4);
  });
});
