import { boundsOf, ChangedBox, changedCropsOf, pngSizeOf } from './contact-sheet';
import { PictureOf } from './merge-compare';
import { readPartModule } from './system/list-system';
import { partKeyOf, ResolvedProduct } from './system/resolve-product';
import { overlaySketch } from './system/sketch/overlay';
import { Sketch } from './system/sketch/sketch';
import { SketchVariant } from './system/system-modules';

/** One box per cluster of the pixels `after` changes from `before`; empty when both draw the same pixels. */
export type BoxOf = (before: Buffer, after: Buffer) => Promise<ChangedBox[]>;

export type VariantPartLoad = (options: {
  file: string;
  product: string;
  sketch: SketchVariant | null;
}) => Promise<unknown>;

export type FrameSize = { width: number; height: number };

/**
 * One state of the sketched part: the box around the pixels the variant changes against the product (`null` for
 * none), one box per cluster of them, and the size of the picture they were found in, `new` when the product does not draw the state, or why a side could
 * not be drawn.
 */
export type StateDiff =
  | { state: string; box: ChangedBox | null; boxes: ChangedBox[]; frame: FrameSize }
  | { state: string; new: true }
  | { state: string; error: string };

/** The crops every column of a comparison shares, one per cluster of changes, and the frame they sit in. */
export type ChangedArea = { frame: FrameSize; crops: ChangedBox[] };

export type VariantDiff = { target: string; variant: string; preset?: string; width?: number; states: StateDiff[] };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Draws every state of the sketched part, or of its target `part`, as `variant` draws it and as the product draws it now, at rest, and
 * returns the boxes of the changed pixels per state. A page is drawn at the preset `size` names, or its first; a part
 * with `widths` at the width `size` names, or its first; any other part fitted to its content.
 */
export const diffVariant = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  part?: string;
  size: string | null;
  params: URLSearchParams;
  pictureOf: PictureOf;
  boxOf: BoxOf;
  load: VariantPartLoad;
}): Promise<VariantDiff> => {
  const { product, sketch, variant, size, params, pictureOf, boxOf, load } = options;
  const target = options.part ?? sketch.target;
  const drawn: SketchVariant = { target: sketch.target, variant };
  const file = overlaySketch({ product, sketch, variant }).parts.find((part) => partKeyOf(part) === target)?.file;
  const current = product.parts.find((part) => partKeyOf(part) === target);

  if (!file) return { target, variant, states: [] };

  const [after, now] = await Promise.all([
    readPartModule({
      part: { file },
      product: product.name,
      load: () => load({ file, product: product.name, sketch: drawn }),
    }),
    current
      ? readPartModule({
          part: current,
          product: product.name,
          load: () => load({ file: current.file, product: product.name, sketch: null }),
        })
      : null,
  ]);
  const isPage = target.startsWith('pages/');
  const offered = isPage ? Object.keys(product.presets) : (('widths' in after ? after.widths : undefined) ?? []);
  const picked = offered.map(String).find((entry) => entry === size) ?? offered[0];
  const at = picked === undefined ? {} : isPage ? { preset: String(picked) } : { width: Number(picked) };
  const known = new Set(now?.problem === null ? now.states : []);

  const states = await Promise.all(
    after.states.map(async (state): Promise<StateDiff> => {
      if (!known.has(state)) return { state, new: true };

      const draw = (sketched: SketchVariant | null) =>
        pictureOf({
          product: product.name,
          part: target,
          state,
          preset: at.preset ?? null,
          width: at.width ?? null,
          sketch: sketched,
          interaction: null,
          params,
        });

      try {
        const [before, changed] = await Promise.all([draw(null), draw(drawn)]);

        const boxes = await boxOf(before.png, changed.png);

        return { state, box: boundsOf(boxes), boxes, frame: pngSizeOf(before.png) };
      } catch (error) {
        return { state, error: messageOf(error) };
      }
    }),
  );

  return { target, variant, ...at, states };
};

/**
 * One crop per cluster of the pixels any of `diffs` changes in any state, padded by `margin`, inside the largest
 * frame they were drawn in; `null` when no pixel changes.
 */
export const changedAreaOf = (diffs: VariantDiff[], margin?: number): ChangedArea | null => {
  const drawn = diffs.flatMap((diff) => diff.states.flatMap((entry) => ('box' in entry ? [entry] : [])));
  const frame = {
    width: Math.max(0, ...drawn.map((entry) => entry.frame.width)),
    height: Math.max(0, ...drawn.map((entry) => entry.frame.height)),
  };
  const crops = changedCropsOf({ boxes: drawn.flatMap((entry) => entry.boxes), frame, margin });

  return crops.length > 0 ? { frame, crops } : null;
};
