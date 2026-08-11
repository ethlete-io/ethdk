import { SyncConfig } from './config';
import {
  allBranches,
  currentBranch,
  defaultRemote,
  gitLoud,
  isDirty,
  localBranchExists,
  remoteBranchExists,
} from './git';
import { BranchNameSpec, GitFlowConfig, parseBranch, planStart, StartPlan } from './git-flow';
import { fetchJiraIssue, JiraIssue, resolveJiraCredentials } from './jira';
import { confirm } from './prompt';

export type StartRequest = {
  root: string;
  config: SyncConfig;
  key?: string;
  subject?: string;
  type?: string;
  parent?: string;
  hotfix: boolean;
  releaseDate?: string;
  push: boolean;
  assumeYes: boolean;
  dryRun: boolean;
};

type Resolved = { spec: BranchNameSpec; issue?: JiraIssue; subjectSource: string };

/**
 * A Task's parent Story must already have its feature branch, because that branch is what the
 * sub-feature nests under and is based on. A Story whose branch still uses a deprecated spelling
 * therefore has to be repaired before anything can nest under it — the name is the parent path.
 */
const findParentBranch = (options: { root: string; storyKey: string; config: GitFlowConfig }) => {
  const { root, storyKey, config } = options;
  const matches = allBranches(root).filter((branch) => {
    const parse = parseBranch({ branch, config });

    return parse.kind === 'main-feature' && !parse.deprecated && parse.storyKey === storyKey;
  });

  if (matches.length === 0) {
    throw new Error(
      [
        `No feature branch found for the parent story ${storyKey}.`,
        `Create it first with \`ethlete-agents git-flow start ${storyKey}\`, or pass --of <branch>.`,
        "If it exists under a deprecated name, `git-flow repair` it first — a sub-feature nests under its parent's full name.",
      ].join('\n'),
    );
  }

  if (matches.length > 1) {
    throw new Error(`${storyKey} has more than one feature branch: ${matches.join(', ')}. Pass --of <branch>.`);
  }

  return matches[0] as string;
};

const specForParent = (options: { parent: string; key: string; subject: string; config: GitFlowConfig }) => {
  const { parent, key, subject, config } = options;
  const kind = parseBranch({ branch: parent, config }).kind === 'release' ? 'release-fix' : 'sub-feature';

  return { kind, parent, key, subject } as BranchNameSpec;
};

const resolveSubject = (options: { issue: JiraIssue; settings: SyncConfig['jira'] }) => {
  const { issue, settings } = options;

  if (issue.subject) return { subject: issue.subject, subjectSource: `${settings.subjectField}` };

  return {
    subject: issue.summary,
    subjectSource: settings.subjectField
      ? `the summary — ${settings.subjectField} is empty on ${issue.key}`
      : 'the summary — set jira.subjectField to use the story subject field instead',
  };
};

const resolve = async (request: StartRequest): Promise<Resolved> => {
  const { root, config, subject, type, parent, hotfix, releaseDate } = request;

  if (releaseDate) return { spec: { kind: 'release', date: releaseDate }, subjectSource: '—' };

  if (!request.key) throw new Error('Pass an issue key, e.g. `git-flow start FIP-2177`.');

  const key = request.key.toUpperCase();

  if (subject) {
    if (hotfix) return { spec: { kind: 'hotfix', key, subject }, subjectSource: '--subject' };

    if (parent) {
      return { spec: specForParent({ parent, key, subject, config: config.gitFlow }), subjectSource: '--subject' };
    }

    return { spec: { kind: 'main-feature', type, key, subject }, subjectSource: '--subject' };
  }

  const issue = await fetchJiraIssue({
    key,
    credentials: resolveJiraCredentials({ root, settings: config.jira }),
    settings: config.jira,
  });
  const resolvedSubject = resolveSubject({ issue, settings: config.jira });
  const resolvedType = type ?? config.jira.typeByIssueType?.[issue.issueType];
  const shared = { key, subject: resolvedSubject.subject };

  if (hotfix) return { spec: { kind: 'hotfix', ...shared }, issue, subjectSource: resolvedSubject.subjectSource };

  const parentBranch =
    parent ??
    (issue.parentKey ? findParentBranch({ root, storyKey: issue.parentKey, config: config.gitFlow }) : undefined);

  if (parentBranch) {
    return {
      spec: specForParent({ parent: parentBranch, ...shared, config: config.gitFlow }),
      issue,
      subjectSource: resolvedSubject.subjectSource,
    };
  }

  return {
    spec: { kind: 'main-feature', type: resolvedType, ...shared },
    issue,
    subjectSource: resolvedSubject.subjectSource,
  };
};

const describePlan = (options: { plan: StartPlan; resolved: Resolved; baseRef: string }) => {
  const { plan, baseRef } = options;
  const { issue, spec, subjectSource } = options.resolved;
  const lines = [`  branch    ${plan.branch}`, `  from      ${baseRef}`, `  merges to ${plan.mrTargets.join(' or ')}`];

  if (issue) lines.unshift(`  issue     ${issue.key}  ${issue.issueType}${issue.summary ? ` — ${issue.summary}` : ''}`);
  if (spec.kind !== 'release') lines.push(`  subject   from ${subjectSource}`);

  return lines;
};

/**
 * The prospective flow: an issue key in, a correctly named branch off the correct base out. Shares
 * `planStart` with `@ethlete/timetrack`'s ticket → branch flow, so the two cannot name a branch
 * differently.
 */
export const gitFlowStart = async (request: StartRequest) => {
  const { root, config, push, dryRun } = request;
  const resolved = await resolve(request);
  const plan = planStart({ spec: resolved.spec, config: config.gitFlow });

  if (plan.problems.length > 0) {
    console.error(`Cannot name a conforming branch for this issue:`);
    plan.problems.forEach((problem) => console.error(`  ${problem}`));

    return 1;
  }

  const base = plan.base as string;
  const remote = defaultRemote(root);
  const baseOnRemote = remote ? remoteBranchExists({ root, remote, branch: base }) : false;
  const baseRef = baseOnRemote ? `${remote}/${base}` : base;

  console.log(`Plan`);
  describePlan({ plan, resolved, baseRef }).forEach((line) => console.log(line));

  if (localBranchExists({ root, branch: plan.branch })) {
    console.error(`\n${plan.branch} already exists — \`git switch ${plan.branch}\`.`);

    return 1;
  }

  if (!baseOnRemote && !localBranchExists({ root, branch: base })) {
    console.error(`\nThe base branch ${base} exists neither locally nor on ${remote ?? 'any remote'}.`);

    return 1;
  }

  if (isDirty(root)) {
    console.error('\nThe working tree has uncommitted changes — commit or stash them first.');

    return 1;
  }

  if (dryRun) {
    console.log('\nDry run — nothing was created.');

    return 0;
  }

  if (!(await confirm({ question: `\nCreate ${plan.branch} from ${baseRef}?`, assumeYes: request.assumeYes }))) {
    console.log('Nothing was created.');

    return 1;
  }

  if (remote && baseOnRemote) gitLoud({ root, args: ['fetch', remote, base] });

  gitLoud({ root, args: ['switch', '-c', plan.branch, '--no-track', baseRef] });

  if (push && remote) gitLoud({ root, args: ['push', '-u', remote, plan.branch] });

  console.log(`\nOn ${currentBranch(root)}. Open the merge request against ${plan.mrTargets[0]}.`);

  return 0;
};
