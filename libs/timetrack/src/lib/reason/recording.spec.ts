import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TimetrackProcessRunner } from '../transport/ports';
import { ModelCall, recordingRunner } from './recording';

const answering = (stdout: string): TimetrackProcessRunner => ({
  run$: () => of({ code: 0, stdout, stderr: '' }),
});

describe('recordingRunner', () => {
  it('reports a model call when it starts and with its reply when it ends', async () => {
    const calls: ModelCall[] = [];
    let clock = 1_000;
    const runner = recordingRunner({
      runner: answering('{"result":"ok"}'),
      record: (call) => calls.push(call),
      now: () => clock++,
    });

    await lastValueFrom(runner.run$({ command: 'claude', args: ['-p'], stdin: 'Name this work', ask: 'a ticket' }));

    expect(calls).toEqual([
      { id: 0, ask: 'a ticket', command: 'claude', args: ['-p'], stdin: 'Name this work', startedAtMs: 1_000 },
      {
        id: 0,
        ask: 'a ticket',
        command: 'claude',
        args: ['-p'],
        stdin: 'Name this work',
        startedAtMs: 1_000,
        endedAtMs: 1_001,
        code: 0,
        stdout: '{"result":"ok"}',
        stderr: '',
      },
    ]);
  });

  it('reports a call that failed to run with its error', async () => {
    const calls: ModelCall[] = [];
    const runner = recordingRunner({
      runner: { run$: () => throwError(() => new Error('claude not found')) },
      record: (call) => calls.push(call),
    });

    await expect(lastValueFrom(runner.run$({ command: 'claude', args: [], ask: 'a worklog' }))).rejects.toThrow();

    expect(calls.at(-1)?.error).toBe('claude not found');
  });

  it('reports nothing for a run that is no model call', async () => {
    const calls: ModelCall[] = [];
    const runner = recordingRunner({ runner: answering('main'), record: (call) => calls.push(call) });

    await lastValueFrom(runner.run$({ command: 'git', args: ['branch'] }));

    expect(calls).toEqual([]);
  });
});
