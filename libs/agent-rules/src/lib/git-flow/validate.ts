import { GitFlowConfig, GitFlowRule, GitFlowSeverity } from './config';
import { BranchParseResult, GitFlowFinding, parseBranch, stripRefPrefix } from './parse';

export type GitFlowResolvedFinding = GitFlowFinding & { severity: Exclude<GitFlowSeverity, 'off'> };

export type GitFlowReport = {
  branch: string;
  target?: string;
  parse: BranchParseResult;
  findings: GitFlowResolvedFinding[];
  ok: boolean;
  /** At least one finding resolved to `error`, so the hook or the CI job should exit non-zero. */
  blocked: boolean;
};

/**
 * `advisory` caps the *naming* rules at `warn`, because the whole naming zoo is deliberately
 * accepted during the grace period. `protected-push` and `wrong-mr-target` are not naming rules
 * and keep their configured severity in both modes — that is what lets `wrong-mr-target` be
 * promoted to `error` before the naming grace period ends.
 */
export const resolveSeverity = (options: { rule: GitFlowRule; config: GitFlowConfig }): GitFlowSeverity => {
  const { rule, config } = options;
  const configured = config.severity[rule];

  if (configured === 'off') return 'off';
  if (rule === 'protected-push' || rule === 'wrong-mr-target') return configured;

  return config.enforcement === 'gated' ? configured : 'warn';
};

const mrTargetFindings = (options: {
  parse: BranchParseResult;
  target: string;
  config: GitFlowConfig;
}): GitFlowFinding[] => {
  const { parse, target, config } = options;

  if (parse.kind === 'unknown' || parse.expectedMrTargets.includes(target)) return [];

  // A flat feature branch is how the zoo spells a sub-branch of an integration branch, and `dev-*`
  // is an integration branch under its old name — so any main feature may target any other. Tighten
  // this and the rule fires on the team's entire real workflow.
  if (parse.kind === 'main-feature' && parseBranch({ branch: target, config }).kind === 'main-feature') return [];

  const expected = parse.expectedMrTargets;

  return [
    {
      rule: 'wrong-mr-target',
      message: expected.length
        ? `A ${parse.kind} branch must merge into ${expected.join(' or ')}, not ${target}.`
        : `A ${parse.kind} branch has no merge request target.`,
      suggestion: expected[0],
    },
  ];
};

/**
 * The single place a verdict is computed — the CLI, the git hook, the CI job and timetrack all
 * call this rather than re-deriving the rules.
 */
export const validateBranch = (options: {
  branch: string;
  config: GitFlowConfig;
  target?: string;
  push?: boolean;
}): GitFlowReport => {
  const { config, push } = options;
  const branch = stripRefPrefix(options.branch);
  const target = options.target ? stripRefPrefix(options.target) : undefined;
  const parse = parseBranch({ branch, config });
  const findings = [...parse.findings];

  if (target) findings.push(...mrTargetFindings({ parse, target, config }));

  if (push && parse.kind === 'protected') {
    findings.push({
      rule: 'protected-push',
      message: `${branch} is protected — push a branch and open a merge request.`,
    });
  }

  const resolved = findings
    .map((finding) => ({ ...finding, severity: resolveSeverity({ rule: finding.rule, config }) }))
    .filter((finding): finding is GitFlowResolvedFinding => finding.severity !== 'off');

  return {
    branch,
    target,
    parse,
    findings: resolved,
    ok: resolved.length === 0,
    blocked: resolved.some((finding) => finding.severity === 'error'),
  };
};
