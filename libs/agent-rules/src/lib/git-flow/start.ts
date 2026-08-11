import { BranchNameSpec, buildBranchName } from './build';
import { GitFlowConfig } from './config';
import { BranchParseResult, parseBranch } from './parse';

export type StartPlan = {
  branch: string;
  /** The branch to create the new one from. Absent only when `problems` says why. */
  base?: string;
  mrTargets: string[];
  parse: BranchParseResult;
  /** Empty when the plan is safe to execute; every entry is a reason to refuse. */
  problems: string[];
};

/**
 * The plan a caller must show before it writes anything: the branch name, the base to branch from
 * and the merge request target. Built through `buildBranchName` and then re-parsed, so a spec the
 * grammar cannot express — a key the project's prefixes reject, a parent that is itself
 * non-conforming — comes back as a problem instead of as a branch somebody has to delete again.
 */
export const planStart = (options: { spec: BranchNameSpec; config: GitFlowConfig }): StartPlan => {
  const { spec, config } = options;
  const branch = buildBranchName({ spec, config });
  const parse = parseBranch({ branch, config });

  const problems = [
    ...(parse.kind === spec.kind ? [] : [`"${branch}" parses as ${parse.kind}, not ${spec.kind}.`]),
    ...parse.findings.map((finding) => finding.message),
    ...(parse.expectedBase ? [] : [`"${branch}" has no base branch to branch from.`]),
  ];

  return { branch, base: parse.expectedBase, mrTargets: parse.expectedMrTargets, parse, problems };
};
