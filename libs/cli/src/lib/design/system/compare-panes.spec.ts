import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { CompareBoxes, PictureBox } from './compare-boxes';
import { comparePart, ShootStates } from './compare-command';
import { encodePng } from './part-compare';
import { resolveProduct } from './resolve-product';

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

const shootWith =
  (app: { picture: Buffer; boxes: CompareBoxes }): ShootStates =>
  async () => ({
    states: { open: {} },
    shots: [{ state: 'open', design, app: app.picture, boxes: { design: DESIGN_BOXES, app: app.boxes } }],
  });

const compared = async (shoot: ShootStates) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-compare-panes-'));
  const product = join(target, DESIGN_DIR, 'app-a');

  mkdirSync(join(product, 'components/chip'), { recursive: true });
  writeFileSync(
    join(product, 'components/chip/chip.ts'),
    "export default definePart({ implements: 'libs/chip/chip.component.ts', states: { open: {} } });\n",
  );
  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));

  const result = await comparePart({
    target,
    config: {},
    product: resolveProduct({ target, name: 'app-a', config: {} }),
    part: 'components/chip',
    url: 'u',
    only: null,
    shoot,
    sketches: [],
  });

  return { result, lines: lines.filter((line) => !line.startsWith('pictures: ')) };
};

describe('compare checks the part root and each overlay pane as boxes of their own', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes a state whose root and pane match although the pictures around them differ in size', async () => {
    const app = pictureOf({ width: 9, height: 7 }, [
      { box: ROOT, rgba: RED },
      { box: PANE, rgba: BLUE },
      { box: { x: 6, y: 0, width: 3, height: 7 }, rgba: GREEN },
    ]);
    const { result, lines } = await compared(shootWith({ picture: app, boxes: DESIGN_BOXES }));

    expect(lines).toEqual(['open ok']);
    expect(result).toMatchObject({ green: true });
  });

  it('fails a pane that drifts from the root, with the root still ok', async () => {
    const moved = { ...PANE, x: 1 };
    const app = pictureOf({ width: 6, height: 6 }, [
      { box: ROOT, rgba: RED },
      { box: moved, rgba: BLUE },
    ]);
    const { result, lines } = await compared(shootWith({ picture: app, boxes: { root: ROOT, panes: [moved] } }));

    expect(lines).toEqual(['open pane 1 OFFSET -2,-2 vs -1,-2']);
    expect(result).toMatchObject({ green: false });
  });

  it('fails a pane of another size or other pixels', async () => {
    const wider = { ...PANE, width: 3 };
    const app = pictureOf({ width: 6, height: 6 }, [
      { box: ROOT, rgba: RED },
      { box: wider, rgba: GREEN },
    ]);
    const { lines } = await compared(shootWith({ picture: app, boxes: { root: ROOT, panes: [wider] } }));
    const { lines: recoloured } = await compared(
      shootWith({
        picture: pictureOf({ width: 6, height: 6 }, [
          { box: ROOT, rgba: RED },
          { box: PANE, rgba: GREEN },
        ]),
        boxes: DESIGN_BOXES,
      }),
    );

    expect(lines).toEqual(['open pane 1 SIZE 2x2 vs 3x2']);
    expect(recoloured).toEqual(['open pane 1 DIFF 4 px']);
  });

  it('fails a state whose app opens another number of panes than the design draws', async () => {
    const app = pictureOf({ width: 6, height: 6 }, [{ box: ROOT, rgba: RED }]);
    const { result, lines } = await compared(shootWith({ picture: app, boxes: { root: ROOT, panes: [] } }));

    expect(lines).toEqual(['open PANES 1 vs 0']);
    expect(result).toMatchObject({ green: false });
  });

  it('prints the root line before the pane lines when the root differs too', async () => {
    const app = pictureOf({ width: 6, height: 6 }, [{ box: { ...ROOT, width: 3 }, rgba: RED }]);
    const { lines } = await compared(shootWith({ picture: app, boxes: { root: { ...ROOT, width: 3 }, panes: [] } }));

    expect(lines).toEqual(['open SIZE 4x4 vs 3x4', 'open PANES 1 vs 0']);
  });
});
