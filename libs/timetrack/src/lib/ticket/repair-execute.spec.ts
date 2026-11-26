import { DEFAULT_GIT_FLOW_CONFIG } from '@ethlete/agent-rules/git-flow';
import { Observable, firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ProcessResult, ProcessSpec } from '../transport/ports';
import { BranchRepairContext, executeBranchRepair$ } from './repair-execute';
import { BranchRepairState, planBranchRepair } from './repair';

const config = DEFAULT_GIT_FLOW_CONFIG;

const stateOf = (overrides: Partial<BranchRepairState> = {}): BranchRepairState => ({
  dirty: false,
  localBranches: ['next', 'feat/user-management'],
  remote: { name: 'origin', branches: ['next', 'feat/user-management'] },
  mergeRequests: [],
  ...overrides,
});

const planFor = (state: BranchRepairState) =>
  planBranchRepair({ branch: 'feat/user-management', issueKey: 'FIP-2177', config, state });

type GlabCall = { method: string; endpoint: string; body: unknown };

type Recorded = { git: string[][]; requests: GlabCall[] };

const glabCallOf = (spec: ProcessSpec): GlabCall => ({
  method: spec.args[spec.args.indexOf('--method') + 1] ?? 'GET',
  endpoint: spec.args.at(-1) ?? '',
  body: spec.stdin === undefined ? undefined : JSON.parse(spec.stdin),
});

const contextOf = (options: { failOn?: string; gitlab?: boolean } = {}) => {
  const recorded: Recorded = { git: [], requests: [] };
  const context: BranchRepairContext = {
    repoPath: '/repo',
    projectId: options.gitlab === false ? undefined : '77',
    gitlabHostname: options.gitlab === false ? undefined : 'gitlab.test',
    processes: {
      run$: (spec: ProcessSpec): Observable<ProcessResult> => {
        if (spec.command === 'glab') {
          recorded.requests.push(glabCallOf(spec));

          return of(
            options.failOn === 'merge_requests'
              ? { code: 1, stdout: '{"message":"conflict"}', stderr: 'glab: 409 Conflict (HTTP 409)' }
              : { code: 0, stdout: '{}', stderr: '' },
          );
        }

        recorded.git.push(spec.args);

        return of(
          options.failOn && spec.args.join(' ').includes(options.failOn)
            ? { code: 1, stdout: '', stderr: 'remote rejected' }
            : { code: 0, stdout: '', stderr: '' },
        );
      },
    },
  };

  return { context, recorded };
};

describe('executeBranchRepair$', () => {
  it('runs the rename, the push and the delete in the planned order', async () => {
    const { context, recorded } = contextOf();
    const outcome = await firstValueFrom(executeBranchRepair$({ plan: planFor(stateOf()), context }));

    expect(outcome.failed).toBeUndefined();
    expect(outcome.completed).toHaveLength(3);
    expect(recorded.git).toEqual([
      ['branch', '-m', 'feat/user-management', 'feat/FIP-2177-user-management'],
      ['push', '-u', 'origin', 'feat/FIP-2177-user-management'],
      ['push', 'origin', '--delete', 'feat/user-management'],
    ]);
  });

  it('shows no undo after a clean run', async () => {
    const { context } = contextOf();
    const outcome = await firstValueFrom(executeBranchRepair$({ plan: planFor(stateOf()), context }));

    expect(outcome.undo).toEqual([]);
  });

  it('stops at the first failure and never runs the steps after it', async () => {
    const { context, recorded } = contextOf({ failOn: 'push -u' });
    const outcome = await firstValueFrom(executeBranchRepair$({ plan: planFor(stateOf()), context }));

    expect(outcome.failed?.step?.describe).toBe('Push feat/FIP-2177-user-management to origin');
    expect(outcome.failed?.message).toBe('remote rejected');
    expect(recorded.git).toHaveLength(2);
  });

  it('reports the undo for what did run, newest first', async () => {
    const { context } = contextOf({ failOn: 'push -u' });
    const outcome = await firstValueFrom(executeBranchRepair$({ plan: planFor(stateOf()), context }));

    expect(outcome.completed.map((step) => step.describe)).toEqual([
      'Rename feat/user-management to feat/FIP-2177-user-management',
    ]);
    expect(outcome.undo).toEqual(['git branch -m feat/FIP-2177-user-management feat/user-management']);
  });

  it('retargets a merge request through glab, not through git', async () => {
    const { context, recorded } = contextOf();
    const plan = planFor(
      stateOf({
        mergeRequests: [{ iid: '9', title: 'Child', sourceBranch: 'sub/x', targetBranch: 'feat/user-management' }],
      }),
    );
    const outcome = await firstValueFrom(executeBranchRepair$({ plan, context }));

    expect(outcome.failed).toBeUndefined();
    expect(recorded.requests).toHaveLength(1);
    expect(recorded.requests[0]?.method).toBe('PUT');
    expect(recorded.requests[0]?.endpoint).toBe('projects/77/merge_requests/9');
    expect(recorded.requests[0]?.body).toEqual({ target_branch: 'feat/FIP-2177-user-management' });
  });

  it('retitles the merge request that pins the branch name', async () => {
    const { context, recorded } = contextOf();
    const plan = planFor(
      stateOf({
        mergeRequests: [
          { iid: '412', title: 'User management', sourceBranch: 'feat/user-management', targetBranch: 'next' },
        ],
      }),
    );
    const outcome = await firstValueFrom(executeBranchRepair$({ plan, context }));

    expect(outcome.failed).toBeUndefined();
    expect(recorded.git).toEqual([]);
    expect(recorded.requests[0]?.body).toEqual({ title: 'FIP-2177 User management' });
  });

  it('runs nothing at all when the plan carries a refusal', async () => {
    const { context, recorded } = contextOf();
    const outcome = await firstValueFrom(executeBranchRepair$({ plan: planFor(stateOf({ dirty: true })), context }));

    expect(outcome.completed).toEqual([]);
    expect(outcome.failed?.step).toBeUndefined();
    expect(outcome.failed?.message).toContain('uncommitted changes');
    expect(recorded.git).toEqual([]);
    expect(recorded.requests).toEqual([]);
  });

  it('fails a merge request step rather than skipping it when GitLab is not configured', async () => {
    const { context } = contextOf({ gitlab: false });
    const plan = planFor(
      stateOf({
        mergeRequests: [
          { iid: '412', title: 'User management', sourceBranch: 'feat/user-management', targetBranch: 'next' },
        ],
      }),
    );
    const outcome = await firstValueFrom(executeBranchRepair$({ plan, context }));

    expect(outcome.failed?.message).toContain('GitLab needs an instance');
    expect(outcome.completed).toEqual([]);
  });

  it('reports what GitLab said when it refuses a merge request change', async () => {
    const { context } = contextOf({ failOn: 'merge_requests' });
    const plan = planFor(
      stateOf({
        mergeRequests: [{ iid: '9', title: 'Child', sourceBranch: 'sub/x', targetBranch: 'feat/user-management' }],
      }),
    );
    const outcome = await firstValueFrom(executeBranchRepair$({ plan, context }));

    expect(outcome.failed?.message).toContain('409');
    expect(outcome.failed?.message).toContain('conflict');
  });
});
