import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { addedBaselineNamesOf } from './baseline-history';
import { Problem } from './problem';
import { repoRootOf } from './reachable-files';
import { partOfFile, ResolvedProduct } from './resolve-product';

export const RULE_BASELINE_FILE = 'rule-baseline.json';

/**
 * A rule hit on a part that predates the rule (ADR 0201): the finding that tracks its fix, and the sketch that fixes
 * it.
 */
export type RuleBaselineEntry = { finding: string; sketch: string };

/** Per rule, the baselined hits by `<part>: <place>`. */
export type RuleBaseline = Record<string, Record<string, RuleBaselineEntry>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isEntry = (value: unknown): value is RuleBaselineEntry =>
  isRecord(value) && typeof value['finding'] === 'string' && typeof value['sketch'] === 'string';

const baselineOf = (text: string): RuleBaseline => {
  try {
    const parsed: unknown = JSON.parse(text);

    if (!isRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([rule, hits]) => [
        rule,
        isRecord(hits)
          ? Object.fromEntries(
              Object.entries(hits).filter((entry): entry is [string, RuleBaselineEntry] => isEntry(entry[1])),
            )
          : {},
      ]),
    );
  } catch {
    return {};
  }
};

const flatOf = (baseline: RuleBaseline) =>
  Object.entries(baseline).flatMap(([rule, hits]) =>
    Object.entries(hits).map(([hit, entry]) => ({ rule, hit, entry })),
  );

export const ruleBaselineFileOf = (product: ResolvedProduct) => resolve(product.dir, RULE_BASELINE_FILE);

export const readRuleBaseline = (product: ResolvedProduct): RuleBaseline => {
  const file = ruleBaselineFileOf(product);

  return existsSync(file) ? baselineOf(readFileSync(file, 'utf8')) : {};
};

/** The baseline key of a hit: its part (`(product)` outside every part) and its place, or its message without one. */
export const hitKeyOf = (product: ResolvedProduct, problem: Problem) =>
  `${partOfFile(product, resolve(repoRootOf(product), problem.file))}: ${problem.at ?? problem.message}`;

/** The `problems` the rule baseline of `product` does not list. */
export const unbaselinedProblemsOf = (product: ResolvedProduct, problems: Problem[]) => {
  const baseline = readRuleBaseline(product);

  return problems.filter((problem) => !baseline[problem.rule]?.[hitKeyOf(product, problem)]);
};

const partOfHit = (hit: string) => hit.slice(0, hit.indexOf(': '));

export const ruleBaselineLineOf = ({ rule, hit, entry }: { rule: string; hit: string; entry: RuleBaselineEntry }) =>
  `baselined (ADR 0201): ${rule} ${hit} - finding ${entry.finding}, sketch ${entry.sketch}`;

/** The entries of `product`'s rule baseline added after it was first committed: it may only shrink; a note may change. */
export const addedRuleBaselineEntriesOf = (product: ResolvedProduct) =>
  addedBaselineNamesOf({
    file: ruleBaselineFileOf(product),
    identitiesOf: (text) =>
      flatOf(baselineOf(text)).map(({ rule, hit }) => [`${rule} ${hit}`, JSON.stringify([rule, hit])]),
  });

/**
 * Splits the `problems` a run found into the ones that fail and the printed lines of the baselined ones. A problem
 * fails too for each entry whose rule ran on its part (`checked`) without that hit, and for each entry added to the
 * baseline after it was committed.
 */
export const ruleBaselineOf = (options: {
  product: ResolvedProduct;
  problems: Problem[];
  checked: (rule: string, part: string) => boolean;
}) => {
  const { product, checked } = options;
  const baseline = readRuleBaseline(product);
  const file = ruleBaselineFileOf(product);
  const hits = new Set<string>();
  const lines: string[] = [];
  const failing = options.problems.filter((problem) => {
    const hit = hitKeyOf(product, problem);
    const entry = baseline[problem.rule]?.[hit];

    if (!entry) return true;

    if (!hits.has(`${problem.rule} ${hit}`)) lines.push(ruleBaselineLineOf({ rule: problem.rule, hit, entry }));

    hits.add(`${problem.rule} ${hit}`);

    return false;
  });
  const stale = flatOf(baseline)
    .filter(({ rule, hit }) => checked(rule, partOfHit(hit)) && !hits.has(`${rule} ${hit}`))
    .map(({ rule, hit, entry }): Problem => ({
      rule,
      file,
      message: `${hit} no longer hits - remove its entry (finding ${entry.finding}, ADR 0201)`,
    }));
  const added = addedRuleBaselineEntriesOf(product).map((name): Problem => ({
    rule: name.slice(0, name.indexOf(' ')),
    file,
    message: `${name.slice(name.indexOf(' ') + 1)} was added to the rule baseline - it may only shrink (ADR 0201)`,
  }));

  return { problems: [...added, ...stale, ...failing], lines };
};

/** The printed lines of every baselined hit of the rules `rules` selects, for a run that does not check them. */
export const ruleBaselineLinesOf = (product: ResolvedProduct, rules: (rule: string) => boolean) =>
  flatOf(readRuleBaseline(product))
    .filter(({ rule }) => rules(rule))
    .map(ruleBaselineLineOf);

/** Writes every hit of `problems` into `product`'s rule baseline under `entry`, for a new rule over existing parts. */
export const writeRuleBaseline = (options: {
  product: ResolvedProduct;
  problems: Problem[];
  entry: RuleBaselineEntry;
}) => {
  const baseline = readRuleBaseline(options.product);

  for (const problem of options.problems)
    baseline[problem.rule] = {
      ...baseline[problem.rule],
      [hitKeyOf(options.product, problem)]:
        baseline[problem.rule]?.[hitKeyOf(options.product, problem)] ?? options.entry,
    };

  const sorted = Object.fromEntries(
    Object.entries(baseline)
      .filter(([, hits]) => Object.keys(hits).length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rule, hits]) => [rule, Object.fromEntries(Object.entries(hits).sort(([a], [b]) => a.localeCompare(b)))]),
  );

  writeFileSync(ruleBaselineFileOf(options.product), `${JSON.stringify(sorted, null, 2)}\n`);
};
