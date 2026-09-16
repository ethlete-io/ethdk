import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { JiraIssue } from '../jira/issue';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { TICKET_MATCH_SYSTEM_PROMPT, matchTicketWithAgent$ } from './match';
import { standInWritingRequest } from './write';

const issue = (key: string, summary: string): JiraIssue => ({ key, id: key, summary, issueType: 'Task' });

const STAND_IN = { name: 'Review feedback panel', description: 'It shows the reviewer note.', days: ['2026-09-16'] };

const REQUEST = standInWritingRequest({
  standIn: STAND_IN,
  parents: [issue('FIP-100', 'Hub')],
  issues: [issue('FIP-2810', 'Review feedback panel')],
});

const answer = (match: unknown) => JSON.stringify({ is_error: false, structured_output: match });

const stubRunner = (results: (ProcessResult | Error)[]) => {
  const specs: ProcessSpec[] = [];
  const runner: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);
      const next = results[Math.min(specs.length - 1, results.length - 1)]!;

      return next instanceof Error ? throwError(() => next) : of(next);
    }),
  };

  return { runner, specs };
};

const ok = (stdout: string): ProcessResult => ({ code: 0, stdout, stderr: '' });

describe('matchTicketWithAgent$', () => {
  it('answers both keys the agent chose from what it was offered', async () => {
    const { runner } = stubRunner([
      ok(answer({ parentKey: 'FIP-100', existingKey: 'FIP-2810', existingReason: 'It names the same panel.' })),
    ]);

    await expect(firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }))).resolves.toEqual({
      parentKey: 'FIP-100',
      existingKey: 'FIP-2810',
      existingReason: 'It names the same panel.',
    });
  });

  it('asks for a match rather than a ticket, so the spend is reported on its own', async () => {
    const { runner, specs } = stubRunner([ok(answer({ parentKey: null, existingKey: null, existingReason: '' }))]);

    await firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }));

    expect(specs[0]?.ask).toBe('a match');
    expect(specs[0]?.args).toContain(TICKET_MATCH_SYSTEM_PROMPT);
  });

  it('sends the same payload a writing press would have sent', async () => {
    const { runner, specs } = stubRunner([ok(answer({ parentKey: null, existingKey: null, existingReason: '' }))]);

    await firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }));

    expect(JSON.parse(specs[0]?.stdin ?? '{}')).toEqual(REQUEST);
  });

  it('reads an empty answer as nothing tracking the work, not as a failed run', async () => {
    const { runner } = stubRunner([ok(answer({ parentKey: null, existingKey: null, existingReason: '' }))]);

    await expect(firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }))).resolves.toEqual({
      parentKey: undefined,
      existingKey: undefined,
      existingReason: undefined,
    });
  });

  it('drops a key the request never offered', async () => {
    const { runner } = stubRunner([
      ok(answer({ parentKey: 'FIP-999', existingKey: 'FIP-888', existingReason: 'It made this up.' })),
    ]);

    await expect(firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }))).resolves.toEqual({
      parentKey: undefined,
      existingKey: undefined,
      existingReason: undefined,
    });
  });

  it('drops the reason when no existing key survived', async () => {
    const { runner } = stubRunner([
      ok(answer({ parentKey: 'FIP-100', existingKey: null, existingReason: 'It answered a reason anyway.' })),
    ]);

    await expect(firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }))).resolves.toEqual({
      parentKey: 'FIP-100',
      existingKey: undefined,
      existingReason: undefined,
    });
  });

  it('runs a second time before it gives up', async () => {
    const { runner, specs } = stubRunner([
      new Error('the agent crashed'),
      ok(answer({ parentKey: null, existingKey: 'FIP-2810', existingReason: 'Same panel.' })),
    ]);

    await expect(firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }))).resolves.toMatchObject({
      existingKey: 'FIP-2810',
    });
    expect(specs).toHaveLength(2);
  });

  it('answers null when the run keeps failing', async () => {
    const { runner } = stubRunner([{ code: 1, stdout: '', stderr: 'not logged in' }]);

    await expect(firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }))).resolves.toBeNull();
  });

  it('answers null when the agent returns no JSON', async () => {
    const { runner } = stubRunner([ok('not json')]);

    await expect(firstValueFrom(matchTicketWithAgent$({ runner, request: REQUEST }))).resolves.toBeNull();
  });

  it('reads the reason back into real names', async () => {
    const names = ['Kessel'];
    const request = standInWritingRequest({
      standIn: { name: 'Kessel review', days: ['2026-09-16'] },
      issues: [issue('FIP-2810', 'Kessel review')],
      maskedNames: names,
    });
    const masked = request.issues[0]!.key;
    const { runner } = stubRunner([
      ok(answer({ parentKey: null, existingKey: masked, existingReason: `${request.standIn?.name} is that issue.` })),
    ]);

    const match = await firstValueFrom(matchTicketWithAgent$({ runner, request, maskedNames: names }));

    expect(match?.existingKey).toBe('FIP-2810');
    expect(match?.existingReason).toBe('Kessel review is that issue.');
  });
});
