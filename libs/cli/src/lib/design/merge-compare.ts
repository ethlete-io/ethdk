import { PartMark, Picture } from './shot';
import { readPartModule } from './system/list-system';
import { partKeyOf, ResolvedProduct } from './system/resolve-product';
import { mergePreviewOf } from './system/sketch/merge-preview';
import { Sketch } from './system/sketch/sketch';
import { SketchVariant } from './system/system-modules';

export type Outline = Omit<PartMark, 'parts'>;

/**
 * One state of a part that shows the sketched part, at the preset or width it is compared at (neither
 * for a part fitted to its content), with the outline of each instance of the sketched part now and
 * after the merge. `error` says why a side could not be drawn.
 */
export type CompareRow = {
  part: string;
  state: string;
  preset?: string;
  width?: number;
  outlines: { now: Outline[]; merged: Outline[] };
  error?: string;
};

/** The rows of a merge preview, split by whether the merge changes a pixel of their picture. */
export type MergeCompare = { target: string; variant: string; changed: CompareRow[]; unchanged: CompareRow[] };

export type PictureOf = (options: {
  product: string;
  part: string;
  state: string;
  preset: string | null;
  width: number | null;
  sketch: SketchVariant | null;
  interaction: string | null;
  params: URLSearchParams;
  fresh?: boolean;
}) => Promise<Picture>;

/**
 * Draws a state without and with `merged`. A pair that differs is drawn once more, bypassing any kept picture,
 * and only that second pair counts, so one odd picture under load is not taken for a change.
 */
export const drawnPair = async (
  draw: (sketch: SketchVariant | null, fresh: boolean) => Promise<Picture>,
  merged: SketchVariant,
) => {
  const both = (fresh: boolean) => Promise.all([draw(null, fresh), draw(merged, fresh)]);
  let [now, after] = await both(false);

  if (!now.png.equals(after.png)) [now, after] = await both(true);

  return { now, after, same: now.png.equals(after.png) };
};

export type PartModuleLoader = (options: { file: string; product: string }) => Promise<unknown>;

const outlinesOf = (picture: Picture, target: string): Outline[] =>
  picture.marks
    .filter((mark) => mark.parts.includes(target))
    .map(({ x, y, width, height }) => ({ x, y, width, height }));

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Draws each state of every element and page that shows the sketched part twice, as the product has it
 * now and with `variant` merged, and splits them by whether the two pictures differ in any pixel. A page
 * is drawn at the preset `size` names, or its first; a part with `widths` at the width `size` names, or
 * its first; any other part fitted to its content.
 */
export const compareMerge = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  size: string | null;
  params: URLSearchParams;
  pictureOf: PictureOf;
  load: PartModuleLoader;
}): Promise<MergeCompare> => {
  const { product, sketch, variant, size, params, pictureOf, load } = options;
  const target = sketch.target;
  const merged: SketchVariant = { target, variant };
  const { affected } = mergePreviewOf({ product, sketch, variant });

  const rowsOf = async (key: string): Promise<{ row: CompareRow; changed: boolean }[]> => {
    const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

    if (!part) return [];

    const read = await readPartModule({ part, product: product.name, load });

    if (read.problem)
      return [{ row: { part: key, state: '', outlines: { now: [], merged: [] }, error: read.problem }, changed: true }];

    const offered =
      part.layer === 'pages' ? Object.keys(product.presets) : (('widths' in read ? read.widths : undefined) ?? []);
    const picked = offered.map(String).find((entry) => entry === size) ?? offered[0];
    const at =
      picked === undefined ? {} : part.layer === 'pages' ? { preset: String(picked) } : { width: Number(picked) };

    return Promise.all(
      read.states.map(async (state) => {
        const draw = (drawn: SketchVariant | null, fresh: boolean) =>
          pictureOf({
            product: product.name,
            part: key,
            state,
            preset: at.preset ?? null,
            width: at.width ?? null,
            sketch: drawn,
            interaction: null,
            params,
            fresh,
          });

        try {
          const { now, after, same } = await drawnPair(draw, merged);

          return {
            row: {
              part: key,
              state,
              ...at,
              outlines: { now: outlinesOf(now, target), merged: outlinesOf(after, target) },
            },
            changed: !same,
          };
        } catch (error) {
          return {
            row: { part: key, state, ...at, outlines: { now: [], merged: [] }, error: messageOf(error) },
            changed: true,
          };
        }
      }),
    );
  };

  const rows = (await Promise.all(affected.map(rowsOf))).flat();

  return {
    target,
    variant,
    changed: rows.filter((entry) => entry.changed).map((entry) => entry.row),
    unchanged: rows.filter((entry) => !entry.changed).map((entry) => entry.row),
  };
};
