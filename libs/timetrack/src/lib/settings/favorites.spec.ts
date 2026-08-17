import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings } from './model';
import { favoriteProjectKeys, isFavoriteIssueKey, withFavoriteProjects, withoutFavoriteProject } from './favorites';

const settingsWith = (keys: string[]): TimetrackSettings => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  favoriteProjects: keys.map((key) => ({ key, name: key })),
});

describe('withFavoriteProjects', () => {
  it('keeps the order the picker chose and upper-cases every key', () => {
    const settings = withFavoriteProjects({
      settings: DEFAULT_TIMETRACK_SETTINGS,
      projects: [
        { key: 'def', name: 'Delta' },
        { key: 'abc', name: 'Alpha' },
      ],
    });

    expect(settings.favoriteProjects).toEqual([
      { key: 'DEF', name: 'Delta' },
      { key: 'ABC', name: 'Alpha' },
    ]);
  });

  it('names a project after its key when the picker had no name for it', () => {
    const settings = withFavoriteProjects({ settings: DEFAULT_TIMETRACK_SETTINGS, projects: [{ key: 'abc' }] });

    expect(settings.favoriteProjects).toEqual([{ key: 'ABC', name: 'ABC' }]);
  });

  it('keeps the first of two entries naming the same project, and drops one naming none', () => {
    const settings = withFavoriteProjects({
      settings: DEFAULT_TIMETRACK_SETTINGS,
      projects: [{ key: 'ABC', name: 'Alpha' }, { key: 'abc', name: 'Alpha again' }, { key: ' ' }],
    });

    expect(settings.favoriteProjects).toEqual([{ key: 'ABC', name: 'Alpha' }]);
  });
});

describe('withoutFavoriteProject', () => {
  it('removes the project whatever case it is asked for in', () => {
    const settings = withoutFavoriteProject({ settings: settingsWith(['ABC', 'DEF']), key: 'abc' });

    expect(favoriteProjectKeys(settings)).toEqual(['DEF']);
  });
});

describe('isFavoriteIssueKey', () => {
  it('reads the key against the picked projects', () => {
    const settings = settingsWith(['ABC']);

    expect(isFavoriteIssueKey({ issueKey: 'ABC-42', settings })).toBe(true);
    expect(isFavoriteIssueKey({ issueKey: 'abc-42', settings })).toBe(true);
    expect(isFavoriteIssueKey({ issueKey: 'DEF-42', settings })).toBe(false);
    expect(isFavoriteIssueKey({ issueKey: 'ABC', settings })).toBe(false);
  });

  it('calls nothing a favourite while no project is picked', () => {
    expect(isFavoriteIssueKey({ issueKey: 'ABC-42', settings: settingsWith([]) })).toBe(false);
  });
});
