import { PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { Sketch, variantDirOf } from './sketch';
import { SketchPartLoader, unchangedStatesOf } from './unchanged-states';

/**
 * Whether every state of every variant of the sketch draws the same pixels as the product does now, in every
 * frame. A variant that holds another part than the target, or a state that fails to draw, counts as a change.
 */
export const sketchShowsNoChange = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<boolean> => {
  const { product, sketch, load, pictureOf } = options;

  if (sketch.variants.length === 0) return false;

  const results = await Promise.all(
    sketch.variants.map(async (variant) => {
      const held = partFilesOf(variantDirOf(sketch, variant)).parts.map(partKeyOf);

      if (held.some((key) => key !== sketch.target)) return false;

      const file = overlaySketch({ product, sketch, variant }).parts.find(
        (part) => partKeyOf(part) === sketch.target,
      )?.file;

      if (!file) return false;

      const read = await readPartModule({
        part: { file },
        product: product.name,
        load: () => load({ file, product: product.name, sketch: { target: sketch.target, variant } }),
      });

      if (read.problem || read.states.length === 0) return false;

      const unchanged = await unchangedStatesOf({ product, sketch, variant, load, pictureOf });

      return read.states.every((state) => unchanged.includes(state));
    }),
  );

  return results.every(Boolean);
};
