import { describe, expect, it } from 'vitest';
import { E2E_ISSUE_BRANCH, E2E_KEYLESS_BRANCH, E2E_PROJECT_PATH, createFakeWorld } from '../world';
import { respondGitLab } from './gitlab';
import { FakeBackend, FakeGitLabMergeRequest } from './types';

const PROJECT = encodeURIComponent(E2E_PROJECT_PATH);

const backendOf = (seed: Parameters<typeof createFakeWorld>[0] = {}) => createFakeWorld(seed).backend;

const call = (options: {
  backend: FakeBackend;
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}) =>
  respondGitLab(options.backend, {
    method: options.method,
    path: `/api/v4${options.path}`,
    query: new URLSearchParams(options.query ?? {}),
    body: options.body,
  });

const openMergeRequest = (part: Partial<FakeGitLabMergeRequest> = {}): FakeGitLabMergeRequest => ({
  iid: '7',
  projectId: E2E_PROJECT_PATH,
  title: 'Invite a member by email',
  sourceBranch: E2E_ISSUE_BRANCH,
  targetBranch: 'next',
  state: 'opened',
  webUrl: `https://gitlab.example.com/${E2E_PROJECT_PATH}/-/merge_requests/7`,
  ...part,
});

type MergeRequestResource = { iid: string; title: string; target_branch: string; references: { full: string } };

const listOf = (body: unknown) => body as MergeRequestResource[];

describe('respondGitLab', () => {
  it('answers every list with an empty next page header, so paging stops', () => {
    const answer = call({ backend: backendOf(), method: 'GET', path: `/projects/${PROJECT}/merge_requests` });

    expect(answer.headers).toEqual({ 'x-next-page': '' });
  });

  it('names the project and the iid the way the app reads a reference', () => {
    const backend = backendOf({ gitlab: { mergeRequests: [openMergeRequest()] } });

    const answer = call({ backend, method: 'GET', path: `/projects/${PROJECT}/merge_requests` });

    expect(listOf(answer.body)[0]?.references.full).toBe(`${E2E_PROJECT_PATH}!7`);
  });

  it('filters a merge request list by state, source branch and target branch', () => {
    const backend = backendOf({
      gitlab: {
        mergeRequests: [
          openMergeRequest({ iid: '1' }),
          openMergeRequest({ iid: '2', sourceBranch: E2E_KEYLESS_BRANCH }),
          openMergeRequest({ iid: '3', state: 'merged' }),
          openMergeRequest({ iid: '4', targetBranch: 'main' }),
        ],
      },
    });

    const iidsFor = (query: Record<string, string>) =>
      listOf(call({ backend, method: 'GET', path: `/projects/${PROJECT}/merge_requests`, query }).body).map(
        (one) => one.iid,
      );

    expect(iidsFor({ state: 'opened' })).toEqual(['1', '2', '4']);
    expect(iidsFor({ source_branch: E2E_KEYLESS_BRANCH })).toEqual(['2']);
    expect(iidsFor({ target_branch: 'next' })).toEqual(['1', '2', '3']);
  });

  it('opens a merge request the next list returns', () => {
    const backend = backendOf();

    const answer = call({
      backend,
      method: 'POST',
      path: `/projects/${PROJECT}/merge_requests`,
      body: { source_branch: E2E_KEYLESS_BRANCH, target_branch: 'next', title: 'Try pdfkit' },
    });

    expect(answer.status).toBe(201);
    expect(backend.gitlab.created.map((one) => one.iid)).toEqual(['42']);

    const listed = call({ backend, method: 'GET', path: `/projects/${PROJECT}/merge_requests` });

    expect(listOf(listed.body).map((one) => one.title)).toEqual(['Try pdfkit']);
  });

  it('numbers opened merge requests from 42 upwards, so a spec can name the iid it will get', () => {
    const backend = backendOf();
    const open = (sourceBranch: string) =>
      call({
        backend,
        method: 'POST',
        path: `/projects/${PROJECT}/merge_requests`,
        body: { source_branch: sourceBranch },
      });

    open('one');
    open('two');

    expect(backend.gitlab.created.map((one) => one.iid)).toEqual(['42', '43']);
  });

  it('refuses to open a merge request with no source branch', () => {
    const backend = backendOf();

    const answer = call({ backend, method: 'POST', path: `/projects/${PROJECT}/merge_requests`, body: { title: 'x' } });

    expect(answer.status).toBe(400);
    expect(backend.gitlab.created).toEqual([]);
  });

  it('changes the title and the target branch, and records what changed', () => {
    const backend = backendOf({ gitlab: { mergeRequests: [openMergeRequest()] } });

    const answer = call({
      backend,
      method: 'PUT',
      path: `/projects/${PROJECT}/merge_requests/7`,
      body: { title: 'feat(users): Invite a member', target_branch: 'main' },
    });

    expect(answer.status).toBe(200);
    expect(backend.gitlab.mergeRequests[0]).toMatchObject({
      title: 'feat(users): Invite a member',
      targetBranch: 'main',
    });
    expect(backend.gitlab.updates).toEqual([{ iid: '7', title: 'feat(users): Invite a member', targetBranch: 'main' }]);
  });

  it('leaves a field the update does not name alone', () => {
    const backend = backendOf({ gitlab: { mergeRequests: [openMergeRequest()] } });

    call({ backend, method: 'PUT', path: `/projects/${PROJECT}/merge_requests/7`, body: { title: 'Renamed' } });

    expect(backend.gitlab.mergeRequests[0]?.targetBranch).toBe('next');
  });

  it('refuses an update to a merge request it does not hold', () => {
    const backend = backendOf();

    expect(call({ backend, method: 'PUT', path: `/projects/${PROJECT}/merge_requests/7`, body: {} }).status).toBe(404);
    expect(backend.gitlab.updates).toEqual([]);
  });

  it('reads one merge request by its iid', () => {
    const backend = backendOf({ gitlab: { mergeRequests: [openMergeRequest()] } });

    const answer = call({ backend, method: 'GET', path: `/projects/${PROJECT}/merge_requests/7` });

    expect(answer.status).toBe(200);
    expect((answer.body as MergeRequestResource).iid).toBe('7');
  });

  it('reads the events between the two days the window names, and neither of them', () => {
    const backend = backendOf({
      gitlab: {
        events: [
          { id: '1', at: '2026-08-11T09:00:00.000Z', actionName: 'pushed to', projectId: E2E_PROJECT_PATH },
          { id: '2', at: '2026-08-12T09:00:00.000Z', actionName: 'pushed to', projectId: E2E_PROJECT_PATH },
          { id: '3', at: '2026-08-13T09:00:00.000Z', actionName: 'pushed to', projectId: E2E_PROJECT_PATH },
        ],
      },
    });

    const answer = call({
      backend,
      method: 'GET',
      path: '/events',
      query: { after: '2026-08-11', before: '2026-08-13' },
    });

    expect((answer.body as { id: string }[]).map((one) => one.id)).toEqual(['2']);
  });

  it('reports a push event with its branch and its commit title', () => {
    const backend = backendOf({
      gitlab: {
        events: [
          {
            id: '1',
            at: '2026-08-12T09:00:00.000Z',
            actionName: 'pushed to',
            projectId: E2E_PROJECT_PATH,
            branch: E2E_ISSUE_BRANCH,
            commitTitle: 'feat(users): Invite a member by email',
          },
        ],
      },
    });

    const answer = call({ backend, method: 'GET', path: '/events' });

    expect((answer.body as { push_data: unknown }[])[0]?.push_data).toEqual({
      ref_type: 'branch',
      ref: E2E_ISSUE_BRANCH,
      commit_title: 'feat(users): Invite a member by email',
    });
  });

  it('answers 404 for a GitLab path it does not route', () => {
    expect(call({ backend: backendOf(), method: 'GET', path: `/projects/${PROJECT}/pipelines` }).status).toBe(404);
  });
});
