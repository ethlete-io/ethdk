import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { logRequests, RequestLogLine } from './request-log';

const servers: Server[] = [];
const dirs: string[] = [];

const serve = async (file: string | null) => {
  const server = createServer((_, response) => {
    response.statusCode = 201;
    response.end('hello');
  });

  if (file) logRequests(server, file);

  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

const tmp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-request-log-'));

  dirs.push(dir);

  return join(dir, 'nested', 'requests.jsonl');
};

afterEach(() => {
  servers.splice(0).forEach((server) => server.close());
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('request log', () => {
  it('appends one line per request with time, method, url, status, duration, bytes and open count', async () => {
    const file = tmp();
    const base = await serve(file);

    await (await fetch(`${base}/system?x=1`)).text();
    await (await fetch(`${base}/sketches`, { method: 'POST', body: 'a' })).text();

    const lines = readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as RequestLogLine);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ method: 'GET', url: '/system?x=1', status: 201, open: 0 });
    expect(lines[1]).toMatchObject({ method: 'POST', url: '/sketches' });
    expect(new Date(lines[0]?.start ?? '').toISOString()).toBe(lines[0]?.start);
    expect(lines[0]?.bytes).toBeGreaterThanOrEqual(5);
    expect(lines[0]?.ms).toBeGreaterThanOrEqual(0);
  });

  it('writes no file while the log is off', async () => {
    const file = tmp();
    const base = await serve(null);

    await (await fetch(base)).text();

    expect(existsSync(file)).toBe(false);
  });
});
