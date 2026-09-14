import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../model/project-link';
import { TimetrackFavoriteProject } from './model';
import { projectPathRows, repoProjectRows, suggestProjectForRepo } from './repo-project';

const PROJECTS: TimetrackFavoriteProject[] = [
  { key: 'ABC', name: 'Alpha Platform' },
  { key: 'DEF', name: 'Delta Shop' },
];

const link = (overrides: Partial<TimetrackProjectLink>): TimetrackProjectLink => ({
  id: 'link-1',
  path: '/home/you/dev/abc-frontend',
  target: { kind: 'project', projectKey: 'ABC' },
  createdAt: new Date(0),
  ...overrides,
});

describe('suggestProjectForRepo', () => {
  it('reads a project key sitting in the directory name as a whole token', () => {
    expect(suggestProjectForRepo({ repoPath: '/home/you/dev/abc-frontend', projects: PROJECTS })?.key).toBe('ABC');
  });

  it('reads a project whose every long name word is in the directory name', () => {
    expect(suggestProjectForRepo({ repoPath: '/home/you/dev/delta-shop-web', projects: PROJECTS })?.key).toBe('DEF');
  });

  it('never reads a key that is only part of a word', () => {
    expect(suggestProjectForRepo({ repoPath: '/home/you/dev/abcdefg', projects: PROJECTS })).toBeUndefined();
  });

  it('suggests nothing when the name says nothing, or says two things', () => {
    expect(suggestProjectForRepo({ repoPath: '/home/you/dev/notes', projects: PROJECTS })).toBeUndefined();
    expect(suggestProjectForRepo({ repoPath: '/home/you/dev/abc-def', projects: PROJECTS })).toBeUndefined();
    expect(suggestProjectForRepo({ repoPath: '  ', projects: PROJECTS })).toBeUndefined();
  });
});

describe('repoProjectRows', () => {
  it('reports the project a link on the repository itself names', () => {
    const [row] = repoProjectRows({
      repoPaths: ['/home/you/dev/abc-frontend'],
      links: [link({})],
      projects: PROJECTS,
    });

    expect(row).toMatchObject({ label: 'abc-frontend', projectKey: 'ABC', inherited: false, private: false });
    expect(row?.suggestion).toBeUndefined();
  });

  it('reports a link on a directory above it as inherited rather than as a missing answer', () => {
    const [row] = repoProjectRows({
      repoPaths: ['/home/you/dev/abc-frontend'],
      links: [link({ path: '/home/you/dev' })],
      projects: PROJECTS,
    });

    expect(row).toMatchObject({ projectKey: 'ABC', inherited: true });
  });

  it('reports a private path as private and names no project for it', () => {
    const [row] = repoProjectRows({
      repoPaths: ['/home/you/dev/abc-frontend'],
      links: [link({ target: { kind: 'private' } })],
      projects: PROJECTS,
    });

    expect(row).toMatchObject({ private: true, projectKey: undefined });
  });

  it('offers the suggestion only for a repository nothing covers yet, sorted by path', () => {
    const rows = repoProjectRows({
      repoPaths: ['/home/you/dev/delta-shop', '/home/you/dev/abc-frontend'],
      links: [link({ path: '/home/you/dev/abc-frontend' })],
      projects: PROJECTS,
    });

    expect(rows.map((row) => row.label)).toEqual(['abc-frontend', 'delta-shop']);
    expect(rows[0]?.suggestion).toBeUndefined();
    expect(rows[1]?.suggestion?.key).toBe('DEF');
  });
});

describe('projectPathRows', () => {
  it('lists a link whose path no repository sits at as a folder of its own', () => {
    const rows = projectPathRows({
      repoPaths: ['/home/you/dev/abc-frontend'],
      links: [link({ id: 'root', path: '/home/you/dev/side', target: { kind: 'private' } })],
      projects: PROJECTS,
    });

    expect(rows.map((row) => [row.path, row.kind])).toEqual([
      ['/home/you/dev/abc-frontend', 'repo'],
      ['/home/you/dev/side', 'folder'],
    ]);
    expect(rows[1]?.private).toBe(true);
  });

  it('lists a link written on a repository once, on that repository', () => {
    const rows = projectPathRows({
      repoPaths: ['/home/you/dev/abc-frontend'],
      links: [link({ path: '/home/you/dev/abc-frontend' })],
      projects: PROJECTS,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'repo', projectKey: 'ABC', inherited: false });
  });

  it('sorts a covering directory above the repositories it covers', () => {
    const rows = projectPathRows({
      repoPaths: ['/home/you/dev/abc-frontend'],
      links: [link({ id: 'root', path: '/home/you/dev' })],
      projects: PROJECTS,
    });

    expect(rows.map((row) => row.path)).toEqual(['/home/you/dev', '/home/you/dev/abc-frontend']);
    expect(rows[1]?.inherited).toBe(true);
  });

  it('matches a link that names the repository with a trailing slash', () => {
    const rows = projectPathRows({
      repoPaths: ['/home/you/dev/abc-frontend'],
      links: [link({ path: '/home/you/dev/abc-frontend/' })],
      projects: PROJECTS,
    });

    expect(rows).toHaveLength(1);
  });
});
