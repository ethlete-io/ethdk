import { lstatSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'fs';
import { createHmac } from 'crypto';
import { IncomingMessage, Server, ServerResponse, createServer } from 'http';
import { platform, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  writeFileSync(path, JSON.stringify({ version: 2, port, token: 'secret' }));
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

afterEach(async () => {
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
