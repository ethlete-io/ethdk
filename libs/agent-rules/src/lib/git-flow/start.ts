import { BranchNameSpec, buildBranchName } from './build';
import { GitFlowConfig } from './config';
import { BranchParseResult, parseBranch, stripRefPrefix } from './parse';

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

/**
 * The spec for a branch nesting under `parent`. Which of the two nested kinds it is follows from the
 * parent alone, so no caller has to decide it: a release branch takes fixes, anything else takes
 * sub-features.
 */
export const nestedSpecFor = (options: {
  parent: string;
  key: string;
  subject: string;
  config: GitFlowConfig;
}): BranchNameSpec => {
  const { parent, key, subject, config } = options;
  const kind = parseBranch({ branch: parent, config }).kind === 'release' ? 'release-fix' : 'sub-feature';

  return { kind, parent, key, subject };
};

/**
 * The branches a story's sub-features may nest under, out of a list of names.
 *
 * A sub-feature's parent is a branch name and not an issue, because the nested spelling keeps the
 * parent's full path inside the child's — so this, and not a Jira lookup, is what says whether a
 * Task can be started at all. A deprecated spelling is never a candidate: a child nested under a
 * name that is about to be repaired would have to be renamed with it.
 *
 * More than one match is returned rather than resolved. Which of two feature branches a story means
 * is not something a grammar can answer, and picking one would put the work on the wrong branch.
 */
export const featureBranchesFor = (options: {
  branches: readonly string[];
  storyKey: string;
  config: GitFlowConfig;
}) => {
  const { branches, config } = options;
  const storyKey = options.storyKey.toUpperCase();

  return [...new Set(branches.map(stripRefPrefix))]
    .filter((branch) => {
      const parse = parseBranch({ branch, config });

      return parse.kind === 'main-feature' && !parse.deprecated && parse.storyKey === storyKey;
    })
    .sort();
};
