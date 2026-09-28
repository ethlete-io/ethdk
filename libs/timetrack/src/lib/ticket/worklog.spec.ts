import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { maskNames, pseudonymMap } from '../reason/pseudonym';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import {
  WORKLOG_WRITING_JSON_SCHEMA,
  WORKLOG_WRITING_SYSTEM_PROMPT,
  WorklogWritingRequest,
  worklogWritingSpec,
  writeWorklogWithAgent$,
} from './worklog';

const REQUEST: WorklogWritingRequest = {
  repo: 'shop',
  minutes: 60,
  issue: { key: 'ABC-1', summary: 'Month export' },
  notes: ['Export the month as CSV'],
};

const answer = (wording: unknown) => JSON.stringify({ is_error: false, structured_output: wording });

const ok = (stdout: string): ProcessResult => ({ code: 0, stdout, stderr: '' });

const stubRunner = (results: (ProcessResult | Error)[]) => {
  const specs: ProcessSpec[] = [];
  const runner: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);
      const next = results[Math.min(specs.length - 1, results.length - 1)] ?? ok('');

      return next instanceof Error ? throwError(() => next) : of(next);
    }),
  };

  return { runner, specs };
};

const write = (results: (ProcessResult | Error)[], maskedNames?: string[]) =>
  firstValueFrom(writeWorklogWithAgent$({ runner: stubRunner(results).runner, request: REQUEST, maskedNames }));

describe('worklogWritingSpec', () => {
  it('asks for one line of done work that does not repeat the ticket summary', () => {
    const spec = worklogWritingSpec({ request: REQUEST });

    expect(spec.stdin).toBe(JSON.stringify(REQUEST));
    expect(spec.args.join(' ')).toContain('one line saying what the work in this stretch did');
    expect(WORKLOG_WRITING_SYSTEM_PROMPT).toContain('Never repeat `issue.summary`');
    expect(WORKLOG_WRITING_SYSTEM_PROMPT).toContain('Aim under 100 characters');
    expect(WORKLOG_WRITING_SYSTEM_PROMPT).not.toContain('still to do');
    expect(WORKLOG_WRITING_JSON_SCHEMA.required).toEqual(['description']);
  });
});

describe('writeWorklogWithAgent$', () => {
  it('answers the line, folded onto one line', async () => {
    expect(await write([ok(answer({ description: '  Wrote the CSV\n writer  ' }))])).toBe('Wrote the CSV writer');
  });

  it('reads the answer back into real names', async () => {
    const pseudonym = maskNames({ text: 'Nebula', map: pseudonymMap(['Nebula']) });

    expect(await write([ok(answer({ description: `Wrote the ${pseudonym} export` }))], ['Nebula'])).toBe(
      'Wrote the Nebula export',
    );
  });

  it('answers null for an answer of the wrong shape', async () => {
    expect(await write([ok(answer({ summary: 'Month export', description: 3 }))])).toBeNull();
  });

  it('answers null for an empty line', async () => {
    expect(await write([ok(answer({ description: '  ' }))])).toBeNull();
  });

  it('answers null when the agent fails', async () => {
    expect(await write([new Error('no agent')])).toBeNull();
  });
});
