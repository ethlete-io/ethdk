import { GitFlowConfig, conformingNameFor, parseBranch } from '@ethlete/agent-rules/git-flow';

/** A merge request, reduced to what a repair plan reads and writes. */
export type RepairMergeRequest = {
  iid: string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  webUrl?: string;
};

/** What the repository looks like right now, read before anything is planned. */
export type BranchRepairState = {
  /** Uncommitted changes in the working tree. */
  dirty: boolean;
  localBranches: readonly string[];
  /** The remote the branch is pushed to, and the branch names it holds. Absent when it is unpushed. */
  remote?: { name: string; branches: readonly string[] };
  /** The open merge requests of this repository's project. */
  mergeRequests: readonly RepairMergeRequest[];
};

export type BranchRepairRefusalRule =
  | 'dirty-tree'
  | 'already-conforms'
  | 'no-shape'
  | 'branch-missing'
  | 'name-taken'
  | 'name-taken-on-remote'
  | 'protected-target';

export type BranchRepairRefusal = { rule: BranchRepairRefusalRule; message: string };

/**
 * What a step does, as data. The executor switches on this rather than on the wording of `describe`,
 * so changing how a step reads can never change what it runs.
 */
export type BranchRepairAction =
  | { kind: 'rename-local'; from: string; to: string }
  | { kind: 'push'; remote: string; branch: string }
  | { kind: 'delete-remote'; remote: string; branch: string }
  | { kind: 'retarget'; iid: string; from: string; to: string }
  | { kind: 'retitle'; iid: string; from: string; to: string };

export type BranchRepairStep = {
  action: BranchRepairAction;
  /** What the step does, in one sentence. */
  describe: string;
  /** The exact command, for a step that runs locally. A merge request call has none. */
  command?: string;
  /** The exact command, or the call, that reverses this step. */
  undo: string;
};

export type BranchRepairRetitle = {
  mergeRequest: RepairMergeRequest;
  title: string;
};

export type BranchRepairPlan = {
  branch: string;
  issueKey: string;
  /** The conforming name, or nothing when the branch keeps the one it has. */
  newName?: string;
  /**
   * Why the branch is not renamed. GitLab cannot move an open merge request to a different source
   * branch and deleting the old branch closes it, so a branch under review is retitled where it is
   * and renamed after the merge request lands.
   */
  keepsName?: 'open-merge-request';
  /** Merge requests whose title would gain the key. */
  retitle: BranchRepairRetitle[];
  /** Merge requests aimed at the old name, which have to follow it. */
  retarget: RepairMergeRequest[];
  steps: BranchRepairStep[];
  /** Reasons nothing may run. A plan with any refusal is never executed, whatever its steps say. */
  refusals: BranchRepairRefusal[];
};

/**
 * The title a merge request should carry once its work has an issue. The key goes in front and the
 * rest is kept verbatim: the title is what somebody wrote about their own work, and repair is only
 * there to make it findable by key.
 */
export const repairedMergeRequestTitle = (options: { title: string; issueKey: string }) => {
  const title = options.title.trim();
  const key = options.issueKey.toUpperCase();

  return new RegExp(`\\b${key}\\b`, 'i').test(title) ? title : `${key} ${title}`.trim();
};

const refusalsForName = (options: {
  branch: string;
  issueKey: string;
  config: GitFlowConfig;
}): { name?: string; refusals: BranchRepairRefusal[] } => {
  const { branch, issueKey, config } = options;
  const resolved = conformingNameFor({ branch, key: issueKey, config });

  if (resolved.ok) return { name: resolved.name, refusals: [] };

  if (resolved.reason === 'already-conforms') {
    return {
      refusals: [{ rule: 'already-conforms', message: `${branch} already names an issue — nothing to repair.` }],
    };
  }

  return {
    refusals: [
      {
        rule: 'no-shape',
        message: `No conforming name can be derived from ${branch}. Rename it by hand to <type>/${issueKey}-<subject>.`,
      },
    ],
  };
};

const collisionRefusals = (options: { name: string; state: BranchRepairState }): BranchRepairRefusal[] => {
  const { name, state } = options;
  const refusals: BranchRepairRefusal[] = [];

  if (state.localBranches.includes(name)) {
    refusals.push({ rule: 'name-taken', message: `${name} already exists locally.` });
  }

  if (state.remote?.branches.includes(name)) {
    refusals.push({ rule: 'name-taken-on-remote', message: `${name} already exists on ${state.remote.name}.` });
  }

  return refusals;
};

const renameSteps = (options: {
  branch: string;
  newName: string;
  state: BranchRepairState;
  retarget: RepairMergeRequest[];
}): BranchRepairStep[] => {
  const { branch, newName, state, retarget } = options;
  const steps: BranchRepairStep[] = [
    {
      action: { kind: 'rename-local', from: branch, to: newName },
      describe: `Rename ${branch} to ${newName}`,
      command: `git branch -m ${branch} ${newName}`,
      undo: `git branch -m ${newName} ${branch}`,
    },
  ];

  if (!state.remote) return steps;

  const remote = state.remote.name;

  steps.push({
    action: { kind: 'push', remote, branch: newName },
    describe: `Push ${newName} to ${remote}`,
    command: `git push -u ${remote} ${newName}`,
    undo: `git push ${remote} --delete ${newName}`,
  });

  retarget.forEach((mergeRequest) =>
    steps.push({
      action: { kind: 'retarget', iid: mergeRequest.iid, from: branch, to: newName },
      describe: `Retarget !${mergeRequest.iid} from ${branch} to ${newName}`,
      undo: `retarget !${mergeRequest.iid} back to ${branch}`,
    }),
  );

  steps.push({
    action: { kind: 'delete-remote', remote, branch },
    describe: `Delete ${branch} from ${remote}`,
    command: `git push ${remote} --delete ${branch}`,
    undo: `git push -u ${remote} ${branch}`,
  });

  return steps;
};

const retitleSteps = (retitle: BranchRepairRetitle[]): BranchRepairStep[] =>
  retitle.map((entry) => ({
    action: { kind: 'retitle', iid: entry.mergeRequest.iid, from: entry.mergeRequest.title, to: entry.title },
    describe: `Retitle !${entry.mergeRequest.iid} to "${entry.title}"`,
    undo: `set !${entry.mergeRequest.iid} back to "${entry.mergeRequest.title}"`,
  }));

/**
 * Works out what it takes to make a branch that names no issue conform, now that one exists for it.
 *
 * Two shapes come out of this. A branch nothing is reviewing is renamed, pushed under its new name,
 * and the merge requests aimed at it follow before the old name is deleted — the order the CLI's
 * `git-flow repair` uses, chosen so a failure at any step leaves the old branch and every merge
 * request intact. A branch that is itself under review keeps its name and only its merge request is
 * retitled: GitLab cannot move an open merge request to a different source branch, and deleting the
 * branch it points at closes it and loses the discussion.
 *
 * Every refusal is decided here, before a single step runs, and a plan carrying one is never
 * executed however complete its steps look.
 */
export const planBranchRepair = (options: {
  branch: string;
  issueKey: string;
  config: GitFlowConfig;
  state: BranchRepairState;
}): BranchRepairPlan => {
  const { branch, issueKey, config, state } = options;
  const { development, production } = config.baseBranches;
  const key = issueKey.toUpperCase();
  const sourcing = state.mergeRequests.filter((mergeRequest) => mergeRequest.sourceBranch === branch);
  const retitle = sourcing
    .map((mergeRequest) => ({
      mergeRequest,
      title: repairedMergeRequestTitle({ title: mergeRequest.title, issueKey: key }),
    }))
    .filter((entry) => entry.title !== entry.mergeRequest.title);

  const plan: BranchRepairPlan = { branch, issueKey: key, retitle, retarget: [], steps: [], refusals: [] };

  if (state.dirty) {
    plan.refusals.push({
      rule: 'dirty-tree',
      message: 'The working tree has uncommitted changes. Commit or stash them, then repair.',
    });
  }

  if (branch === development || branch === production) {
    plan.refusals.push({ rule: 'protected-target', message: `${branch} is a protected branch and is never repaired.` });

    return plan;
  }

  if (sourcing.length > 0) {
    plan.keepsName = 'open-merge-request';
    plan.steps = retitleSteps(retitle);

    return plan;
  }

  const { name, refusals } = refusalsForName({ branch, issueKey: key, config });

  plan.refusals.push(...refusals);

  if (!name) return plan;

  plan.newName = name;
  plan.refusals.push(...collisionRefusals({ name, state }));

  if (!state.localBranches.includes(branch)) {
    plan.refusals.push({ rule: 'branch-missing', message: `${branch} does not exist locally. Check it out first.` });
  }

  plan.retarget = state.mergeRequests.filter((mergeRequest) => mergeRequest.targetBranch === branch);
  plan.steps = [...renameSteps({ branch, newName: name, state, retarget: plan.retarget }), ...retitleSteps(retitle)];

  return plan;
};

/**
 * Whether a branch the day observed is worth offering repair for: it names no issue, and the grammar
 * can build a name for it once one exists. A branch the grammar cannot spell is left alone rather
 * than offered a repair that would refuse the moment it is opened.
 */
export const isRepairableBranch = (options: { branch: string; config: GitFlowConfig }) => {
  const { branch, config } = options;

  if (parseBranch({ branch, config }).issueKey) return false;

  const resolved = conformingNameFor({ branch, config });

  return !resolved.ok && resolved.reason === 'needs-key';
};
