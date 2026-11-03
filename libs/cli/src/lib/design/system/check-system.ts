import { dirname, relative } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { autoAcceptOf, DrawStates, newStatesLineOf } from './accepted-pictures';
import { importProblemsOf } from './imports';
import { CompletenessGap, partsCompletenessOf } from './complete';
import { actionsRerunLineOf } from './embedded-actions';
import { actionLostProblemsOf } from './action-lost';
import { capabilityPlaceOf } from './rules/capability-place';
import { actionUndeclaredUnderGoOf } from './action-undeclared';
import { bespokeControlProblemsOf } from './bespoke-controls';
import { droppedPropProblemsOf } from './dropped-props';
import { DrawnFindings, drawnFindingsFrom, isPartUndrawn, isStateUndrawn, statefulPartsOf } from './drawn-open-points';
import { openPointsText } from './open-points';
import { goMarkOf, goPartsOf, goStateOf } from './part-go';
import { doneParts } from './part-task';
import { actionsRerunOf, readyPartsOf } from './part-ready';
import { staleLineOf, stalePartsOf, upgradeLegacyMarksOf } from './stale-parts';
import { Problem } from './problem';
import { staleDistWarningsOf } from './stale-dist';
import { instantLinesOf, readOpenPoints, unlinkedPartsOf } from './read-open-points';
import { partKeyOf, resolveProduct, ResolvedProduct } from './resolve-product';
import { canonicalClassesOf } from './rules/canonical-class';
import { componentCopiesOf } from './rules/component-copy';
import { deniedClassesOf } from './rules/denied-class';
import { nativeTitlesOf } from './rules/native-title';
import { ownerPartOf, RenderIssue, renderIssueLineOf, renderIssuesOf } from './render-check';
import { flowProblemsOf } from './rules/flow';
import { badLinksOf } from './rules/implements';
import { hardCodedColoursOf } from './rules/hard-coded-colour';
import { unknownInteractionsOf } from './rules/interactions';
import { kitOutsidePagesOf } from './rules/kit-outside-pages';
import { inlineSvgsOf } from './rules/inline-svg';
import { badMotionsOf, badUnreachableOf, hardCodedMotionOf, scriptedMotionOf } from './rules/motion';
import { goneSketchCommentWarningsOf, staleCommentsOf, staleNotesOf } from './rules/stale-comment';
import { gluedInterpolationsOf } from './rules/glued-interpolation';
import { undefinedClassesOf } from './rules/undefined-class';
import { undefinedTokensOf } from './rules/undefined-token';
import { tokenSelectorsOf } from './rules/token-selectors';
import { upwardDependenciesOf } from './rules/upward-dependency';
import { badSvgAssetsOf } from './rules/svg-asset';
import { staleReplacesOf } from './rules/stale-replace';
import { CHECK_RULES } from './check-rules';
import { unusedSharedExportsOf } from './rules/unused-shared-export';
import { utilityCssOf } from './rules/utility-css';
import { orphanEndpointProblemsOf, orphanEndpointWarningsOf } from './rules/orphan-endpoint';
import { sampleDefaultProblemsOf, sampleDefaultWarningsOf } from './rules/sample-default';
import { unboundInputProblemsOf, unboundInputWarningsOf } from './rules/unbound-input';
import { uncoveredViewsOf, uncoveredViewsText } from './rules/view-coverage';
import { badWidthsOf } from './rules/widths';
import { typecheckVariant } from './sketch/check-sketches';
import { changedOutsideSketchOf } from './sketch/merged-parts';
import { staleBaselineOf } from './sketch/baseline';
import { listSketches, variantDirOf } from './sketch/sketch';
import { typecheckProduct, writeEditorTsconfig } from './system-tsconfig';
import { repoInvocation } from '../../invocation';
import { uncommittedDecisionsWarningOf } from './uncommitted-decisions';

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
  undefinedClassesOf,
  deniedClassesOf,
  nativeTitlesOf,
  utilityCssOf,
  orphanEndpointProblemsOf,
  sampleDefaultProblemsOf,
  unboundInputProblemsOf,
  gluedInterpolationsOf,
];

export const warningProblemsOf = (product: ResolvedProduct): Problem[] => [
  ...unusedSharedExportsOf(product),
  ...staleReplacesOf(product),
  ...tokenSelectorsOf(product),
  ...orphanEndpointWarningsOf(product),
  ...sampleDefaultWarningsOf(product),
  ...unboundInputWarningsOf(product),
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
};

const PRODUCT_LEVEL = '(product)';

/** The key of the part whose folder holds `file`, the innermost one, or `(product)` for a file outside every part. */
export const partOfFile = (product: ResolvedProduct, file: string): string =>
  product.parts
    .map((part) => ({ key: partKeyOf(part), dir: dirname(part.file) }))
    .filter(({ dir }) => !relative(dir, file).startsWith('..'))
    .sort((a, b) => b.dir.length - a.dir.length)[0]?.key ?? PRODUCT_LEVEL;

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

    return items.length > 0 ? `PART ${options.product} ${key}: ${items.join(', ')}` : null;
  };
  const lines = keys.map((key) => ({ key, line: lineOf(key) }));

  if (options.only) return [lines[0]?.line ?? `PART ${options.product} ${options.only}: clean`];

  const clean = lines.filter(({ key, line }) => line === null && key !== PRODUCT_LEVEL).length;

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

/**
 * One SKETCH-BASE-STALE problem, with its printed line, per undiscarded sketch (open or picked) whose base changed since it was drawn or
 * rebased; with `parts`, only the sketches where one of those parts changed.
 */
export const staleSketchBasesOf = (options: {
  product: ResolvedProduct;
  invocation: string;
  parts?: Set<string>;
}): (Problem & { line: string })[] => {
  const { product, invocation, parts } = options;

  return listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) => {
    if (typeof sketch === 'string' || sketch.decision?.kind === 'discard') return [];

    const changed = staleBaselineOf({ product, sketch });

    if (!changed?.length || (parts && !changed.some((part) => parts.has(part)))) return [];

    const message = `${changed.join(', ')} changed since the sketch was drawn - bring each variant up to date, then run ${invocation} sketch rebase ${sketch.target} --product ${product.name} --by <model id>`;

    return [
      {
        rule: 'SKETCH-BASE-STALE',
        file: sketch.dir,
        message,
        line: `SKETCH-BASE-STALE ${product.name} ${sketch.target}: ${message}`,
      },
    ];
  });
};

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
    tallyOf(options.tally, { product: product.name, part: partOfFile(product, problem.file) })?.problems.push(
      problem.rule,
    );
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

    if (!options.part) goneSketchCommentWarningsOf(product).forEach((warning) => console.warn(warning));
    const isWanted = (problem: Problem) => !options.part || partOfFile(product, problem.file) === options.part;
    const isOwn = (problem: Problem) => !isInBasePart(product, problem.file) && isWanted(problem);
    const warnings = warningProblemsOf(product);
    const problems = ruleProblemsOf(product);

    warnings.filter(isOwn).forEach((problem) => {
      console.warn(`WARNING ${lineOf(target, problem)}`);
      const counted = tallyOf(options.tally, { product: name, part: partOfFile(product, problem.file) });

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
  options: CheckOptions & { product: ResolvedProduct; rendered: RenderIssue[] },
): Promise<DrawnFindings> => {
  const { product, rendered } = options;
  const stateful = statefulPartsOf(product, options.part ? [options.part] : null);
  let gaps: Map<string, CompletenessGap[] | string> | null = null;

  if (stateful.length > 0) {
    const checked = await partsCompletenessOf({ ...options, parts: stateful });

    if ('unavailable' in checked) {
      console.log(`COMPLETE CHECK SKIPPED - ${checked.unavailable}`);
      countCannotDraw({ ...options, why: checked.unavailable });
    } else {
      for (const hint of [...checked.hints.values()].flat()) console.log(hint);

      gaps = checked.gaps;
    }
  }

  const { failed, ...findings } = drawnFindingsFrom({ product, issues: rendered, gaps, stateful });

  for (const line of failed) {
    console.log(cannotDrawLine({ product: product.name, line }));

    const counted = tallyOf(options.tally, { product: product.name, part: line.slice(0, line.indexOf(':')) });

    if (counted) counted.open += 1;
  }

  return findings;
};

const printOpenPoints = async (options: CheckOptions & { rendered: RenderIssue[] | null; notDrawn?: string }) => {
  const { target, config, products, rendered } = options;

  for (const name of products) {
    const entry = config.products?.[name];

    if (!entry) continue;

    const product = resolveProduct({ target, name, config: entry });
    const findings = rendered === null ? {} : await drawnFindingsFor({ ...options, product, rendered });

    if (rendered === null && options.notDrawn) countCannotDraw({ ...options, product, why: options.notDrawn });

    const points = readOpenPoints(product, findings).filter(({ part }) => !options.part || part === options.part);

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

    const ready = readyPartsOf(product).filter((key) => !options.part || key === options.part);

    if (ready.length > 0) console.log(`READY ${name}: ${ready.join(', ')}`);

    for (const part of ready) {
      const embedded = actionsRerunOf({ product, part });

      if (embedded.length === 0) continue;

      console.log(actionsRerunLineOf({ product: name, part, embedded }));

      const counted = tallyOf(options.tally, { product: name, part });

      if (counted) counted.open += 1;
    }

    const go = goPartsOf(product).filter((key) => !options.part || key === options.part);

    if (go.length > 0) console.log(`GO ${name}: ${go.join(', ')}`);

    for (const part of go) {
      const review = goMarkOf({ product, part })?.review ?? [];

      if (review.length > 0) console.log(newStatesLineOf({ product: name, part, states: review }));
    }

    stalePartsOf({ product, only: options.part }).forEach((stale) => console.log(staleLineOf(name, stale)));
  }
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

const renderSystem = async (
  options: CheckOptions,
): Promise<{ code: number; rendered: RenderIssue[] | null; notDrawn?: string }> => {
  const { code, fatal } = reportSystem({ ...options, warn: true });

  if (fatal) return { code, rendered: null };

  const rendered = await renderIssuesOf({
    ...options,
    onProgress: (line) => console.log(line),
    jobs: options.products.map((product) => ({ product, sketch: null, parts: options.part ? [options.part] : null })),
  });

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
  const underGo = actionUndeclaredUnderGoOf({
    issues: rendered.issues.filter((issue) => !isInBase(issue)),
    isGo: ({ product, part }) => {
      const found = resolved.find((candidate) => candidate.name === product);

      return found !== undefined && goStateOf({ product: found, part }) === 'current';
    },
  });
  const { issues } = underGo;

  underGo.warnings.forEach(({ product, part, line }) => {
    console.warn(line);
    const counted = tallyOf(options.tally, { product, part });

    if (counted) counted.warnings += 1;
  });
  rendered.warnings
    .filter((issue) => !isInBase(issue))
    .forEach((issue) => {
      console.warn(`WARNING ${renderIssueLineOf(issue)}`);
      const counted = tallyOf(options.tally, { product: issue.product, part: ownerPartOf(issue) });

      if (counted) counted.warnings += 1;
    });
  issues.forEach((issue) => {
    console.error(renderIssueLineOf(issue));
    tallyOf(options.tally, { product: issue.product, part: ownerPartOf(issue) })?.problems.push(issue.rule);
  });
  printUndrawn(issues.filter((issue) => isPartUndrawn(issue) || isStateUndrawn(issue)));

  if (!options.part)
    for (const product of resolved)
      printBaseFindings(
        product,
        rendered.issues.filter((issue) => issue.product === product.name && isInBase(issue)).map((issue) => issue.rule),
      );

  return { code: code !== 0 || issues.length > 0 ? 1 : 0, rendered: issues };
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
  const tally: Tally = new Map();
  const counted = { ...options, tally };

  for (const line of staleDistWarningsOf(options)) console.warn(line);

  for (const name of options.products) {
    const entry = options.config.products?.[name];

    if (!entry) continue;

    const product = resolveProduct({ target: options.target, name, config: entry });
    const lines = await autoAcceptOf({ ...options, product, only: options.part, draw: options.drawPictures });

    lines.forEach((line) => console.log(line));
  }

  const { code, rendered, notDrawn } = await renderSystem(counted);

  await printOpenPoints({ ...counted, rendered, notDrawn });

  let failed = 0;
  let partsTotal = 0;

  for (const name of options.products) {
    const entry = options.config.products?.[name];

    if (!entry) continue;

    const resolved = resolveProduct({ target: options.target, name, config: entry });
    const capabilities = await capabilityPlaceOf({ ...options, product: resolved });

    const isWanted = (problem: { file: string }) =>
      !options.part || partOfFile(resolved, problem.file) === options.part;

    capabilities.warnings.filter(isWanted).forEach((warning) => {
      console.warn(`WARNING ${lineOf(options.target, warning)}`);
      const counted = tallyOf(tally, { product: name, part: partOfFile(resolved, warning.file) });

      if (counted) counted.warnings += 1;
    });
    const problems = [
      ...(await droppedPropProblemsOf({ ...options, product: resolved })),
      ...(await bespokeControlProblemsOf({ ...options, product: resolved })),
      ...(await actionLostProblemsOf({
        ...options,
        product: resolved,
        invocation: options.invocation ?? repoInvocation({ root: options.target, subcommand: 'design' }),
      })),
      ...capabilities.errors,
    ].filter(isWanted);

    for (const problem of problems) {
      console.error(lineOf(options.target, problem));
      tallyOf(tally, { product: name, part: partOfFile(resolved, problem.file) })?.problems.push(problem.rule);
    }

    failed += problems.length;
  }

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

  const exit = code !== 0 || failed > 0 ? 1 : 0;

  if (exit === 0) console.log('ok');

  ruleSummaryText(tally).forEach((line) => console.log(line));

  const findings = [...tally.values()]
    .flatMap((found) => [...found.values()])
    .reduce((n, e) => n + e.problems.length, 0);

  console.log(`check complete: ${countText(partsTotal, 'part')}, ${countText(findings, 'finding')}`);

  return exit;
};
