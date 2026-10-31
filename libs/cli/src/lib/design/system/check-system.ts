import { relative } from 'path';
import { DesignConfig } from '../paths';
import { ProductSource } from './base';
import { importProblemsOf } from './imports';
import { isMissingStateGap, partsCompletenessOf } from './complete';
import { OpenPointsInput, openPointsText } from './open-points';
import { Problem } from './problem';
import { readOpenPoints } from './read-open-points';
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

type Blocking = { rule: string; base: string | null };

const reportSystem = (options: CheckOptions & { warn?: boolean; blocking?: Blocking[] }) => {
  const { target, config, products } = options;
  const declared = config.products ?? {};
  let failed = false;
  let base: ProductSource | null = null;
  const report = (problem: Problem) => {
    const line = lineOf(target, problem);

    if (options.known?.includes(line)) {
      console.warn(`NOTE (was there before) ${line}`);

      return;
    }

    console.error(line);
    failed = true;
    options.blocking?.push({
      rule: problem.rule,
      base: base && !relative(base.dir, problem.file).startsWith('..') ? base.name : null,
    });
  };

  for (const name of products) {
    const entry = declared[name];

    if (!entry) {
      console.error(`NO PRODUCT "${name}" - config.json declares ${Object.keys(declared).join(', ') || 'none'}.`);

      return 1;
    }

    const product = resolveProduct({ target, name, config: entry });

    base = product.base;

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

const contrastsOf = (issues: RenderIssue[]): NonNullable<OpenPointsInput['contrasts']> => {
  const seen = new Set<string>();

  return issues.flatMap(({ rule, part, state, path }) => {
    const key = `${part} ${state} ${path}`;

    if (rule !== 'CONTRAST' || seen.has(key)) return [];

    seen.add(key);

    return [{ part, state, path }];
  });
};

const missingStatesOf = async (
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

  return [...checked.gaps].flatMap(([part, gaps]) =>
    typeof gaps === 'string'
      ? []
      : [...new Set(gaps.filter(isMissingStateGap).map((gap) => gap.target.slice(part.length + 1)))].map((control) => ({
          part,
          control,
        })),
  );
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
            missingStates: options.complete ? await missingStatesOf({ ...options, product }) : undefined,
          };

    openPointsText(name, readOpenPoints(product, findings)).forEach((line) => console.log(line));
  }
};

const countsOf = (values: string[]) =>
  [...new Set(values)].map((value) => `${value} ${values.filter((other) => other === value).length}`).join(', ');

const blockedRenderLineOf = (blocking: Blocking[]) => {
  const inBase = blocking.flatMap((problem) => (problem.base ? [problem.base] : []));
  const where = inBase.length > 0 ? `, ${inBase.length} of them in base ${[...new Set(inBase)].join(', ')}` : '';

  return `RENDER CHECK NOT RUN - ${blocking.length} problem${blocking.length === 1 ? '' : 's'} above stop it (${countsOf(blocking.map((problem) => problem.rule))}${where}); the open points list no contrasts or missing states until they are fixed`;
};

const renderSystem = async (options: CheckOptions): Promise<{ code: number; rendered: RenderIssue[] | null }> => {
  const blocking: Blocking[] = [];
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

  rendered.warnings.forEach((issue) => console.warn(`WARNING ${renderIssueLineOf(issue)}`));
  rendered.issues.forEach((issue) => console.error(renderIssueLineOf(issue)));

  return { code: rendered.issues.length > 0 ? 1 : 0, rendered: rendered.issues };
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
