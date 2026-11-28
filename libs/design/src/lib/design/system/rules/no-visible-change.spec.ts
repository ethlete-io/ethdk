import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { PictureOf } from '../../merge-compare';
import { readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { createSketch, Sketch, variantDirOf } from '../sketch/sketch';
import { SketchPartLoader } from '../sketch/unchanged-states';
import { isJudgedForVisibleChange, NO_VISIBLE_CHANGE_RULE, noVisibleChangeProblemsOf } from './no-visible-change';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-no-visible-rule-'));

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

describe('noVisibleChangeProblemsOf', { timeout: 30_000 }, () => {
  it('puts one problem on the sketch part when no variant draws a different picture', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n/* same look */\n`);

    const problems = await noVisibleChangeProblemsOf({ product, sketch, load, pictureOf: pictureWith(() => 0) });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ rule: NO_VISIBLE_CHANGE_RULE, part: 'elements/hero' });
    expect(problems[0]?.file).toMatch(/hero/u);
  });

  it('puts none when a variant draws a visible change', async () => {
    const { product, sketch, css } = acme();

    writeFileSync(css, `${readFileSync(css, 'utf8')}\nh1 { color: red; }\n`);

    expect(
      await noVisibleChangeProblemsOf({
        product,
        sketch,
        load,
        pictureOf: pictureWith((sketched) => (sketched ? 1 : 0)),
      }),
    ).toEqual([]);
  });
});

describe('isJudgedForVisibleChange', () => {
  it('judges an in-progress sketch and skips a ready one', () => {
    const { product, sketch } = acme();

    expect(isJudgedForVisibleChange({ product, sketch })).toBe(true);
    expect(isJudgedForVisibleChange({ product, sketch: { ...sketch, status: 'ready' } })).toBe(false);
  });
});
