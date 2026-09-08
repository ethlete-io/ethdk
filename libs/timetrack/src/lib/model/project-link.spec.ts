import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink, describeProjectLink, matchProjectLink, projectKeyFor } from './project-link';

const link = (options: Partial<TimetrackProjectLink> & Pick<TimetrackProjectLink, 'path' | 'target'>) => ({
  id: options.path,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  ...options,
});

const work = link({ path: '/home/tom/dev/ea-frontend', target: { kind: 'project', projectKey: 'FIP' } });
const secluded = link({ path: '/home/tom/dev/private', target: { kind: 'private' } });

describe('matchProjectLink', () => {
  it('matches the repository the link names', () => {
    const context = { repoPath: '/home/tom/dev/ea-frontend' };

    expect(matchProjectLink({ context, links: [work] })).toBe(work);
  });

  it('matches a repository under a directory root', () => {
    const root = link({ path: '/home/tom/dev', target: { kind: 'project', projectKey: 'FIP' } });
    const context = { repoPath: '/home/tom/dev/ea-frontend' };

    expect(matchProjectLink({ context, links: [root] })).toBe(root);
  });

  it('reads the longest path, so one checkout escapes the root it sits in', () => {
    const root = link({ path: '/home/tom/dev', target: { kind: 'private' } });
    const context = { repoPath: '/home/tom/dev/ea-frontend' };

    expect(matchProjectLink({ context, links: [root, work] })).toBe(work);
    expect(matchProjectLink({ context, links: [work, root] })).toBe(work);
  });

  it('stops at a separator, so a root does not reach the directory beside it', () => {
    const root = link({ path: '/home/tom/dev', target: { kind: 'private' } });

    expect(matchProjectLink({ context: { repoPath: '/home/tom/dev-old/thing' }, links: [root] })).toBeUndefined();
  });

  it('ignores a trailing slash on either side', () => {
    const root = link({ path: '/home/tom/dev/', target: { kind: 'private' } });

    expect(matchProjectLink({ context: { repoPath: '/home/tom/dev/thing/' }, links: [root] })).toBe(root);
  });

  it('matches nothing for a context with no repository', () => {
    const root = link({ path: '/home/tom/dev', target: { kind: 'private' } });

    expect(matchProjectLink({ context: { appId: 'firefox' }, links: [root] })).toBeUndefined();
  });

  it('refuses a link with no path rather than reading it as every repository', () => {
    const everything = link({ path: '  ', target: { kind: 'private' } });

    expect(matchProjectLink({ context: { repoPath: '/home/tom/dev/x' }, links: [everything] })).toBeUndefined();
  });
});

describe('projectKeyFor', () => {
  it('answers the key a link names, and nothing for a private one', () => {
    expect(projectKeyFor({ context: { repoPath: '/home/tom/dev/ea-frontend' }, links: [work] })).toBe('FIP');
    expect(projectKeyFor({ context: { repoPath: '/home/tom/dev/private' }, links: [secluded] })).toBeUndefined();
  });
});

describe('describeProjectLink', () => {
  it('reads as the directory the user recognises', () => {
    expect(describeProjectLink({ path: '/home/tom/dev/ea-frontend' })).toBe('ea-frontend');
    expect(describeProjectLink({ path: '/home/tom/dev/ea-frontend/' })).toBe('ea-frontend');
  });
});
