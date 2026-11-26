import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockingMergeRequests, gitLabToken, GitLabMergeRequest, openMergeRequestsFor, parseRemoteUrl } from './gitlab';

const mergeRequest = (overrides: Partial<GitLabMergeRequest>): GitLabMergeRequest => ({
  iid: 1,
  title: 'A change',
  sourceBranch: 'feat/FIP-1-a',
  targetBranch: 'next',
  url: '',
  ...overrides,
});

describe('gitLabToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not fall back to a CI job token, which GitLab refuses as a private token', () => {
    vi.stubEnv('GITLAB_TOKEN', '');
    vi.stubEnv('CI_JOB_TOKEN', 'job-token');

    expect(gitLabToken()).toBeUndefined();
  });
});

describe('parseRemoteUrl', () => {
  it('reads the host and project out of every remote form in use', () => {
    expect(parseRemoteUrl('git@gitlab.example.com:group/sub/project.git')).toEqual({
      host: 'gitlab.example.com',
      project: 'group/sub/project',
    });
    expect(parseRemoteUrl('ssh://git@gitlab.example.com:2224/group/project.git')).toEqual({
      host: 'gitlab.example.com',
      project: 'group/project',
    });
    expect(parseRemoteUrl('https://gitlab.example.com/group/project.git/')).toEqual({
      host: 'gitlab.example.com',
      project: 'group/project',
    });
    expect(parseRemoteUrl('https://gitlab.example.com/group/project')).toEqual({
      host: 'gitlab.example.com',
      project: 'group/project',
    });
  });

  it('returns nothing for a remote it cannot read, so the caller can refuse', () => {
    expect(parseRemoteUrl('/tmp/some/local/repo')).toBeUndefined();
    expect(parseRemoteUrl('')).toBeUndefined();
  });
});

describe('blockingMergeRequests', () => {
  it('blocks on a merge request out of the branch and not on one into it', () => {
    const mergeRequests = [
      mergeRequest({ iid: 1, sourceBranch: 'dev-game-codes' }),
      mergeRequest({ iid: 2, targetBranch: 'dev-game-codes' }),
    ];

    expect(blockingMergeRequests({ mergeRequests, branch: 'dev-game-codes' }).map((mr) => mr.iid)).toEqual([1]);
  });
});

describe('openMergeRequestsFor', () => {
  const stubFetch = () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    return fetchMock;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('refuses to send the token to a host that is not a configured GitLab host', async () => {
    vi.stubEnv('GITLAB_HOST', 'gitlab.example.com');
    vi.stubEnv('CI_SERVER_HOST', '');
    const fetchMock = stubFetch();

    await expect(
      openMergeRequestsFor({ project: { host: 'github.com', project: 'org/repo' }, token: 'secret', branch: 'feat/x' }),
    ).rejects.toThrow(/github\.com/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls a configured GitLab host and refuses to follow redirects', async () => {
    vi.stubEnv('GITLAB_HOST', 'other.example.com, GitLab.Example.com');
    const fetchMock = stubFetch();

    await openMergeRequestsFor({
      project: { host: 'gitlab.example.com', project: 'group/project' },
      token: 'secret',
      branch: 'feat/x',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      expect.objectContaining({ redirect: 'error' }),
      expect.objectContaining({ redirect: 'error' }),
    ]);
  });

  it('accepts the GitLab instance a CI job runs on', async () => {
    vi.stubEnv('GITLAB_HOST', '');
    vi.stubEnv('CI_SERVER_HOST', 'gitlab.example.com');
    const fetchMock = stubFetch();

    await openMergeRequestsFor({
      project: { host: 'gitlab.example.com', project: 'group/project' },
      token: 'secret',
      branch: 'feat/x',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
