import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { UnnamedContext } from '../correlate/rules';
import { contextKey } from '../model/block';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { ticketWritingRequest, writeTicketWithAgent$ } from './write';

const CONTEXT: UnnamedContext['context'] = { repoPath: '/Users/tom/dev/ea-frontend', branch: 'feat/hub-review' };

const UNNAMED: UnnamedContext = {
  id: contextKey(CONTEXT),
  context: CONTEXT,
  observedMs: 21 * 60_000,
  from: new Date('2026-08-16T09:00:00Z'),
  to: new Date('2026-08-16T09:21:00Z'),
  suggestion: { repoPath: CONTEXT.repoPath, branch: CONTEXT.branch },
};

const REQUEST = ticketWritingRequest({ context: UNNAMED, notes: ['feat(hub): Add the review feedback panel'] });

const answer = (wording: unknown) => JSON.stringify({ is_error: false, structured_output: wording });

const stubRunner = (results: (ProcessResult | Error)[]) => {
  const specs: ProcessSpec[] = [];
  const runner: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);
      const next = results[Math.min(specs.length - 1, results.length - 1)];

      return next instanceof Error ? throwError(() => next) : of(next);
    }),
  };

  return { runner, specs };
};

const ok = (stdout: string): ProcessResult => ({ code: 0, stdout, stderr: '' });

describe('ticketWritingRequest', () => {
  it('sends the repository name and never its path', () => {
    expect(REQUEST).toEqual({
      repo: 'ea-frontend',
      branch: 'feat/hub-review',
      app: undefined,
      minutes: 21,
      notes: ['feat(hub): Add the review feedback panel'],
    });
  });
});

describe('writeTicketWithAgent$', () => {
  it('answers the wording the agent wrote', async () => {
    const { runner, specs } = stubRunner([ok(answer({ summary: 'Review feedback panel', description: 'It shows.' }))]);

    await expect(firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }))).resolves.toEqual({
      summary: 'Review feedback panel',
      description: 'It shows.',
    });
    expect(specs[0]?.stdin).toBe(JSON.stringify(REQUEST));
    expect(specs[0]?.args).toContain('--safe-mode');
  });

  it('trims a summary Jira would refuse', async () => {
    const summary = 'x'.repeat(300);
    const { runner } = stubRunner([ok(answer({ summary, description: 'd' }))]);
    const written = await firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }));

    expect(written?.summary).toHaveLength(255);
  });

  it('retries once, then answers nothing rather than a half-written ticket', async () => {
    const { runner, specs } = stubRunner([ok('not json')]);

    await expect(firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }))).resolves.toBeNull();
    expect(specs).toHaveLength(2);
  });

  it('treats an empty summary as a failed run', async () => {
    const { runner } = stubRunner([ok(answer({ summary: '   ', description: 'd' }))]);

    await expect(firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }))).resolves.toBeNull();
  });

  it('treats a non-zero exit as a failed run', async () => {
    const { runner, specs } = stubRunner([{ code: 1, stdout: '', stderr: 'not logged in' }]);

    await expect(firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }))).resolves.toBeNull();
    expect(specs).toHaveLength(2);
  });
});
