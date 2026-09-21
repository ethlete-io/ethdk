import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { streamDay } from './stream-day';

const SPECS = '/home/tom/dev/fifagg/specs';
const REWORK = 'context/tracks/20260921_competition-navigation-rework';
const JOURNEY = 'context/tracks/20260808_competition-journey';

const AT = (minutes: number) => new Date(new Date(2026, 8, 21, 9, 0, 0).getTime() + minutes * 60_000);

const focusRun = (options: { from: number; to: number }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'spec.md - specs - Code',
  }));

const commit = (options: { minutes: number; branch: string; paths: string[] }): CollectedEvent => ({
  at: AT(options.minutes),
  source: 'git',
  kind: 'git-commit',
  repoPath: SPECS,
  branch: options.branch,
  sha: `sha-${options.minutes}`,
  subject: `docs(spec): The one at ${options.minutes}`,
  paths: options.paths,
});

const dayOn = (branch: string): CollectedEvent[] => [
  ...focusRun({ from: 0, to: 120 }),
  commit({ minutes: 30, branch, paths: [`${JOURNEY}/progress.md`] }),
  commit({ minutes: 90, branch, paths: ['context/tracks.md', `${REWORK}/index.md`, `${REWORK}/spec.md`] }),
];

const blocksOf = (events: CollectedEvent[]) =>
  streamDay({ events, options: { repoRoots: [SPECS], baseBranches: ['main'] } }).blocks.filter(
    (block) => block.context.repoPath === SPECS,
  );

describe('streamDay work paths', () => {
  it('splits a base branch into the two directories its commits worked in', () => {
    expect(new Set(blocksOf(dayOn('main')).map((block) => block.context.workPath))).toEqual(new Set([JOURNEY, REWORK]));
  });

  it('gives a stretch the directory of the commit that followed it, not the one before', () => {
    const first = blocksOf(dayOn('main'))[0];

    expect(first?.from.getTime()).toBe(AT(0).getTime());
    expect(first?.context.workPath).toBe(JOURNEY);
  });

  it('carries on in the last directory after the day.s last commit', () => {
    const last = blocksOf(dayOn('main')).at(-1);

    expect(last?.to.getTime()).toBe(AT(120).getTime());
    expect(last?.context.workPath).toBe(REWORK);
  });

  it('leaves a feature branch whole, because the branch already names the piece of work', () => {
    expect(blocksOf(dayOn('spec/20260921_rework')).map((block) => block.context.workPath)).toEqual([undefined]);
  });

  it('leaves a checkout that worked in one directory whole', () => {
    const events = [
      ...focusRun({ from: 0, to: 120 }),
      commit({ minutes: 30, branch: 'main', paths: [`${REWORK}/spec.md`] }),
      commit({ minutes: 90, branch: 'main', paths: [`${REWORK}/index.md`] }),
    ];

    expect(blocksOf(events).map((block) => block.context.workPath)).toEqual([undefined]);
  });
});
