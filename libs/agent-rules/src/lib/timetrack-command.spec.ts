import { lstatSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'fs';
import { createHmac } from 'crypto';
import { IncomingMessage, Server, ServerResponse, createServer } from 'http';
import { platform, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timetrackCommand } from './timetrack-command';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

let server: Server | undefined;

const withEndpoint = async (handler: Handler) => {
  server = createServer((request, response) => {
    if (!request.url?.startsWith('/agent/proof')) return handler(request, response);

    const nonce = new URL(request.url, 'http://127.0.0.1').searchParams.get('nonce') ?? '';

    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({ ok: true, value: { proof: createHmac('sha256', 'secret').update(nonce).digest('hex') } }),
    );
  });

  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const path = join(mkdtempSync(join(tmpdir(), 'agent-rules-command-')), 'agent.json');

  writeFileSync(path, JSON.stringify({ version: 3, port, token: 'secret' }));
  process.env['TIMETRACK_AGENT_DISCOVERY'] = path;
};

const answered =
  (value: unknown): Handler =>
  (_, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ok: true, value }));
  };

const printedLines = () => {
  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));

  return lines;
};

/** Answers each operation from its own entry, and records every operation the command asked for. */
const answeredByOp = (values: Record<string, unknown>) => {
  const asked: string[] = [];
  const handler: Handler = (request, response) => {
    let body = '';

    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const op = String((JSON.parse(body || '{}') as { op?: string }).op ?? '');

      asked.push(op);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, value: values[op] ?? {} }));
    });
  };

  return { handler, asked };
};

const standIn = (over: Record<string, unknown>) => ({
  id: 'stand-in:1:repo',
  name: 'Some work',
  state: 'open',
  days: ['2026-09-16'],
  author: 'app',
  createdAtMs: Date.UTC(2026, 8, 16),
  ...over,
});

const run = (argv: string[]) => timetrackCommand({ root: '/repo', argv });

beforeEach(() => {
  vi.stubEnv('TIMETRACK_CLIENT', '');
  vi.stubEnv('CLAUDECODE', '');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete process.env['TIMETRACK_AGENT_DISCOVERY'];

  const running = server;

  server = undefined;

  if (running) await new Promise<void>((resolve) => running.close(() => resolve()));
});

describe('timetrack edit', () => {
  it('refuses two edits in one call rather than making one of them', async () => {
    let calls = 0;

    await withEndpoint((request, response) => {
      calls += 1;
      answered({ day: '2026-09-16', applied: 1, rows: [], warnings: [] })(request, response);
    });

    await expect(run(['edit', 'row-1', '--issue', 'DEMO-2', '--state', 'rejected'])).rejects.toThrow(
      /One edit per call, and these name 2: --issue, --state/,
    );
    expect(calls).toBe(0);
  });

  it('still takes the one pair that names a single change', async () => {
    await withEndpoint(answered({ day: '2026-09-16', applied: 1, rows: [], warnings: [] }));
    printedLines();

    await expect(
      run(['edit', 'row-1', '--from', '2026-09-16T09:00:00Z', '--to', '2026-09-16T10:00:00Z']),
    ).resolves.toBe(0);
  });
});

describe('timetrack output', () => {
  it('prints a terminal control sequence in an issue summary as text', async () => {
    await withEndpoint(answered({ issue: { key: 'FIP-1', id: '1', issueType: 'Task', summary: '[2JGone' } }));

    const lines = printedLines();

    await run(['issue', 'FIP-1']);

    expect(lines.join('\n')).toContain('\\x1b[2JGone');
    expect(lines.join('\n')).not.toContain('');
  });
});

describe('timetrack day --out', () => {
  const dayEvents = { day: '2026-09-16', events: [{ kind: 'window' }] };

  it('writes a new export readable by its owner alone', async () => {
    await withEndpoint(answered(dayEvents));
    printedLines();

    const out = join(mkdtempSync(join(tmpdir(), 'agent-rules-out-')), 'day.json');

    await run(['day', '2026-09-16', '--out', out]);

    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(dayEvents);
    if (platform() !== 'win32') expect(statSync(out).mode & 0o777).toBe(0o600);
  });

  it('refuses a destination that is already there until an overwrite is asked for', async () => {
    await withEndpoint(answered(dayEvents));
    printedLines();

    const out = join(mkdtempSync(join(tmpdir(), 'agent-rules-out-')), 'day.json');

    writeFileSync(out, 'keep me');

    await expect(run(['day', '2026-09-16', '--out', out])).rejects.toThrow(/already exists/);
    expect(readFileSync(out, 'utf8')).toBe('keep me');

    await run(['day', '2026-09-16', '--out', out, '--overwrite']);

    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(dayEvents);
    if (platform() !== 'win32') expect(statSync(out).mode & 0o777).toBe(0o600);
  });

  it('resolves a relative --out against the root and answers --json with data', async () => {
    await withEndpoint(answered(dayEvents));

    const lines = printedLines();
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-root-'));

    await timetrackCommand({ root, argv: ['day', '2026-09-16', '--out', 'day.json', '--json'] });

    expect(JSON.parse(readFileSync(join(root, 'day.json'), 'utf8'))).toEqual(dayEvents);
    expect(JSON.parse(lines.join('\n'))).toEqual({ day: '2026-09-16', events: 1, out: join(root, 'day.json') });
  });

  it.runIf(platform() !== 'win32')('never writes through a symlink somebody else planted', async () => {
    await withEndpoint(answered(dayEvents));
    printedLines();

    const directory = mkdtempSync(join(tmpdir(), 'agent-rules-out-'));
    const target = join(directory, 'target.json');
    const out = join(directory, 'day.json');

    writeFileSync(target, 'somebody else');
    symlinkSync(target, out);

    await expect(run(['day', '2026-09-16', '--out', out])).rejects.toThrow(/already exists/);
    await expect(run(['day', '2026-09-16', '--out', out, '--overwrite'])).rejects.toThrow(/not a regular file/);

    expect(readFileSync(target, 'utf8')).toBe('somebody else');
    expect(lstatSync(out).isSymbolicLink()).toBe(true);
  });
});

describe('timetrack resync', () => {
  it('asks the app to read the agent sessions of the named checkout again, as an absolute path', async () => {
    const bodies: unknown[] = [];

    await withEndpoint((request, response) => {
      let body = '';

      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        const parsed = JSON.parse(body) as { paths: string[] };

        bodies.push(parsed);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, value: { paths: parsed.paths } }));
      });
    });
    printedLines();

    await expect(run(['resync', '../fut-frontend-altcha'])).resolves.toBe(0);
    expect(bodies).toEqual([{ op: 'agentSessions.resync', paths: ['/fut-frontend-altcha'] }]);
  });

  it('asks for a replacing re-read of every named checkout with --replace', async () => {
    const bodies: unknown[] = [];

    await withEndpoint((request, response) => {
      let body = '';

      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        const parsed = JSON.parse(body) as { paths: string[]; replace?: true };

        bodies.push(parsed);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, value: parsed }));
      });
    });
    const lines = printedLines();

    await expect(run(['resync', '../a', '../b', '--replace'])).resolves.toBe(0);
    expect(bodies).toEqual([{ op: 'agentSessions.resync', paths: ['/a', '/b'], replace: true }]);
    expect(lines.join('\n')).toContain('replacing what it stored for them');
  });
});

describe('timetrack argument checks', () => {
  it('refuses a malformed naming day instead of answering for today', async () => {
    const { handler, asked } = answeredByOp({});

    await withEndpoint(handler);
    printedLines();

    await expect(run(['naming', '2026-9-1'])).rejects.toThrow('Pass a day as YYYY-MM-DD, not 2026-9-1.');
    expect(asked).toEqual([]);
  });

  it('refuses a flag whose value is another flag', async () => {
    const { handler, asked } = answeredByOp({});

    await withEndpoint(handler);
    printedLines();

    await expect(run(['create', '--summary', '--project', 'FIP'])).rejects.toThrow('--summary needs a value.');
    expect(asked).toEqual([]);
  });

  it('refuses a search limit that is not a whole number above zero', async () => {
    const { handler, asked } = answeredByOp({});

    await withEndpoint(handler);
    printedLines();

    for (const limit of ['-1', '', '2.5', '0']) {
      await expect(run(['search', 'x', '--limit', limit])).rejects.toThrow('--limit');
    }

    expect(asked).toEqual([]);
  });

  it('reads the value of --name as a flag value, not as the subcommand', async () => {
    const { handler, asked } = answeredByOp({ 'standIn.list': { standIns: [] }, 'settings.rules': {} });

    await withEndpoint(handler);
    printedLines();

    await run(['--name', 'x', 'standins']);

    expect(asked).toContain('standIn.list');
  });
});

describe('timetrack standins', () => {
  const noRules = { attributionRules: [], projectLinks: [] };

  it('says a record naming no branch holds its whole checkout', async () => {
    const { handler } = answeredByOp({
      'standIn.list': { standIns: [standIn({ openedFor: '/repo/wide' })] },
      'settings.rules': noRules,
    });

    await withEndpoint(handler);

    const lines = printedLines();

    await run(['standins']);

    expect(lines.join('\n')).toContain('covers all of /repo/wide');
  });

  it('reads the rule too, because an older record names no checkout of its own', async () => {
    const { handler } = answeredByOp({
      'standIn.list': { standIns: [standIn({})] },
      'settings.rules': {
        ...noRules,
        attributionRules: [{ id: 'r1', repoPath: '/repo/older', standInId: 'stand-in:1:repo', donates: false }],
      },
    });

    await withEndpoint(handler);

    const lines = printedLines();

    await run(['standins']);

    expect(lines.join('\n')).toContain('covers all of /repo/older');
  });

  it('says nothing about the grain of a record that names its branch', async () => {
    const { handler } = answeredByOp({
      'standIn.list': { standIns: [standIn({ openedFor: '/repo/wide', openedForBranch: 'feat-1' })] },
      'settings.rules': noRules,
    });

    await withEndpoint(handler);

    const lines = printedLines();

    await run(['standins']);

    expect(lines.join('\n')).not.toContain('covers all of');
  });

  it('refuses a delete that would strand a day, and asks nothing of the endpoint', async () => {
    const { handler, asked } = answeredByOp({
      'standIn.list': { standIns: [standIn({ days: ['2026-09-08', '2026-09-16'] })] },
    });

    await withEndpoint(handler);
    printedLines();

    await expect(run(['standins', '--remove', 'stand-in:1:repo'])).resolves.toBe(1);
    expect(asked).toEqual(['standIn.list']);
  });

  it('makes the same delete once --force says the stranded days are wanted', async () => {
    const { handler, asked } = answeredByOp({
      'standIn.list': { standIns: [standIn({ days: ['2026-09-08', '2026-09-16'] })] },
      'standIn.remove': { standIns: [] },
      'settings.rules': noRules,
    });

    await withEndpoint(handler);
    printedLines();

    await expect(run(['standins', '--remove', 'stand-in:1:repo', '--force'])).resolves.toBe(0);
    expect(asked).toContain('standIn.remove');
  });
});

describe('timetrack worklogs', () => {
  const worklog = (over: Record<string, unknown>) => ({
    id: '1',
    day: '2026-09-01',
    startMs: 0,
    durationMs: 30 * 60_000,
    issueKey: 'FIP-1',
    issueId: '10',
    description: 'private note',
    ...over,
  });

  it('sums each day per issue and prints no description', async () => {
    const bodies: unknown[] = [];

    await withEndpoint((request, response) => {
      let body = '';

      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        bodies.push(JSON.parse(body));
        answered({
          from: '2026-09-01',
          to: '2026-09-02',
          worklogs: [
            worklog({ id: '1' }),
            worklog({ id: '2', issueKey: 'FIP-2', durationMs: 90 * 60_000 }),
            worklog({ id: '3', durationMs: 15 * 60_000 }),
            worklog({ id: '4', day: '2026-09-02', issueKey: undefined, issueId: '77' }),
          ],
        })(request, response);
      });
    });

    const lines = printedLines();

    await expect(run(['worklogs', '2026-09-01', '2026-09-02'])).resolves.toBe(0);
    expect(bodies).toEqual([{ op: 'tempo.worklogs', from: '2026-09-01', to: '2026-09-02' }]);
    expect(lines).toEqual([
      '2026-09-01 … 2026-09-02  4 worklog(s), 2.8h',
      '  2026-09-01  2.3h  FIP-2 90m  FIP-1 45m',
      '  2026-09-02  0.5h  #77 30m',
    ]);
  });

  it('refuses a range end that is not a day before asking the app', async () => {
    let calls = 0;

    await withEndpoint((request, response) => {
      calls += 1;
      answered({})(request, response);
    });

    await expect(run(['worklogs', '2026-09-01', 'friday'])).rejects.toThrow(/YYYY-MM-DD, not friday/);
    expect(calls).toBe(0);
  });
});

describe('timetrack calendar', () => {
  const event = (over: Record<string, unknown>) => ({
    calendarId: 'primary',
    day: '2026-09-01',
    startMs: new Date(2026, 8, 1, 10, 0).getTime(),
    endMs: new Date(2026, 8, 1, 11, 0).getTime(),
    allDay: false,
    title: 'Sprint Planning',
    attendeeCount: 4,
    response: 'accepted',
    ...over,
  });

  it('prints each day with its meeting hours, leaving declined and all-day entries out of the sum', async () => {
    const bodies: unknown[] = [];

    await withEndpoint((request, response) => {
      let body = '';

      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        bodies.push(JSON.parse(body));
        answered({
          from: '2026-09-01',
          to: '2026-09-02',
          calendarIds: ['primary'],
          events: [
            event({ allDay: true, title: 'Urlaub', response: 'organizer', startMs: new Date(2026, 8, 1).getTime() }),
            event({}),
            event({
              title: 'Review',
              response: 'declined',
              startMs: new Date(2026, 8, 1, 14, 0).getTime(),
              endMs: new Date(2026, 8, 1, 14, 30).getTime(),
            }),
            event({
              day: '2026-09-02',
              title: 'Daily',
              response: 'tentative',
              startMs: new Date(2026, 8, 2, 9, 30).getTime(),
              endMs: new Date(2026, 8, 2, 9, 45).getTime(),
            }),
          ],
        })(request, response);
      });
    });

    const lines = printedLines();

    await expect(run(['calendar', '2026-09-01', '2026-09-02'])).resolves.toBe(0);
    expect(bodies).toEqual([{ op: 'calendar.events', from: '2026-09-01', to: '2026-09-02' }]);
    expect(lines).toEqual([
      '2026-09-01 … 2026-09-02  4 event(s) from 1 calendar(s), 1.3h in meetings',
      '  2026-09-01  3 event(s), 1.0h',
      '    all-day  Urlaub',
      '    10:00 60m  Sprint Planning',
      '    14:00 30m  Review  declined',
      '  2026-09-02  1 event(s), 0.3h',
      '    09:30 15m  Daily  tentative',
    ]);
  });

  it('refuses a range start that is not a day before asking the app', async () => {
    let calls = 0;

    await withEndpoint((request, response) => {
      calls += 1;
      answered({})(request, response);
    });

    await expect(run(['calendar', 'monday'])).rejects.toThrow(/YYYY-MM-DD, not monday/);
    expect(calls).toBe(0);
  });
});

describe('timetrack worklog --delete', () => {
  const recordingBodies = (value: unknown) => {
    const bodies: Record<string, unknown>[] = [];
    const handler: Handler = (request, response) => {
      let body = '';

      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        bodies.push(JSON.parse(body) as Record<string, unknown>);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(value));
      });
    };

    return { handler, bodies };
  };

  const deleted = {
    id: '98765',
    day: '2026-09-07',
    startTime: '09:15',
    minutes: 90,
    issueKey: 'FIP-3010',
    description: 'Logout on idle',
  };

  it('asks the app to delete the one worklog, and prints that it waits for the approval', async () => {
    const { handler, bodies } = recordingBodies({ ok: true, value: { status: 'queued', approvalId: 'a1' } });

    await withEndpoint(handler);

    const lines = printedLines();

    await expect(run(['worklog', '--delete', '98765', '--day', '2026-09-07'])).resolves.toBe(0);
    expect(bodies).toEqual([{ op: 'tempo.delete', day: '2026-09-07', worklogId: '98765' }]);
    expect(lines).toEqual([
      "Queued in Timetrack for the user's approval: delete Tempo worklog 98765 on 2026-09-07.",
      'Nothing is written until they approve it. Read the outcome with: timetrack approval a1',
    ]);
  });

  it('refuses a delete without a day or a numeric id, and asks nothing of the app', async () => {
    const { handler, bodies } = recordingBodies({ ok: true, value: { deleted } });

    await withEndpoint(handler);
    printedLines();

    await expect(run(['worklog', '--delete', '98765'])).rejects.toThrow(/--day <YYYY-MM-DD>/);
    await expect(run(['worklog', '--day', '2026-09-07'])).rejects.toThrow(/--delete <id>/);
    await expect(run(['worklog', '--delete', 'FIP-1', '--day', '2026-09-07'])).rejects.toThrow(/--delete <id>/);
    expect(bodies).toEqual([]);
  });

  it('fails with the app refusal for a worklog the account does not hold on that day', async () => {
    const { handler } = recordingBodies({
      ok: false,
      message: 'Your Tempo worklogs on 2026-09-07 hold no worklog 11111. Nothing was deleted.',
    });

    await withEndpoint(handler);

    await expect(run(['worklog', '--delete', '11111', '--day', '2026-09-07'])).rejects.toThrow(/hold no worklog 11111/);
  });

  it('exits non-zero once approved when the ledger kept the entry of the deleted worklog', async () => {
    const { handler } = recordingBodies({
      ok: true,
      value: { status: 'approved', approvalId: 'a1', result: { deleted, unrecorded: 'store is locked' } },
    });

    await withEndpoint(handler);

    const lines = printedLines();

    await expect(run(['approval', 'a1'])).resolves.toBe(1);
    expect(lines[2]).toMatch(/ledger did not follow: store is locked/);
  });
});

describe('timetrack sync', () => {
  const at = (hour: number, minute = 0) => new Date(2026, 8, 7, hour, minute).getTime();
  const plan = (over: Record<string, unknown> = {}) => ({
    day: '2026-09-07',
    planHash: '1a2b3c4d',
    writes: [
      {
        kind: 'create',
        proposalId: 'p1',
        issueKey: 'FIP-1',
        fromMs: at(9),
        durationMs: 60 * 60_000,
        description: 'Logout on idle',
        reason: 'new',
      },
      {
        kind: 'update',
        proposalId: 'p2',
        issueKey: 'FIP-2',
        fromMs: at(10),
        durationMs: 30 * 60_000,
        description: '',
        reason: 'content-changed',
        tempoWorklogId: '71',
        blocked: 'needs a description, Tempo refuses an empty one',
      },
    ],
    unchanged: 3,
    skipped: 1,
    unresolvedKeys: ['NOPE-1'],
    foreign: [
      { id: '9', issueKey: 'FIP-9', issueId: '90', fromMs: at(8), durationMs: 15 * 60_000, description: 'By hand' },
    ],
    coveredMs: 15 * 60_000,
    ...over,
  });

  const recording = (value: unknown | ((body: Record<string, unknown>) => unknown)) => {
    const bodies: Record<string, unknown>[] = [];
    const handler: Handler = (request, response) => {
      let body = '';

      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        const parsed = JSON.parse(body) as Record<string, unknown>;

        bodies.push(parsed);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(typeof value === 'function' ? value(parsed) : { ok: true, value }));
      });
    };

    return { handler, bodies };
  };

  it('prints every write with its time, note and hold-back, and the command that writes this plan', async () => {
    const { handler, bodies } = recording(plan());

    await withEndpoint(handler);

    const lines = printedLines();

    await expect(run(['sync', '2026-09-07'])).resolves.toBe(0);
    expect(bodies).toEqual([{ op: 'tempo.sync', day: '2026-09-07' }]);
    expect(lines).toEqual([
      '2026-09-07  plan 1a2b3c4d  1 create, 1 update, 0 delete',
      '  create  FIP-1  09:00-10:00  60m  new  Logout on idle',
      '  update  FIP-2  10:00-10:30  30m  content-changed  worklog 71  (no description)  HELD BACK: needs a description, Tempo refuses an empty one',
      '3 unchanged, 1 skipped (still awaiting review)',
      '1 row(s) held back: Tempo would refuse them until they are fixed on the day.',
      'Jira does not know NOPE-1, so nothing is written for those rows.',
      '15m of the day is already logged by foreign worklogs, so it is left out.',
      'Foreign worklogs (1), never touched',
      '  FIP-9  08:00  15m  By hand',
      'Once the user has confirmed these rows: timetrack sync 2026-09-07 --write --plan 1a2b3c4d',
    ]);
  });

  it('refuses a write that names no plan, and asks nothing of the app', async () => {
    const { handler, bodies } = recording(plan());

    await withEndpoint(handler);
    printedLines();

    await expect(run(['sync', '2026-09-07', '--write'])).resolves.toBe(1);
    expect(bodies).toEqual([]);
  });

  it('queues the write of the confirmed plan', async () => {
    const { handler, bodies } = recording({ status: 'queued', approvalId: 'a1' });

    await withEndpoint(handler);

    const lines = printedLines();

    await expect(run(['sync', '2026-09-07', '--write', '--plan', '1a2b3c4d'])).resolves.toBe(0);
    expect(bodies).toEqual([{ op: 'tempo.sync', day: '2026-09-07', planHash: '1a2b3c4d' }]);
    expect(lines.join('\n')).toContain('timetrack approval a1');
  });

  it('fails once approved with the app refusal when the plan changed since it was confirmed', async () => {
    const { handler } = recording({
      status: 'approved',
      approvalId: 'a1',
      error: 'The plan for 2026-09-07 is 99999999 now, not 1a2b3c4d, so nothing was written.',
    });

    await withEndpoint(handler);

    const lines = printedLines();

    await expect(run(['approval', 'a1'])).resolves.toBe(1);
    expect(lines).toEqual([
      'a1  approved, but it failed: The plan for 2026-09-07 is 99999999 now, not 1a2b3c4d, so nothing was written.',
    ]);
  });

  it('prints each row an approved write attempted, and exits non-zero while a row waits for a retry', async () => {
    const { handler } = recording({
      status: 'approved',
      approvalId: 'a1',
      result: plan({
        run: {
          rows: [
            { kind: 'create', proposalId: 'p1', status: 'written', issueKey: 'FIP-1', tempoWorklogId: '716401' },
            {
              kind: 'update',
              proposalId: 'p2',
              status: 'blocked',
              issueKey: 'FIP-2',
              tempoWorklogId: '71',
              detail: 'needs a description',
            },
          ],
          retryCount: 1,
        },
      }),
    });

    await withEndpoint(handler);

    const lines = printedLines();

    await expect(run(['approval', 'a1'])).resolves.toBe(1);
    expect(lines.slice(-3)).toEqual([
      'written  create  FIP-1  worklog 716401',
      'blocked  update  FIP-2  worklog 71  needs a description',
      "1 row(s) did not land. Retry them on the Sync page, which retries this run's own plan: a new plan read straight after a write can miss what Tempo just took.",
    ]);
    expect(lines.join('\n')).not.toContain('Once the user');
  });
});

describe('timetrack create', () => {
  it('queues the issue, naming this caller for the approval queue', async () => {
    const bodies: unknown[] = [];

    await withEndpoint((request, response) => {
      let body = '';

      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        bodies.push(JSON.parse(body));
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, value: { status: 'queued', approvalId: 'a1' } }));
      });
    });
    vi.stubEnv('TIMETRACK_CLIENT', 'Codex');

    const lines = printedLines();

    await expect(run(['create', '--summary', 'Pdf export', '--project', 'ABC'])).resolves.toBe(0);
    expect(bodies).toEqual([{ op: 'jira.create', summary: 'Pdf export', projectKey: 'ABC', client: 'Codex' }]);
    expect(lines).toEqual([
      "Queued in Timetrack for the user's approval: file the issue Pdf export.",
      'Nothing is written until they approve it. Read the outcome with: timetrack approval a1',
    ]);
  });

  it('says a queued write still waits', async () => {
    await withEndpoint(answered({ status: 'queued', approvalId: 'a1' }));

    const lines = printedLines();

    await expect(run(['approval', 'a1'])).resolves.toBe(0);
    expect(lines).toEqual(["a1  still waits for the user's approval in Timetrack."]);
  });
});

/** Records the body of every request the command sent, and answers each with `value`. */
const recordedBodies = (value: unknown) => {
  const bodies: Record<string, unknown>[] = [];
  const handler: Handler = (request, response) => {
    let body = '';

    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      bodies.push(JSON.parse(body || '{}') as Record<string, unknown>);
      answered(value)(request, response);
    });
  };

  return { handler, bodies };
};

describe('timetrack log --at', () => {
  const queued = { queued: true, id: 'q-1' };

  it('reads a date alone as local midnight', async () => {
    vi.stubEnv('TZ', 'Europe/Berlin');

    const { handler, bodies } = recordedBodies(queued);

    await withEndpoint(handler);
    printedLines();
    await run(['log', '--issue', 'FIP-1', '--minutes', '15', '--at', '2026-09-28']);

    expect(bodies.find((body) => body['op'] === 'worklog.add')?.['fromMs']).toBe(new Date(2026, 8, 28).getTime());
  });

  it('reads a clock as that time today', async () => {
    const { handler, bodies } = recordedBodies(queued);
    const expected = new Date();

    expected.setHours(10, 30, 0, 0);

    await withEndpoint(handler);
    printedLines();
    await run(['log', '--issue', 'FIP-1', '--minutes', '15', '--at', '10:30']);

    expect(bodies.find((body) => body['op'] === 'worklog.add')?.['fromMs']).toBe(expected.getTime());
  });
});

describe('timetrack project', () => {
  it('resolves a relative path against the root', async () => {
    const { handler, bodies } = recordedBodies({ repoPath: '/api', inherited: false, private: false });

    await withEndpoint(handler);
    printedLines();
    await run(['project', '../api']);

    expect(bodies.find((body) => body['op'] === 'repo.project')?.['repoPath']).toBe('/api');
  });
});
