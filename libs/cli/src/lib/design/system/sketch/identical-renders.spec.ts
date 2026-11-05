import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { PictureOf } from '../../merge-compare';
import { BoxOf } from '../../variant-diff';
import { readConfig } from '../../paths';
import { DRAWS_AT_ONCE } from '../../thumb';
import { resolveProduct } from '../resolve-product';
import { identicalRenderLinesOf } from './identical-renders';
import { createSketch, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

const acme = (variants: string[]) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-identical-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants }) as Sketch;

  return { product, sketch };
};

const load: SketchPartLoader = async () => ({
  default: { note: 'n', states: { default: {}, hover: {} }, render: () => ({ body: '', styles: '' }) },
});

const drawing =
  (pixels: Record<string, Record<string, number>>): PictureOf =>
  async ({ sketch, state }) => ({
    png: Buffer.from([pixels[sketch?.variant ?? 'now']?.[state] ?? 0]),
    marks: [],
  });

const boxOf: BoxOf = async (before, after) =>
  before[0] === after[0] && before.length > 0 === after.length > 0 ? [] : [{ x: 0, y: 0, width: 1, height: 1 }];

describe('identicalRenderLinesOf', () => {
  it('names a variant that draws like another one in every state', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({
      now: { default: 0, hover: 0 },
      a: { default: 1, hover: 2 },
      b: { default: 1, hover: 2 },
    });

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf, boxOf })).toEqual([
      'elements/hero variant b draws the same pixels as variant a in every state (default, hover) - it adds nothing visible: withdraw it with `sketch withdraw elements/hero --variant b --by <model id>` or redraw it',
    ]);
  });

  it('accepts variants that differ in one state', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({
      now: { default: 0, hover: 0 },
      a: { default: 1, hover: 2 },
      b: { default: 3, hover: 2 },
    });

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf, boxOf })).toEqual([]);
  });

  it('names every variant when all of them draw like the product', async () => {
    const { product, sketch } = acme(['a', 'b', 'c']);
    const pictureOf = drawing({});

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf, boxOf })).toEqual([
      'elements/hero variant a draws the same pixels as Aktuell in every state (default, hover) - it adds nothing visible: redraw it',
      'elements/hero variant b draws the same pixels as variant a in every state (default, hover) - it adds nothing visible: withdraw it with `sketch withdraw elements/hero --variant b --by <model id>` or redraw it',
      'elements/hero variant c draws the same pixels as variant a in every state (default, hover) - it adds nothing visible: withdraw it with `sketch withdraw elements/hero --variant c --by <model id>` or redraw it',
    ]);
  });

  it('names a variant that draws like the product while another one differs', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: { default: 1 } });

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf, boxOf })).toEqual([
      'elements/hero variant b draws the same pixels as Aktuell in every state (default, hover) - it adds nothing visible: redraw it',
    ]);
  });

  it('names a variant whose first changed state draws like the first changed state of an earlier variant', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: { default: 1, hover: 2 }, b: { default: 1, hover: 3 } });

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf, boxOf })).toEqual([
      'elements/hero variant b first changes default, which draws the same pixels as variant a draws at its first change default, so the Studio sketch view shows identical frames - withdraw it with `sketch withdraw elements/hero --variant b --by <model id>` or redraw it',
    ]);
  });

  it('accepts the variant once a state that draws differently is its first changed state', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: { default: 1, hover: 2 }, b: { default: 1, hover: 3 } });
    const reordered: SketchPartLoader = async ({ sketch: drawn }) => ({
      default: {
        note: 'n',
        states: drawn?.variant === 'b' ? { hover: {}, default: {} } : { default: {}, hover: {} },
        render: () => ({ body: '', styles: '' }),
      },
    });

    expect(await identicalRenderLinesOf({ product, sketch, load: reordered, pictureOf, boxOf })).toEqual([]);
  });

  it('compares a variant at its first changed state, not at a state it draws like the product', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: { default: 1, hover: 2 }, b: { hover: 1 } });

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf, boxOf })).toEqual([
      'elements/hero variant b first changes hover, which draws the same pixels as variant a draws at its first change default, so the Studio sketch view shows identical frames - withdraw it with `sketch withdraw elements/hero --variant b --by <model id>` or redraw it',
    ]);
  });

  it('accepts a lone variant that draws its first state like the product and changes another one', async () => {
    const { product, sketch } = acme(['a']);

    expect(
      await identicalRenderLinesOf({ product, sketch, load, pictureOf: drawing({ a: { hover: 1 } }), boxOf }),
    ).toEqual([]);
  });

  it('leaves a lone variant that draws like the product to the no-visible-change merge', async () => {
    const { product, sketch } = acme(['a']);

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf: drawing({}), boxOf })).toEqual([]);
  });

  it('skips a rejected variant', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const rejected: Sketch = { ...sketch, rejections: { b: [{ by: 'designer', decidedAt: '2026-11-02' }] } };
    const pictureOf = drawing({ a: { default: 1 }, b: { default: 1 } });

    expect(await identicalRenderLinesOf({ product, sketch: rejected, load, pictureOf, boxOf })).toEqual([]);
  });

  it('takes the first changed state from the pixel diff of design shot, not from the PNG bytes', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf: PictureOf = async ({ sketch: drawn, state }) => {
      const pixels: Record<string, Record<string, number[]>> = {
        a: { default: [0, 1], hover: [2] },
        b: { default: [0, 1], hover: [3] },
      };

      return { png: Buffer.from(pixels[drawn?.variant ?? 'now']?.[state] ?? [0]), marks: [] };
    };

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf, boxOf })).toEqual([]);
  });

  it('takes the first changed state at the frame design shot draws, the first width', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const wide: SketchPartLoader = async () => ({
      default: {
        note: 'n',
        widths: [320, 1440],
        states: { default: {}, hover: {} },
        render: () => ({ body: '', styles: '' }),
      },
    });
    const pictureOf: PictureOf = async ({ sketch: drawn, state, width }) => {
      const pixels: Record<string, number> = {
        'a default 1440': 5,
        'a hover 320': 2,
        'b default 1440': 5,
        'b hover 320': 3,
      };

      return { png: Buffer.from([pixels[`${drawn?.variant ?? 'now'} ${state} ${width}`] ?? 0]), marks: [] };
    };

    expect(await identicalRenderLinesOf({ product, sketch, load: wide, pictureOf, boxOf })).toEqual([]);
  });

  it('shoots up to DRAWS_AT_ONCE states at once and keeps their order', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const names = Array.from({ length: DRAWS_AT_ONCE * 2 }, (_, at) => `s${at}`);
    const many: SketchPartLoader = async () => ({
      default: {
        note: 'n',
        states: Object.fromEntries(names.map((name) => [name, {}])),
        render: () => ({ body: '', styles: '' }),
      },
    });
    let running = 0;
    let most = 0;
    const pictureOf: PictureOf = async ({ sketch: drawn, state }) => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running--;

      if (state === 's1') throw new Error('broken');

      return { png: Buffer.from([drawn?.variant === 'now' || !drawn ? 0 : 1]), marks: [] };
    };

    const lines = await identicalRenderLinesOf({ product, sketch, load: many, pictureOf, boxOf });

    expect(most).toBe(DRAWS_AT_ONCE);
    expect(lines).toEqual([
      `elements/hero variant b draws the same pixels as variant a in every state (${names.filter((name) => name !== 's1').join(', ')}) - it adds nothing visible: withdraw it with \`sketch withdraw elements/hero --variant b --by <model id>\` or redraw it`,
    ]);
  });
});
