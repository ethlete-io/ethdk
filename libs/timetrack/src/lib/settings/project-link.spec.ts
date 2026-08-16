import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../correlate/project-link';
import { DEFAULT_TIMETRACK_SETTINGS } from './model';
import { withProjectLink, withoutProjectLink } from './project-link';

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
