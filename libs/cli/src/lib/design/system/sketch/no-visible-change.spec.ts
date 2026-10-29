import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { PictureOf } from '../../merge-compare';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { sketchShowsNoChange } from './no-visible-change';
import { createSketch, Sketch, variantDirOf } from './sketch';
import { SketchPartLoader } from './unchanged-states';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-no-change-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;

  return { product, sketch, css: resolve(variantDirOf(sketch, 'a'), 'elements', 'hero', 'hero.css') };
};

const load: SketchPartLoader = async ({ file }) => ({
  default: {
    states: { default: { title: 'Dune' } },
    render: ({ title }: { title: string }) => ({
      body: `<h1>${title}</h1>`,
      styles: readFileSync(resolve(dirname(file), 'hero.css'), 'utf8'),
    }),
  },
});

const pictureWith =
  (pixel: (sketched: boolean) => number): PictureOf =>
  async ({ sketch }) => ({ png: Buffer.from([1, 2, pixel(sketch !== null)]), marks: [] });

describe('sketchShowsNoChange', () => {
  it('is true when every state draws the same pixels', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n/* same look */\n`);

    expect(await sketchShowsNoChange({ product, sketch, load, pictureOf: pictureWith(() => 0) })).toBe(true);
  });

  it('names the changed states when one pixel differs', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n/* one pixel */\n`);

    expect(await sketchShowsNoChange({ product, sketch, load, pictureOf: pictureWith((sketched) => +sketched) })).toBe(
      'variant a changes default',
    );
  });

  it('names the failed shot', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n/* broken */\n`);

    const pictureOf: PictureOf = async () => {
      throw new Error('no browser');
    };

    expect(await sketchShowsNoChange({ product, sketch, load, pictureOf })).toBe(
      'variant a changes default - a shot failed: no browser',
    );
  });
});
