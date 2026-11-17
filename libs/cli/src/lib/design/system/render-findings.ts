import { relative } from 'path';
import { isPartUndrawn, isStateUndrawn } from './drawn-open-points';
import { BuildReadyInputs } from './part-build-ready';
import { Problem } from './problem';
import { BASELINED_RENDER_RULES, ownerPartOf, RenderIssue } from './render-check';
import { partKeyOf, partOfFile, PRODUCT_PART_KEY, ResolvedProduct } from './resolve-product';
import { renderProblemOf, ruleBaselineOf } from './rule-baseline';

export const APP_CODE = 'app code:';

/** The tally key of `file`: its part, `(product)` for a design file outside every part, or `app code:<file>` for app code. */
export const tallyKeyOf = (target: string, { product, file }: { product: ResolvedProduct; file: string }) => {
  const part = partOfFile(product, file);
  const inDesign = [product.dir, product.base?.dir].some((dir) => dir && !relative(dir, file).startsWith('..'));

  return part !== PRODUCT_PART_KEY || inDesign ? part : `${APP_CODE}${relative(target, file) || '.'}`;
};

const isBasePartKey = (product: ResolvedProduct, key: string) =>
  product.parts.find((part) => partKeyOf(part) === key)?.origin === 'base';

/**
 * Splits the render issues of a draw of `resolved` into the ones that fail, after the rule baseline (ADR 0201), and
 * answers the rules each part fails by. `design check` and `design ready` both decide a part from this; `part` limits
 * the stale-baseline problems to that part.
 */
export const renderFindingsOf = (options: {
  target: string;
  resolved: ResolvedProduct[];
  issues: RenderIssue[];
  part?: string;
}) => {
  const { target, resolved, part } = options;
  const isBaseOf = (issue: RenderIssue, key: string) =>
    resolved.some((product) => product.name === issue.product && isBasePartKey(product, key));
  const countedPartOf = (issue: RenderIssue) => (isBaseOf(issue, ownerPartOf(issue)) ? issue.part : ownerPartOf(issue));
  const isInBase = (issue: RenderIssue) => isBaseOf(issue, countedPartOf(issue));
  const own = options.issues.filter((issue) => !isInBase(issue));
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
      checked: (rule, at) => BASELINED_RENDER_RULES.has(rule) && !undrawn.has(at) && (!part || at === part),
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
  const failed = [
    ...baselineProblems.map(({ product, problem }) => ({
      product: product.name,
      part: tallyKeyOf(target, { product, file: problem.file }),
      rule: problem.rule,
    })),
    ...issues.map((issue) => ({ product: issue.product, part: countedPartOf(issue), rule: issue.rule })),
  ];

  return {
    issues,
    baselineProblems,
    baselineLines: baselined.flatMap(({ lines }) => lines),
    countedPartOf,
    isInBase,
    failed,
    rulesOf: (product: string, at: string) =>
      failed.filter((found) => found.product === product && found.part === at).map((found) => found.rule),
  };
};

/** `inputs` whose problems of a part add each rule `rulesOf` names for it that no problem of the part has yet. */
export const withFoundRules = (inputs: BuildReadyInputs, rulesOf: (part: string) => string[]): BuildReadyInputs => ({
  ...inputs,
  problemsOf: (part) => {
    const own: Problem[] = inputs.problemsOf(part);
    const ruled = new Set(own.map((problem) => problem.rule));
    const found = [...new Set(rulesOf(part))].filter((rule) => !ruled.has(rule));

    return [...own, ...found.map((rule) => ({ rule, file: '', message: 'found by design check' }))];
  },
});
