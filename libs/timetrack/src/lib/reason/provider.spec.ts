import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { ReasoningPlan } from './model';
import { reasoningSpec, runReasoning$ } from './provider';

const PLAN: ReasoningPlan = {
  request: {
    candidates: [{ issueKey: 'FIP-2201', summary: 'Hub query rewrite' }],
    contexts: [{ id: 'c1', repo: 'ea-frontend', branch: 'refactor/hub-query-v3', minutes: 95, notes: [] }],
  },
  contextIds: { c1: 'repo:/Users/tom/dev/ea-frontend@refactor/hub-query-v3' },
  hash: 'abc',
};

const EMPTY_PLAN: ReasoningPlan = { request: { candidates: [], contexts: [] }, contextIds: {}, hash: 'empty' };

const ANSWER = JSON.stringify({
  is_error: false,
  structured_output: { answers: [{ id: 'c1', issueKey: 'FIP-2201', reason: 'the branch names the rewrite' }] },
});

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

describe('reasoningSpec', () => {
  it('disables every tool and leaves authentication alone', () => {
    const spec = reasoningSpec({ plan: PLAN });

    expect(spec.command).toBe('claude');
    expect(spec.args).toContain('--safe-mode');
    expect(spec.args).not.toContain('--bare');
    expect(spec.args.slice(spec.args.indexOf('--tools'), spec.args.indexOf('--tools') + 2)).toEqual(['--tools', '']);
    expect(spec.stdin).toBe(JSON.stringify(PLAN.request));
  });

  it('leaves the model to the CLI when none is configured', () => {
    expect(reasoningSpec({ plan: PLAN, options: { model: '' } }).args).not.toContain('--model');
    expect(reasoningSpec({ plan: PLAN, options: { model: 'sonnet' } }).args).toContain('sonnet');
  });
});

describe('runReasoning$', () => {
  it('proposes what the provider answered', async () => {
    const { runner } = stubRunner([ok(ANSWER)]);

    await expect(firstValueFrom(runReasoning$({ runner, plan: PLAN }))).resolves.toEqual({
      answers: [{ contextId: PLAN.contextIds['c1'], issueKey: 'FIP-2201', reason: 'the branch names the rewrite' }],
      failure: null,
    });
  });

  it('spawns nothing when there is no question or no candidate to answer with', async () => {
    const { runner, specs } = stubRunner([ok(ANSWER)]);

    await expect(firstValueFrom(runReasoning$({ runner, plan: EMPTY_PLAN }))).resolves.toEqual({
      answers: [],
      failure: null,
    });
    expect(specs).toEqual([]);
  });

  it('retries once, then proposes nothing rather than guessing', async () => {
    const { runner, specs } = stubRunner([ok('not json')]);

    const outcome = await firstValueFrom(runReasoning$({ runner, plan: PLAN }));

    expect(outcome.answers).toEqual([]);
    expect(outcome.failure).toBeTruthy();
    expect(specs).toHaveLength(2);
  });

  it('recovers when the second run answers', async () => {
    const { runner } = stubRunner([ok('not json'), ok(ANSWER)]);

    await expect(firstValueFrom(runReasoning$({ runner, plan: PLAN }))).resolves.toMatchObject({ failure: null });
  });

  it('reports why a non-zero exit produced nothing, so it is not read as an answer', async () => {
    const { runner, specs } = stubRunner([{ code: 1, stdout: '', stderr: 'not logged in' }]);

    await expect(firstValueFrom(runReasoning$({ runner, plan: PLAN }))).resolves.toEqual({
      answers: [],
      failure: 'not logged in',
    });
    expect(specs).toHaveLength(2);
  });

  it('answers nothing without a failure when the provider proposed no attribution', async () => {
    const { runner } = stubRunner([ok(JSON.stringify({ structured_output: { answers: [] } }))]);

    await expect(firstValueFrom(runReasoning$({ runner, plan: PLAN }))).resolves.toEqual({
      answers: [],
      failure: null,
    });
  });
});
