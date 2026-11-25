import { cpSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { PictureOf } from '../../merge-compare';
import { resolveProduct } from '../resolve-product';
import { IMAGE_TEXT_CONTRAST, imageTextWarningsOf, textBlocksOf } from './image-text';
import { createSketch, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

const SHOTS = resolve(__dirname, '__fixtures__', 'image-text');

const shotOf = (name: string) => readFileSync(join(SHOTS, `${name}.png`));

const titleCardSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-image-text-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({
    product,
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b', 'c'],
  }) as Sketch;

  return { product, sketch };
};

const load: SketchPartLoader = async () => ({
  default: { states: { logo: {}, fallback: {} }, render: () => ({ body: '', styles: '' }) },
});

const pictureOf: PictureOf = async ({ sketch, state, params }) => ({
  png: shotOf(`${sketch?.variant}-${state}${params.get('titleless') === '1' ? '-titleless' : ''}`),
  marks: [],
});

describe('textBlocksOf', () => {
  it('finds the orange logo on the white gradient of the backdrop below the contrast bar', () => {
    const logo = textBlocksOf(shotOf('b-logo'), shotOf('b-logo-titleless')).find((block) => block.box.width > 90);

    expect(logo?.onImage).toBe(true);
    expect(logo?.contrast).toBeLessThan(IMAGE_TEXT_CONTRAST);
  });

  it('reads the written title of a card without a logo', () => {
    const blocks = textBlocksOf(shotOf('b-fallback'), shotOf('b-fallback-titleless'));

    expect(blocks.every((block) => block.contrast >= IMAGE_TEXT_CONTRAST)).toBe(true);
  });
});

describe('imageTextWarningsOf', () => {
  it('warns about the pale logo under the poster and the logo on the white gradient, not the written titles', async () => {
    const { product, sketch } = titleCardSketch();

    const warnings = await imageTextWarningsOf({ product, sketch, load, pictureOf });
    const fix =
      'below 3:1 - put a scrim or a solid plate behind it, move it onto a calm part of the picture, or give it a colour or outline that stands out';

    expect(warnings).toEqual([
      `elements/hero a: elements/hero logo draws text or a title image at 1.8:1 against what it covers, ${fix}`,
      `elements/hero b: elements/hero logo draws text or a title image at 1.4:1 against what it covers, ${fix}`,
      `elements/hero c: elements/hero logo draws text or a title image at 1.5:1 against what it covers, ${fix}`,
    ]);
  });
});

describe('a logo on a flat surface', () => {
  const loadNew: SketchPartLoader = async () => ({
    default: { states: { new: {} }, render: () => ({ body: '', styles: '' }) },
  });

  const flatPictureOf: PictureOf = async ({ sketch, state, params }) => ({
    png: shotOf(`flat-${sketch?.variant}-${state}${params.get('titleless') === '1' ? '-titleless' : ''}`),
    marks: [],
  });

  it('warns about the thin logo of title-card a and c new, not about b', async () => {
    const { product, sketch } = titleCardSketch();

    const warnings = await imageTextWarningsOf({ product, sketch, load: loadNew, pictureOf: flatPictureOf });

    expect(warnings).toEqual([
      'elements/hero a: elements/hero new draws text or a title image at 2.9:1 against what it covers, below 3:1 - ' +
        'use a lighter version of the logo or text, or put a solid plate behind it',
      'elements/hero c: elements/hero new draws text or a title image at 2.3:1 against what it covers, below 3:1 - ' +
        'use a lighter version of the logo or text, or put a solid plate behind it',
    ]);
  });
});
