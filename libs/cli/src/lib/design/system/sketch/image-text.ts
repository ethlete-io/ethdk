import { PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { decodePng, Pixels } from '../part-compare';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { defaultFrameOf, SketchPartLoader } from './unchanged-states';

/** Text or a title image drawn on a picture below this contrast ratio against the pixels behind it does not read. */
export const IMAGE_TEXT_CONTRAST = 3;

/** Text or a title image this many px tall or taller is a title, which has to read on any background. */
export const TITLE_HEIGHT = 18;

/**
 * A logo or text under `TITLE_HEIGHT` on a flat surface reads down to this ratio: thin strokes blend into their
 * background at the edges, which pulls the measured median below the colour the stroke is drawn in.
 */
export const FLAT_SMALL_CONTRAST = 2.5;

/** A channel that changes by more than this when the text is hidden belongs to the text. */
const TEXT_DIFF = 24;

/** Text pixels this many px apart belong to one block. */
const BLOCK_GAP = 12;

/** A block with fewer text pixels than this is an icon or a speck, not a line of text or a title. */
const BLOCK_PIXELS = 60;

/** The background behind a block with a luminance spread below this is a flat surface, not a picture. */
const IMAGE_SPREAD = 0.04;

export type TextBlock = {
  box: { x: number; y: number; width: number; height: number };
  pixels: number[];
  contrast: number;
  onImage: boolean;
};

const channel = (value: number) => {
  const linear = value / 255;

  return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
};

const luminanceAt = ({ data }: Pixels, pixel: number) =>
  0.2126 * channel(data[pixel * 4] ?? 0) +
  0.7152 * channel(data[pixel * 4 + 1] ?? 0) +
  0.0722 * channel(data[pixel * 4 + 2] ?? 0);

const ratioOf = (one: number, other: number) => (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);

const diffAt = ([one, other]: [Pixels, Pixels], pixel: number) =>
  Math.max(
    Math.abs((one.data[pixel * 4] ?? 0) - (other.data[pixel * 4] ?? 0)),
    Math.abs((one.data[pixel * 4 + 1] ?? 0) - (other.data[pixel * 4 + 1] ?? 0)),
    Math.abs((one.data[pixel * 4 + 2] ?? 0) - (other.data[pixel * 4 + 2] ?? 0)),
  );

const medianOf = (values: number[]) => {
  const sorted = [...values].sort((one, other) => one - other);

  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const groupsOf = (pixels: number[], width: number) => {
  const columns = Math.ceil(width / BLOCK_GAP);
  const cells = new Map<number, number[]>();

  for (const pixel of pixels) {
    const cell = Math.floor(Math.floor(pixel / width) / BLOCK_GAP) * columns + Math.floor((pixel % width) / BLOCK_GAP);

    const members = cells.get(cell) ?? [];

    members.push(pixel);
    cells.set(cell, members);
  }

  const seen = new Set<number>();
  const groups: number[][] = [];

  for (const start of cells.keys()) {
    if (seen.has(start)) continue;

    seen.add(start);
    const queue = [start];
    const group: number[] = [];

    while (queue.length > 0) {
      const cell = queue.pop() ?? 0;
      const column = cell % columns;

      group.push(...(cells.get(cell) ?? []));

      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const next = cell + dy * columns + dx;

          if (column + dx < 0 || column + dx >= columns || !cells.has(next) || seen.has(next)) continue;

          seen.add(next);
          queue.push(next);
        }
    }

    groups.push(group);
  }

  return groups;
};

const spreadOf = (picture: Pixels, box: TextBlock['box']) => {
  const values: number[] = [];

  for (let y = box.y; y < box.y + box.height; y++)
    for (let x = box.x; x < box.x + box.width; x++) values.push(luminanceAt(picture, y * picture.width + x));

  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1));
};

/**
 * The blocks of text and title images in `drawn`, found as the pixels that change in `bare`, the same state drawn with
 * its text and title images hidden. `contrast` is the median ratio of the block's strongest text pixels against the
 * pixel `bare` shows behind each; `onImage` when the background behind the block is not a flat surface.
 */
export const textBlocksOf = (drawn: Buffer, bare: Buffer): TextBlock[] => {
  const shown = decodePng(drawn);
  const hidden = decodePng(bare);

  if (shown.width !== hidden.width || shown.height !== hidden.height) return [];

  const changed: number[] = [];

  for (let pixel = 0; pixel < shown.width * shown.height; pixel++)
    if (diffAt([shown, hidden], pixel) > TEXT_DIFF) changed.push(pixel);

  return groupsOf(changed, shown.width)
    .filter((pixels) => pixels.length >= BLOCK_PIXELS)
    .map((pixels) => {
      const xs = pixels.map((pixel) => pixel % shown.width);
      const ys = pixels.map((pixel) => Math.floor(pixel / shown.width));
      const box = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs) + 1,
        height: Math.max(...ys) - Math.min(...ys) + 1,
      };
      const diffs = pixels.map((pixel) => diffAt([shown, hidden], pixel));
      const strong = medianOf(diffs);
      const ratios = pixels
        .filter((_, index) => (diffs[index] ?? 0) >= strong)
        .map((pixel) => ratioOf(luminanceAt(shown, pixel), luminanceAt(hidden, pixel)));

      return { box, pixels, contrast: medianOf(ratios), onImage: spreadOf(hidden, box) >= IMAGE_SPREAD };
    });
};

const barOf = (block: TextBlock) =>
  block.onImage || block.box.height >= TITLE_HEIGHT ? IMAGE_TEXT_CONTRAST : FLAT_SMALL_CONTRAST;

const statesText = (states: string[]) => states.join(', ');

/**
 * One warning per target of a live variant, in the part's default frame, naming the states that draw text or a title
 * image below `IMAGE_TEXT_CONTRAST` against what it covers, on a picture or at title size, with how to fix it.
 */
export const imageTextWarningsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string[]> => {
  const { product, sketch, load, pictureOf } = options;
  const warnings: string[] = [];

  for (const variant of sketch.variants.filter((entry) => !rejectionOf(sketch, entry)))
    for (const target of sketch.targets) {
      const part = overlaySketch({ product, sketch, variant }).parts.find((entry) => partKeyOf(entry) === target);

      if (!part) continue;

      const on = { target: sketch.target, variant };
      const read = await readPartModule({
        part: { file: part.file },
        product: product.name,
        load: () => load({ file: part.file, product: product.name, sketch: on }),
      });

      if (read.problem) continue;

      const presets = part.layer === 'pages' ? Object.keys(product.presets) : null;
      const frame = defaultFrameOf(
        { widths: 'widths' in read ? read.widths : undefined, interactions: read.interactions },
        presets,
      );
      const shot = async (state: string, titleless: boolean) =>
        (
          await pictureOf({
            product: product.name,
            part: target,
            state,
            ...frame,
            sketch: on,
            params: new URLSearchParams(titleless ? { titleless: '1' } : {}),
            priority: 'low',
          })
        ).png;
      const low: { state: string; contrast: number; bar: number; flat: boolean }[] = [];

      for (const state of read.states) {
        const found = await Promise.all([shot(state, false), shot(state, true)])
          .then(([drawn, bare]) => textBlocksOf(drawn, bare).filter((block) => block.contrast < barOf(block)))
          .catch(() => []);
        const worst = found.reduce<TextBlock | null>(
          (lowest, block) => (!lowest || block.contrast < lowest.contrast ? block : lowest),
          null,
        );

        if (worst)
          low.push({
            state,
            contrast: worst.contrast,
            bar: barOf(worst),
            flat: !worst.onImage && worst.box.height < TITLE_HEIGHT,
          });
      }

      const worst = low.reduce<(typeof low)[number] | null>(
        (lowest, entry) => (!lowest || entry.contrast < lowest.contrast ? entry : lowest),
        null,
      );

      if (worst)
        warnings.push(
          `${sketch.target} ${variant}: ${target} ${statesText(low.map((entry) => entry.state))} draws text or a title ` +
            `image at ${worst.contrast.toFixed(1)}:1 against what it covers, below ${worst.bar}:1 - ` +
            (worst.flat
              ? `use a lighter version of the logo or text, or put a solid plate behind it`
              : `put a scrim or a solid plate behind it, move it onto a calm part of the picture, or give it a colour ` +
                `or outline that stands out`),
        );
    }

  return warnings;
};
