import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { UnnamedContext } from '../model/attribution';
import { JiraIssue } from '../jira/issue';
import { contextKey } from '../model/block';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import {
  parentWritingRequest,
  standInWritingRequest,
  ticketWritingRequest,
  writeParentWithAgent$,
  writeTicketWithAgent$,
} from './write';

const CONTEXT: UnnamedContext['context'] = { repoPath: '/Users/tom/dev/ea-frontend', branch: 'feat/hub-review' };

const UNNAMED: UnnamedContext = {
  id: contextKey(CONTEXT),
  context: CONTEXT,
  observedMs: 21 * 60_000,
  from: new Date('2026-08-16T09:00:00Z'),
  to: new Date('2026-08-16T09:21:00Z'),
  suggestion: { repoPath: CONTEXT.repoPath, branch: CONTEXT.branch },
};

const issue = (key: string, summary: string): JiraIssue => ({ key, id: key, summary, issueType: 'Task' });

const REQUEST = ticketWritingRequest({
  context: UNNAMED,
  notes: ['feat(hub): Add the review feedback panel'],
  parents: [issue('FIP-100', 'Hub')],
  issues: [issue('FIP-2810', 'Review feedback panel')],
});

const answer = (wording: unknown) => JSON.stringify({ is_error: false, structured_output: wording });

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

describe('ticketWritingRequest', () => {
  it('sends the repository name and never its path', () => {
    expect(REQUEST).toEqual({
      repo: 'ea-frontend',
      branch: 'feat/hub-review',
      app: undefined,
      minutes: 21,
      notes: ['feat(hub): Add the review feedback panel'],
      parents: [{ key: 'FIP-100', summary: 'Hub' }],
      issues: [{ key: 'FIP-2810', summary: 'Review feedback panel' }],
    });
  });

  it('carries the spec in pseudonyms, and leaves it out where the work sits under none', () => {
    const request = ticketWritingRequest({
      context: UNNAMED,
      notes: [],
      spec: {
        title: 'Nordkiosk hub',
        type: 'feature',
        tags: ['nordkiosk', 'hub'],
        intent: 'The Nordkiosk hub shows a review.',
        epicKey: 'NORDKIOSK-12',
      },
      maskedNames: ['Nordkiosk'],
    });

    expect(JSON.stringify(request.spec)).not.toContain('Nordkiosk');
    expect(JSON.stringify(request.spec).toLowerCase()).not.toContain('nordkiosk');
    expect(request.spec?.epicKey).toMatch(/-12$/);
    expect(ticketWritingRequest({ context: UNNAMED, notes: [] })).not.toHaveProperty('spec');
  });
});

describe('writeTicketWithAgent$', () => {
  it('answers the wording the agent wrote', async () => {
    const { runner, specs } = stubRunner([ok(answer({ summary: 'Review feedback panel', description: 'It shows.' }))]);

    await expect(firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }))).resolves.toEqual({
      summary: 'Review feedback panel',
      description: 'It shows.',
      parentKey: undefined,
      existingKey: undefined,
      existingReason: undefined,
    });
    expect(specs[0]?.stdin).toBe(JSON.stringify(REQUEST));
    expect(specs[0]?.args).toContain('--safe-mode');
  });

  it('keeps a parent and an existing issue the request offered', async () => {
    const { runner } = stubRunner([
      ok(
        answer({
          summary: 's',
          description: 'd',
          parentKey: 'fip-100',
          existingKey: 'FIP-2810',
          existingReason: 'the panel is its whole subject',
        }),
      ),
    ]);
    const written = await firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }));

    expect(written?.parentKey).toBe('FIP-100');
    expect(written?.existingKey).toBe('FIP-2810');
    expect(written?.existingReason).toBe('the panel is its whole subject');
  });

  it('drops a key the request never offered rather than showing an invented issue', async () => {
    const { runner } = stubRunner([
      ok(answer({ summary: 's', description: 'd', parentKey: 'FIP-9', existingKey: 'SCRUM-2' })),
    ]);
    const written = await firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }));

    expect(written?.parentKey).toBeUndefined();
    expect(written?.existingKey).toBeUndefined();
  });

  it('drops the reason when no existing issue was chosen', async () => {
    const { runner } = stubRunner([
      ok(answer({ summary: 's', description: 'd', existingKey: null, existingReason: 'left over' })),
    ]);

    await expect(firstValueFrom(writeTicketWithAgent$({ runner, request: REQUEST }))).resolves.toMatchObject({
      existingReason: undefined,
    });
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

describe('the name list on the ticket call', () => {
  const NAMES = ['Fip', 'ea-frontend'];

  const MASKED = ticketWritingRequest({
    context: UNNAMED,
    notes: ['feat(hub): Add the review feedback panel for ea-frontend'],
    parents: [issue('FIP-100', 'Hub')],
    issues: [issue('FIP-2810', 'Review feedback panel')],
    maskedNames: NAMES,
  });

  it('masks the repository, the notes and the project prefix of every offered key', () => {
    const printed = JSON.stringify(MASKED);

    expect(printed).not.toContain('ea-frontend');
    expect(printed).not.toContain('FIP-');
    expect(MASKED.parents[0]?.key).toMatch(/^[A-Z]+-100$/);
    expect(MASKED.issues[0]?.key).toMatch(/^[A-Z]+-2810$/);
  });

  it('reads the answer back into real names, keys included', async () => {
    const existingKey = MASKED.issues[0]?.key ?? '';
    const parentKey = MASKED.parents[0]?.key ?? '';
    const { runner } = stubRunner([
      ok(
        answer({
          summary: `A review panel for ${MASKED.repo}`,
          description: 'It shows the feedback.',
          parentKey,
          existingKey,
          existingReason: `${existingKey} already tracks it`,
        }),
      ),
    ]);

    const wording = await firstValueFrom(writeTicketWithAgent$({ runner, request: MASKED, maskedNames: NAMES }));

    expect(wording?.summary).toBe('A review panel for ea-frontend');
    expect(wording?.parentKey).toBe('FIP-100');
    expect(wording?.existingKey).toBe('FIP-2810');
    expect(wording?.existingReason).toBe('FIP-2810 already tracks it');
  });

  it('masks nothing when the name list is empty', () => {
    expect(ticketWritingRequest({ context: UNNAMED, notes: [], parents: [], issues: [], maskedNames: [] }).repo).toBe(
      'ea-frontend',
    );
  });
});

describe('standInWritingRequest', () => {
  const WAITING = {
    name: 'Mesa invoice export',
    description: 'The finance team needs the run as a CSV.',
    days: ['2026-09-10', '2026-09-11', '2026-09-14'],
  };

  it('sends the name the user gave the work, the days it waited, and no minutes', () => {
    expect(standInWritingRequest({ standIn: WAITING, parents: [issue('FIP-100', 'Hub')] })).toEqual({
      standIn: { name: 'Mesa invoice export', description: 'The finance team needs the run as a CSV.', days: 3 },
      notes: [],
      parents: [{ key: 'FIP-100', summary: 'Hub' }],
      issues: [],
    });
  });

  it('leaves out a description the stand-in never carried', () => {
    const request = standInWritingRequest({ standIn: { name: 'Invoice export', days: ['2026-09-10'] } });

    expect(request.standIn?.description).toBeUndefined();
  });

  it("masks the name and the description, which are the user's own free text", () => {
    const request = standInWritingRequest({ standIn: WAITING, maskedNames: ['Mesa', 'finance team'] });
    const printed = JSON.stringify(request);

    expect(printed).not.toContain('Mesa');
    expect(printed).not.toContain('finance team');
  });

  it('reads the answer back into the real names', async () => {
    const request = standInWritingRequest({ standIn: WAITING, maskedNames: ['Mesa'] });
    const { runner } = stubRunner([
      ok(answer({ summary: `Export the ${request.standIn?.name}`, description: 'It writes a CSV.' })),
    ]);

    const wording = await firstValueFrom(writeTicketWithAgent$({ runner, request, maskedNames: ['Mesa'] }));

    expect(wording?.summary).toBe('Export the Mesa invoice export');
  });
});

describe('parentWritingRequest', () => {
  it('passes the spec through from the ticket payload it was given', () => {
    const request = ticketWritingRequest({
      context: UNNAMED,
      notes: [],
      spec: { title: 'The hub', intent: 'It shows a review.' },
    });

    const parent = parentWritingRequest({ level: 'Epic', child: { summary: 'a', description: 'b' }, request });

    expect(parent.spec).toEqual(request.spec);
  });
  it('carries the child in pseudonyms and offers the agent no issue to pick from', () => {
    const request = ticketWritingRequest({
      context: UNNAMED,
      notes: ['feat(hub): Add the review feedback panel'],
      parents: [issue('FIP-100', 'Hub')],
      issues: [issue('FIP-2810', 'Review feedback panel')],
      maskedNames: ['Nordkiosk'],
    });

    const parent = parentWritingRequest({
      level: 'Epic',
      child: { summary: 'The Nordkiosk hub', description: 'It serves Nordkiosk.' },
      request,
      maskedNames: ['Nordkiosk'],
    });

    expect(parent.child.summary).not.toContain('Nordkiosk');
    expect(parent.child.description).not.toContain('Nordkiosk');
    expect(parent).not.toHaveProperty('issues');
    expect(parent).not.toHaveProperty('parents');
    expect(parent.level).toBe('Epic');
  });
});

describe('writeParentWithAgent$', () => {
  it('answers the wording the agent wrote, in real names', async () => {
    const { runner, specs } = stubRunner([ok(answer({ summary: 'Hub for Kessel', description: 'Kessel needs one.' }))]);
    const request = parentWritingRequest({
      level: 'Epic',
      child: { summary: 'A panel', description: 'For Kessel.' },
      request: REQUEST,
      maskedNames: ['Kessel'],
    });

    await expect(firstValueFrom(writeParentWithAgent$({ runner, request, maskedNames: ['Kessel'] }))).resolves.toEqual({
      summary: 'Hub for Kessel',
      description: 'Kessel needs one.',
    });
    expect(specs[0]?.args).toContain('--safe-mode');
  });

  it('answers null when the agent fails, so the drafted parent stays', async () => {
    const { runner } = stubRunner([new Error('no agent')]);
    const request = parentWritingRequest({
      level: 'Epic',
      child: { summary: 'A panel', description: '' },
      request: REQUEST,
    });

    await expect(firstValueFrom(writeParentWithAgent$({ runner, request }))).resolves.toBeNull();
  });
});
