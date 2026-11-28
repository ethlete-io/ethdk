import { describe, expect, it } from 'vitest';
import { CompareBoxes, PictureBox } from './compare-boxes';
import { ShootStates } from './compare-command';
import { encodePng, shotCompareLinesOf, shotCompareOf } from './part-compare';
import { ResolvedProduct } from './resolve-product';
import { comparedProblemsOf } from './slow-run';

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const GREEN = [0, 255, 0, 255];
const CLEAR = [0, 0, 0, 0];

const inside = (box: PictureBox, x: number, y: number) =>
  x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;

const pictureOf = (size: { width: number; height: number }, fills: { box: PictureBox; rgba: number[] }[]) =>
  encodePng({
    ...size,
    data: Buffer.from(
      Array.from({ length: size.width * size.height }, (_, at) => {
        const [x, y] = [at % size.width, Math.floor(at / size.width)];

        return [...fills].reverse().find(({ box }) => inside(box, x, y))?.rgba ?? CLEAR;
      }).flat(),
    ),
  });

const ROOT = { x: 2, y: 2, width: 4, height: 4 };
const PANE = { x: 0, y: 0, width: 2, height: 2 };
const DESIGN_BOXES: CompareBoxes = { root: ROOT, panes: [PANE] };
const design = pictureOf({ width: 6, height: 6 }, [
  { box: ROOT, rgba: RED },
  { box: PANE, rgba: BLUE },
]);
const wideApp = pictureOf({ width: 9, height: 7 }, [
  { box: ROOT, rgba: RED },
  { box: PANE, rgba: BLUE },
  { box: { x: 6, y: 0, width: 3, height: 7 }, rgba: GREEN },
]);

const problemsOf = (app: { picture: Buffer; boxes: CompareBoxes }) => {
  const shoot: ShootStates = async () => ({
    states: { open: {} },
    shots: [{ state: 'open', design, app: app.picture, boxes: { design: DESIGN_BOXES, app: app.boxes } }],
  });

  return comparedProblemsOf({
    target: '/nowhere',
    config: {},
    product: {} as ResolvedProduct,
    part: 'components/chip',
    file: 'components/chip/chip.ts',
    url: 'u',
    shoot,
  }).then((problems) => problems.map(({ message }) => message));
};

describe('the slow compare checks the part root and each overlay pane as boxes of their own', () => {
  it('passes a state whose root and pane match although the pictures around them differ in size', async () => {
    expect(await problemsOf({ picture: wideApp, boxes: DESIGN_BOXES })).toEqual([]);
  });

  it('fails a state whose app opens another number of panes than the design draws', async () => {
    const app = pictureOf({ width: 6, height: 6 }, [{ box: ROOT, rgba: RED }]);

    expect(await problemsOf({ picture: app, boxes: { root: ROOT, panes: [] } })).toEqual(['open PANES 1 vs 0']);
  });
});

describe('shotCompareOf', () => {
  it('compares box by box with boxes on both sides, and the whole pictures without', () => {
    const boxed = shotCompareOf({ design, app: wideApp, boxes: { design: DESIGN_BOXES, app: DESIGN_BOXES } });
    const whole = shotCompareOf({ design, app: wideApp });

    expect(boxed.ok).toBe(true);
    expect(shotCompareLinesOf('open', boxed)).toEqual(['open ok']);
    expect(whole.ok).toBe(false);
    expect(shotCompareLinesOf('open', whole)).toEqual(['open SIZE 6x6 vs 9x7']);
  });

  it('is not ok when the root matches and a pane does not', () => {
    const app = pictureOf({ width: 6, height: 6 }, [
      { box: ROOT, rgba: RED },
      { box: PANE, rgba: GREEN },
    ]);
    const compared = shotCompareOf({ design, app, boxes: { design: DESIGN_BOXES, app: DESIGN_BOXES } });

    expect(compared.result.kind).toBe('ok');
    expect(compared.ok).toBe(false);
    expect(shotCompareLinesOf('open', compared)).toEqual(['open pane 1 DIFF 4 px']);
  });
});
