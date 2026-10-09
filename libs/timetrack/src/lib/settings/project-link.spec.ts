import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../model/project-link';
import { DEFAULT_TIMETRACK_SETTINGS } from './model';
import { withProjectLink, withProjectLinkEpics, withoutProjectLink } from './project-link';
import { parseTimetrackSettings } from './parse';

const link = (overrides: Partial<TimetrackProjectLink> = {}): TimetrackProjectLink => ({
  id: 'link-1',
  path: '/Users/tom/dev/ea-frontend',
  target: { kind: 'project', projectKey: 'FIP' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const settingsWith = (links: TimetrackProjectLink[]) => ({ ...DEFAULT_TIMETRACK_SETTINGS, projectLinks: links });

describe('withProjectLink', () => {
  it('replaces the link that named the same path', () => {
    const settings = withProjectLink({
      settings: settingsWith([link()]),
      link: link({ id: 'link-2', target: { kind: 'private' } }),
    });

    expect(settings.projectLinks).toHaveLength(1);
    expect(settings.projectLinks[0]?.target).toEqual({ kind: 'private' });
  });

  it('reads a trailing slash as the same path', () => {
    const settings = withProjectLink({
      settings: settingsWith([link()]),
      link: link({ id: 'link-2', path: '/Users/tom/dev/ea-frontend/' }),
    });

    expect(settings.projectLinks.map((entry) => entry.id)).toEqual(['link-2']);
  });

  it('keeps a link on a repository beside the root it sits in', () => {
    const settings = withProjectLink({
      settings: settingsWith([link()]),
      link: link({ id: 'link-2', path: '/Users/tom/dev', target: { kind: 'private' } }),
    });

    expect(settings.projectLinks.map((entry) => entry.id)).toEqual(['link-1', 'link-2']);
  });
});

describe('withoutProjectLink', () => {
  it('removes the link by id', () => {
    expect(withoutProjectLink({ settings: settingsWith([link()]), id: 'link-1' }).projectLinks).toEqual([]);
  });
});

describe('withProjectLinkEpics', () => {
  it('names the epics of a project link, each key once, and survives a round trip', () => {
    const settings = withProjectLinkEpics({
      settings: settingsWith([link()]),
      id: 'link-1',
      epicKeys: ['fifagg-12601', 'FIFAGG-12601', 'not a key'],
    });

    expect(settings.projectLinks[0]?.target).toEqual({
      kind: 'project',
      projectKey: 'FIP',
      epicKeys: ['FIFAGG-12601'],
    });
    expect(parseTimetrackSettings(JSON.parse(JSON.stringify(settings))).projectLinks[0]?.target).toEqual(
      settings.projectLinks[0]?.target,
    );
  });

  it('clears the epics with an empty list, and leaves a private link alone', () => {
    const named = withProjectLinkEpics({ settings: settingsWith([link()]), id: 'link-1', epicKeys: ['FIP-1'] });
    const privateLink = link({ id: 'link-2', path: '/dev/side', target: { kind: 'private' } });

    expect(withProjectLinkEpics({ settings: named, id: 'link-1', epicKeys: [] }).projectLinks[0]?.target).toEqual({
      kind: 'project',
      projectKey: 'FIP',
    });
    expect(
      withProjectLinkEpics({ settings: settingsWith([privateLink]), id: 'link-2', epicKeys: ['FIP-1'] }).projectLinks,
    ).toEqual([privateLink]);
  });
});
