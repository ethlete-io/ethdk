import { describe, expect, it } from 'vitest';
import { workPathOf, workPathsSplit } from './work-path';

const TRACK = 'context/tracks/20260921_competition-navigation-rework';
const OTHER_TRACK = 'context/tracks/20260808_competition-journey';

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

  it('cuts a deeper directory to the maximum depth', () => {
    expect(workPathOf({ paths: ['libs/timetrack/src/lib/model/work-path.ts'] })).toBe('libs/timetrack/src');
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
