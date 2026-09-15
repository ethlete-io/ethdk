import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AgentUsageEvent, TIMETRACK_PROVIDER } from '../model/event';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { agentRunSpend, meteredRunner } from './spend';

const AT = new Date(2026, 8, 15, 11, 30, 0);

const ENVELOPE = JSON.stringify({
  session_id: 'run-7',
  modelUsage: { 'claude-opus-5': { inputTokens: 12 } },
  usage: {
    input_tokens: 12,
    output_tokens: 340,
    cache_creation_input_tokens: 50,
    cache_read_input_tokens: 9000,
    output_tokens_details: { thinking_tokens: 120 },
  },
});

const result = (stdout: string): ProcessResult => ({ code: 0, stdout, stderr: '' });

const stubRunner = (results: ProcessResult[]): TimetrackProcessRunner & { specs: ProcessSpec[] } => {
  const specs: ProcessSpec[] = [];
  let next = 0;

  return {
    specs,
    run$: (spec) => {
      specs.push(spec);

      return of(results[next++] ?? result(''));
    },
  };
};

describe('agentRunSpend', () => {
  it('reads what one run spent out of the CLI envelope, under the reserved provider', () => {
    const spend = agentRunSpend({ stdout: ENVELOPE, ask: 'the day', at: AT });

    expect(spend).toEqual<AgentUsageEvent>({
      at: AT,
      source: 'agent-usage',
      kind: 'agent-usage',
      provider: TIMETRACK_PROVIDER,
      sessionId: 'the day',
      turnId: 'run-7',
      cwd: '',
      model: 'claude-opus-5',
      usage: { input: 12, output: 340, cacheWrite: 50, cacheRead: 9000, thinking: 120 },
    });
  });

  it('names no working directory, so no stream and no band can take the turn', () => {
    expect(agentRunSpend({ stdout: ENVELOPE, ask: 'a ticket', at: AT })?.cwd).toBe('');
  });

  it('keeps a run that answered an error, because it spent its tokens either way', () => {
    const stdout = JSON.stringify({ is_error: true, session_id: 'run-8', usage: { output_tokens: 7 } });

    expect(agentRunSpend({ stdout, ask: 'the day', at: AT })?.usage.output).toBe(7);
  });

  it('keeps a run that reports all zeros, because the call was still made', () => {
    const stdout = JSON.stringify({ session_id: 'run-9', usage: { output_tokens: 0 } });
    const spend = agentRunSpend({ stdout, ask: 'the day', at: AT });

    expect(spend?.turnId).toBe('run-9');
    expect(spend?.usage.output).toBe(0);
    expect(spend?.model).toBe('unknown');
  });

  it('falls back to the instant as the id, so a retry is a second turn rather than the same one', () => {
    const stdout = JSON.stringify({ usage: { output_tokens: 1 } });

    expect(agentRunSpend({ stdout, ask: 'the day', at: AT })?.turnId).toBe(AT.toISOString());
  });

  it('reports nothing for output that is no envelope, and nothing for one that reports no usage', () => {
    expect(agentRunSpend({ stdout: 'not json', ask: 'the day', at: AT })).toBeNull();
    expect(agentRunSpend({ stdout: JSON.stringify({ session_id: 'x' }), ask: 'the day', at: AT })).toBeNull();
  });
});

describe('meteredRunner', () => {
  it('records what a spec that names an ask spent', async () => {
    const recorded: AgentUsageEvent[] = [];
    const runner = stubRunner([result(ENVELOPE)]);
    const metered = meteredRunner({
      runner,
      record$: (event) => {
        recorded.push(event);

        return of(undefined);
      },
      now: () => AT,
    });

    await firstValueFrom(metered.run$({ command: 'claude', args: [], ask: 'the day' }));

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.provider).toBe(TIMETRACK_PROVIDER);
    expect(recorded[0]?.usage.output).toBe(340);
  });

  it('meters no run that names no ask, so a git or forge call is never read as a model call', async () => {
    const record$ = vi.fn(() => of(undefined));
    const runner = stubRunner([result(ENVELOPE)]);
    const metered = meteredRunner({ runner, record$, now: () => AT });

    await firstValueFrom(metered.run$({ command: 'git', args: ['status'] }));

    expect(record$).not.toHaveBeenCalled();
  });

  it('answers the run even when the recording fails, so the meter never costs the user the answer', async () => {
    const runner = stubRunner([result(ENVELOPE)]);
    const metered = meteredRunner({
      runner,
      record$: () => throwError(() => new Error('store is locked')) as Observable<unknown>,
      now: () => AT,
    });

    const answer = await firstValueFrom(metered.run$({ command: 'claude', args: [], ask: 'the day' }));

    expect(answer.stdout).toBe(ENVELOPE);
  });

  it('passes the spec through untouched, so the run is the one the caller asked for', async () => {
    const runner = stubRunner([result(ENVELOPE)]);
    const metered = meteredRunner({ runner, record$: () => of(undefined), now: () => AT });
    const spec: ProcessSpec = { command: 'claude', args: ['--print'], stdin: 'a payload', ask: 'a ticket' };

    await firstValueFrom(metered.run$(spec));

    expect(runner.specs).toEqual([spec]);
  });
});
