import { relative } from 'path';
import { PictureOf } from '../../merge-compare';
import { Problem } from '../problem';
import { repoRootOf } from '../reachable-files';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { sketchShowsNoChange } from '../sketch/no-visible-change';
import { Sketch } from '../sketch/sketch';
import { SketchPartLoader } from '../sketch/unchanged-states';

export const NO_VISIBLE_CHANGE_RULE = 'NO-VISIBLE-CHANGE';

/** Whether a sketch is judged by `NO-VISIBLE-CHANGE`: it is in progress, targets only parts the product has, and `ready` has not declared it a change without a picture. */
export const isJudgedForVisibleChange = (options: { product: ResolvedProduct; sketch: Sketch }) =>
  options.sketch.status !== 'ready' &&
  !options.sketch.decision &&
  options.sketch.targets.every((key) => options.product.parts.some((part) => partKeyOf(part) === key));

/** One `NO-VISIBLE-CHANGE` problem on the sketch's part when every live variant draws the pixels the product draws now; none otherwise. */
export const noVisibleChangeProblemsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<Problem[]> => {
  const { product, sketch } = options;
  const part = product.parts.find((candidate) => partKeyOf(candidate) === sketch.target);

  if (!part || (await sketchShowsNoChange(options)) !== true) return [];

  return [
    {
      rule: NO_VISIBLE_CHANGE_RULE,
      file: relative(repoRootOf(product), part.file),
      part: sketch.target,
      message: `the sketch ${sketch.target} draws no visible change in any live variant - draw one, or run sketch ready --no-visible-change when none is meant`,
    },
  ];
};
