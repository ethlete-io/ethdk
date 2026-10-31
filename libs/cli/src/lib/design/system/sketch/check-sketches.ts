import { TypecheckResult } from '../../typecheck';
import { ruleProblemsOf } from '../check-system';
import { Problem } from '../problem';
import { relative } from 'path';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { goneSketchCommentWarningsOf } from '../rules/stale-comment';
import { typecheckProduct } from '../system-tsconfig';
import { duplicateClassWarningsOf } from './duplicate-class';
import { overlaySketch, SketchedProduct } from './overlay';
import { sharedClassWarningsOf } from './shared-class';
import { unusedFileWarningsOf } from './unused-files';
import { stateNamesOf, withMadeBy, withNote } from './part-definition';
import { listSketches, Sketch, sketchFolderOf, variantDirOf } from './sketch';

/** `problems` are the ones a variant brings in; `before` are the ones the product already has, which do not fail the variant. */
export type VariantProblems = { sketch: Sketch; variant: string; problems: Problem[]; before: Problem[] };

const droppedStatesOf = (options: {
  product: ResolvedProduct;
  overlaid: SketchedProduct;
  allowed: string[];
}): Problem[] => {
  const { product, overlaid, allowed } = options;

  return overlaid.parts
    .filter((part) => overlaid.sketched.includes(partKeyOf(part)))
    .flatMap((part) => {
      const own = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(part));
      const before = own ? stateNamesOf(own.source) : null;
      const after = stateNamesOf(part.source);

      if (before === null || after === null) return [];

      const dropped = before.filter((state) => !after.includes(state) && !allowed.includes(state));

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
};

/** The rule problems of each variant of a sketch laid over the product, and the states it drops from a part. */
export const variantProblemsOf = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  productProblems?: Problem[];
}): VariantProblems[] => {
  const keyOf = (dir: string, problem: Problem) => `${problem.rule} ${relative(dir, problem.file)}: ${problem.message}`;
  const had = new Set(
    (options.productProblems ?? ruleProblemsOf(options.product)).map((problem) => keyOf(options.product.dir, problem)),
  );

  return options.sketch.variants.map((variant) => {
    const overlaid = overlaySketch({ ...options, variant });
    const round = options.sketch.rounds.find((entry) => entry.key === options.sketch.variantInfo[variant]?.round);
    const variantDir = variantDirOf(options.sketch, variant);
    const wasThere = (problem: Problem) =>
      had.has(keyOf(relative(variantDir, problem.file).startsWith('..') ? options.product.dir : variantDir, problem));
    const found = ruleProblemsOf(overlaid);
    const target = overlaid.parts.find((part) => partKeyOf(part) === options.sketch.target);
    const metadataProblem: Problem[] =
      target && (withNote(target.source, '') === null || withMadeBy(target.source, ['author']) === null)
        ? [
            {
              rule: 'SKETCH',
              file: target.file,
              message: `merge cannot write metadata to ${options.sketch.target} - define it with definePart({ ..., note: '...' }) in this file`,
            },
          ]
        : [];

    return {
      sketch: options.sketch,
      variant,
      problems: [
        ...found.filter((problem) => !wasThere(problem)),
        ...metadataProblem,
        ...droppedStatesOf({ product: options.product, overlaid, allowed: round?.drops ?? [] }),
      ],
      before: found.filter(wasThere),
    };
  });
};

/** Warnings that do not fail a variant: a class two stylesheets of one part both define, a class of `shared/` the variant restyles, a file nothing imports. */
export const variantWarningsOf = (options: {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): string[] => {
  const overlaid = overlaySketch(options);

  return [
    ...duplicateClassWarningsOf({ target: options.target, product: overlaid }),
    ...sharedClassWarningsOf({ target: options.target, product: overlaid }),
    ...unusedFileWarningsOf(options),
    ...goneSketchCommentWarningsOf(options.product),
  ];
};

/**
 * The rule problems of every variant of every open sketch of a product. A sketch folder that
 * cannot be read is a `SKETCH` problem of its own.
 */
export const openSketchProblemsOf = (product: ResolvedProduct) => {
  const sketches = listSketches({ productDir: product.dir, product: product.name });
  const productProblems = ruleProblemsOf(product);

  return {
    unreadable: sketches.flatMap((sketch): Problem[] =>
      typeof sketch === 'string' ? [{ rule: 'SKETCH', file: product.dir, message: sketch }] : [],
    ),
    variants: sketches.flatMap((sketch) =>
      typeof sketch === 'string' ? [] : variantProblemsOf({ product, sketch, productProblems }),
    ),
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
