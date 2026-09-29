import { describe, expect, it } from 'vitest';
import { PieceSession, sessionPieces } from './session-piece';

const AT = (minutes: number) => new Date(new Date(2026, 8, 29, 10, 0, 0).getTime() + minutes * 60_000);

const ROOTS = ['libs/timetrack', 'libs/eslint-plugin', 'apps/timetrack'];

const session = (options: { id: string; from: number; to: number; paths: string[] }): PieceSession => ({
  sessionId: options.id,
  from: AT(options.from),
  to: AT(options.to),
  paths: options.paths,
});

const piecesOf = (sessions: PieceSession[]) =>
  Object.fromEntries([...sessionPieces({ sessions, projectRoots: ROOTS })].map(([id, found]) => [id, found.piece]));

describe('sessionPieces', () => {
  it('joins sessions one after the other that worked in the same project', () => {
    expect(
      piecesOf([
        session({ id: 'a', from: 0, to: 40, paths: ['libs/timetrack/src/lib/rows/merge.ts'] }),
        session({ id: 'b', from: 60, to: 90, paths: ['libs/timetrack/src/lib/model/block.ts'] }),
      ]),
    ).toEqual({ a: 'a', b: 'a' });
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
});
