import { cpSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { PictureOf } from '../../merge-compare';
import { resolveProduct } from '../resolve-product';
import { samePictureStateWarningsOf } from './same-picture-states';
import { createSketch, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

const SHOTS = resolve(__dirname, '__fixtures__', 'same-picture-states');

const cardSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-same-picture-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;

  return { product, sketch };
};

const loadOf =
  (grid: unknown): SketchPartLoader =>
  async () => {
    const rows = Object.values((grid as { rows: Record<string, Record<string, string>> }).rows);
    const states = Object.fromEntries(rows.flatMap((row) => Object.values(row)).map((state) => [state, {}]));

    return { default: { states, grid, render: () => ({ body: '', styles: '' }) } };
  };

const pictureOf: PictureOf = async ({ state }) => ({ png: readFileSync(join(SHOTS, `${state}.png`)), marks: [] });

const iconGrid = {
  columns: ['rest', 'hover', 'active'],
  rows: {
    tonal: { rest: 'icon-tonal', hover: 'icon-tonal-hover' },
    transparent: { rest: 'icon-transparent', active: 'icon-transparent-active' },
  },
};

const pressedGrid = {
  columns: ['rest', 'hover', 'active'],
  rows: { pressed: { rest: 'pressed', hover: 'pressed-hover', active: 'pressed-active' } },
};

describe('samePictureStateWarningsOf', () => {
  it('warns when an active state draws the rest picture of another row', async () => {
    const { product, sketch } = cardSketch();

    const warnings = await samePictureStateWarningsOf({ product, sketch, load: loadOf(iconGrid), pictureOf });

    expect(warnings).toEqual([
      'elements/hero a: elements/hero icon-tonal renders the same picture as icon-transparent-active; make the states differ or drop one',
    ]);
  });

  it('warns when hover and active of a pressed row draw the same picture', async () => {
    const { product, sketch } = cardSketch();

    const warnings = await samePictureStateWarningsOf({ product, sketch, load: loadOf(pressedGrid), pictureOf });

    expect(warnings).toEqual([
      'elements/hero a: elements/hero pressed-hover renders the same picture as pressed-active; make the states differ or drop one',
    ]);
  });

  it('stays silent when every state draws its own picture', async () => {
    const { product, sketch } = cardSketch();
    const grid = {
      columns: ['rest', 'hover'],
      rows: {
        tonal: { rest: 'icon-tonal', hover: 'icon-tonal-hover' },
        pressed: { rest: 'pressed', hover: 'pressed-hover' },
      },
    };

    expect(await samePictureStateWarningsOf({ product, sketch, load: loadOf(grid), pictureOf })).toEqual([]);
  });
});
