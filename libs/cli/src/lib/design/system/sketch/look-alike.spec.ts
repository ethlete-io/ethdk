import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { PictureOf } from '../../merge-compare';
import { BoxOf } from '../../variant-diff';
import { decodePng, encodePng } from '../part-compare';
import { resolveProduct } from '../resolve-product';
import { sketchRendersOf } from './identical-renders';
import { studioFitZoomOf } from './look-alike';
import { createSketch, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

const WIDTH = 1440;
const HEIGHT = 120;

const acme = (variants: string[]) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-look-alike-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants }) as Sketch;

  return { product, sketch };
};

const load: SketchPartLoader = async () => ({
  default: { note: 'n', states: { default: {} }, render: () => ({ body: '', styles: '' }) },
});

const pngOf = (dark: (x: number, y: number) => boolean) => {
  const data = Buffer.alloc(WIDTH * HEIGHT * 4, 255);

  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) if (dark(x, y)) data.fill(0, (y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 3);

  return encodePng({ width: WIDTH, height: HEIGHT, data });
};

const blank = pngOf(() => false);
const fineEven = pngOf((x, y) => y >= 40 && y < 52 && (x + y) % 2 === 0);
const fineOdd = pngOf((x, y) => y >= 40 && y < 52 && (x + y) % 2 === 1);
const largeLeft = pngOf((x, y) => y >= 20 && y < 100 && x < WIDTH / 2);
const largeRight = pngOf((x, y) => y >= 20 && y < 100 && x >= WIDTH / 2);

const drawing =
  (shots: Record<string, Buffer>): PictureOf =>
  async ({ sketch }) => ({ png: shots[sketch?.variant ?? 'now'] ?? blank, marks: [] });

const boxOf: BoxOf = async (before, after) => {
  const one = decodePng(before);
  const other = decodePng(after);
  let box: { left: number; top: number; right: number; bottom: number } | null = null;

  for (let y = 0; y < one.height; y++)
    for (let x = 0; x < one.width; x++) {
      const at = (y * one.width + x) * 4;

      if (one.data.readUInt32BE(at) === other.data.readUInt32BE(at)) continue;

      box = box
        ? {
            left: Math.min(box.left, x),
            top: Math.min(box.top, y),
            right: Math.max(box.right, x),
            bottom: Math.max(box.bottom, y),
          }
        : { left: x, top: y, right: x, bottom: y };
    }

  return box ? [{ x: box.left, y: box.top, width: box.right - box.left + 1, height: box.bottom - box.top + 1 }] : [];
};

describe('sketchRendersOf look-alike warnings', () => {
  it('warns about two variants whose differences vanish at the fit zoom', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: fineEven, b: fineOdd });

    const { identical, lookAlike } = await sketchRendersOf({
      product,
      sketch,
      load,
      pictureOf,
      boxOf,
      lookAlike: true,
    });

    expect(identical).toEqual([]);
    expect(lookAlike).toEqual([
      expect.stringMatching(
        /^elements\/hero: WARNING variants a and b look alike at Studio's fit zoom \(28 %\): they differ most in default, region 1440x12 at 0,40, by \d+ visible screen pixels \(\d+ at 100 %\), fewer than 1500 - draw the difference larger$/,
      ),
    ]);
  });

  it('zooms to the sketch list width Studio measured', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: fineEven, b: fineOdd });

    const { lookAlike } = await sketchRendersOf({
      product,
      sketch,
      load,
      pictureOf,
      boxOf,
      lookAlike: true,
      listWidth: 2600,
    });

    expect(lookAlike).toEqual([expect.stringContaining("look alike at Studio's fit zoom (59 %)")]);
  });

  it('stays quiet about variants that differ in large shapes', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: largeLeft, b: largeRight });

    expect((await sketchRendersOf({ product, sketch, load, pictureOf, boxOf, lookAlike: true })).lookAlike).toEqual([]);
  });

  it('stays quiet about a difference that is small at 100 % too', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: pngOf((x, y) => x < 10 && y < 10), b: blank });

    expect((await sketchRendersOf({ product, sketch, load, pictureOf, boxOf, lookAlike: true })).lookAlike).toEqual([]);
  });

  it('measures nothing without the lookAlike option', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: fineEven, b: fineOdd });

    expect((await sketchRendersOf({ product, sketch, load, pictureOf, boxOf })).lookAlike).toEqual([]);
  });
});

describe('studioFitZoomOf', () => {
  it('fits wide frames side by side, one column per variant and Aktuell', () => {
    expect(studioFitZoomOf({ width: 1440, rows: 4, states: 1 })).toBeCloseTo((1280 - 3 * 24 - 16) / (4 * 1440));
  });

  it('fits narrow frames up to four states in a row', () => {
    expect(studioFitZoomOf({ width: 300, rows: 4, states: 6 })).toBe(1);
    expect(studioFitZoomOf({ width: 310, rows: 4, states: 6 })).toBeCloseTo((1280 - 3 * 24) / (4 * 310));
  });
});
