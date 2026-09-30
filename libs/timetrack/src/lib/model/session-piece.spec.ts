import { describe, expect, it } from 'vitest';
import { PieceSession, sessionPieces } from './session-piece';

const AT = (minutes: number) => new Date(new Date(2026, 8, 29, 10, 0, 0).getTime() + minutes * 60_000);

const ROOTS = [
  'libs/timetrack',
  'libs/eslint-plugin',
  'apps/timetrack',
  'apps/timetrack-e2e',
  'libs/query',
  'libs/query-devtools',
];

const session = (options: {
  id: string;
  from: number;
  to: number;
  paths: string[];
  branch?: string;
}): PieceSession => ({
  sessionId: options.id,
  from: AT(options.from),
  to: AT(options.to),
  paths: options.paths,
  branch: options.branch,
});

const piecesOf = (sessions: PieceSession[]) =>
  Object.fromEntries(
    [...sessionPieces({ sessions, projectRoots: ROOTS, baseBranches: ['main', 'next'] })].map(([id, found]) => [
      id,
      found.piece,
    ]),
  );

describe('sessionPieces', () => {
  it('joins sessions one after the other that worked in the same project', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/src/lib/rows/merge.ts'] }),
        session({ id: 'b', from: 60, to: 90, paths: ['libs/timetrack/src/lib/model/block.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'a' });
  });

  it('reads a directory a shell command wrote in at the grain of the files beside it', () => {
    const found = sessionPieces({
      sessions: [
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/src/lib/rows/merge.ts', 'libs/timetrack/'] }),
        session({ id: 'b', from: 60, to: 90, paths: ['libs/timetrack/'] }),
        session({
          id: 'c',
          from: 30,
          to: 50,
          paths: ['libs/eslint-plugin/src/rules/a.ts', 'libs/eslint-plugin/src/rules/b.ts', 'libs/eslint-plugin/'],
        }),
      ],
    });

    expect(found.get('b')).toEqual({ piece: 'a', workPath: 'libs/timetrack' });
  });

  it('keeps sessions one after the other in two projects apart', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/src/lib/rows/merge.ts'] }),
        session({ id: 'b', from: 60, to: 90, paths: ['libs/eslint-plugin/src/rules/a.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'b' });
  });

  it('keeps two sessions that ran at the same time apart, though they worked in one project', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/src/lib/rows/merge.ts'] }),
        session({ id: 'b', from: 30, to: 90, paths: ['libs/timetrack/src/lib/rows/cut.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'b' });
  });

  it('joins a later session to the parallel piece that ended last', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/a.ts'] }),
        session({ id: 'b', from: 30, to: 90, paths: ['libs/timetrack/b.ts'] }),
        session({ id: 'c', from: 100, to: 120, paths: ['libs/timetrack/c.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'b', c: 'b' });
  });

  it('names a session by the project most of its files sat in', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/a.ts'] }),
        session({
          id: 'b',
          from: 60,
          to: 90,
          paths: ['libs/eslint-plugin/a.ts', 'libs/timetrack/b.ts', 'libs/timetrack/c.ts'],
        }),
      ]),
    ).toEqual({ a: 'a', b: 'a' });
  });

  it('names the directory each session worked in', () => {
    const found = sessionPieces({
      sessions: [
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/src/a.ts'] }),
        session({ id: 'b', from: 60, to: 90, paths: [] }),
      ],
      projectRoots: ROOTS,
    });

    expect(found.get('a')).toEqual({ piece: 'a', workPath: 'libs/timetrack' });
    expect(found.get('b')).toEqual({ piece: 'b', workPath: undefined });
  });

  it('leaves a session whose files name no directory as a piece of its own', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: [] }),
        session({ id: 'b', from: 60, to: 90, paths: [] }),
        session({ id: 'c', from: 100, to: 120, paths: ['.changeset/x.md'] }),
      ]),
    ).toEqual({ a: 'a', b: 'b', c: 'c' });
  });

  it('joins two sessions that ran at the same time and wrote one handoff', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 60, paths: ['.claude/handoffs/lib-scan.md', 'libs/timetrack/a.ts'] }),
        session({ id: 'b', from: 30, to: 90, paths: ['libs/eslint-plugin/a.ts', '.claude/handoffs/lib-scan.md'] }),
      ]),
    ).toEqual({ a: 'a', b: 'a' });
  });

  it('joins two sessions that ran at the same time and wrote one design call', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 60, paths: ['.ethlete/design/calls/components/time-range/01/call.ts'] }),
        session({ id: 'b', from: 30, to: 90, paths: ['.ethlete/design/calls/components/time-range/02/call.ts'] }),
        session({ id: 'c', from: 30, to: 90, paths: ['.ethlete/design/calls/components/color/01/call.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'a', c: 'c' });
  });

  it('keeps two sessions that ran at the same time and wrote two handoffs apart', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 60, paths: ['.claude/handoffs/one.md', 'libs/timetrack/a.ts'] }),
        session({ id: 'b', from: 30, to: 90, paths: ['.claude/handoffs/two.md', 'libs/timetrack/b.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'b' });
  });

  it('joins a later session to the piece a parallel session joined through a handoff', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 60, paths: ['.claude/handoffs/one.md', 'libs/eslint-plugin/a.ts'] }),
        session({ id: 'b', from: 30, to: 90, paths: ['.claude/handoffs/one.md', 'libs/eslint-plugin/b.ts'] }),
        session({ id: 'c', from: 100, to: 120, paths: ['libs/eslint-plugin/c.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'a', c: 'a' });
  });

  it('reads an app, its e2e app and its library as one project', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/src/a.ts'] }),
        session({ id: 'b', from: 60, to: 90, paths: ['apps/timetrack/src/b.ts'] }),
        session({ id: 'c', from: 100, to: 120, paths: ['apps/timetrack-e2e/src/c.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'a', c: 'a' });
  });

  it('keeps two libraries whose names only share a prefix apart', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: ['libs/query/src/a.ts'] }),
        session({ id: 'b', from: 60, to: 90, paths: ['libs/query-devtools/src/b.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'b' });
  });

  it('joins two sessions that ran at the same time and wrote in one plan directory', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 60, paths: ['plans/lib-scan/', 'libs/timetrack/a.ts'] }),
        session({ id: 'b', from: 30, to: 90, paths: ['plans/lib-scan', 'libs/eslint-plugin/a.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'a' });
  });

  it('joins two sessions that ran at the same time and wrote one changeset', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 60, paths: ['.changeset/core-scan.md', 'libs/timetrack/a.ts'] }),
        session({ id: 'b', from: 30, to: 90, paths: ['.changeset/core-scan.md'] }),
      ]),
    ).toEqual({ a: 'a', b: 'a' });
  });

  it('joins sessions one after the other on one feature branch, whatever they worked in', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 5, paths: [], branch: 'feat/ET-1-x' }),
        session({ id: 'b', from: 6, to: 12, paths: ['libs/eslint-plugin/a.ts'], branch: 'feat/ET-1-x' }),
        session({ id: 'c', from: 13, to: 17, paths: ['libs/timetrack/a.ts'], branch: 'feat/ET-1-x' }),
      ]),
    ).toEqual({ a: 'a', b: 'a', c: 'a' });
  });

  it('keeps sessions one after the other on a base branch apart when they worked in two projects', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 5, paths: ['libs/timetrack/a.ts'], branch: 'next' }),
        session({ id: 'b', from: 6, to: 12, paths: ['libs/eslint-plugin/a.ts'], branch: 'next' }),
        session({ id: 'c', from: 13, to: 17, paths: [], branch: 'next' }),
      ]),
    ).toEqual({ a: 'a', b: 'b', c: 'c' });
  });

  it('keeps sessions on one feature branch that ran at the same time apart', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: [], branch: 'feat/ET-1-x' }),
        session({ id: 'b', from: 30, to: 60, paths: [], branch: 'feat/ET-1-x' }),
      ]),
    ).toEqual({ a: 'a', b: 'b' });
  });

  it('keeps sessions one after the other on two feature branches apart', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 5, paths: [], branch: 'feat/ET-1-x' }),
        session({ id: 'b', from: 6, to: 12, paths: [], branch: 'feat/ET-2-y' }),
      ]),
    ).toEqual({ a: 'a', b: 'b' });
  });
});
