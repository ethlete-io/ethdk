import { relative } from 'path';
import { DesignConfig } from '../paths';
import { typecheck } from '../typecheck';
import { importProblemsOf } from './imports';
import { Problem } from './problem';
import { resolveProduct, ResolvedProduct } from './resolve-product';
import { componentCopiesOf } from './rules/component-copy';
import { hardCodedColoursOf } from './rules/hard-coded-colour';
import { unknownInteractionsOf } from './rules/interactions';
import { scriptedMotionOf } from './rules/motion';
import { staleCommentsOf, staleNotesOf } from './rules/stale-comment';
import { upwardDependenciesOf } from './rules/upward-dependency';
import { badWidthsOf } from './rules/widths';
import { writeSystemTsconfig } from './system-tsconfig';

const RULES = [
  importProblemsOf,
  upwardDependenciesOf,
  hardCodedColoursOf,
  componentCopiesOf,
  scriptedMotionOf,
  staleCommentsOf,
  staleNotesOf,
  badWidthsOf,
  unknownInteractionsOf,
];

/** Every problem the rules find in a resolved product, its resolution problems first. */
export const ruleProblemsOf = (product: ResolvedProduct): Problem[] => [
  ...product.problems,
  ...RULES.flatMap((rule) => rule(product)),
];

const lineOf = (target: string, problem: Problem) =>
  `${problem.rule} ${relative(target, problem.file)}: ${problem.message}`;

/**
 * Checks the design system of each named product: the rules, then `tsc --noEmit` over its
 * generated tsconfig. Prints one line per problem and `ok` when there is none.
 */
export const checkSystem = (options: { target: string; config: DesignConfig; products: string[] }) => {
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

    ruleProblemsOf(product).forEach(report);

    const result = typecheck({ target, tsconfig: writeSystemTsconfig({ target, product }) });

    if (result.kind === 'unavailable') {
      console.error(result.message);

      return 1;
    }

    if (result.kind === 'failed') report({ rule: 'TYPE-ERROR', file: product.dir, message: `\n${result.output}` });
  }

  if (failed) return 1;

  console.log('ok');

  return 0;
};
