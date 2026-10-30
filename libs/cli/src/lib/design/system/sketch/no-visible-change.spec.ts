import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { PictureOf } from '../../merge-compare';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { sketchShowsNoChange, variantLoadProblemsOf } from './no-visible-change';
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

  it('accepts a difference that one more drawing of both sides does not repeat', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n/* odd picture */\n`);

    let drawn = 0;
    const pictureOf: PictureOf = async ({ sketch: drawing, fresh }) => ({
      png: Buffer.from([1, 2, drawn++ === 1 && !fresh && drawing !== null ? 1 : 0]),
      marks: [],
    });

    expect(await sketchShowsNoChange({ product, sketch, load, pictureOf })).toBe(true);
  });

  it('still names a difference that one more drawing of both sides repeats', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n/* real change */\n`);

    const fresh: boolean[] = [];
    const pictureOf: PictureOf = async ({ sketch: drawing, fresh: again }) => {
      fresh.push(!!again);

      return { png: Buffer.from([1, 2, +(drawing !== null)]), marks: [] };
    };

    expect(await sketchShowsNoChange({ product, sketch, load, pictureOf })).toBe('variant a changes default');
    expect(fresh).toContain(true);
  });

  it('names the state of a part that shows the target when only that part changes', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n/* the page breaks */\n`);

    const pictureOf: PictureOf = async ({ part, sketch: drawn }) => ({
      png: Buffer.from([1, 2, part === 'pages/home' && drawn !== null ? 1 : 0]),
      marks: [],
    });

    expect(await sketchShowsNoChange({ product, sketch, load, pictureOf })).toBe(
      'variant a changes pages/home default',
    );
  });

  it('stops when one of two variants changes a token the product stylesheet imports, though the markup is the same', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-no-change-'));

    cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
    writeFileSync(join(target, '.ethlete/design/acme/styles.css'), "@import './foundations/palette/palette.css';\n");

    const config = { ...readConfig(target)?.products?.['acme'], styles: ['.ethlete/design/acme/styles.css'] };
    const product = resolveProduct({ target, name: 'acme', config });
    const sketch = createSketch({
      product,
      sketch: { layer: 'foundations', name: 'palette' },
      variants: ['a', 'b'],
    }) as Sketch;
    const css = resolve(variantDirOf(sketch, 'a'), 'foundations', 'palette', 'palette.css');

    writeFileSync(css, readFileSync(css, 'utf8').replace('#e4572e', '#13579b'));

    const tokens: SketchPartLoader = async () => ({
      default: { states: { default: {} }, render: () => ({ body: '<p class="acme-swatch"></p>', styles: '' }) },
    });
    const pictureOf: PictureOf = async ({ part, sketch: drawn }) => ({
      png: Buffer.from([1, 2, part === 'foundations/palette' && drawn?.variant === 'a' ? 1 : 0]),
      marks: [],
    });

    expect(await sketchShowsNoChange({ product, sketch, load: tokens, pictureOf })).toBe('variant a changes default');
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

  it('ignores a rejected variant that changes the look', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n/* one pixel */\n`);

    const rejected = {
      ...sketch,
      rejections: { a: [{ by: 'designer', decidedAt: '2026-10-30T00:00:00.000Z' }] },
    } as Sketch;
    const pictureOf = pictureWith((sketched) => +sketched);

    expect(await sketchShowsNoChange({ product, sketch: rejected, load, pictureOf })).toBe(
      'the sketch has no live variant',
    );
  });

  it('compares every target of a sketch with several targets and names the part that changes', async () => {
    const { product } = acme();
    const sketch = createSketch({
      merge: 'override',
      product,
      sketch: { layer: 'components', name: 'button' },
      others: [{ layer: 'components', name: 'card' }],
      variants: ['a'],
    }) as Sketch;
    const card = resolve(variantDirOf(sketch, 'a'), 'components/card/card.css');
    const byFolder: SketchPartLoader = async ({ file }) => ({
      default: {
        states: { default: {} },
        render: () => ({
          body: '<p></p>',
          styles: readFileSync(resolve(dirname(file), `${basename(dirname(file))}.css`), 'utf8'),
        }),
      },
    });

    expect(await sketchShowsNoChange({ product, sketch, load: byFolder, pictureOf: pictureWith(() => 0) })).toBe(true);

    writeFileSync(card, `${readFileSync(card, 'utf8')}\n/* one pixel */\n`);

    expect(
      await sketchShowsNoChange({ product, sketch, load: byFolder, pictureOf: pictureWith((sketched) => +sketched) }),
    ).toBe('variant a changes components/card default');
  });
});

describe('variantLoadProblemsOf', () => {
  it('names each live variant whose target throws on load, and nothing when all load', async () => {
    const { product, sketch } = acme();
    const throwing: SketchPartLoader = async () => {
      throw new ReferenceError('exports is not defined');
    };

    expect(await variantLoadProblemsOf({ product, sketch, load })).toEqual([]);
    expect(await variantLoadProblemsOf({ product, sketch, load: throwing })).toEqual([
      'variant a elements/hero does not load: exports is not defined',
    ]);
  });
});
