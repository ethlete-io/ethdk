import { describe, expect, it } from 'vitest';
import { blockingMergeRequests, GitLabMergeRequest, parseRemoteUrl } from './gitlab';

const mergeRequest = (overrides: Partial<GitLabMergeRequest>): GitLabMergeRequest => ({
  iid: 1,
  title: 'A change',
  sourceBranch: 'feat/FIP-1-a',
  targetBranch: 'next',
  url: '',
  ...overrides,
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
