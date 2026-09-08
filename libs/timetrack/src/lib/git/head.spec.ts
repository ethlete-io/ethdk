import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ProcessResult, ProcessSpec } from '../transport/ports';
import { GIT_FIELD_SEPARATOR } from './format';
import { parseHeadBranchAt, readHeadBranches$ } from './head';

const line = (options: { stamp: string; subject: string }) =>
  `HEAD@{${options.stamp}}${GIT_FIELD_SEPARATOR}${options.subject}`;

const checkout = (options: { stamp: string; from: string; to: string }) =>
  line({ stamp: options.stamp, subject: `checkout: moving from ${options.from} to ${options.to}` });

const commit = (stamp: string) => line({ stamp, subject: 'commit: Ship the thing' });

const branchAt = (lines: string[], at: string) => parseHeadBranchAt({ output: lines.join('\n'), at: new Date(at) });

describe('parseHeadBranchAt', () => {
  it('reads the branch of the newest switch at or before the instant', () => {
    const branch = branchAt(
      [
        checkout({ stamp: '2026-08-19T09:00:00+02:00', from: 'main', to: 'feature/20260819_bracket-challenge' }),
        checkout({ stamp: '2026-07-01T09:00:00+02:00', from: 'next', to: 'main' }),
      ],
      '2026-09-08T23:59:59+02:00',
    );

    expect(branch).toBe('feature/20260819_bracket-challenge');
  });

  it('ignores a commit, which moves HEAD without changing the branch', () => {
    const branch = branchAt(
      [
        commit('2026-09-07T18:08:34+02:00'),
        checkout({ stamp: '2026-08-19T09:00:00+02:00', from: 'main', to: 'feature/20260819_bracket-challenge' }),
      ],
      '2026-09-08T23:59:59+02:00',
    );

    expect(branch).toBe('feature/20260819_bracket-challenge');
  });

  it('reads where HEAD came from when every switch is younger than the instant', () => {
    const branch = branchAt(
      [checkout({ stamp: '2026-08-19T09:00:00+02:00', from: 'main', to: 'feature/20260819_bracket-challenge' })],
      '2026-08-12T23:59:59+02:00',
    );

    expect(branch).toBe('main');
  });

  it('answers nothing for a reflog holding no switch at all', () => {
    expect(branchAt([commit('2026-09-07T18:08:34+02:00')], '2026-09-08T23:59:59+02:00')).toBeUndefined();
  });

  it('answers nothing for a detached checkout, which names a commit where a branch would be', () => {
    const branch = branchAt(
      [checkout({ stamp: '2026-08-19T09:00:00+02:00', from: 'main', to: '9fceb02' })],
      '2026-09-08T23:59:59+02:00',
    );

    expect(branch).toBeUndefined();
  });
});

const runner = (byRepo: Record<string, ProcessResult>) => {
  const specs: ProcessSpec[] = [];

  return {
    specs,
    processes: {
      run$: (spec: ProcessSpec): Observable<ProcessResult> => {
        specs.push(spec);

        return of(byRepo[spec.cwd ?? ''] ?? { code: 128, stdout: '', stderr: 'not a git repository' });
      },
    },
  };
};

describe('readHeadBranches$', () => {
  const FIFAGG = '/home/tom/dev/fifagg/fifagg-frontend';
  const GONE = '/home/tom/dev/moved-away';

  const output = [checkout({ stamp: '2026-08-19T09:00:00+02:00', from: 'main', to: 'feature/x' })].join('\n');

  it('reads one branch per checkout', async () => {
    const { processes } = runner({ [FIFAGG]: { code: 0, stdout: output, stderr: '' } });

    const branches = await new Promise((resolve) =>
      readHeadBranches$({ processes, repoPaths: [FIFAGG], at: new Date('2026-09-08T23:59:59+02:00') }).subscribe(
        resolve,
      ),
    );

    expect(branches).toEqual({ [FIFAGG]: 'feature/x' });
  });

  it('leaves out a repository whose reflog cannot be read, rather than failing the others', async () => {
    const { processes } = runner({ [FIFAGG]: { code: 0, stdout: output, stderr: '' } });

    const branches = await new Promise((resolve) =>
      readHeadBranches$({ processes, repoPaths: [FIFAGG, GONE], at: new Date('2026-09-08T23:59:59+02:00') }).subscribe(
        resolve,
      ),
    );

    expect(branches).toEqual({ [FIFAGG]: 'feature/x' });
  });

  it('runs no process at all when every stream already named a branch', async () => {
    const { processes, specs } = runner({});

    const branches = await new Promise((resolve) =>
      readHeadBranches$({ processes, repoPaths: [], at: new Date('2026-09-08T23:59:59+02:00') }).subscribe(resolve),
    );

    expect(branches).toEqual({});
    expect(specs).toEqual([]);
  });
});
