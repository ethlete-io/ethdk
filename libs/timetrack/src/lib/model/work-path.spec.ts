import { describe, expect, it } from 'vitest';
import { workPathDays, workPathOf, workPathPieces, workPathsOf, workPathsSplit } from './work-path';

const TRACK = 'context/tracks/20260921_competition-navigation-rework';
const OTHER_TRACK = 'context/tracks/20260808_competition-journey';

const COMPETITION = 'libs/domain/public/competition';
const STATIC = 'libs/domain/public/static';
const PLATFORM = 'libs/domain/platform';

describe('workPathOf', () => {
  it('answers the directory of a commit that touched one file', () => {
    expect(workPathOf({ paths: [`${TRACK}/spec.md`] })).toBe(TRACK);
  });

  it('keeps the directory a majority of the files are in, past a file at the top of the checkout', () => {
    expect(workPathOf({ paths: ['context/tracks.md', `${TRACK}/index.md`, `${TRACK}/spec.md`] })).toBe(TRACK);
  });

  it('separates two tracks the same checkout worked on', () => {
    const rework = workPathOf({ paths: ['context/tracks.md', `${TRACK}/index.md`, `${TRACK}/spec.md`] });
    const journey = workPathOf({ paths: [`${OTHER_TRACK}/progress.md`] });

    expect(rework).not.toBe(journey);
  });

  it('answers the full directory, with no depth of its own to cut it to', () => {
    expect(workPathOf({ paths: ['libs/timetrack/src/lib/model/work-path.ts'] })).toBe('libs/timetrack/src/lib/model');
  });

  it('climbs to the directory the files share when none of them holds a majority', () => {
    expect(workPathOf({ paths: ['a/b/one.ts', 'a/c/two.ts'] })).toBe('a');
  });

  it('answers nothing when the files share no directory', () => {
    expect(workPathOf({ paths: ['a/one.ts', 'b/two.ts'] })).toBeUndefined();
  });

  it('answers nothing for a file at the top of the checkout', () => {
    expect(workPathOf({ paths: ['README.md'] })).toBeUndefined();
  });

  it('answers nothing when the commit touched no file', () => {
    expect(workPathOf({ paths: [] })).toBeUndefined();
  });

  it('answers nothing for the checkout.s own tooling', () => {
    expect(workPathOf({ paths: ['.changeset/a-fix.md', '.changeset/another-fix.md'] })).toBeUndefined();
    expect(workPathOf({ paths: ['.claude/skills/one/SKILL.md'] })).toBeUndefined();
    expect(workPathOf({ paths: ['.ai-context/notes.md'] })).toBeUndefined();
  });

  it('still answers the source directory of a commit that also wrote one tooling file', () => {
    const paths = ['.changeset/a-fix.md', 'libs/query/src/one.ts', 'libs/query/src/two.ts'];

    expect(workPathOf({ paths })).toBe('libs/query/src');
  });
});

describe('workPathsOf', () => {
  it('keeps two projects of one checkout apart, however deep the files sit', () => {
    const commits = [
      { paths: [`${COMPETITION}/src/lib/table/table.component.ts`] },
      { paths: [`${STATIC}/src/lib/page/page.component.ts`] },
    ];

    expect(workPathsOf({ commits, projectRoots: [COMPETITION, STATIC] })).toEqual([COMPETITION, STATIC]);
  });

  it('folds one project own subdirectories back into it', () => {
    const commits = [
      { paths: [`${PLATFORM}/src/lib/campaign/squad-detail-view/wizard-views/one.ts`] },
      { paths: [`${PLATFORM}/src/lib/campaign/squad-detail-view/components/two.ts`] },
    ];

    expect(workPathsOf({ commits, projectRoots: [PLATFORM] })).toEqual([PLATFORM, PLATFORM]);
  });

  it('cuts one level below the trunk where the checkout declares no project', () => {
    const commits = [
      { paths: [`${TRACK}/spec.md`, `${TRACK}/index.md`] },
      { paths: [`${OTHER_TRACK}/progress.md`] },
      { paths: [`${OTHER_TRACK}/api.md`] },
    ];

    expect(workPathsOf({ commits })).toEqual([TRACK, OTHER_TRACK, OTHER_TRACK]);
  });

  it('cuts a deep commit to one level below the trunk the set shares', () => {
    const commits = [
      { paths: ['src/app/one.ts'] },
      { paths: ['src/app/two.ts'] },
      { paths: ['src/app/feature/deep/nested/three.ts'] },
    ];

    expect(workPathsOf({ commits })).toEqual(['src/app', 'src/app', 'src/app/feature']);
  });

  it('answers nothing for a commit whose files name no directory', () => {
    expect(workPathsOf({ commits: [{ paths: ['README.md'] }, { paths: [`${TRACK}/spec.md`] }] })).toEqual([
      undefined,
      TRACK,
    ]);
  });
});

describe('workPathsSplit', () => {
  it('splits a checkout that worked in two directories', () => {
    expect(workPathsSplit({ paths: [TRACK, OTHER_TRACK, TRACK] })).toEqual(new Set([TRACK, OTHER_TRACK]));
  });

  it('refuses to split a checkout that worked in one directory', () => {
    expect(workPathsSplit({ paths: [TRACK, TRACK, undefined] })).toBeNull();
  });

  it('refuses to split a checkout whose directories are structure rather than work', () => {
    expect(workPathsSplit({ paths: ['a', 'b', 'c', 'd', 'e'] })).toBeNull();
  });
});

const day = (index: number) => `2026-09-0${index}`;

const commitsIn = (workPath: string, count: number, from = 1) =>
  Array.from({ length: count }, (_, index) => ({
    day: day(from + index),
    paths: [`${workPath}/spec.md`, `${workPath}/ui.md`],
  }));

describe('workPathDays', () => {
  it('counts the commits and the days of every directory, floor or no floor', () => {
    const commits = [...commitsIn('context/tracks/journey', 3), ...commitsIn('context/tracks/season-pass', 1, 5)];

    expect(workPathDays({ commits })).toEqual([
      { workPath: 'context/tracks/journey', days: [day(1), day(2), day(3)], commits: 3 },
      { workPath: 'context/tracks/season-pass', days: [day(5)], commits: 1 },
    ]);
  });
});

describe('workPathPieces', () => {
  it('answers one directory per piece of work, with the days that worked in it', () => {
    const commits = [...commitsIn('context/tracks/journey', 3), ...commitsIn('context/tracks/season-pass', 3, 5)];

    expect(workPathPieces({ commits })).toEqual([
      { workPath: 'context/tracks/journey', days: [day(1), day(2), day(3)], commits: 3 },
      { workPath: 'context/tracks/season-pass', days: [day(5), day(6), day(7)], commits: 3 },
    ]);
  });

  it('leaves out a directory the checkout only touched in passing', () => {
    const commits = [
      ...commitsIn('context/tracks/journey', 3),
      ...commitsIn('context/tracks/season-pass', 3, 5),
      { day: day(9), paths: ['context/tracks/notes/one.md'] },
    ];

    expect(workPathPieces({ commits }).map((piece) => piece.workPath)).toEqual([
      'context/tracks/journey',
      'context/tracks/season-pass',
    ]);
  });

  it('answers nothing when every commit worked in the same directory', () => {
    expect(workPathPieces({ commits: commitsIn('context/tracks/journey', 4) })).toEqual([]);
  });

  it('answers nothing when no directory reaches the floor', () => {
    const commits = [...commitsIn('context/tracks/journey', 2), ...commitsIn('context/tracks/season-pass', 2, 5)];

    expect(workPathPieces({ commits })).toEqual([]);
    expect(workPathPieces({ commits, minCommits: 2 })).toHaveLength(2);
  });

  it('leaves out a commit whose files name no directory', () => {
    const commits = [
      ...commitsIn('context/tracks/journey', 3),
      ...commitsIn('context/tracks/season-pass', 3, 5),
      { day: day(9), paths: ['README.md'] },
    ];

    expect(workPathPieces({ commits })).toHaveLength(2);
  });
});
