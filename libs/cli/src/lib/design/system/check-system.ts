import { relative } from 'path';
import { DesignConfig } from '../paths';
import { importProblemsOf } from './imports';
import { Problem } from './problem';
import { resolveProduct, ResolvedProduct } from './resolve-product';
import { componentCopiesOf } from './rules/component-copy';
import { renderIssueLineOf, renderIssuesOf } from './render-check';
import { flowProblemsOf } from './rules/flow';
import { hardCodedColoursOf } from './rules/hard-coded-colour';
import { unknownInteractionsOf } from './rules/interactions';
import { kitOutsidePagesOf } from './rules/kit-outside-pages';
import { scriptedMotionOf } from './rules/motion';
import { goneSketchCommentWarningsOf, staleCommentsOf, staleNotesOf } from './rules/stale-comment';
import { undefinedTokensOf } from './rules/undefined-token';
import { upwardDependenciesOf } from './rules/upward-dependency';
import { badSvgAssetsOf } from './rules/svg-asset';
import { badWidthsOf } from './rules/widths';
import { changedOutsideSketchOf } from './sketch/merged-parts';
import { typecheckProduct, writeEditorTsconfig } from './system-tsconfig';

const RULES = [
  importProblemsOf,
  upwardDependenciesOf,
  hardCodedColoursOf,
  undefinedTokensOf,
  componentCopiesOf,
  scriptedMotionOf,
  staleCommentsOf,
  staleNotesOf,
  badWidthsOf,
  unknownInteractionsOf,
  kitOutsidePagesOf,
  flowProblemsOf,
  badSvgAssetsOf,
];

/** Every problem the rules find in a resolved product, its resolution problems first. */
export const ruleProblemsOf = (product: ResolvedProduct): Problem[] => [
  ...product.problems,
  ...RULES.flatMap((rule) => rule(product)),
];

const lineOf = (target: string, problem: Problem) =>
  `${problem.rule} ${relative(target, problem.file)}: ${problem.message}`;

type CheckOptions = { target: string; config: DesignConfig; products: string[] };

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
    console.error(lineOf(target, problem));
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

    ruleProblemsOf(product).forEach(report);

    writeEditorTsconfig({ target, product });

    const result = typecheckProduct({ target, product });

    if (result.kind === 'unavailable') {
      console.error(result.message);

      return 1;
    }

    if (result.kind === 'failed') report({ rule: 'TYPE-ERROR', file: product.dir, message: `\n${result.output}` });
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
  else rendered.issues.forEach((issue) => console.error(renderIssueLineOf(issue)));

  if ('issues' in rendered && rendered.issues.length > 0) return 1;

  console.log('ok');

  return 0;
};
