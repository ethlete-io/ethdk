import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { maskNames, pseudonymMap } from '../reason/pseudonym';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import {
  WORKLOG_WRITING_JSON_SCHEMA,
  WorklogWritingRequest,
  worklogWritingSystemPrompt,
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
    expect(spec.ask).toBe('a worklog');
    expect(spec.args.join(' ')).toContain('one line saying what the work in this stretch did');
    expect(worklogWritingSystemPrompt('German')).toContain('Never repeat `issue.summary`');
    expect(worklogWritingSystemPrompt('German')).toContain('Aim under 100 characters');
    expect(worklogWritingSystemPrompt('German')).not.toContain('still to do');
    expect(WORKLOG_WRITING_JSON_SCHEMA.required).toEqual(['description']);
  });

  it('writes in German unless another worklog language is configured', () => {
    expect(worklogWritingSpec({ request: REQUEST }).args.join(' ')).toContain(
      'Write the description in German, whatever language the notes or this instruction are in.',
    );
    expect(worklogWritingSpec({ request: REQUEST, language: 'French' }).args.join(' ')).toContain(
      'Write the description in French',
    );
    expect(worklogWritingSpec({ request: REQUEST }).args.join(' ')).not.toContain('the language the notes are in');
  });

  it('follows the notes only where the worklog language is left empty', () => {
    expect(worklogWritingSpec({ request: REQUEST, language: '' }).args.join(' ')).toContain(
      'Write in the language the notes are in',
    );
  });

  it('lets the worklog language outrank the language every other answer is written in', () => {
    const prompt = worklogWritingSpec({ request: REQUEST, options: { language: 'English' } }).args.join(' ');

    expect(prompt).toContain('Write the description in German');
    expect(prompt).not.toContain('Write every word you answer in English');
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
