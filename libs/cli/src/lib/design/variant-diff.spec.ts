import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { PictureOf } from './merge-compare';
import { readConfig } from './paths';
import { resolveProduct } from './system/resolve-product';
import { createSketch, Sketch } from './system/sketch/sketch';
import { BoxOf, changedAreaOf, diffVariant, VariantDiff } from './variant-diff';

const sketchOn = (name: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-variant-diff-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'components', name }, variants: ['a'] }) as Sketch;

  return { product, sketch };
};

const pngOf = (text: string) => {
  const header = Buffer.alloc(24);

  header.writeUInt32BE(480, 16);
  header.writeUInt32BE(120, 20);

  return Buffer.concat([header, Buffer.from(text)]);
};

const pictureOf = vi.fn<PictureOf>(async ({ state, sketch }) => {
  if (state === 'broken') throw new Error('state "broken" failed');

  return { png: pngOf(state === 'default' && sketch ? 'after' : 'now'), marks: [] };
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
        { state: 'default', box: { x: 4, y: 2, width: 8, height: 4 }, frame: { width: 480, height: 120 } },
        { state: 'empty', box: null, frame: { width: 480, height: 120 } },
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

describe('changedAreaOf', () => {
  const diffOf = (variant: string, states: VariantDiff['states']): VariantDiff => ({
    target: 'pages/inbox',
    variant,
    preset: 'desktop',
    states,
  });

  it('crops every variant and state to one shared box around all their changed pixels', () => {
    const area = changedAreaOf([
      diffOf('a', [
        { state: 'default', box: { x: 100, y: 200, width: 32, height: 18 }, frame: { width: 1440, height: 900 } },
        { state: 'empty', box: null, frame: { width: 1440, height: 900 } },
      ]),
      diffOf('b', [
        { state: 'default', box: { x: 96, y: 198, width: 40, height: 22 }, frame: { width: 1440, height: 900 } },
        { state: 'loading', new: true },
        { state: 'broken', error: 'failed' },
      ]),
    ]);

    expect(area).toEqual({ frame: { width: 1440, height: 900 }, crop: { x: 80, y: 182, width: 72, height: 54 } });
  });

  it('keeps the crop inside the frame', () => {
    const area = changedAreaOf([
      diffOf('a', [
        { state: 'default', box: { x: 0, y: 880, width: 20, height: 20 }, frame: { width: 1440, height: 900 } },
      ]),
    ]);

    expect(area?.crop).toEqual({ x: 0, y: 864, width: 36, height: 36 });
  });

  it('is null when no variant changes a pixel', () => {
    expect(
      changedAreaOf([
        diffOf('a', [{ state: 'default', box: null, frame: { width: 1440, height: 900 } }]),
        diffOf('b', [{ state: 'loading', new: true }]),
      ]),
    ).toBeNull();
  });
});
