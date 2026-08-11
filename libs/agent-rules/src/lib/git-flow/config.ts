/**
 * The branch grammar as data: one config drives the parser, the validators, the CLI, the generated
 * skill and `@ethlete/timetrack`'s correlation engine.
 *
 * Nothing in this folder may import `fs`, `path` or `process`, or take a dependency — it is
 * reachable as `@ethlete/agent-rules/git-flow` and gets bundled into a browser webview.
 */

export const GIT_FLOW_RULES = [
  'unknown-type',
  'missing-key',
  'key-case',
  'missing-subject',
  'type-alias',
  'deprecated-prefix',
  'release-date',
  'wrong-mr-target',
  'protected-push',
] as const;

export type GitFlowRule = (typeof GIT_FLOW_RULES)[number];

export type GitFlowSeverity = 'off' | 'warn' | 'error';

export type GitFlowEnforcement = 'advisory' | 'gated';

export type GitFlowBranchKind =
  'main-feature' | 'sub-feature' | 'release' | 'release-fix' | 'hotfix' | 'protected' | 'unknown';

/**
 * A legacy spelling that means one of the known kinds. `match` is a regular expression whose
 * `subject` and `key` named groups feed `renameTo`, in which `<subject>` and `<KEY>` are the
 * placeholders — an unresolved `<KEY>` is left in place, because only Jira can supply it.
 */
export type GitFlowDeprecatedShape = {
  match: string;
  kind: GitFlowBranchKind;
  renameTo: string;
};

export type GitFlowConfig = {
  enforcement: GitFlowEnforcement;
  keyPattern: string;
  /**
   * Project prefixes a key may use, e.g. `["FIP"]`. Empty accepts anything `keyPattern` matches,
   * which also accepts `chore/angular-22` as issue ANGULAR-22 — set this in any repo whose
   * branch subjects can start with a word followed by a number.
   */
  keyPrefixes: string[];
  baseBranches: { development: string; production: string };
  types: string[];
  typeAliases: Record<string, string>;
  releasePrefix: string;
  releasePattern: string;
  hotfixPrefix: string;
  subjectCase: 'kebab';
  deprecatedShapes: GitFlowDeprecatedShape[];
  severity: Record<GitFlowRule, GitFlowSeverity>;
};

export const DEFAULT_GIT_FLOW_CONFIG: GitFlowConfig = {
  enforcement: 'advisory',
  keyPattern: '[A-Z]{2,10}-\\d+',
  keyPrefixes: [],
  baseBranches: { development: 'next', production: 'main' },
  types: ['feat', 'fix', 'refactor', 'chore', 'docs', 'perf', 'test', 'style', 'build', 'ci'],
  typeAliases: { feature: 'feat', bugfix: 'fix' },
  releasePrefix: 'release',
  releasePattern: '\\d{4}\\.\\d{2}\\.\\d{2}',
  hotfixPrefix: 'hotfix',
  subjectCase: 'kebab',
  deprecatedShapes: [{ match: '^dev-(?<subject>.+)$', kind: 'main-feature', renameTo: 'feat/<KEY>-<subject>' }],
  severity: {
    'unknown-type': 'warn',
    'missing-key': 'warn',
    'key-case': 'warn',
    'missing-subject': 'warn',
    'type-alias': 'warn',
    'deprecated-prefix': 'warn',
    'release-date': 'warn',
    'wrong-mr-target': 'warn',
    'protected-push': 'error',
  },
};

export type RawGitFlowConfig = Partial<Omit<GitFlowConfig, 'baseBranches' | 'typeAliases' | 'severity'>> & {
  baseBranches?: Partial<GitFlowConfig['baseBranches']>;
  typeAliases?: Record<string, string>;
  severity?: Partial<Record<GitFlowRule, GitFlowSeverity>>;
};

/** Fills a repo's `gitFlow` config block out to a complete grammar. */
export const resolveGitFlowConfig = (raw?: RawGitFlowConfig): GitFlowConfig => ({
  ...DEFAULT_GIT_FLOW_CONFIG,
  ...raw,
  baseBranches: { ...DEFAULT_GIT_FLOW_CONFIG.baseBranches, ...raw?.baseBranches },
  typeAliases: { ...DEFAULT_GIT_FLOW_CONFIG.typeAliases, ...raw?.typeAliases },
  severity: { ...DEFAULT_GIT_FLOW_CONFIG.severity, ...raw?.severity },
});
