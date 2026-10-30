import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { PictureOf } from './merge-compare';
import { readConfig } from './paths';
import { resolveProduct } from './system/resolve-product';
import { createSketch, Sketch } from './system/sketch/sketch';
import { BoxOf, changedAreaOf, diffVariant, VariantDiff } from './variant-diff';

const sketchOn = (name: string, others: string[] = []) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-variant-diff-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({
    merge: 'override',
    product,
    sketch: { layer: 'components', name },
    others: others.map((other) => ({ layer: 'components', name: other })),
    variants: ['a'],
  }) as Sketch;

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
  before.equals(after) ? [] : [{ x: 4, y: 2, width: 8, height: 4 }],
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
        {
          state: 'default',
          box: { x: 4, y: 2, width: 8, height: 4 },
          boxes: [{ x: 4, y: 2, width: 8, height: 4 }],
          frame: { width: 480, height: 120 },
        },
        { state: 'empty', box: null, boxes: [], frame: { width: 480, height: 120 } },
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

  it('draws a later target part of the sketch when asked for it', async () => {
    const { product, sketch } = sketchOn('card', ['button']);
    const diff = await diffVariant({
      product,
      sketch,
      variant: 'a',
      part: 'components/button',
      size: null,
      params: new URLSearchParams(),
      pictureOf,
      boxOf,
      load: loadOf({ now: ['default'], variant: ['default'] }),
    });

    expect(diff.target).toBe('components/button');
    expect(diff.states).toEqual([
      expect.objectContaining({ state: 'default', box: { x: 4, y: 2, width: 8, height: 4 } }),
    ]);
    expect(pictureOf).toHaveBeenCalledWith(
      expect.objectContaining({
        part: 'components/button',
        state: 'default',
        sketch: { target: 'components/card', variant: 'a' },
      }),
    );
  });
});

describe('changedAreaOf', () => {
  const diffOf = (variant: string, states: VariantDiff['states']): VariantDiff => ({
    target: 'pages/inbox',
    variant,
    preset: 'desktop',
    states,
  });

  const frame = { width: 1440, height: 900 };
  const drawn = (state: string, boxes: { x: number; y: number; width: number; height: number }[]) => ({
    state,
    box: null,
    boxes,
    frame,
  });

  it('shares one crop per cluster of changed pixels across every variant and state', () => {
    const area = changedAreaOf([
      diffOf('a', [
        drawn('default', [
          { x: 100, y: 200, width: 32, height: 18 },
          { x: 100, y: 700, width: 10, height: 10 },
        ]),
        drawn('empty', []),
      ]),
      diffOf('b', [
        drawn('default', [{ x: 96, y: 198, width: 40, height: 22 }]),
        { state: 'loading', new: true },
        { state: 'broken', error: 'failed' },
      ]),
    ]);

    expect(area).toEqual({
      frame,
      crops: [
        { x: 80, y: 182, width: 72, height: 54 },
        { x: 84, y: 684, width: 42, height: 42 },
      ],
    });
  });

  it('keeps the crop inside the frame', () => {
    const area = changedAreaOf([diffOf('a', [drawn('default', [{ x: 0, y: 880, width: 20, height: 20 }])])]);

    expect(area?.crops).toEqual([{ x: 0, y: 864, width: 36, height: 36 }]);
  });

  it('is null when no variant changes a pixel', () => {
    expect(
      changedAreaOf([diffOf('a', [drawn('default', [])]), diffOf('b', [{ state: 'loading', new: true }])]),
    ).toBeNull();
  });
});
