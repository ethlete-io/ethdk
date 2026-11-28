import { PictureOf } from '../../merge-compare';
import { ResolvedProduct } from '../resolve-product';
import { rejectionOf, Sketch } from './sketch';
import { sameAsRestOf, SketchPartLoader } from './unchanged-states';

/**
 * One warning per state of a target of a live variant that draws the same pixels as its row's `rest` state in every
 * frame, with how to fix it. `[]` when every such state draws a visible change.
 */
export const restLikeStateWarningsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string[]> => {
  const { product, sketch, load, pictureOf } = options;
  const live = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));
  const warnings: string[] = [];

  for (const variant of live)
    for (const part of sketch.targets) {
      const same = await sameAsRestOf({ product, sketch, variant, load, pictureOf, part });

      for (const [state, rest] of Object.entries(same))
        warnings.push(
          `${sketch.target} ${variant}: ${part} ${state} draws the same as its rest state ${rest} - ` +
            `give ${state} a change the user sees next to ${rest} (colour, surface, outline or shadow), ` +
            `or drop it from the grid when the part has no such state`,
        );
    }

  return warnings;
};
