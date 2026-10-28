import { TypecheckResult } from '../../typecheck';
import { ruleProblemsOf } from '../check-system';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { typecheckProduct } from '../system-tsconfig';
import { overlaySketch } from './overlay';
import { listSketches, Sketch, sketchFolderOf } from './sketch';

export type VariantProblems = { sketch: Sketch; variant: string; problems: Problem[] };

/** The rule problems of each variant of a sketch, laid over the product. */
export const variantProblemsOf = (options: { product: ResolvedProduct; sketch: Sketch }): VariantProblems[] =>
  options.sketch.variants.map((variant) => ({
    sketch: options.sketch,
    variant,
    problems: ruleProblemsOf(overlaySketch({ ...options, variant })),
  }));

/**
 * The rule problems of every variant of every open sketch of a product. A sketch folder that
 * cannot be read is a `SKETCH` problem of its own.
 */
export const openSketchProblemsOf = (product: ResolvedProduct) => {
  const sketches = listSketches({ productDir: product.dir, product: product.name });

  return {
    unreadable: sketches.flatMap((sketch): Problem[] =>
      typeof sketch === 'string' ? [{ rule: 'SKETCH', file: product.dir, message: sketch }] : [],
    ),
    variants: sketches.flatMap((sketch) => (typeof sketch === 'string' ? [] : variantProblemsOf({ product, sketch }))),
  };
};

/** Runs `tsc` over one variant laid over the product, with a tsconfig of its own. */
export const typecheckVariant = (options: {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): TypecheckResult => {
  const { target, product, sketch, variant } = options;
  const overlaid = overlaySketch({ product, sketch, variant });

  return typecheckProduct({
    target,
    product: { ...overlaid, name: `${product.name}.sketch.${sketchFolderOf(sketch)}.${variant}` },
  });
};
