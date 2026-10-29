import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { PictureOf } from './merge-compare';
import { readConfig } from './paths';
import { resolveProduct } from './system/resolve-product';
import { createSketch, Sketch } from './system/sketch/sketch';
import { BoxOf, diffVariant } from './variant-diff';

const sketchOn = (name: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-variant-diff-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'components', name }, variants: ['a'] }) as Sketch;

  return { product, sketch };
};

const pictureOf = vi.fn<PictureOf>(async ({ state, sketch }) => {
  if (state === 'broken') throw new Error('state "broken" failed');

  return { png: Buffer.from(state === 'default' && sketch ? 'after' : 'now'), marks: [] };
});

const boxOf = vi.fn<BoxOf>(async (before, after) =>
  before.equals(after) ? null : { x: 4, y: 2, width: 8, height: 4 },
);

const loadOf =
  (states: { now: string[]; variant: string[] }) =>
  async ({ sketch }: { sketch: unknown }) => ({
    default: {
      note: 'n',
      render: () => null,
      widths: [320, 480],
      states: Object.fromEntries((sketch ? states.variant : states.now).map((state) => [state, {}])),
    },
  });

describe('diffVariant', () => {
  it('gives each state of the variant the box of its changed pixels, null when none, and marks new ones', async () => {
    const { product, sketch } = sketchOn('card');
    const diff = await diffVariant({
      product,
      sketch,
      variant: 'a',
      size: '480',
      params: new URLSearchParams('surface=dark'),
      pictureOf,
      boxOf,
      load: loadOf({ now: ['default', 'empty', 'broken'], variant: ['default', 'empty', 'broken', 'loading'] }),
    });

    expect(diff).toEqual({
      target: 'components/card',
      variant: 'a',
      width: 480,
      states: [
        { state: 'default', box: { x: 4, y: 2, width: 8, height: 4 } },
        { state: 'empty', box: null },
        { state: 'broken', error: 'state "broken" failed' },
        { state: 'loading', new: true },
      ],
    });
    expect(pictureOf).toHaveBeenCalledWith(
      expect.objectContaining({
        part: 'components/card',
        state: 'default',
        width: 480,
        preset: null,
        interaction: null,
        sketch: { target: 'components/card', variant: 'a' },
      }),
    );
    expect(pictureOf).toHaveBeenCalledWith(expect.objectContaining({ state: 'default', sketch: null }));
  });

  it('draws at the first width when the asked size is not offered', async () => {
    const { product, sketch } = sketchOn('card');
    const diff = await diffVariant({
      product,
      sketch,
      variant: 'a',
      size: '999',
      params: new URLSearchParams(),
      pictureOf,
      boxOf,
      load: loadOf({ now: ['empty'], variant: ['empty'] }),
    });

    expect(diff.width).toBe(320);
  });
});
