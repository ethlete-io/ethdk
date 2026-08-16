import { DEFAULT_GIT_FLOW_CONFIG } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import {
  BranchRepairState,
  RepairMergeRequest,
  isRepairableBranch,
  planBranchRepair,
  repairedMergeRequestTitle,
} from './repair';

const config = DEFAULT_GIT_FLOW_CONFIG;

const mergeRequest = (overrides: Partial<RepairMergeRequest> = {}): RepairMergeRequest => ({
  iid: '412',
  title: 'User management',
  sourceBranch: 'feat/user-management',
  targetBranch: 'next',
  ...overrides,
});

const stateOf = (overrides: Partial<BranchRepairState> = {}): BranchRepairState => ({
  dirty: false,
  localBranches: ['next', 'feat/user-management'],
  mergeRequests: [],
  ...overrides,
});

const plan = (overrides: { branch?: string; issueKey?: string; state?: BranchRepairState } = {}) =>
  planBranchRepair({
    branch: overrides.branch ?? 'feat/user-management',
    issueKey: overrides.issueKey ?? 'FIP-2177',
    config,
    state: overrides.state ?? stateOf(),
  });

describe('repairedMergeRequestTitle', () => {
  it('puts the key in front and keeps the rest verbatim', () => {
    expect(repairedMergeRequestTitle({ title: 'User management', issueKey: 'FIP-2177' })).toBe(
      'FIP-2177 User management',
    );
  });

  it('leaves a title that already names the issue alone', () => {
    expect(repairedMergeRequestTitle({ title: 'FIP-2177 User management', issueKey: 'FIP-2177' })).toBe(
      'FIP-2177 User management',
    );
  });

  it('recognises the key wherever it sits, in any case', () => {
    expect(repairedMergeRequestTitle({ title: 'Draft: fix fip-2177 at last', issueKey: 'FIP-2177' })).toBe(
      'Draft: fix fip-2177 at last',
    );
  });

  it('does not mistake a longer key for this one', () => {
    expect(repairedMergeRequestTitle({ title: 'FIP-21770 something else', issueKey: 'FIP-2177' })).toBe(
      'FIP-2177 FIP-21770 something else',
    );
  });
});

describe('planBranchRepair', () => {
  it('renames an unpushed branch and nothing else', () => {
    const result = plan();

    expect(result.refusals).toEqual([]);
    expect(result.newName).toBe('feat/FIP-2177-user-management');
    expect(result.steps).toEqual([
      {
        action: { kind: 'rename-local', from: 'feat/user-management', to: 'feat/FIP-2177-user-management' },
        describe: 'Rename feat/user-management to feat/FIP-2177-user-management',
        command: 'git branch -m feat/user-management feat/FIP-2177-user-management',
        undo: 'git branch -m feat/FIP-2177-user-management feat/user-management',
      },
    ]);
  });

  it('pushes the new name before deleting the old one', () => {
    const result = plan({
      state: stateOf({ remote: { name: 'origin', branches: ['next', 'feat/user-management'] } }),
    });

    expect(result.steps.map((step) => step.command)).toEqual([
      'git branch -m feat/user-management feat/FIP-2177-user-management',
      'git push -u origin feat/FIP-2177-user-management',
      'git push origin --delete feat/user-management',
    ]);
  });

  it('gives every step a command that reverses it', () => {
    const result = plan({
      state: stateOf({ remote: { name: 'origin', branches: ['next', 'feat/user-management'] } }),
    });

    expect(result.steps.every((step) => !!step.undo)).toBe(true);
  });

  it('moves the merge requests aimed at the old name before the old name goes', () => {
    const result = plan({
      state: stateOf({
        remote: { name: 'origin', branches: ['next', 'feat/user-management'] },
        mergeRequests: [mergeRequest({ iid: '9', sourceBranch: 'sub/x', targetBranch: 'feat/user-management' })],
      }),
    });

    expect(result.retarget.map((request) => request.iid)).toEqual(['9']);
    expect(result.steps.map((step) => step.describe)).toEqual([
      'Rename feat/user-management to feat/FIP-2177-user-management',
      'Push feat/FIP-2177-user-management to origin',
      'Retarget !9 from feat/user-management to feat/FIP-2177-user-management',
      'Delete feat/user-management from origin',
    ]);
  });

  it('keeps the branch name and only retitles when a merge request is open on it', () => {
    const result = plan({
      state: stateOf({
        remote: { name: 'origin', branches: ['next', 'feat/user-management'] },
        mergeRequests: [mergeRequest()],
      }),
    });

    expect(result.keepsName).toBe('open-merge-request');
    expect(result.newName).toBeUndefined();
    expect(result.refusals).toEqual([]);
    expect(result.retitle).toEqual([{ mergeRequest: mergeRequest(), title: 'FIP-2177 User management' }]);
    expect(result.steps).toEqual([
      {
        action: { kind: 'retitle', iid: '412', from: 'User management', to: 'FIP-2177 User management' },
        describe: 'Retitle !412 to "FIP-2177 User management"',
        undo: 'set !412 back to "User management"',
      },
    ]);
  });

  it('plans nothing when the open merge request already names the issue', () => {
    const result = plan({
      state: stateOf({ mergeRequests: [mergeRequest({ title: 'FIP-2177 User management' })] }),
    });

    expect(result.keepsName).toBe('open-merge-request');
    expect(result.retitle).toEqual([]);
    expect(result.steps).toEqual([]);
  });

  it('refuses a dirty working tree', () => {
    const result = plan({ state: stateOf({ dirty: true }) });

    expect(result.refusals.map((refusal) => refusal.rule)).toEqual(['dirty-tree']);
  });

  it('refuses a protected branch outright', () => {
    expect(plan({ branch: 'main' }).refusals.map((refusal) => refusal.rule)).toEqual(['protected-target']);
    expect(plan({ branch: 'next' }).refusals.map((refusal) => refusal.rule)).toEqual(['protected-target']);
  });

  it('plans no steps for a protected branch, whatever else is true', () => {
    expect(plan({ branch: 'main' }).steps).toEqual([]);
  });

  it('refuses a branch that already names an issue', () => {
    const result = plan({
      branch: 'feat/FIP-1-done',
      state: stateOf({ localBranches: ['next', 'feat/FIP-1-done'] }),
    });

    expect(result.refusals.map((refusal) => refusal.rule)).toEqual(['already-conforms']);
    expect(result.steps).toEqual([]);
  });

  it('refuses a name the grammar cannot spell', () => {
    const result = plan({ branch: 'user-management', state: stateOf({ localBranches: ['user-management'] }) });

    expect(result.refusals.map((refusal) => refusal.rule)).toEqual(['no-shape']);
    expect(result.newName).toBeUndefined();
  });

  it('refuses a new name that is already taken locally', () => {
    const result = plan({
      state: stateOf({ localBranches: ['next', 'feat/user-management', 'feat/FIP-2177-user-management'] }),
    });

    expect(result.refusals.map((refusal) => refusal.rule)).toEqual(['name-taken']);
  });

  it('refuses a new name that is already taken on the remote', () => {
    const result = plan({
      state: stateOf({
        remote: { name: 'origin', branches: ['feat/FIP-2177-user-management'] },
      }),
    });

    expect(result.refusals.map((refusal) => refusal.rule)).toEqual(['name-taken-on-remote']);
  });

  it('refuses a branch it cannot find locally', () => {
    const result = plan({ state: stateOf({ localBranches: ['next'] }) });

    expect(result.refusals.map((refusal) => refusal.rule)).toEqual(['branch-missing']);
  });

  it('uppercases the key it was given', () => {
    expect(plan({ issueKey: 'fip-2177' }).newName).toBe('feat/FIP-2177-user-management');
  });
});

describe('isRepairableBranch', () => {
  it('offers a keyless branch the grammar can spell', () => {
    expect(isRepairableBranch({ branch: 'feat/user-management', config })).toBe(true);
    expect(isRepairableBranch({ branch: 'hotfix/broken-login', config })).toBe(true);
  });

  it('leaves a branch that already names an issue alone', () => {
    expect(isRepairableBranch({ branch: 'feat/FIP-1-user-management', config })).toBe(false);
  });

  it('leaves a branch whose only fault is the key case alone — no ticket is missing', () => {
    expect(isRepairableBranch({ branch: 'feat/fip-1-user-management', config })).toBe(false);
  });

  it('leaves a protected branch alone', () => {
    expect(isRepairableBranch({ branch: 'next', config })).toBe(false);
    expect(isRepairableBranch({ branch: 'main', config })).toBe(false);
  });

  it('leaves a name the grammar cannot spell alone', () => {
    expect(isRepairableBranch({ branch: 'user-management', config })).toBe(false);
    expect(isRepairableBranch({ branch: 'wip/user-management', config })).toBe(false);
  });
});
