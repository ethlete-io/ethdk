import {
  GitFlowConfig,
  buildBranchName,
  featureBranchesFor,
  nestedSpecFor,
  planStart,
} from '@ethlete/agent-rules/git-flow';
import { ticketSubjectOf } from './draft';

/** The placeholder the branch and the title carry until Jira has filed the issue and named it. */
export const WORK_START_KEY_PLACEHOLDER = '<KEY>';

/** What the user chose in the form. Everything the flow writes is derived from this. */
export type WorkStartSpec = {
  projectKey: string;
  issueTypeName: string;
  summary: string;
  description: string;
  /**
   * The Story the new issue rolls up to. Its feature branch is what the new branch nests under, so
   * this one field decides both the Jira relation and the shape of the branch name.
   */
  parentKey?: string;
  /** The type segment of a main feature, such as `fix`. A nested branch takes its parent's. */
  type?: string;
};

/** What the repository looks like right now, read before anything is planned. */
export type WorkStartState = {
  dirty: boolean;
  localBranches: readonly string[];
  /** The remote the repository pushes to, and the branch names it holds. Absent when it has none. */
  remote?: { name: string; branches: readonly string[] };
};

export type WorkStartRefusalRule =
  | 'no-project'
  | 'no-summary'
  | 'no-issue-type'
  | 'dirty-tree'
  | 'no-shape'
  | 'parent-unknown'
  | 'parent-ambiguous'
  | 'parent-unpushed'
  | 'base-missing'
  | 'protected-target'
  | 'name-taken'
  | 'name-taken-on-remote';

export type WorkStartRefusal = { rule: WorkStartRefusalRule; message: string };

/**
 * What a step does, as data. The executor switches on this rather than on the wording of `describe`,
 * so changing how a step reads can never change what it runs.
 */
export type WorkStartAction =
  | { kind: 'create-issue'; projectKey: string; issueTypeName: string; parentKey?: string }
  | { kind: 'fetch-base'; remote: string; base: string }
  | { kind: 'create-branch'; branch: string; baseRef: string }
  | { kind: 'push'; remote: string; branch: string }
  | { kind: 'open-merge-request'; sourceBranch: string; targetBranch: string; title: string };

export type WorkStartStep = {
  action: WorkStartAction;
  /** What the step does, in one sentence. */
  describe: string;
  /** The exact command, for a step that runs locally. A Jira or GitLab call has none. */
  command?: string;
  /** The exact command, or the call, that reverses this step. A fetch writes nothing and has none. */
  undo?: string;
};

export type WorkStartPlan = {
  /** The branch name, carrying `<KEY>` until Jira supplies one. */
  branch: string;
  /** The branch the new one is created from. */
  base?: string;
  /** The ref actually branched from — the remote's copy of the base whenever it has one. */
  baseRef?: string;
  /** The branch the draft merge request targets. Absent when no merge request is opened. */
  mrTarget?: string;
  /** The merge request title, carrying `<KEY>` until Jira supplies one. */
  mrTitle?: string;
  /** The issue this plan was built for, once one exists. */
  issueKey?: string;
  steps: WorkStartStep[];
  /** Reasons nothing may run. A plan with any refusal is never executed, whatever its steps say. */
  refusals: WorkStartRefusal[];
};

/**
 * The title a draft merge request opens with. `Draft:` is the only thing that marks a GitLab merge
 * request as one, so it is part of the title rather than a flag beside it.
 */
export const draftMergeRequestTitle = (options: { issueKey: string; summary: string }) =>
  `Draft: ${options.issueKey} ${options.summary.trim()}`.trim();

/**
 * The body a draft merge request opens with: the issue it is for, and the review the branch grammar
 * expects before it merges. Kept short — everything else about the work belongs on the issue.
 */
export const draftMergeRequestBody = (options: { issueKey: string; issueUrl?: string }) =>
  [
    options.issueUrl ? `Issue: [${options.issueKey}](${options.issueUrl})` : `Issue: ${options.issueKey}`,
    '',
    'Opened as a draft. Mark it ready once it has been reviewed.',
  ].join('\n');

const branchSpecFor = (options: { spec: WorkStartSpec; key: string; parentBranch?: string; config: GitFlowConfig }) => {
  const { spec, key, parentBranch, config } = options;
  const subject = ticketSubjectOf(spec.summary);

  return parentBranch
    ? nestedSpecFor({ parent: parentBranch, key, subject, config })
    : ({ kind: 'main-feature', type: spec.type, key, subject } as const);
};

/**
 * The Story's feature branch, which a Task's branch nests under and is based on.
 *
 * A Task cannot be started before its Story has a branch, because the branch name *is* the parent
 * link — there is nothing to nest under and nothing for the merge request to target. Two candidate
 * branches are refused rather than resolved: which one the Story means is not a question the grammar
 * can answer, and putting the work on the wrong one is silent.
 */
const resolveParentBranch = (options: {
  parentKey: string;
  state: WorkStartState;
  config: GitFlowConfig;
}): { branch?: string; refusals: WorkStartRefusal[] } => {
  const { parentKey, state, config } = options;
  const matches = featureBranchesFor({
    branches: [...state.localBranches, ...(state.remote?.branches ?? [])],
    storyKey: parentKey,
    config,
  });

  if (matches.length === 0) {
    return {
      refusals: [
        {
          rule: 'parent-unknown',
          message: `${parentKey} has no feature branch. Start the Story first, or repair its branch if it exists under a name that does not carry the key.`,
        },
      ],
    };
  }

  if (matches.length > 1) {
    return {
      refusals: [
        { rule: 'parent-ambiguous', message: `${parentKey} has more than one feature branch: ${matches.join(', ')}.` },
      ],
    };
  }

  return { branch: matches[0], refusals: [] };
};

/**
 * A key shaped like a real one, for deciding whether the grammar can name this branch at all before
 * Jira has filed anything. It uses the project the issue will be filed in, so the probe is not
 * rejected by `keyPrefixes` for a reason the real key would never hit.
 */
const probeKeyFor = (projectKey: string) => `${projectKey.toUpperCase()}-0`;

const inputRefusals = (spec: WorkStartSpec): WorkStartRefusal[] => {
  const refusals: WorkStartRefusal[] = [];

  if (!spec.projectKey.trim()) {
    refusals.push({ rule: 'no-project', message: 'Name the Jira project the issue is filed in.' });
  }

  if (!spec.summary.trim()) {
    refusals.push({
      rule: 'no-summary',
      message: 'Write a summary — it is both the issue title and the branch subject.',
    });
  }

  if (!spec.issueTypeName.trim()) {
    refusals.push({ rule: 'no-issue-type', message: 'Set the issue type in Settings before filing anything.' });
  }

  return refusals;
};

const baseRefusals = (options: { nested: boolean; base: string; state: WorkStartState }): WorkStartRefusal[] => {
  const { nested, base, state } = options;
  const onRemote = !!state.remote?.branches.includes(base);

  if (nested) {
    // A sub-feature's base is its parent, which is also what its merge request targets. A parent that
    // only exists on this machine gives GitLab nothing to target, so the branch would be unreviewable.
    return onRemote
      ? []
      : [
          {
            rule: 'parent-unpushed',
            message: `${base} is not on ${state.remote?.name ?? 'any remote'}. Push the parent branch first — a sub-feature has to merge into it.`,
          },
        ];
  }

  if (onRemote || state.localBranches.includes(base)) return [];

  return [
    {
      rule: 'base-missing',
      message: `${base} exists neither locally nor on ${state.remote?.name ?? 'any remote'}.`,
    },
  ];
};

const stepsFor = (options: {
  spec: WorkStartSpec;
  branch: string;
  base: string;
  baseRef: string;
  mrTarget?: string;
  mrTitle?: string;
  issueLabel: string;
  state: WorkStartState;
}): WorkStartStep[] => {
  const { spec, branch, base, baseRef, mrTarget, mrTitle, issueLabel, state } = options;
  const remote = state.remote?.name;
  const steps: WorkStartStep[] = [
    {
      action: {
        kind: 'create-issue',
        projectKey: spec.projectKey.toUpperCase(),
        issueTypeName: spec.issueTypeName,
        ...(spec.parentKey ? { parentKey: spec.parentKey } : {}),
      },
      describe: spec.parentKey
        ? `File a ${spec.issueTypeName} in ${spec.projectKey.toUpperCase()} under ${spec.parentKey}`
        : `File a ${spec.issueTypeName} in ${spec.projectKey.toUpperCase()}`,
      undo: `delete ${issueLabel} in Jira`,
    },
  ];

  if (remote && state.remote?.branches.includes(base)) {
    steps.push({
      action: { kind: 'fetch-base', remote, base },
      describe: `Fetch ${base} from ${remote}`,
      command: `git fetch ${remote} ${base}`,
    });
  }

  steps.push({
    action: { kind: 'create-branch', branch, baseRef },
    describe: `Create ${branch} from ${baseRef} and check it out`,
    command: `git switch -c ${branch} --no-track ${baseRef}`,
    undo: `git switch - && git branch -D ${branch}`,
  });

  if (!remote) return steps;

  steps.push({
    action: { kind: 'push', remote, branch },
    describe: `Push ${branch} to ${remote}`,
    command: `git push -u ${remote} ${branch}`,
    undo: `git push ${remote} --delete ${branch}`,
  });

  if (mrTarget && mrTitle) {
    steps.push({
      action: { kind: 'open-merge-request', sourceBranch: branch, targetBranch: mrTarget, title: mrTitle },
      describe: `Open a draft merge request into ${mrTarget}, linking ${issueLabel}`,
      undo: 'close the merge request in GitLab',
    });
  }

  return steps;
};

/**
 * Works out what it takes to start a piece of work: the issue, the branch the grammar names for it,
 * and the draft merge request it will be reviewed in.
 *
 * The branch cannot be named before the issue exists, so the plan the user confirms carries `<KEY>`
 * where the key will go and the grammar is checked against a probe key for the same project. Every
 * refusal that does not need the key is therefore decided up front, and the executor asks again with
 * the real key before it creates anything local.
 *
 * The merge request is always a draft and is only planned when the remote is a GitLab project this
 * app can reach; a repository nobody reviews in GitLab still gets a correctly named branch.
 */
export const planWorkStart = (options: {
  spec: WorkStartSpec;
  config: GitFlowConfig;
  state: WorkStartState;
  /** The issue, once it has been filed. Absent while the plan is still being shown. */
  issueKey?: string;
  /** The GitLab project the remote points at, when it is the configured instance. */
  gitlabProject?: string;
}): WorkStartPlan => {
  const { spec, config, state, issueKey, gitlabProject } = options;
  const key = issueKey?.toUpperCase();
  const issueLabel = key ?? 'the new issue';
  const refusals = inputRefusals(spec);

  if (refusals.length > 0) return { branch: '', steps: [], refusals };

  const parent = spec.parentKey
    ? resolveParentBranch({ parentKey: spec.parentKey, state, config })
    : { branch: undefined, refusals: [] };

  if (parent.refusals.length > 0) return { branch: '', steps: [], refusals: parent.refusals };

  const parentBranch = parent.branch;
  const checked = planStart({
    spec: branchSpecFor({ spec, key: key ?? probeKeyFor(spec.projectKey), parentBranch, config }),
    config,
  });
  const branch = key
    ? checked.branch
    : buildBranchName({
        spec: branchSpecFor({ spec, key: WORK_START_KEY_PLACEHOLDER, parentBranch, config }),
        config,
      });
  const target = gitlabProject && state.remote ? checked.mrTargets[0] : undefined;
  const plan: WorkStartPlan = {
    branch,
    base: checked.base,
    mrTarget: target,
    ...(target
      ? { mrTitle: draftMergeRequestTitle({ issueKey: key ?? WORK_START_KEY_PLACEHOLDER, summary: spec.summary }) }
      : {}),
    ...(key ? { issueKey: key } : {}),
    steps: [],
    refusals: checked.problems.map((message) => ({ rule: 'no-shape' as const, message })),
  };

  if (state.dirty) {
    plan.refusals.push({
      rule: 'dirty-tree',
      message: 'The working tree has uncommitted changes. Commit or stash them, then start.',
    });
  }

  if (checked.mrTargets.includes(config.baseBranches.production)) {
    plan.refusals.push({
      rule: 'protected-target',
      message: `A branch started here never merges into ${config.baseBranches.production}. Start it off ${config.baseBranches.development} instead.`,
    });
  }

  if (!plan.base) return plan;

  plan.refusals.push(...baseRefusals({ nested: !!parentBranch, base: plan.base, state }));
  plan.baseRef = state.remote?.branches.includes(plan.base) ? `${state.remote.name}/${plan.base}` : plan.base;

  if (state.localBranches.includes(branch)) {
    plan.refusals.push({ rule: 'name-taken', message: `${branch} already exists locally. Switch to it instead.` });
  }

  if (state.remote?.branches.includes(branch)) {
    plan.refusals.push({ rule: 'name-taken-on-remote', message: `${branch} already exists on ${state.remote.name}.` });
  }

  plan.steps = stepsFor({
    spec,
    branch,
    base: plan.base,
    baseRef: plan.baseRef,
    mrTarget: plan.mrTarget,
    mrTitle: plan.mrTitle,
    issueLabel,
    state,
  });

  return plan;
};
