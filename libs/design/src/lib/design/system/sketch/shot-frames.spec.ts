import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { blankPngOf } from '../../blank-png';
import { DESIGN_DIR } from '../../design-config';
import { PictureOf, SourcedPicture } from '../../merge-compare';
import { writePictures } from '../accepted-pictures';
import { resolveProduct } from '../resolve-product';
import { partHashOf } from './baseline';
import { NotKeptError } from '../../shot';
import { LeftOutShot, leftOutLineOf, shotFramesOf } from './shot-frames';
import { Sketch } from './sketch';

const ZOOM_CHIP = 'components/zoom-chip';
const STATES = ['reset', 'reset-hover', 'reset-active', 'reset-focus-visible'];

const targets: string[] = [];

afterEach(() => {
  for (const target of targets.splice(0)) rmSync(target, { recursive: true, force: true });
});

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-shot-frames-'));
  const design = join(target, DESIGN_DIR);
  const chip = join(design, 'app-a/components/zoom-chip/zoom-chip.ts');

  targets.push(target);
  mkdirSync(dirname(chip), { recursive: true });
  writeFileSync(
    chip,
    `export default definePart({ states: { ${STATES.map((state) => `'${state}': {}`).join(', ')} } });\n`,
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return { chip, productOf: () => resolveProduct({ target, name: 'app-a', config: {} }) };
};

const sketch = { target: ZOOM_CHIP, layer: 'components' } as Sketch;

const keptReset: PictureOf = async ({ state, sketch: variant }) => {
  if (state !== 'reset' || variant !== null) throw new Error('not kept');

  return { png: blankPngOf(202, 62) } as SourcedPicture;
};

const framesOf = (product: ReturnType<ReturnType<typeof checkout>['productOf']>) =>
  shotFramesOf({ product, sketch, part: ZOOM_CHIP, drawn: [{ variant: null, states: STATES }], pictureOf: keptReset });

describe('shotFramesOf', () => {
  it('sizes every fitted shot of the product the zoom-chip listing has no kept picture of from its pictures.json record', async () => {
    const { chip, productOf } = checkout();
    const product = productOf();

    writePictures({
      dir: product.dir,
      part: ZOOM_CHIP,
      pictures: {
        hash: 'design',
        states: Object.fromEntries(STATES.map((state) => [state, state])),
        partHash: partHashOf({ product, dir: dirname(chip) }),
        sizes: {
          reset: { width: 170, height: 30 },
          'reset-hover': { width: 170, height: 30 },
          'reset-active': { width: 170, height: 30 },
          'reset-focus-visible': { width: 198, height: 85 },
        },
      },
    });

    expect(Object.fromEntries((await framesOf(productOf())).map(({ state, frame }) => [state, frame]))).toEqual({
      reset: { width: 202, height: 62 },
      'reset-hover': { width: 202, height: 62 },
      'reset-active': { width: 202, height: 62 },
      'reset-focus-visible': { width: 230, height: 117 },
    });
  });

  it('leaves a shot without a kept picture out while the part changed since its record was drawn', async () => {
    const { chip, productOf } = checkout();
    const product = productOf();

    writePictures({
      dir: product.dir,
      part: ZOOM_CHIP,
      pictures: {
        hash: 'design',
        states: {},
        partHash: partHashOf({ product, dir: dirname(chip) }),
        sizes: { 'reset-hover': { width: 170, height: 30 } },
      },
    });
    writeFileSync(chip, `export default definePart({ states: { reset: {}, 'reset-hover': { x: 1 } } });\n`);

    expect((await framesOf(productOf())).map(({ state }) => state)).toEqual(['reset']);
  });

  it('sizes each hero variant shot of the tomflix sketch from a picture an older picture code drew', async () => {
    const { productOf } = checkout();
    const hero = { target: 'elements/hero', layer: 'elements' } as Sketch;
    const heights: Record<string, number> = { a: 554, b: 718, c: 640 };
    const olderCode: PictureOf = async ({ kept, sketch: variant }) => {
      if (kept !== 'size' || !variant) throw new Error('not kept');

      return { png: blankPngOf(1472, heights[variant.variant] ?? 0) } as SourcedPicture;
    };

    const frames = await shotFramesOf({
      product: productOf(),
      sketch: hero,
      part: 'elements/hero',
      drawn: ['a', 'b', 'c'].map((variant) => ({ variant, states: ['desktop'] })),
      pictureOf: olderCode,
    });

    expect(frames.map(({ variant, frame }) => [variant, frame])).toEqual([
      ['a', { width: 1472, height: 554 }],
      ['b', { width: 1472, height: 718 }],
      ['c', { width: 1472, height: 640 }],
    ]);
  });

  it('names each zoom-chip shot it leaves out with the draw it waited for, and each shot it lists', async () => {
    const { productOf } = checkout();
    const leftOut: LeftOutShot[] = [];
    const pictureOf: PictureOf = async ({ state, sketch: variant }) => {
      if (state === 'reset' && variant === null) return { png: blankPngOf(202, 62) } as SourcedPicture;
      if (state === 'reset-hover') throw new NotKeptError('held', 12600);

      throw new NotKeptError('not kept');
    };

    const listed = await shotFramesOf({
      product: productOf(),
      sketch,
      part: ZOOM_CHIP,
      drawn: [
        { variant: null, states: ['reset', 'reset-hover'] },
        { variant: 'a', states: ['reset'] },
      ],
      pictureOf,
      onLeftOut: (shot) => leftOut.push(shot),
    });

    expect(leftOutLineOf({ target: ZOOM_CHIP, listed, leftOut })).toBe(
      'design-explore: sketch listing components/zoom-chip left out 2 of 3 frame(s): current reset-hover ' +
        '(draw still running after 12600 ms), a reset (no draw asked, none stored); listed: current reset',
    );
  });
});
