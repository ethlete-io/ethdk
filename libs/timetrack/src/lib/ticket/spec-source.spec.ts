import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Evidence, EvidenceKind } from '../model/evidence';
import { ProcessResult, ProcessSpec, SpecFiles, TimetrackProcessRunner, TimetrackSpecSource } from '../transport/ports';
import { shasFromEvidence, specForCommits$, specPathArgs } from './spec-source';

const METADATA = JSON.stringify({ title: 'Bracket Challenge', type: 'feature', jira_epic: 'FIFAGG-12573' });

const harness = (options: { result?: Partial<ProcessResult>; files?: SpecFiles | null } = {}) => {
  const spawned: ProcessSpec[] = [];
  const asked: { repoPath: string; directories: readonly string[] }[] = [];

  const processes: TimetrackProcessRunner = {
    run$: (spec) => {
      spawned.push(spec);

      return of({ code: 0, stdout: '', stderr: '', ...options.result }) as Observable<ProcessResult>;
    },
  };
  const specs: TimetrackSpecSource = {
    read$: (ask) => {
      asked.push(ask);

      return of(options.files ?? null);
    },
  };

  return { processes, specs, spawned, asked };
};

const seen = (detail: string, kind: EvidenceKind = 'commit'): Evidence => ({ kind, at: new Date(), detail });

describe('shasFromEvidence', () => {
  it('pulls the sha out of the detail the stream writes', () => {
    expect(shasFromEvidence([seen('a1b2c3d Verlaufsleiste rendern'), seen('e4f5a6b Rundenname korrigieren')])).toEqual([
      'a1b2c3d',
      'e4f5a6b',
    ]);
  });

  it('skips evidence that is not a commit', () => {
    expect(shasFromEvidence([seen('a1b2c3d Real branch', 'branch'), seen('a1b2c3d Real commit')])).toEqual(['a1b2c3d']);
  });

  it('skips a commit whose detail carries no sha', () => {
    expect(shasFromEvidence([seen('Feature branch merged'), seen('a1b2c3d Real commit')])).toEqual(['a1b2c3d']);
  });

  it('names a sha once, however many blocks quoted it', () => {
    expect(shasFromEvidence([seen('a1b2c3d One'), seen('a1b2c3d One')])).toEqual(['a1b2c3d']);
  });
});

describe('specPathArgs', () => {
  it('asks git for paths only, through the operation the host allows', () => {
    expect(specPathArgs(['a1b2c3d'])).toEqual(['log', '--no-walk', '--name-only', '--pretty=format:', 'a1b2c3d']);
  });
});

describe('specForCommits$', () => {
  const run = (options: Parameters<typeof harness>[0]) => {
    const h = harness(options);

    return {
      ...h,
      spec: firstValueFrom(specForCommits$({ repoPath: '/home/tom/dev/fifagg/specs', shas: ['a1b2c3d'], ...h })),
    };
  };

  it('reads the spec of the directory the commits touched', async () => {
    const h = run({
      result: { stdout: 'context/tracks/bracket/spec.md\ncontext/tracks/bracket/plan.md\n' },
      files: { directory: 'context/tracks/bracket', metadata: METADATA },
    });

    await expect(h.spec).resolves.toMatchObject({ title: 'Bracket Challenge', epicKey: 'FIFAGG-12573' });
    expect(h.asked[0]?.directories[0]).toBe('context/tracks/bracket');
  });

  it('runs git in the checkout the work belongs to', async () => {
    const h = run({ result: { stdout: 'a/b/spec.md\n' }, files: null });

    await h.spec;
    expect(h.spawned[0]).toMatchObject({ command: 'git', cwd: '/home/tom/dev/fifagg/specs' });
  });

  it('answers null where no directory holds a spec', async () => {
    await expect(run({ result: { stdout: 'a/b/spec.md\n' }, files: null }).spec).resolves.toBeNull();
  });

  it('answers null where the git call failed', async () => {
    const h = run({ result: { code: 128, stderr: 'not a git repository' } });

    await expect(h.spec).resolves.toBeNull();
    expect(h.asked).toEqual([]);
  });

  it('answers null where the host itself threw', async () => {
    const h = harness();

    vi.spyOn(h.processes, 'run$').mockReturnValue(throwError(() => new Error('the host is gone')));

    await expect(
      firstValueFrom(specForCommits$({ repoPath: '/repo', shas: ['a1b2c3d'], processes: h.processes, specs: h.specs })),
    ).resolves.toBeNull();
  });

  it('never asks the host anything when the band quotes no commit', async () => {
    const h = harness();
    const read = vi.spyOn(h.specs, 'read$');

    await expect(
      firstValueFrom(specForCommits$({ repoPath: '/repo', shas: [], processes: h.processes, specs: h.specs })),
    ).resolves.toBeNull();
    expect(h.spawned).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
});
