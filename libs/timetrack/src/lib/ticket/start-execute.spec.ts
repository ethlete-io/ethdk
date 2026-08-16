import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { Observable, firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ProcessResult, ProcessSpec, TimetrackRequest, TimetrackResponse } from '../transport/ports';
import { WorkStartContext, WorkStartRequest, executeWorkStart$ } from './start-execute';
import { WorkStartSpec, WorkStartState } from './start';

const config = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });

const specOf = (overrides: Partial<WorkStartSpec> = {}): WorkStartSpec => ({
  projectKey: 'FIP',
  issueTypeName: 'Task',
  summary: 'Logout confirmation',
  description: 'Ask before logging out.',
  type: 'feat',
  ...overrides,
});

const stateOf = (overrides: Partial<WorkStartState> = {}): WorkStartState => ({
  dirty: false,
  localBranches: ['next', 'feat/FIP-2177-user-management'],
  remote: { name: 'origin', branches: ['next', 'feat/FIP-2177-user-management'] },
  ...overrides,
});

const requestOf = (
  options: { spec?: Partial<WorkStartSpec>; state?: Partial<WorkStartState> } = {},
): WorkStartRequest => ({
  spec: specOf(options.spec),
  config,
  state: stateOf(options.state),
  gitlabProject: 'braune-digital/fut-frontend',
});

type Recorded = { git: string[][]; requests: TimetrackRequest[] };

const contextOf = (options: { failOn?: string; issueKey?: string; jira?: boolean; gitlab?: boolean } = {}) => {
  const recorded: Recorded = { git: [], requests: [] };
  const context: WorkStartContext = {
    repoPath: '/repo',
    jira: options.jira === false ? null : { host: 'https://jira.test', email: 'a@b.c', token: 't' },
    gitlab: options.gitlab === false ? null : { host: 'https://gitlab.test', token: 't' },
    processes: {
      run$: (spec: ProcessSpec): Observable<ProcessResult> => {
        recorded.git.push(spec.args);

        return of(
          options.failOn && spec.args.join(' ').includes(options.failOn)
            ? { code: 1, stdout: '', stderr: 'remote rejected' }
            : { code: 0, stdout: '', stderr: '' },
        );
      },
    },
    transport: {
      request$: <T>(request: TimetrackRequest): Observable<TimetrackResponse<T>> => {
        recorded.requests.push(request);

        const body = request.url.includes('/rest/api/3/issue')
          ? { id: '1', key: options.issueKey ?? 'FIP-2412' }
          : { iid: 12, web_url: 'https://gitlab.test/mr/12' };

        return of({ status: 200, headers: {}, body: body as T });
      },
    },
  };

  return { context, recorded };
};

describe('executeWorkStart$', () => {
  it('files the issue, then names the branch with the key it returned', async () => {
    const { context, recorded } = contextOf();
    const outcome = await firstValueFrom(executeWorkStart$({ request: requestOf(), context }));

    expect(outcome.failed).toBeUndefined();
    expect(outcome.issueKey).toBe('FIP-2412');
    expect(outcome.branch).toBe('feat/FIP-2412-logout-confirmation');
    expect(recorded.git).toEqual([
      ['fetch', 'origin', 'next'],
      ['switch', '-c', 'feat/FIP-2412-logout-confirmation', '--no-track', 'origin/next'],
      ['push', '-u', 'origin', 'feat/FIP-2412-logout-confirmation'],
    ]);
  });

  it('opens the merge request as a draft, linking the issue', async () => {
    const { context, recorded } = contextOf();
    const outcome = await firstValueFrom(executeWorkStart$({ request: requestOf(), context }));
    const opened = recorded.requests.find(
      (request) => request.method === 'POST' && request.url.includes('merge_requests'),
    );
    const body = opened?.body as Record<string, unknown>;

    expect(body['title']).toBe('Draft: FIP-2412 Logout confirmation');
    expect(body['target_branch']).toBe('next');
    expect(body['remove_source_branch']).toBe(true);
    expect(String(body['description'])).toContain('https://jira.test/browse/FIP-2412');
    expect(outcome.mergeRequestUrl).toBe('https://gitlab.test/mr/12');
  });

  it('shows no undo after a clean run', async () => {
    const { context } = contextOf();
    const outcome = await firstValueFrom(executeWorkStart$({ request: requestOf(), context }));

    expect(outcome.undo).toEqual([]);
    expect(outcome.completed).toHaveLength(5);
  });

  it('stops at the first failure and reports what puts back the rest', async () => {
    const { context, recorded } = contextOf({ failOn: 'push' });
    const outcome = await firstValueFrom(executeWorkStart$({ request: requestOf(), context }));

    expect(outcome.failed?.step?.action.kind).toBe('push');
    expect(outcome.undo).toEqual([
      'git switch - && git branch -D feat/FIP-2412-logout-confirmation',
      'delete FIP-2412 in Jira',
    ]);
    expect(recorded.git.some((args) => args[0] === 'push')).toBe(true);
    expect(recorded.requests.some((request) => request.url.includes('merge_requests'))).toBe(false);
  });

  it('keeps the filed issue in the outcome when a later step fails', async () => {
    const { context } = contextOf({ failOn: 'switch' });
    const outcome = await firstValueFrom(executeWorkStart$({ request: requestOf(), context }));

    expect(outcome.issueKey).toBe('FIP-2412');
    expect(outcome.failed?.step?.action.kind).toBe('create-branch');
  });

  it('stops with nothing local touched when the key it gets back collides', async () => {
    const { context, recorded } = contextOf({ issueKey: 'FIP-2412' });
    const request = requestOf({ state: { localBranches: ['next', 'feat/FIP-2412-logout-confirmation'] } });
    const outcome = await firstValueFrom(executeWorkStart$({ request, context }));

    expect(outcome.issueKey).toBe('FIP-2412');
    expect(outcome.failed?.message).toContain('already exists locally');
    expect(recorded.git).toEqual([]);
    expect(outcome.undo).toEqual(['delete FIP-2412 in Jira']);
  });

  it('runs nothing at all when the shown plan already refuses', async () => {
    const { context, recorded } = contextOf();
    const outcome = await firstValueFrom(
      executeWorkStart$({ request: requestOf({ state: { dirty: true } }), context }),
    );

    expect(outcome.failed?.message).toContain('uncommitted changes');
    expect(recorded.requests).toEqual([]);
    expect(recorded.git).toEqual([]);
  });

  it('files nothing without Jira credentials', async () => {
    const { context, recorded } = contextOf({ jira: false });
    const outcome = await firstValueFrom(executeWorkStart$({ request: requestOf(), context }));

    expect(outcome.failed?.message).toContain('Jira needs a host');
    expect(recorded.requests).toEqual([]);
  });
});
