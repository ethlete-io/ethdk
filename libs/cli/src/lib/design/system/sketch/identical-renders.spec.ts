import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { PictureOf } from '../../merge-compare';
import { readConfig } from '../../paths';
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

describe('identicalRenderLinesOf', () => {
  it('names a variant that draws like another one in every state', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({
      now: { default: 0, hover: 0 },
      a: { default: 1, hover: 2 },
      b: { default: 1, hover: 2 },
    });

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf })).toEqual([
      'elements/hero variant b draws the same pixels as variant a in every state (default, hover) - it adds nothing visible: change it or reject it',
    ]);
  });

  it('accepts variants that differ in one state', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({
      now: { default: 0, hover: 0 },
      a: { default: 1, hover: 2 },
      b: { default: 1, hover: 3 },
    });

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf })).toEqual([]);
  });

  it('names every variant when all of them draw like the product', async () => {
    const { product, sketch } = acme(['a', 'b', 'c']);
    const pictureOf = drawing({});

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf })).toEqual([
      'elements/hero variant a draws the same pixels as Aktuell in every state (default, hover) - it adds nothing visible: change it or reject it',
      'elements/hero variant b draws the same pixels as variant a in every state (default, hover) - it adds nothing visible: change it or reject it',
      'elements/hero variant c draws the same pixels as variant a in every state (default, hover) - it adds nothing visible: change it or reject it',
    ]);
  });

  it('names a variant that draws like the product while another one differs', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const pictureOf = drawing({ a: { default: 1 } });

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf })).toEqual([
      'elements/hero variant b draws the same pixels as Aktuell in every state (default, hover) - it adds nothing visible: change it or reject it',
    ]);
  });

  it('leaves a lone variant that draws like the product to the no-visible-change merge', async () => {
    const { product, sketch } = acme(['a']);

    expect(await identicalRenderLinesOf({ product, sketch, load, pictureOf: drawing({}) })).toEqual([]);
  });

  it('skips a rejected variant', async () => {
    const { product, sketch } = acme(['a', 'b']);
    const rejected: Sketch = { ...sketch, rejections: { b: [{ by: 'designer', decidedAt: '2026-11-02' }] } };
    const pictureOf = drawing({ a: { default: 1 }, b: { default: 1 } });

    expect(await identicalRenderLinesOf({ product, sketch: rejected, load, pictureOf })).toEqual([]);
  });
});
