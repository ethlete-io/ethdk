import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { compareMerge, PictureOf } from './merge-compare';
import { readConfig } from './paths';
import { resolveProduct } from './system/resolve-product';
import { createSketch, Sketch } from './system/sketch/sketch';

const acme = (target: string) => {
  const product = resolveProduct({
    target,
    name: 'acme',
    config: readConfig(target)?.products?.['acme'] ?? {},
  });

  return product;
};

const sketchOn = (layer: 'components', name: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-compare-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = acme(target);
  const sketch = createSketch({ merge: 'override', product, sketch: { layer, name }, variants: ['a'] }) as Sketch;

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
