import { TypecheckResult } from '../../typecheck';
import { ruleProblemsOf } from '../check-system';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { typecheckProduct } from '../system-tsconfig';
import { overlaySketch, SketchedProduct } from './overlay';
import { stateNamesOf } from './part-definition';
import { listSketches, Sketch, sketchFolderOf } from './sketch';

export type VariantProblems = { sketch: Sketch; variant: string; problems: Problem[] };

const droppedStatesOf = (product: ResolvedProduct, overlaid: SketchedProduct): Problem[] =>
  overlaid.parts
    .filter((part) => overlaid.sketched.includes(partKeyOf(part)))
    .flatMap((part) => {
      const own = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(part));
      const before = own ? stateNamesOf(own.source) : null;
      const after = stateNamesOf(part.source);

      if (before === null || after === null) return [];

      const dropped = before.filter((state) => !after.includes(state));

      return dropped.length === 0
        ? []
        : [
            {
              rule: 'STATES',
              file: part.file,
              message: `drops the state${dropped.length === 1 ? '' : 's'} ${dropped.join(', ')} that ${partKeyOf(part)} has in ${product.name} - a variant keeps every state of the part`,
            },
          ];
    });

/** The rule problems of each variant of a sketch laid over the product, and the states it drops from a part. */
export const variantProblemsOf = (options: { product: ResolvedProduct; sketch: Sketch }): VariantProblems[] =>
  options.sketch.variants.map((variant) => {
    const overlaid = overlaySketch({ ...options, variant });

    return {
      sketch: options.sketch,
      variant,
      problems: [...ruleProblemsOf(overlaid), ...droppedStatesOf(options.product, overlaid)],
    };
  });

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
