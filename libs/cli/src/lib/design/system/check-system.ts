import { relative } from 'path';
import { DesignConfig } from '../paths';
import { importProblemsOf } from './imports';
import { Problem } from './problem';
import { resolveProduct, ResolvedProduct } from './resolve-product';
import { canonicalClassesOf } from './rules/canonical-class';
import { componentCopiesOf } from './rules/component-copy';
import { renderIssueLineOf, renderIssuesOf } from './render-check';
import { flowProblemsOf } from './rules/flow';
import { hardCodedColoursOf } from './rules/hard-coded-colour';
import { unknownInteractionsOf } from './rules/interactions';
import { kitOutsidePagesOf } from './rules/kit-outside-pages';
import { inlineSvgsOf } from './rules/inline-svg';
import { badMotionsOf, hardCodedMotionOf, scriptedMotionOf } from './rules/motion';
import { goneSketchCommentWarningsOf, staleCommentsOf, staleNotesOf } from './rules/stale-comment';
import { undefinedTokensOf } from './rules/undefined-token';
import { tokenSelectorsOf } from './rules/token-selectors';
import { upwardDependenciesOf } from './rules/upward-dependency';
import { badSvgAssetsOf } from './rules/svg-asset';
import { staleReplacesOf } from './rules/stale-replace';
import { unusedSharedExportsOf } from './rules/unused-shared-export';
import { utilityCssOf } from './rules/utility-css';
import { badWidthsOf } from './rules/widths';
import { typecheckVariant } from './sketch/check-sketches';
import { changedOutsideSketchOf } from './sketch/merged-parts';
import { listSketches, variantDirOf } from './sketch/sketch';
import { typecheckProduct, writeEditorTsconfig } from './system-tsconfig';

const RULES = [
  importProblemsOf,
  upwardDependenciesOf,
  hardCodedColoursOf,
  undefinedTokensOf,
  componentCopiesOf,
  scriptedMotionOf,
  badMotionsOf,
  hardCodedMotionOf,
  staleCommentsOf,
  staleNotesOf,
  badWidthsOf,
  unknownInteractionsOf,
  kitOutsidePagesOf,
  flowProblemsOf,
  badSvgAssetsOf,
  inlineSvgsOf,
  canonicalClassesOf,
  utilityCssOf,
];

export const ruleLinesOf = (target: string, product: ResolvedProduct) =>
  ruleProblemsOf(product).map((problem) => lineOf(target, problem));

/** Every problem the rules find in a resolved product, its resolution problems first. */
export const ruleProblemsOf = (product: ResolvedProduct): Problem[] => [
  ...product.problems,
  ...RULES.flatMap((rule) => rule(product)),
];

const lineOf = (target: string, problem: Problem) =>
  `${problem.rule} ${relative(target, problem.file)}: ${problem.message}`;

type CheckOptions = { target: string; config: DesignConfig; products: string[]; known?: string[] };

const typecheckOpenSketches = (options: { target: string; product: ResolvedProduct }): Problem[] =>
  listSketches({ productDir: options.product.dir, product: options.product.name }).flatMap((sketch) =>
    typeof sketch === 'string'
      ? []
      : sketch.variants.flatMap((variant): Problem[] => {
          const result = typecheckVariant({ ...options, sketch, variant });

          return result.kind === 'ok'
            ? []
            : [
                {
                  rule: 'TYPE-ERROR',
                  file: variantDirOf(sketch, variant),
                  message: `\n${result.kind === 'failed' ? result.output : result.message}`,
                },
              ];
        }),
  );

const warnChangedOutsideSketch = (product: ResolvedProduct) => {
  for (const part of changedOutsideSketchOf(product))
    console.warn(
      `WARNING ${product.name} ${part} changed outside a sketch - every change to a merged part goes through a sketch, with one variant when there is no choice`,
    );
};

const reportSystem = (options: CheckOptions & { warn?: boolean }) => {
  const { target, config, products } = options;
  const declared = config.products ?? {};
  let failed = false;
  const report = (problem: Problem) => {
    const line = lineOf(target, problem);

    if (options.known?.includes(line)) {
      console.warn(`NOTE (was there before) ${line}`);

      return;
    }

    console.error(line);
    failed = true;
  };

  for (const name of products) {
    const entry = declared[name];

    if (!entry) {
      console.error(`NO PRODUCT "${name}" - config.json declares ${Object.keys(declared).join(', ') || 'none'}.`);

      return 1;
    }

    const product = resolveProduct({ target, name, config: entry });

    if (options.warn) warnChangedOutsideSketch(product);

    goneSketchCommentWarningsOf(product).forEach((warning) => console.warn(warning));
    unusedSharedExportsOf(product).forEach((problem) => console.warn(`WARNING ${lineOf(target, problem)}`));
    staleReplacesOf(product).forEach((problem) => console.warn(`WARNING ${lineOf(target, problem)}`));
    tokenSelectorsOf(product).forEach((problem) => console.warn(`WARNING ${lineOf(target, problem)}`));

    ruleProblemsOf(product).forEach(report);

    writeEditorTsconfig({ target, product });

    const result = typecheckProduct({ target, product });

    if (result.kind === 'unavailable') {
      console.error(result.message);

      return 1;
    }

    if (result.kind === 'failed') report({ rule: 'TYPE-ERROR', file: product.dir, message: `\n${result.output}` });

    if (options.warn) typecheckOpenSketches({ target, product }).forEach(report);
  }

  return failed ? 1 : 0;
};

/**
 * Checks the design system of each named product: the rules, then `tsc --noEmit` over its
 * generated tsconfig. Prints one line per problem and `ok` when there is none.
 */
export const checkSystem = (options: CheckOptions) => {
  const code = reportSystem(options);

  if (code === 0) console.log('ok');

  return code;
};

/**
 * Checks as `checkSystem` does, then draws every state in a headless browser and prints one line per
 * render rule a drawing breaks, and warns of each merged part that changed outside a sketch. Without a browser it prints one skip line and passes on the other checks.
 */
export const checkSystemRendered = async (options: CheckOptions) => {
  const code = reportSystem({ ...options, warn: true });

  if (code !== 0) return code;

  const rendered = await renderIssuesOf({
    ...options,
    jobs: options.products.map((product) => ({ product, sketch: null, parts: null })),
  });

  if ('unavailable' in rendered) console.log(`RENDER CHECK SKIPPED - ${rendered.unavailable}`);
  else {
    rendered.warnings.forEach((issue) => console.warn(`WARNING ${renderIssueLineOf(issue)}`));
    rendered.issues.forEach((issue) => console.error(renderIssueLineOf(issue)));
  }

  if ('issues' in rendered && rendered.issues.length > 0) return 1;

  console.log('ok');

  return 0;
};
