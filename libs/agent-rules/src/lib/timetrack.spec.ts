import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { mkdtempSync, writeFileSync } from 'fs';
import { platform, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { askTimetrack, timetrackDiscoveryPath, timetrackIssue } from './timetrack';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

let server: Server | undefined;

/** Serves one endpoint on a real socket and writes the discovery file that points at it. */
const withEndpoint = async (options: { handler: Handler; version?: number; token?: string }) => {
  server = createServer(options.handler);

  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const path = join(mkdtempSync(join(tmpdir(), 'agent-rules-timetrack-')), 'agent.json');

  writeFileSync(path, JSON.stringify({ version: options.version ?? 1, port, token: options.token ?? 'secret' }));
  process.env['TIMETRACK_AGENT_DISCOVERY'] = path;

  return path;
};

const answered =
  (body: unknown): Handler =>
  (_, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  };

afterEach(async () => {
  delete process.env['TIMETRACK_AGENT_DISCOVERY'];

  const running = server;

  server = undefined;

  if (running) await new Promise<void>((resolve) => running.close(() => resolve()));
});

describe('timetrackDiscoveryPath', () => {
  it('takes the override over every platform rule', () => {
    process.env['TIMETRACK_AGENT_DISCOVERY'] = '/tmp/somewhere/agent.json';

    expect(timetrackDiscoveryPath()).toBe('/tmp/somewhere/agent.json');
  });

  it.runIf(platform() === 'linux')('reads the app data directory from XDG_DATA_HOME', () => {
    const previous = process.env['XDG_DATA_HOME'];

    process.env['XDG_DATA_HOME'] = '/home/someone/.local/share';

    expect(timetrackDiscoveryPath()).toBe('/home/someone/.local/share/io.ethlete.timetrack/agent.json');

    if (previous === undefined) delete process.env['XDG_DATA_HOME'];
    else process.env['XDG_DATA_HOME'] = previous;
  });
});

describe('askTimetrack', () => {
  it('says the app is not running when nothing wrote a discovery file', async () => {
    process.env['TIMETRACK_AGENT_DISCOVERY'] = join(tmpdir(), 'nothing-wrote-this', 'agent.json');

    await expect(askTimetrack({ op: 'status' })).rejects.toThrow(/Timetrack is not running/);
  });

  it('refuses a contract version it does not speak', async () => {
    await withEndpoint({ handler: answered({ ok: true, value: {} }), version: 99 });

    await expect(askTimetrack({ op: 'status' })).rejects.toThrow(/version 99 .* speaks 1/);
  });

  it('carries the run token and returns the value', async () => {
    let authorization: string | undefined;
    let body = '';

    await withEndpoint({
      handler: (request, response) => {
        authorization = request.headers.authorization;
        request.on('data', (chunk) => (body += chunk));
        request.on('end', () => response.end(JSON.stringify({ ok: true, value: { issue: { key: 'FIP-1' } } })));
      },
    });

    const issue = await timetrackIssue('FIP-1');

    expect(issue).toEqual({ key: 'FIP-1' });
    expect(authorization).toBe('Bearer secret');
    expect(JSON.parse(body)).toEqual({ op: 'jira.issue', key: 'FIP-1' });
  });

  it("reports the operation's own failure as the error", async () => {
    await withEndpoint({ handler: answered({ ok: false, message: 'Jira has no issue ZZZ-1.' }) });

    await expect(timetrackIssue('ZZZ-1')).rejects.toThrow('Jira has no issue ZZZ-1.');
  });

  it('tells the user to restart when the token is stale', async () => {
    await withEndpoint({
      handler: (_, response) => {
        response.statusCode = 401;
        response.end();
      },
    });

    await expect(askTimetrack({ op: 'status' })).rejects.toThrow(/restart the app/);
  });
});
