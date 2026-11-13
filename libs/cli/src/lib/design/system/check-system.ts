import { dirname, relative, resolve, sep } from 'path';
import { baseIssuesFileOf, oldRenderIssuesOf } from './base-issues';
import { designHashOf } from './design-hash';
import { repoRootOf } from './reachable-files';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../design-config';
import { autoAcceptOf, DrawStates } from './accepted-pictures';
import { importProblemsOf } from './imports';
import { CompletenessGap, partsCompletenessOf } from './complete';
import { actionsRerunLineOf } from './embedded-actions';
import { actionLostProblemsOf, declaredPartActionsOf } from './action-lost';
import { refreshHarnessMap } from './harness-map';
import { runningCliStaleWarning } from '../stale-cli-dist';
import { capabilityPlaceOf } from './rules/capability-place';
import { bespokeControlProblemsOf } from './bespoke-controls';
import { droppedPropProblemsOf } from './dropped-props';
import { DrawnFindings, drawnFindingsFrom, isPartUndrawn, isStateUndrawn, statefulPartsOf } from './drawn-open-points';
import { openPointsText, PartOpenPoints } from './open-points';
import { doneParts, gitDiffFilesOf } from './part-task';
import { actionsRerunOf, readyPartsOf } from './part-ready';
import { BuildReadyInputs } from './part-build-ready';
import { recordCheckedBuildReady, slowWaitingLineOf } from './check-record';
import { partActionFailuresOf } from './actions-command';
import { renderProblemOf, ruleBaselineLinesOf, ruleBaselineOf } from './rule-baseline';
import { isDrawRule, isSlowRule, unjudgedStateWarningsOf } from './slow-checks';
import {
  staleLineOf,
  stalePartsOf,
  UNCOMPARED_RULE,
  uncomparedAppProblemsOf,
  upgradeLegacyMarksOf,
} from './stale-parts';
import { Problem } from './problem';
import { collectingSkips, isCiEnv, isFailingSkip, RuleSkip, skipLineOf } from './rule-skips';
import { staleDistWarningsOf } from './stale-dist';
import { instantLinesOf, partPointsOf, readOpenPoints, unlinkedPartsOf } from './read-open-points';
import { partKeyOf, partOfFile, PRODUCT_PART_KEY, resolveProduct, ResolvedProduct } from './resolve-product';
import { canonicalClassesOf } from './rules/canonical-class';
import { componentCopiesOf } from './rules/component-copy';
import { deniedClassesOf } from './rules/denied-class';
import { nativeTitlesOf } from './rules/native-title';
import { commandTextOf } from './rules/command-text';
import {
  BASELINED_RENDER_RULES,
  BusyState,
  ownerPartOf,
  RenderIssue,
  renderIssueLineOf,
  renderIssuesOf,
} from './render-check';
import { flowProblemsOf } from './rules/flow';
import { badLinksOf } from './rules/implements';
import { statesNotInComponentOf } from './rules/state-in-component';
import { partRewritesOf } from './rules/part-rewrite';
import { hardCodedColoursOf } from './rules/hard-coded-colour';
import { unknownInteractionsOf } from './rules/interactions';
import { kitOutsidePagesOf } from './rules/kit-outside-pages';
import { inlineUiInPageProblemsOf, inlineUiInPageWarningsOf } from './rules/inline-ui-in-page';
import { inlineSvgsOf } from './rules/inline-svg';
import { topLevelAwaitsOf } from './rules/top-level-await';
import { badSkipsOf } from './rules/skips';
import { badMotionsOf, badUnreachableOf, hardCodedMotionOf, scriptedMotionOf } from './rules/motion';
import { goneSketchCommentWarningsOf, staleCommentsOf, staleNotesOf } from './rules/stale-comment';
import { gluedInterpolationsOf } from './rules/glued-interpolation';
import { undefinedClassesOf } from './rules/undefined-class';
import { undefinedTokensOf } from './rules/undefined-token';
import { tokenSelectorsOf } from './rules/token-selectors';
import { sdkAttributeValuesOf } from './rules/sdk-attribute-value';
import { sdkPrivateVarsOf } from './rules/sdk-private-var';
import { upwardDependenciesOf } from './rules/upward-dependency';
import { badSvgAssetsOf } from './rules/svg-asset';
import { staleReplacesOf } from './rules/stale-replace';
import { CHECK_RULES } from './check-rules';
import { unusedSharedExportsOf } from './rules/unused-shared-export';
import { utilityCssOf } from './rules/utility-css';
import { orphanEndpointProblemsOf, orphanEndpointWarningsOf } from './rules/orphan-endpoint';
import { sampleDefaultProblemsOf, sampleDefaultWarningsOf } from './rules/sample-default';
import { unboundInputProblemsOf, unboundInputWarningsOf } from './rules/unbound-input';
import { pendingStateWarningsOf } from './rules/pending-state';
import { uncoveredViewsOf, uncoveredViewsText } from './rules/view-coverage';
import { designCoverageOf } from './rules/design-coverage';
import { badWidthsOf } from './rules/widths';
import { typecheckVariant } from './sketch/check-sketches';
import { changedOutsideSketchOf } from './sketch/merged-parts';
import { withStampsInMemory } from './stamp-files';
import { staleSketchBasesOf } from './sketch/stale-base';
import { listSketches, variantDirOf } from './sketch/sketch';
import { typecheckProduct, writeEditorTsconfig } from './system-tsconfig';
import { repoInvocation } from '../../invocation';
import { leftoverGateFilesWarningOf } from './leftover-gate-files';
import { uncommittedDecisionsWarningOf } from './uncommitted-decisions';
import { timedPhase } from '../phase-timing';
import { createRunDraw, WarmDraw } from '../warm-draw';

const RULES = [
  importProblemsOf,
  upwardDependenciesOf,
  hardCodedColoursOf,
  undefinedTokensOf,
  componentCopiesOf,
  scriptedMotionOf,
  badMotionsOf,
  badUnreachableOf,
  badSkipsOf,
  hardCodedMotionOf,
  staleCommentsOf,
  staleNotesOf,
  badWidthsOf,
  badLinksOf,
  statesNotInComponentOf,
  partRewritesOf,
  unknownInteractionsOf,
  kitOutsidePagesOf,
  inlineUiInPageProblemsOf,
  flowProblemsOf,
  badSvgAssetsOf,
  inlineSvgsOf,
  topLevelAwaitsOf,
  canonicalClassesOf,
  undefinedClassesOf,
  deniedClassesOf,
  nativeTitlesOf,
  commandTextOf,
  utilityCssOf,
  orphanEndpointProblemsOf,
  sampleDefaultProblemsOf,
  unboundInputProblemsOf,
  gluedInterpolationsOf,
  sdkAttributeValuesOf,
  sdkPrivateVarsOf,
];

export const warningProblemsOf = (product: ResolvedProduct): Problem[] => [
  ...unusedSharedExportsOf(product),
  ...staleReplacesOf(product),
  ...tokenSelectorsOf(product),
  ...orphanEndpointWarningsOf(product),
  ...sampleDefaultWarningsOf(product),
  ...unboundInputWarningsOf(product),
  ...inlineUiInPageWarningsOf(product),
  ...pendingStateWarningsOf(product),
];

export const ruleLinesOf = (target: string, product: ResolvedProduct) =>
  ruleProblemsOf(product).map((problem) => lineOf(target, problem));

/**
 * Runs only the static rules of `products` - no draw, no tsc - and prints each problem a product's own files hold
 * that its rule baseline does not list, and each baselined hit; exits 1 on a problem. With `base`, it also flags each app file changed since `base` that moved since its part's implemented record.
 * Prints one line per rule that did not run; under `CI` a rule skipped for a missing input, such as no `base`, fails.
 */
export const checkRules = (options: {
  target: string;
  config: DesignConfig;
  products: string[];
  base?: string;
  invocation?: string;
}) => {
  const { target, config, base } = options;
  const changed = base === undefined ? [] : gitDiffFilesOf({ root: target, range: base });
  const invocation = options.invocation ?? repoInvocation({ root: target, subcommand: 'design' });
  const ci = isCiEnv();
  let failed = 0;
  const failing: string[] = [];

  for (const name of options.products) {
    const entry = config.products?.[name];

    if (!entry) {
      console.error(`NO PRODUCT "${name}" in config.json.`);
      failed++;
      failing.push(name);
      continue;
    }

    const product = resolveProduct({ target, name, config: entry });
    const isStatic = (rule: string) =>
      !isSlowRule(rule) && !BASELINED_RENDER_RULES.has(rule) && rule !== UNCOMPARED_RULE;
    const { result: own, skips } = collectingSkips(() =>
      ruleProblemsOf(product).filter((problem) => !isInBasePart(product, problem.file)),
    );
    const baselined = ruleBaselineOf({ product, problems: own, checked: isStatic });
    const problems = [
      ...baselined.problems.filter((problem) => !isInBasePart(product, problem.file)),
      ...uncomparedOf({ product, changed, invocation }),
    ];
    const allSkips: RuleSkip[] = [
      ...skips,
      ...(base === undefined
        ? [{ rule: UNCOMPARED_RULE, product: name, kind: 'missing-input' as const, reason: 'no --base given' }]
        : []),
    ];
    const failingSkips = allSkips.filter((skip) => isFailingSkip(skip, ci));

    [...baselined.lines, ...ruleBaselineLinesOf(product, (rule) => !isStatic(rule))].forEach((line) =>
      console.log(line),
    );
    allSkips.filter((skip) => !isFailingSkip(skip, ci)).forEach((skip) => console.log(skipLineOf(skip, ci)));
    problems.forEach((problem) => console.error(lineOf(target, problem)));
    failingSkips.forEach((skip) => console.error(skipLineOf(skip, ci)));
    failed += problems.length + failingSkips.length;

    if (problems.length + failingSkips.length > 0) failing.push(name);
  }

  console.log(
    failed === 0 ? 'No static design rule finds a problem.' : `${failed} problem(s) in ${failing.join(', ')}.`,
  );

  return failed === 0 ? 0 : 1;
};

const uncomparedOf = (options: {
  product: ResolvedProduct;
  changed: string[];
  invocation: string;
  onlyChanged?: boolean;
}) =>
  (options.changed.length > 0 ? uncomparedAppProblemsOf(options) : []).filter(
    (problem) => !isInBasePart(options.product, problem.file),
  );

/**
 * The IMPLEMENTATION-UNCOMPARED lines `check --rules --base` prints for `products`, limited to the files in `changed`,
 * without the other rules, and the uncompared parts they name.
 */
export const uncomparedLinesOf = (options: {
  target: string;
  config: DesignConfig;
  products: string[];
  changed: string[];
  invocation?: string;
}) => {
  const { target, config, changed } = options;
  const invocation = options.invocation ?? repoInvocation({ root: target, subcommand: 'design' });
  const files = new Set(changed.map((file) => resolve(target, file)));

  return options.products.flatMap((name) => {
    const entry = config.products?.[name];

    if (!entry) return [];

    const product = resolveProduct({ target, name, config: entry });
    const problems = uncomparedOf({ product, changed, invocation, onlyChanged: true }).filter((problem) =>
      files.has(resolve(target, problem.file)),
    );
    const parts = [...new Set(problems.flatMap((problem) => (problem.part ? [problem.part] : [])))].sort();

    return problems.length > 0
      ? [{ product: name, lines: problems.map((problem) => lineOf(target, problem)), parts }]
      : [];
  });
};

/** Every problem the rules find in a resolved product, its resolution problems first. */
export const ruleProblemsOf = (product: ResolvedProduct): Problem[] => [
  ...product.problems,
  ...RULES.flatMap((rule) => rule(product)),
];

/**
 * Build-ready inputs from the open points of `points`, read without a draw by default, and the static rule `problems`
 * of the product, run by default.
 */
export const buildReadyInputsOf = (
  product: ResolvedProduct,
  {
    points = readOpenPoints(product),
    problems = ruleProblemsOf(product),
  }: { points?: PartOpenPoints[]; problems?: Problem[] } = {},
): BuildReadyInputs => {
  return {
    pointsOf: (part) => partPointsOf(points, part),
    problemsOf: (part) => problems.filter((problem) => partOfFile(product, problem.file) === part),
  };
};

const withTalliedProblems = (
  inputs: BuildReadyInputs,
  tally: Map<string, PartTally> | undefined,
): BuildReadyInputs => ({
  ...inputs,
  problemsOf: (part) => {
    const own = inputs.problemsOf(part);
    const ruled = new Set(own.map((problem) => problem.rule));
    const tallied = [...new Set(tally?.get(part)?.problems ?? [])].filter((rule) => !ruled.has(rule));

    return [...own, ...tallied.map((rule) => ({ rule, file: '', message: 'found by design check' }))];
  },
});

const lineOf = (target: string, problem: Problem) =>
  `${problem.rule} ${relative(target, problem.file)}: ${problem.message}`;

/** What `design check` found per part of each product: the rules of its problems, its warnings and open points. */
type PartTally = { problems: string[]; warnings: number; open: number };

type Tally = Map<string, Map<string, PartTally>>;

type CheckOptions = {
  target: string;
  config: DesignConfig;
  products: string[];
  known?: string[];
  /** Only this part's findings, `<layer>/<name>`. */
  part?: string;
  tally?: Tally;
  drawPictures?: DrawStates;
  /** How the repo runs `et design`; defaults to the one its package.json implies. */
  invocation?: string;
  chromiumOf?: typeof chromiumOf;
  warm?: WarmDraw;
};

const PRODUCT_LEVEL = PRODUCT_PART_KEY;

const APP_CODE = 'app code:';

/** The tally key of `file`: its part, `(product)` for a design file outside every part, or `app code:<file>` for app code. */
const tallyKeyOf = (target: string, { product, file }: { product: ResolvedProduct; file: string }) => {
  const part = partOfFile(product, file);
  const inDesign = [product.dir, product.base?.dir].some((dir) => dir && !relative(dir, file).startsWith('..'));

  return part !== PRODUCT_LEVEL || inDesign ? part : `${APP_CODE}${relative(target, file) || '.'}`;
};

const tallyOf = (tally: Tally | undefined, at: { product: string; part: string }) => {
  const { product, part } = at;

  if (!tally) return null;

  const parts = tally.get(product) ?? new Map<string, PartTally>();
  const entry = parts.get(part) ?? { problems: [], warnings: 0, open: 0 };

  tally.set(product, parts);
  parts.set(part, entry);

  return entry;
};

const countText = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * One line per part with findings, then one line with the count of clean parts; with `only`, one line for that part
 * even when it is clean.
 */
export const summaryText = (options: {
  product: string;
  parts: string[];
  tally: Tally;
  only?: string;
  done?: number;
}): string[] => {
  const found = options.tally.get(options.product) ?? new Map<string, PartTally>();
  const keys = options.only ? [options.only] : [...new Set([...options.parts, ...found.keys()])];
  const lineOf = (key: string) => {
    const entry = found.get(key);
    const rules = [...new Set(entry?.problems ?? [])].join(', ');
    const items = [
      ...(entry?.problems.length ? [`${countText(entry.problems.length, 'problem')} (${rules})`] : []),
      ...(entry?.warnings ? [countText(entry.warnings, 'warning')] : []),
      ...(entry?.open ? [countText(entry.open, 'open point')] : []),
    ];

    if (items.length === 0) return null;

    return key.startsWith(APP_CODE)
      ? `APP CODE ${options.product} ${key.slice(APP_CODE.length)}: ${items.join(', ')}`
      : `PART ${options.product} ${key}: ${items.join(', ')}`;
  };
  const lines = keys.map((key) => ({ key, line: lineOf(key) }));

  if (options.only) return [lines[0]?.line ?? `PART ${options.product} ${options.only}: clean`];

  const clean = lines.filter(
    ({ key, line }) => line === null && key !== PRODUCT_LEVEL && !key.startsWith(APP_CODE),
  ).length;

  return [
    ...lines.flatMap(({ line }) => (line ? [line] : [])),
    `PARTS ${options.product}: ${clean} of ${options.parts.length} clean`,
    ...(options.done === undefined ? [] : [`DONE ${options.product}: ${options.done} of ${options.parts.length}`]),
  ];
};

/** One line per rule with how many problems this run found, zeros included, rules outside `CHECK_RULES` after them. */
export const ruleSummaryText = (tally: Tally): string[] => {
  const counts = new Map<string, number>(CHECK_RULES.map((rule) => [rule, 0]));

  for (const parts of tally.values())
    for (const { problems } of parts.values())
      for (const rule of problems) counts.set(rule, (counts.get(rule) ?? 0) + 1);

  return [...counts].map(([rule, n]) => `${rule} ${n}`);
};

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

const reportSystem = (options: CheckOptions & { warn?: boolean }): { code: number; fatal: boolean } => {
  const { target, config, products } = options;
  const declared = config.products ?? {};
  let failed = false;
  const report = (problem: Problem & { line?: string }, product: ResolvedProduct) => {
    const line = problem.line ?? lineOf(target, problem);
    if (options.known?.includes(line)) {
      console.warn(`NOTE (was there before) ${line}`);

      return;
    }

    console.error(line);
    failed = true;
    tallyOf(options.tally, {
      product: product.name,
      part: tallyKeyOf(target, { product, file: problem.file }),
    })?.problems.push(problem.rule);
  };

  for (const name of products) {
    const entry = declared[name];

    if (!entry) {
      console.error(`NO PRODUCT "${name}" - config.json declares ${Object.keys(declared).join(', ') || 'none'}.`);

      return { code: 1, fatal: true };
    }

    const product = resolveProduct({ target, name, config: entry });

    if (options.part && !product.parts.some((part) => partKeyOf(part) === options.part)) {
      console.error(`NO PART "${options.part}" in product ${name}.`);

      return { code: 1, fatal: true };
    }

    if (options.warn && !options.part) warnChangedOutsideSketch(product);

    const uncommitted = options.warn ? uncommittedDecisionsWarningOf(product) : null;

    if (uncommitted) console.warn(uncommitted);

    const leftover = options.warn ? leftoverGateFilesWarningOf(product) : null;

    if (leftover) console.warn(leftover);

    if (!options.part) goneSketchCommentWarningsOf(product).forEach((warning) => console.warn(warning));
    const isWanted = (problem: Problem) => !options.part || partOfFile(product, problem.file) === options.part;
    const isOwn = (problem: Problem) => !isInBasePart(product, problem.file) && isWanted(problem);
    const warnings = warningProblemsOf(product);
    const problems = ruleProblemsOf(product);

    warnings.filter(isOwn).forEach((problem) => {
      console.warn(`WARNING ${lineOf(target, problem)}`);
      const counted = tallyOf(options.tally, {
        product: name,
        part: tallyKeyOf(target, { product, file: problem.file }),
      });

      if (counted) counted.warnings += 1;
    });
    problems.filter(isOwn).forEach((problem) => report(problem, product));
    if (!options.part)
      printBaseFindings(
        product,
        problems.filter((problem) => !isOwn(problem)).map((problem) => problem.rule),
      );

    writeEditorTsconfig({ target, product });

    const result = typecheckProduct({ target, product });

    if (result.kind === 'unavailable') {
      console.error(result.message);

      return { code: 1, fatal: true };
    }

    if (result.kind === 'failed')
      report({ rule: 'TYPE-ERROR', file: product.dir, message: `\n${result.output}` }, product);

    if (options.warn && !options.part)
      typecheckOpenSketches({ target, product }).forEach((problem) => report(problem, product));

    if (options.warn && !options.part)
      staleSketchBasesOf({
        product,
        invocation: options.invocation ?? repoInvocation({ root: target, subcommand: 'design' }),
      }).forEach((problem) => report(problem, product));
  }

  return { code: failed ? 1 : 0, fatal: false };
};

/**
 * Checks the design system of each named product: the rules, then `tsc --noEmit` over its
 * generated tsconfig. Prints one line per problem and `ok` when there is none. The problems of a part the
 * product takes from its base are counted in one line and do not fail it.
 */
export const checkSystem = (options: CheckOptions) => {
  const { code } = reportSystem(options);

  if (code === 0) console.log('ok');

  return code;
};

const cannotDrawLine = (options: { product: string; line: string }) =>
  `CANNOT DRAW ${options.product} ${options.line} - et design ready refuses the part until it draws`;

const countCannotDraw = (options: CheckOptions & { product: ResolvedProduct; why: string }) => {
  for (const part of statefulPartsOf(options.product, options.part ? [options.part] : null)) {
    console.log(cannotDrawLine({ product: options.product.name, line: `${part}: ${options.why}` }));

    const counted = tallyOf(options.tally, { product: options.product.name, part });

    if (counted) counted.open += 1;
  }
};

const drawnFindingsFor = async (
  options: CheckOptions & { product: ResolvedProduct; rendered: RenderIssue[]; busy?: BusyState[] },
): Promise<DrawnFindings> => {
  const { product, rendered, busy } = options;
  const stateful = statefulPartsOf(product, options.part ? [options.part] : null);
  let gaps: Map<string, CompletenessGap[] | string> | null = null;

  if (stateful.length > 0) {
    const checked = await partsCompletenessOf({ ...options, parts: stateful, cached: true });

    if ('unavailable' in checked) {
      console.log(`COMPLETE CHECK SKIPPED - ${checked.unavailable}`);
      countCannotDraw({ ...options, why: checked.unavailable });
    } else {
      for (const hint of [...checked.hints.values()].flat()) console.log(hint);

      gaps = checked.gaps;
    }
  }

  const { failed, ...findings } = drawnFindingsFrom({ product, issues: rendered, busy, gaps, stateful });

  for (const line of failed) {
    console.log(cannotDrawLine({ product: product.name, line }));

    const counted = tallyOf(options.tally, { product: product.name, part: line.slice(0, line.indexOf(':')) });

    if (counted) counted.open += 1;
  }

  return findings;
};

const printOpenPoints = async (
  options: CheckOptions & { rendered: RenderIssue[] | null; busy?: BusyState[]; notDrawn?: string },
) => {
  const { target, config, products, rendered } = options;

  for (const name of products) {
    const entry = config.products?.[name];

    if (!entry) continue;

    const product = resolveProduct({ target, name, config: entry });
    const findings =
      rendered === null
        ? {}
        : await timedPhase('completeness', () => drawnFindingsFor({ ...options, product, rendered }));

    await timedPhase('open-points', () => printProductOpenPoints({ ...options, product, findings }));
  }
};

const printProductOpenPoints = async (
  options: CheckOptions & {
    rendered: RenderIssue[] | null;
    notDrawn?: string;
    product: ResolvedProduct;
    findings: Partial<DrawnFindings>;
  },
) => {
  const { target, config, rendered, product, findings } = options;
  const name = product.name;

  if (rendered === null && options.notDrawn) countCannotDraw({ ...options, product, why: options.notDrawn });

  const allPoints = readOpenPoints(product, findings);
  const points = allPoints.filter(({ part }) => !options.part || part === options.part);

  for (const { part, points: ofPart } of points) {
    const counted = tallyOf(options.tally, { product: name, part });

    if (counted) counted.open += ofPart.length;
  }

  openPointsText(name, points).forEach((line) => console.log(line));

  if (!options.part) uncoveredViewsText(name, uncoveredViewsOf(product)).forEach((line) => console.log(line));

  const unlinked = unlinkedPartsOf(product).filter((part) => !options.part || part === options.part);

  if (unlinked.length > 0) console.log(`UNLINKED ${name}: ${unlinked.join(', ')}`);

  instantLinesOf(
    product,
    options.part
      ? [options.part]
      : product.parts.filter((part) => part.origin !== 'base').map((part) => partKeyOf(part)),
  ).forEach((line) => console.log(line));

  const upgraded = upgradeLegacyMarksOf({ product, only: options.part });

  if (upgraded.length > 0)
    console.log(`REHASHED ${name}: ${upgraded.map(({ part, marks }) => `${part} (${marks.join(', ')})`).join(', ')}`);

  const recorded = await recordCheckedBuildReady({
    target,
    config,
    settle: options.part && rendered !== null ? [options.part] : [],
    product,
    parts: options.part
      ? [options.part]
      : product.parts.filter((part) => part.origin !== 'base').map((part) => partKeyOf(part)),
    inputs: withTalliedProblems(buildReadyInputsOf(product, { points: allPoints }), options.tally?.get(name)),
    ...(rendered === null
      ? {}
      : {
          actionsOf: (part: string) =>
            partActionFailuresOf({ target, config, product, part, ...(options.part ? { onNote: console.log } : {}) }),
          declaredActionsOf: async (part: string) => {
            const declared = await declaredPartActionsOf({ target, config, product, part, warm: options.warm });

            if (typeof declared === 'string') console.log(`ACTIONS NOT RECORDED ${name} ${part}: ${declared}`);

            return declared;
          },
        }),
    ...(options.part ? { onNoRecord: (line: string) => console.log(line) } : {}),
    onRecordDropped: (line: string) => console.log(line),
  });

  for (const [part] of recorded) {
    const warnings = unjudgedStateWarningsOf({ product, parts: [part] });
    const counted = warnings.length > 0 ? tallyOf(options.tally, { product: name, part }) : null;

    warnings.forEach((line) => console.warn(line));
    if (counted) counted.warnings += warnings.length;
  }

  const waiting = [...recorded.values()].filter(
    (result) => !result.ready && result.blockers.some((blocker) => blocker.kind === 'pending'),
  ).length;

  if (waiting > 0) console.log(slowWaitingLineOf({ product: name, count: waiting }));

  const ready = readyPartsOf(product).filter((key) => !options.part || key === options.part);

  if (ready.length > 0) console.log(`READY ${name}: ${ready.join(', ')}`);

  for (const part of ready) {
    const embedded = actionsRerunOf({ product, part });

    if (embedded.length === 0) continue;

    console.log(actionsRerunLineOf({ product: name, part, embedded }));

    const counted = tallyOf(options.tally, { product: name, part });

    if (counted) counted.open += 1;
  }

  stalePartsOf({ product, only: options.part }).forEach((stale) => console.log(staleLineOf(name, stale)));
};

const notCheckedLineOf = (options: { product: string; parts: string; why: string }) =>
  `NOT CHECKED ${options.product} render rules on ${options.parts} - ${options.why}`;

const printUndrawn = (issues: RenderIssue[]) => {
  for (const product of new Set(issues.map((issue) => issue.product))) {
    const own = issues.filter((issue) => issue.product === product);
    const parts = [...new Set(own.filter(isPartUndrawn).map((issue) => issue.part))];
    const states = [
      ...new Set(
        own
          .filter((issue) => isStateUndrawn(issue) && !parts.includes(issue.part))
          .map((issue) => `${issue.part} state ${issue.state}`),
      ),
    ];

    if (parts.length > 0)
      console.log(
        notCheckedLineOf({
          product,
          parts: `${countText(parts.length, 'part')}: ${parts.join(', ')}`,
          why: `${parts.length === 1 ? 'it' : 'they'} did not draw, see RENDER above`,
        }),
      );

    states.forEach((state) =>
      console.log(notCheckedLineOf({ product, parts: state, why: 'it did not draw, see RENDER above' })),
    );
  }
};

const RENDER_INPUTS_OUTSIDE_PARTS = ['libs/', 'package.json', 'yarn.lock'];

const oldIssuesOfRun = (options: {
  resolved: ResolvedProduct[];
  part: string | undefined;
  issues: RenderIssue[];
  undrawn: Set<string>;
}): Set<RenderIssue> => {
  try {
    return new Set(
      options.resolved.flatMap((product) => {
        const root = repoRootOf(product);
        const parts = product.parts
          .filter((part) => part.origin !== 'base' && (!options.part || partKeyOf(part) === options.part))
          .filter((part) => !options.undrawn.has(partKeyOf(part)))
          .map((part) => ({
            part: partKeyOf(part),
            inputs: [
              ...Object.keys(designHashOf({ product, part }).files),
              `${relative(root, dirname(part.file)).split(sep).join('/')}/`,
              ...RENDER_INPUTS_OUTSIDE_PARTS,
            ],
          }));

        return [
          ...oldRenderIssuesOf({
            root,
            file: baseIssuesFileOf(product),
            parts,
            issues: options.issues.filter((issue) => issue.product === product.name),
          }),
        ];
      }),
    );
  } catch {
    return new Set();
  }
};

const renderSystem = async (
  options: CheckOptions,
): Promise<{ code: number; rendered: RenderIssue[] | null; busy?: BusyState[]; notDrawn?: string }> => {
  const { code, fatal } = timedPhase('static', () => reportSystem({ ...options, warn: true }));

  if (fatal) return { code, rendered: null };

  const rendered = await timedPhase('render-inspect', () =>
    renderIssuesOf({
      ...options,
      cached: true,
      onProgress: (line) => console.log(line),
      jobs: options.products.map((product) => ({ product, sketch: null, parts: options.part ? [options.part] : null })),
    }),
  );

  const resolved = options.products.flatMap((name) => {
    const entry = options.config.products?.[name];

    return entry ? [resolveProduct({ target: options.target, name, config: entry })] : [];
  });

  if ('unavailable' in rendered) {
    const ci = Boolean(process.env['CI']);

    if (ci) console.log(`RENDER CHECK SKIPPED - ${rendered.unavailable}`);
    else console.log(`RENDER CHECK FAILED - no usable browser: ${rendered.unavailable}`);

    for (const product of resolved) {
      const parts = product.parts
        .filter((part) => part.origin !== 'base')
        .map(partKeyOf)
        .filter((key) => !options.part || key === options.part);

      if (parts.length > 0)
        console.log(
          notCheckedLineOf({
            product: product.name,
            parts: parts.length === 1 ? `1 part: ${parts[0]}` : `all ${parts.length} parts`,
            why: rendered.unavailable,
          }),
        );
    }

    return { code: ci ? code : 1, rendered: null, notDrawn: rendered.unavailable };
  }
  const isInBase = (issue: RenderIssue) =>
    resolved.some((product) => product.name === issue.product && isBasePartKey(product, ownerPartOf(issue)));
  const own = rendered.issues.filter((issue) => !isInBase(issue));
  const baselined = resolved.map((product) => {
    const baselinedOwn = own.filter(
      (issue) => issue.product === product.name && BASELINED_RENDER_RULES.has(issue.rule),
    );
    const undrawn = new Set(
      own
        .filter((issue) => issue.product === product.name && (isPartUndrawn(issue) || isStateUndrawn(issue)))
        .map((issue) => issue.part),
    );
    const problemOf = new Map(baselinedOwn.map((issue) => [renderProblemOf(product, issue), issue]));
    const result = ruleBaselineOf({
      product,
      problems: [...problemOf.keys()],
      checked: (rule, part) =>
        BASELINED_RENDER_RULES.has(rule) && !undrawn.has(part) && (!options.part || part === options.part),
    });

    return {
      product,
      own: baselinedOwn,
      lines: result.lines,
      failing: result.problems.flatMap((problem) => problemOf.get(problem) ?? []),
      problems: result.problems.filter((problem) => !problemOf.has(problem)),
    };
  });
  const passed = new Set(baselined.flatMap(({ own, failing }) => own.filter((issue) => !failing.includes(issue))));
  const issues = own.filter((issue) => !passed.has(issue));
  const baselineProblems = baselined.flatMap(({ product, problems }) =>
    problems.map((problem) => ({ product, problem })),
  );

  baselined.forEach(({ lines }) => lines.forEach((line) => console.log(line)));
  baselineProblems.forEach(({ product, problem }) => {
    console.error(lineOf(options.target, problem));
    tallyOf(options.tally, {
      product: product.name,
      part: tallyKeyOf(options.target, { product, file: problem.file }),
    })?.problems.push(problem.rule);
  });

  rendered.warnings
    .filter((issue) => !isInBase(issue))
    .forEach((issue) => {
      console.warn(`WARNING ${renderIssueLineOf(issue)}`);
      const counted = tallyOf(options.tally, { product: issue.product, part: ownerPartOf(issue) });

      if (counted) counted.warnings += 1;
    });
  const old = oldIssuesOfRun({
    resolved,
    part: options.part,
    issues: rendered.issues.filter((issue) => !isInBase(issue)),
    undrawn: new Set(issues.filter(isPartUndrawn).map((issue) => issue.part)),
  });

  issues.forEach((issue) => {
    console.error(old.has(issue) ? `OLD ${renderIssueLineOf(issue)}` : renderIssueLineOf(issue));
    tallyOf(options.tally, { product: issue.product, part: ownerPartOf(issue) })?.problems.push(issue.rule);
  });
  printUndrawn(issues.filter((issue) => isPartUndrawn(issue) || isStateUndrawn(issue)));

  if (!options.part)
    for (const product of resolved)
      printBaseFindings(
        product,
        rendered.issues.filter((issue) => issue.product === product.name && isInBase(issue)).map((issue) => issue.rule),
      );

  return {
    code: code !== 0 || issues.length > 0 || baselineProblems.length > 0 ? 1 : 0,
    rendered: issues,
    busy: rendered.busy,
  };
};

const checkProductTail = async (
  options: CheckOptions & {
    tally: Tally;
    name: string;
    entry: NonNullable<DesignConfig['products']>[string];
    problemsOfEdits: Problem[];
  },
) => {
  const { tally, name, entry } = options;
  const resolved = resolveProduct({ target: options.target, name, config: entry });
  const capabilities = await capabilityPlaceOf({ ...options, product: resolved });

  const isWanted = (problem: { file: string }) => !options.part || partOfFile(resolved, problem.file) === options.part;

  const coverage = await designCoverageOf({ ...options, product: resolved });

  [...capabilities.warnings, ...coverage].filter(isWanted).forEach((warning) => {
    console.warn(`WARNING ${lineOf(options.target, warning)}`);
    const counted = tallyOf(tally, {
      product: name,
      part: tallyKeyOf(options.target, { product: resolved, file: warning.file }),
    });

    if (counted) counted.warnings += 1;
  });
  const drawn = ruleBaselineOf({
    product: resolved,
    problems: [
      ...(await droppedPropProblemsOf({ ...options, product: resolved })),
      ...(await bespokeControlProblemsOf({ ...options, product: resolved })),
      ...(await actionLostProblemsOf({
        ...options,
        product: resolved,
        invocation: options.invocation ?? repoInvocation({ root: options.target, subcommand: 'design' }),
      })),
    ].filter(isWanted),
    checked: (rule, part) => isDrawRule(rule) && (!options.part || part === options.part),
  });

  drawn.lines.forEach((line) => console.log(line));

  const problems = [...drawn.problems, ...capabilities.errors, ...options.problemsOfEdits].filter(isWanted);

  for (const problem of problems) {
    console.error(lineOf(options.target, problem));
    tallyOf(tally, {
      product: name,
      part: tallyKeyOf(options.target, { product: resolved, file: problem.file }),
    })?.problems.push(problem.rule);
  }

  return problems.length;
};

/**
 * Checks as `checkSystem` does, then draws every state in a headless browser and prints one line per
 * render rule a drawing breaks, also when a static rule failed, and warns of each merged part that changed outside a sketch. A part that does not
 * draw, each state that does not draw, or every part without a browser, gets one `NOT CHECKED` line; without a browser it passes on the other checks.
 * It then lists the open points of each product's parts, with the contrasts the drawing found and the missing states
 * of each component part as `design complete` draws them, the blockers `design ready` refuses on; they do not change
 * the exit code.
 */
export const checkSystemRendered = async (options: CheckOptions) => {
  const run = options.warm
    ? { warm: { ...options.warm, perRun: true }, close: async () => undefined }
    : createRunDraw(options.target, { chromiumOf: options.chromiumOf });

  try {
    return await withStampsInMemory(() => checkSystemRenderedOn({ ...options, warm: run.warm }));
  } finally {
    await run.close();
  }
};

export const deniedLineOf = (id: string) =>
  `SERVE-DENIED ${id}: the design server answered 403, the file is outside its allow list, so a drawing got other content`;

const checkSystemRenderedOn = async (options: CheckOptions & { warm: WarmDraw }) => {
  const tally: Tally = new Map();

  options.warm.takeDeniedIds?.();
  const counted = { ...options, tally };

  for (const line of timedPhase('stale-dist', () => staleDistWarningsOf(options))) console.warn(line);

  const editProblems = new Map<string, Problem[]>();

  for (const name of options.products) {
    const entry = options.config.products?.[name];

    if (!entry) continue;

    const product = resolveProduct({ target: options.target, name, config: entry });
    const refreshed = timedPhase('harness-map', () => refreshHarnessMap({ target: options.target, product }));

    if (typeof refreshed === 'string') console.log(`HARNESS MAP STALE ${name}: ${refreshed}`);
    if (refreshed === true) console.log(`REGENERATED ${name}: the stale harness map`);

    const problems: Problem[] = [];
    const lines = await timedPhase('auto-accept', () =>
      autoAcceptOf({ ...options, product, only: options.part, draw: options.drawPictures, problems }),
    );

    editProblems.set(name, problems);

    lines.forEach((line) => console.log(line));
  }

  const { code, rendered, busy, notDrawn } = await renderSystem(counted);

  await printOpenPoints({ ...counted, rendered, busy, notDrawn });

  let failed = 0;
  let partsTotal = 0;

  for (const name of options.products) {
    const entry = options.config.products?.[name];

    if (!entry) continue;

    failed += await timedPhase('tail', () =>
      checkProductTail({ ...options, tally, name, entry, problemsOfEdits: editProblems.get(name) ?? [] }),
    );
  }

  const denied = [...new Set(options.warm.takeDeniedIds?.() ?? [])];

  denied.forEach((id) => console.error(deniedLineOf(id)));
  failed += denied.length;

  timedPhase('summary', () => {
    const staleCli = runningCliStaleWarning();

    if (staleCli) console.log(staleCli);

    for (const name of options.products) {
      const entry = options.config.products?.[name];

      if (!entry) continue;

      const resolved = resolveProduct({ target: options.target, name, config: entry });
      const parts = resolved.parts.filter((part) => part.origin !== 'base').map(partKeyOf);

      partsTotal += options.part ? parts.filter((key) => key === options.part).length : parts.length;

      summaryText({
        product: name,
        parts,
        tally,
        only: options.part,
        done: doneParts({ product: resolved, parts }).length,
      }).forEach((line) => console.log(line));
    }
  });

  const exit = code !== 0 || failed > 0 ? 1 : 0;

  if (exit === 0) console.log('ok');

  ruleSummaryText(tally).forEach((line) => console.log(line));

  const findings = [...tally.values()]
    .flatMap((found) => [...found.values()])
    .reduce((n, e) => n + e.problems.length, 0);

  console.log(`check complete: ${countText(partsTotal, 'part')}, ${countText(findings, 'finding')}`);

  return exit;
};
