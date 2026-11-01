import { dirname, relative } from 'path';
import { DesignConfig } from '../paths';
import { importProblemsOf } from './imports';
import { CompletenessGap, partsCompletenessOf } from './complete';
import { DrawnFindings, drawnFindingsFrom, statefulPartsOf } from './drawn-open-points';
import { openPointsText } from './open-points';
import { goPartsOf } from './part-go';
import { readyPartsOf } from './part-ready';
import { Problem } from './problem';
import { staleDistWarningsOf } from './stale-dist';
import { readOpenPoints, unlinkedPartsOf } from './read-open-points';
import { partKeyOf, resolveProduct, ResolvedProduct } from './resolve-product';
import { canonicalClassesOf } from './rules/canonical-class';
import { componentCopiesOf } from './rules/component-copy';
import { deniedClassesOf } from './rules/denied-class';
import { RenderIssue, renderIssueLineOf, renderIssuesOf } from './render-check';
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
import { unusedSharedExportsOf } from './rules/unused-shared-export';
import { utilityCssOf } from './rules/utility-css';
import { uncoveredViewsOf, uncoveredViewsText } from './rules/view-coverage';
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
  undefinedClassesOf,
  deniedClassesOf,
  utilityCssOf,
];

export const warningProblemsOf = (product: ResolvedProduct): Problem[] => [
  ...unusedSharedExportsOf(product),
  ...staleReplacesOf(product),
  ...tokenSelectorsOf(product),
  ...gluedInterpolationsOf(product),
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
export const summaryText = (options: { product: string; parts: string[]; tally: Tally; only?: string }): string[] => {
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
  ];
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
  const report = (problem: Problem, product: ResolvedProduct) => {
    const line = lineOf(target, problem);

    if (options.known?.includes(line)) {
      console.warn(`NOTE (was there before) ${line}`);

      return;
    }

    console.error(line);
    failed = true;
    options.blocking?.push(problem.rule);
    tallyOf(options.tally, { product: product.name, part: partOfFile(product, problem.file) })?.problems.push(
      problem.rule,
    );
  };

  for (const name of products) {
    const entry = declared[name];

    if (!entry) {
      console.error(`NO PRODUCT "${name}" - config.json declares ${Object.keys(declared).join(', ') || 'none'}.`);

      return 1;
    }

    const product = resolveProduct({ target, name, config: entry });

    if (options.part && !product.parts.some((part) => partKeyOf(part) === options.part)) {
      console.error(`NO PART "${options.part}" in product ${name}.`);

      return 1;
    }

    if (options.warn && !options.part) warnChangedOutsideSketch(product);

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

      return 1;
    }

    if (result.kind === 'failed')
      report({ rule: 'TYPE-ERROR', file: product.dir, message: `\n${result.output}` }, product);

    if (options.warn && !options.part)
      typecheckOpenSketches({ target, product }).forEach((problem) => report(problem, product));
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

const drawnFindingsFor = async (
  options: CheckOptions & { product: ResolvedProduct; rendered: RenderIssue[] },
): Promise<DrawnFindings> => {
  const { product, rendered } = options;
  const stateful = statefulPartsOf(product, options.part ? [options.part] : null);
  let gaps: Map<string, CompletenessGap[] | string> | null = null;

  if (stateful.length > 0) {
    const checked = await partsCompletenessOf({ ...options, parts: stateful });

    if ('unavailable' in checked) console.log(`COMPLETE CHECK SKIPPED - ${checked.unavailable}`);
    else {
      for (const hint of [...checked.hints.values()].flat()) console.log(hint);

      gaps = checked.gaps;
    }
  }

  const { failed, ...findings } = drawnFindingsFrom({ product, issues: rendered, gaps, stateful });

  for (const line of failed) {
    console.log(`CANNOT DRAW ${product.name} ${line} - et design ready refuses the part until it draws`);

    const counted = tallyOf(options.tally, { product: product.name, part: line.slice(0, line.indexOf(':')) });

    if (counted) counted.open += 1;
  }

  return findings;
};

const printOpenPoints = async (options: CheckOptions & { rendered: RenderIssue[] | null }) => {
  const { target, config, products, rendered } = options;

  for (const name of products) {
    const entry = config.products?.[name];

    if (!entry) continue;

    const product = resolveProduct({ target, name, config: entry });
    const findings = rendered === null ? {} : await drawnFindingsFor({ ...options, product, rendered });

    const points = readOpenPoints(product, findings).filter(({ part }) => !options.part || part === options.part);

    for (const { part, points: ofPart } of points) {
      const counted = tallyOf(options.tally, { product: name, part });

      if (counted) counted.open += ofPart.length;
    }

    openPointsText(name, points).forEach((line) => console.log(line));

    if (!options.part) uncoveredViewsText(name, uncoveredViewsOf(product)).forEach((line) => console.log(line));

    const unlinked = unlinkedPartsOf(product).filter((part) => !options.part || part === options.part);

    if (unlinked.length > 0) console.log(`UNLINKED ${name}: ${unlinked.join(', ')}`);

    const ready = readyPartsOf(product);

    if (ready.length > 0) console.log(`READY ${name}: ${ready.join(', ')}`);

    const go = goPartsOf(product);

    if (go.length > 0) console.log(`GO ${name}: ${go.join(', ')}`);
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
    jobs: options.products.map((product) => ({ product, sketch: null, parts: options.part ? [options.part] : null })),
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
    .forEach((issue) => {
      console.warn(`WARNING ${renderIssueLineOf(issue)}`);
      const counted = tallyOf(options.tally, { product: issue.product, part: ownerPartOf(issue) });

      if (counted) counted.warnings += 1;
    });
  issues.forEach((issue) => {
    console.error(renderIssueLineOf(issue));
    tallyOf(options.tally, { product: issue.product, part: ownerPartOf(issue) })?.problems.push(issue.rule);
  });

  if (!options.part)
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
 * It then lists the open points of each product's parts, with the contrasts the drawing found and the missing states
 * of each component part as `design complete` draws them, the blockers `design ready` refuses on; they do not change
 * the exit code.
 */
export const checkSystemRendered = async (options: CheckOptions) => {
  const tally: Tally = new Map();
  const counted = { ...options, tally };

  for (const line of staleDistWarningsOf(options)) console.warn(line);

  const { code, rendered } = await renderSystem(counted);

  await printOpenPoints({ ...counted, rendered });

  for (const name of options.products) {
    const entry = options.config.products?.[name];

    if (!entry) continue;

    const own = resolveProduct({ target: options.target, name, config: entry }).parts.filter(
      (part) => part.origin !== 'base',
    );

    summaryText({ product: name, parts: own.map(partKeyOf), tally, only: options.part }).forEach((line) =>
      console.log(line),
    );
  }

  if (code === 0) console.log('ok');

  return code;
};
