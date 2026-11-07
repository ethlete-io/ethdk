import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { compareMerge, drawnPair, looksTheSame, PictureOf } from './merge-compare';
import { encodePng } from './system/part-compare';
import { readConfig } from './design-config';
import { resolveProduct } from './system/resolve-product';
import { createSketch, Sketch, SketchTarget } from './system/sketch/sketch';

const acme = (target: string) => {
  const product = resolveProduct({
    target,
    name: 'acme',
    config: readConfig(target)?.products?.['acme'] ?? {},
  });

  return product;
};

const sketchOn = (layer: 'components' | 'pages', name: string, others: SketchTarget[] = []) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-compare-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = acme(target);
  const sketch = createSketch({
    merge: 'override',
    product,
    sketch: { layer, name },
    others,
    variants: ['a'],
  }) as Sketch;

  return { product, sketch };
};

const card = { parts: ['components/card'], x: 10, y: 20, width: 300, height: 120 };
const hero = { parts: ['elements/hero'], x: 0, y: 0, width: 390, height: 200 };

const pictureOf = vi.fn<PictureOf>(async ({ state, sketch }) => {
  if (state === 'broken') throw new Error('state "broken" failed');

  return {
    png: Buffer.from(state === 'default' && sketch ? 'after' : 'now'),
    marks: [hero, { ...card, height: sketch ? 140 : 120 }],
  };
});

const loadWith =
  (module: Record<string, unknown>) =>
  async ({ file }: { file: string }) =>
    file.endsWith('hero.ts')
      ? { default: { note: 'n', states: { default: {} }, widths: [320, 480], render: () => null } }
      : { default: { note: 'n', render: () => null, ...module } };

describe('compareMerge', () => {
  it('splits the states of each user by whether a pixel changes, with the outlines of the target', async () => {
    const { product, sketch } = sketchOn('components', 'card');
    const compared = await compareMerge({
      product,
      sketch,
      variant: 'a',
      size: null,
      params: new URLSearchParams('surface=dark'),
      pictureOf,
      load: loadWith({ states: { default: {}, empty: {} } }),
    });

    expect(compared).toEqual({
      target: 'components/card',
      variant: 'a',
      changed: [
        {
          part: 'pages/home',
          state: 'default',
          preset: 'phone',
          outlines: {
            now: [{ x: 10, y: 20, width: 300, height: 120 }],
            merged: [{ x: 10, y: 20, width: 300, height: 140 }],
          },
        },
      ],
      unchanged: [
        {
          part: 'pages/home',
          state: 'empty',
          preset: 'phone',
          outlines: {
            now: [{ x: 10, y: 20, width: 300, height: 120 }],
            merged: [{ x: 10, y: 20, width: 300, height: 140 }],
          },
        },
      ],
    });
    expect(pictureOf).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'acme',
        part: 'pages/home',
        state: 'default',
        preset: 'phone',
        width: null,
        sketch: { target: 'components/card', variant: 'a' },
        interaction: null,
      }),
    );
    expect(pictureOf).toHaveBeenCalledWith(expect.objectContaining({ state: 'default', sketch: null }));
  });

  it('draws each sketched element and page itself, for a sketch with several targets', async () => {
    const { product, sketch } = sketchOn('pages', 'home', [{ layer: 'elements', name: 'hero' }]);
    const compared = await compareMerge({
      product,
      sketch,
      variant: 'a',
      size: null,
      params: new URLSearchParams(),
      pictureOf,
      load: loadWith({ states: { default: {}, empty: {} } }),
    });

    expect(compared.changed.map(({ part, state }) => `${part} ${state}`)).toEqual([
      'elements/hero default',
      'pages/home default',
    ]);
    expect(compared.unchanged.map(({ part, state }) => `${part} ${state}`)).toEqual(['pages/home empty']);
  });

  it('draws a state only the variant or only the product has on that side alone, as a change', async () => {
    const { product, sketch } = sketchOn('pages', 'home');
    const drawnSides = vi.fn<PictureOf>(async ({ state, sketch: drawn }) => {
      if ((state === 'added' && !drawn) || (state === 'removed' && drawn)) throw new Error(`no state "${state}"`);

      return { png: Buffer.from('same'), marks: [] };
    });
    const compared = await compareMerge({
      product,
      sketch,
      variant: 'a',
      size: null,
      params: new URLSearchParams(),
      pictureOf: drawnSides,
      load: async ({ sketch: drawn }) => ({
        default: {
          note: 'n',
          render: () => null,
          states: drawn ? { default: {}, added: {} } : { default: {}, removed: {} },
        },
      }),
    });

    expect(compared.changed).toEqual([
      { part: 'pages/home', state: 'removed', preset: 'phone', missing: 'merged', outlines: { now: [], merged: [] } },
      { part: 'pages/home', state: 'added', preset: 'phone', missing: 'now', outlines: { now: [], merged: [] } },
    ]);
    expect(compared.unchanged.map(({ state }) => state)).toEqual(['default']);
  });

  it('draws a page at the asked preset and a part with widths at the asked width, else at their first', async () => {
    const { product, sketch } = sketchOn('components', 'button');
    const compareAt = (size: string) =>
      compareMerge({
        product,
        sketch,
        variant: 'a',
        size,
        params: new URLSearchParams(),
        pictureOf,
        load: loadWith({ states: { empty: {} } }),
      });
    const sizesOf = (compared: Awaited<ReturnType<typeof compareMerge>>) =>
      [...compared.changed, ...compared.unchanged].map(({ part, preset, width }) => ({ part, preset, width }));

    expect(sizesOf(await compareAt('480'))).toEqual([
      { part: 'elements/hero', preset: undefined, width: 480 },
      { part: 'pages/home', preset: 'phone', width: undefined },
    ]);
    expect(sizesOf(await compareAt('desktop'))).toEqual([
      { part: 'elements/hero', preset: undefined, width: 320 },
      { part: 'pages/home', preset: 'desktop', width: undefined },
    ]);
  });

  it('counts a state that fails to draw, or a part that fails to load, as changed and says why', async () => {
    const { product, sketch } = sketchOn('components', 'card');
    const broken = await compareMerge({
      product,
      sketch,
      variant: 'a',
      size: null,
      params: new URLSearchParams(),
      pictureOf,
      load: loadWith({ states: { broken: {} } }),
    });
    const unreadable = await compareMerge({
      product,
      sketch,
      variant: 'a',
      size: null,
      params: new URLSearchParams(),
      pictureOf,
      load: async () => {
        throw new Error('syntax error');
      },
    });

    expect(broken.changed).toEqual([
      expect.objectContaining({ part: 'pages/home', state: 'broken', error: 'state "broken" failed' }),
    ]);
    expect(unreadable).toMatchObject({
      changed: [{ part: 'pages/home', state: '', error: 'syntax error' }],
      unchanged: [],
    });
  });
});

const pillOf = (options: { edge: number; width?: number }) => {
  const width = options.width ?? 12;
  const height = 6;
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
      const value = corner ? options.edge : 200;

      data.fill(value, at, at + 3);
      data[at + 3] = 255;
    }

  return encodePng({ width, height, data });
};

describe('looksTheSame', () => {
  it('takes an anti-alias shift of up to 8 of 255 on a rounded border for the same picture', () => {
    expect(looksTheSame(pillOf({ edge: 120 }), pillOf({ edge: 128 }))).toBe(true);
  });

  it('takes a shift over 8, or another size, for a change', () => {
    expect(looksTheSame(pillOf({ edge: 120 }), pillOf({ edge: 129 }))).toBe(false);
    expect(looksTheSame(pillOf({ edge: 120 }), pillOf({ edge: 120, width: 13 }))).toBe(false);
  });

  it('compares a picture that does not decode byte for byte', () => {
    expect(looksTheSame(Buffer.from('now'), Buffer.from('now'))).toBe(true);
    expect(looksTheSame(Buffer.from('now'), Buffer.from('after'))).toBe(false);
  });

  it('lets drawnPair call an anti-alias shift no change', async () => {
    const draw = async (sketch: unknown) => ({ png: pillOf({ edge: sketch ? 126 : 120 }), marks: [] });

    expect((await drawnPair(draw, { target: 'elements/pill', variant: 'a' })).same).toBe(true);
  });
});
