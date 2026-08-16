import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import {
  TimetrackProjectLink,
  describeProjectLink,
  matchProjectLink,
  privateTime,
  projectKeyFor,
} from './project-link';

const link = (options: Partial<TimetrackProjectLink> & Pick<TimetrackProjectLink, 'path' | 'target'>) => ({
  id: options.path,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  ...options,
});

const work = link({ path: '/home/tom/dev/ea-frontend', target: { kind: 'project', projectKey: 'FIP' } });
const secluded = link({ path: '/home/tom/dev/private', target: { kind: 'private' } });

const block = (options: { from: string; to: string }): ActivityBlock => ({
  from: new Date(options.from),
  to: new Date(options.to),
  context: {},
  evidence: [],
});

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

describe('privateTime', () => {
  it('folds every block of one link into one entry, largest first', () => {
    const other = link({ path: '/home/tom/dev/other', target: { kind: 'private' } });
    const folded = privateTime({
      blocks: [
        { block: block({ from: '2026-08-16T09:00:00Z', to: '2026-08-16T09:30:00Z' }), link: secluded },
        { block: block({ from: '2026-08-16T11:00:00Z', to: '2026-08-16T11:10:00Z' }), link: other },
        { block: block({ from: '2026-08-16T13:00:00Z', to: '2026-08-16T13:20:00Z' }), link: secluded },
      ],
    });

    expect(folded).toEqual([
      {
        link: secluded,
        observedMs: 50 * 60_000,
        from: new Date('2026-08-16T09:00:00Z'),
        to: new Date('2026-08-16T13:20:00Z'),
      },
      {
        link: other,
        observedMs: 10 * 60_000,
        from: new Date('2026-08-16T11:00:00Z'),
        to: new Date('2026-08-16T11:10:00Z'),
      },
    ]);
  });

  it('answers with nothing when the day had none', () => {
    expect(privateTime({ blocks: [] })).toEqual([]);
  });
});
