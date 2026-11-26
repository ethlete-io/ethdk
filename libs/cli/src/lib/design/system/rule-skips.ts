/**
 * A rule that did not run for a product. `missing-input` means the rule applies but an input it needs (a base ref, a
 * tool, a file) was absent, so it is blind; `not-applicable` means the product does not use what the rule checks.
 */
export type RuleSkip = {
  rule: string;
  product: string;
  kind: 'missing-input' | 'not-applicable';
  reason: string;
};

let collected: RuleSkip[] | null = null;

/** Records that `skip.rule` did not run; a no-op outside {@link collectingSkips}. */
export const skipRule = (skip: RuleSkip) => {
  collected?.push(skip);
};

/** Runs `run` and returns its result with every distinct skip the rules recorded meanwhile. */
export const collectingSkips = <T>(run: () => T): { result: T; skips: RuleSkip[] } => {
  const outer = collected;
  const own: RuleSkip[] = [];

  collected = own;

  try {
    return { result: run(), skips: distinct(own) };
  } finally {
    collected = outer;
    outer?.push(...own);
  }
};

const distinct = (skips: RuleSkip[]) => [
  ...new Map(skips.map((skip) => [`${skip.product}\0${skip.rule}\0${skip.kind}\0${skip.reason}`, skip])).values(),
];

export const isCiEnv = (env: NodeJS.ProcessEnv = process.env) => {
  const ci = env['CI'];

  return !!ci && ci !== 'false' && ci !== '0';
};

export const isFailingSkip = (skip: RuleSkip, ci: boolean) => ci && skip.kind === 'missing-input';

export const skipLineOf = (skip: RuleSkip, ci: boolean) =>
  `${isFailingSkip(skip, ci) ? 'SKIPPED' : 'skipped'} ${skip.rule} for ${skip.product}: ${skip.reason}${
    isFailingSkip(skip, ci) ? ' - a rule may not skip on a missing input under CI' : ''
  }`;
