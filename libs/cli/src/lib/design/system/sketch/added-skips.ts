import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { addedSkipMarksOf } from '../rules/skips';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';

export type AddedSkip = { variant: string; part: string; classes: string };

/** Each `data-et-skip` a live variant of `sketch` adds to a part beyond the product's current part. */
export const addedSkipsOf = ({ product, sketch }: { product: ResolvedProduct; sketch: Sketch }): AddedSkip[] =>
  sketch.variants
    .filter((variant) => !rejectionOf(sketch, variant))
    .flatMap((variant) => {
      const drawn = overlaySketch({ product, sketch, variant });

      return drawn.sketched.flatMap((part) => {
        const after = drawn.parts.find((entry) => partKeyOf(entry) === part);
        const before = product.parts.find((entry) => partKeyOf(entry) === part);

        return after
          ? addedSkipMarksOf(before?.source ?? null, after.source).map((classes) => ({ variant, part, classes }))
          : [];
      });
    });
