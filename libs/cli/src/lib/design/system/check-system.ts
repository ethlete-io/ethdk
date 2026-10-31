import { dirname, relative } from 'path';
import { DesignConfig } from '../paths';
import { importProblemsOf } from './imports';
import { partsCompletenessOf } from './complete';
import { OpenPointsInput, openPointsText } from './open-points';
import { Problem } from './problem';
import { contrastsOf, missingStatesOf, readOpenPoints } from './read-open-points';
import { partKeyOf, resolveProduct, ResolvedProduct } from './resolve-product';
import { canonicalClassesOf } from './rules/canonical-class';
import { componentCopiesOf } from './rules/component-copy';
import { RenderIssue, renderIssueLineOf, renderIssuesOf } from './render-check';
import { flowProblemsOf } from './rules/flow';
import { badLinksOf } from './rules/implements';
import { hardCodedColoursOf } from './rules/hard-coded-colour';
import { unknownInteractionsOf } from './rules/interactions';
import { kitOutsidePagesOf } from './rules/kit-outside-pages';
import { inlineSvgsOf } from './rules/inline-svg';
import { badMotionsOf, badUnreachableOf, hardCodedMotionOf, scriptedMotionOf } from './rules/motion';
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
  badUnreachableOf,
  hardCodedMotionOf,
  staleCommentsOf,
  staleNotesOf,
  badWidthsOf,
  badLinksOf,
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

type CheckOptions = { target: string; config: DesignConfig; products: string[]; known?: string[]; complete?: boolean };

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

const isInBasePart = (product: ResolvedProduct, file: string) =>
  product.parts.some((part) => part.origin === 'base' && !relative(dirname(part.file), file).startsWith('..'));

const isBasePartKey = (product: ResolvedProduct, key: string) =>
  product.parts.find((part) => partKeyOf(part) === key)?.origin === 'base';

const ownerPartOf = (issue: RenderIssue) =>
  [...issue.path.matchAll(/\[data-et-part=([^\]]+)\]/gu)].pop()?.[1] ?? issue.part;

const printBaseFindings = (product: ResolvedProduct, rules: string[]) => {
  if (rules.length === 0 || !product.base) return;

  const counts = new Map<string, number>();

  for (const rule of rules) counts.set(rule, (counts.get(rule) ?? 0) + 1);

  const perRule = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([rule, n]) => `${rule} ${n}`);

  console.log(
    `${rules.length} finding${rules.length === 1 ? '' : 's'} in base product ${product.base.name} (${perRule.join(', ')}) - they do not block this product; run et design check --product ${product.base.name} for the base's own`,
  );
};

const reportSystem = (options: CheckOptions & { warn?: boolean; blocking?: string[] }) => {
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
    options.blocking?.push(problem.rule);
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
    const isOwn = (problem: Problem) => !isInBasePart(product, problem.file);
    const warnings = [...unusedSharedExportsOf(product), ...staleReplacesOf(product), ...tokenSelectorsOf(product)];
    const problems = ruleProblemsOf(product);

    warnings.filter(isOwn).forEach((problem) => console.warn(`WARNING ${lineOf(target, problem)}`));
    problems.filter(isOwn).forEach(report);
    printBaseFindings(
      product,
      problems.filter((problem) => !isOwn(problem)).map((problem) => problem.rule),
    );

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
 * generated tsconfig. Prints one line per problem and `ok` when there is none. The problems of a part the
 * product takes from its base are counted in one line and do not fail it.
 */
export const checkSystem = (options: CheckOptions) => {
  const code = reportSystem(options);

  if (code === 0) console.log('ok');

  return code;
};

const drawnMissingStatesOf = async (
  options: CheckOptions & { product: ResolvedProduct },
): Promise<NonNullable<OpenPointsInput['missingStates']>> => {
  const parts = options.product.parts
    .filter((part) => part.layer !== 'pages' && part.layer !== 'foundations')
    .map(partKeyOf);
  const checked = await partsCompletenessOf({ ...options, parts });

  if ('unavailable' in checked) {
    console.log(`COMPLETE CHECK SKIPPED - ${checked.unavailable}`);

    return [];
  }

  for (const hint of [...checked.hints.values()].flat()) console.log(hint);

  return missingStatesOf(checked.gaps);
};

const printOpenPoints = async (options: CheckOptions & { rendered: RenderIssue[] | null }) => {
  const { target, config, products, rendered } = options;

  for (const name of products) {
    const entry = config.products?.[name];

    if (!entry) continue;

    const product = resolveProduct({ target, name, config: entry });
    const findings =
      rendered === null
        ? {}
        : {
            contrasts: contrastsOf(rendered.filter((issue) => issue.product === name && issue.sketch === null)),
            missingStates: options.complete ? await drawnMissingStatesOf({ ...options, product }) : undefined,
          };

    openPointsText(name, readOpenPoints(product, findings)).forEach((line) => console.log(line));
  }
};

const countsOf = (values: string[]) =>
  [...new Set(values)].map((value) => `${value} ${values.filter((other) => other === value).length}`).join(', ');

const blockedRenderLineOf = (blocking: string[]) =>
  `RENDER CHECK NOT RUN - ${blocking.length} problem${blocking.length === 1 ? '' : 's'} above stop it (${countsOf(blocking)}); the open points list no contrasts or missing states until they are fixed`;

const renderSystem = async (options: CheckOptions): Promise<{ code: number; rendered: RenderIssue[] | null }> => {
  const blocking: string[] = [];
  const code = reportSystem({ ...options, warn: true, blocking });

  if (code !== 0) {
    if (blocking.length > 0) console.error(blockedRenderLineOf(blocking));

    return { code, rendered: null };
  }

  const rendered = await renderIssuesOf({
    ...options,
    jobs: options.products.map((product) => ({ product, sketch: null, parts: null })),
  });

  if ('unavailable' in rendered) {
    console.log(`RENDER CHECK SKIPPED - ${rendered.unavailable}`);

    return { code: 0, rendered: null };
  }

  const resolved = options.products.flatMap((name) => {
    const entry = options.config.products?.[name];

    return entry ? [resolveProduct({ target: options.target, name, config: entry })] : [];
  });
  const isInBase = (issue: RenderIssue) =>
    resolved.some((product) => product.name === issue.product && isBasePartKey(product, ownerPartOf(issue)));
  const issues = rendered.issues.filter((issue) => !isInBase(issue));

  rendered.warnings
    .filter((issue) => !isInBase(issue))
    .forEach((issue) => console.warn(`WARNING ${renderIssueLineOf(issue)}`));
  issues.forEach((issue) => console.error(renderIssueLineOf(issue)));

  for (const product of resolved)
    printBaseFindings(
      product,
      rendered.issues.filter((issue) => issue.product === product.name && isInBase(issue)).map((issue) => issue.rule),
    );

  return { code: issues.length > 0 ? 1 : 0, rendered: issues };
};

/**
 * Checks as `checkSystem` does, then draws every state in a headless browser and prints one line per
 * render rule a drawing breaks, and warns of each merged part that changed outside a sketch. Without a browser it prints one skip line and passes on the other checks.
 * It then lists the open points of each product's parts, with the contrasts the drawing found and, with `complete`,
 * the missing states of each component part as `design complete` draws them; they do not change the exit code.
 */
export const checkSystemRendered = async (options: CheckOptions) => {
  const { code, rendered } = await renderSystem(options);

  await printOpenPoints({ ...options, rendered });

  if (code === 0) console.log('ok');

  return code;
};
