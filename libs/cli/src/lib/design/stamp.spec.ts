import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { buildStampOf, serverProblemOf, STAMP_PATH } from './stamp';

let running: Server | null = null;

const serve = async (body: string) => {
  running = createServer((request, response) =>
    response.end(request.url === STAMP_PATH ? body : '<!doctype html><html></html>'),
  );
  await new Promise<void>((done) => running?.listen(0, '127.0.0.1', done));

  return `http://127.0.0.1:${(running.address() as AddressInfo).port}`;
};

describe('serverProblemOf', () => {
  afterEach(() => {
    running?.close();
    running = null;
  });

  it('accepts a server started from this build', async () => {
    const own = buildStampOf();

    expect(await serverProblemOf({ base: await serve(JSON.stringify(own)), own })).toBeNull();
  });

  it('calls a server from another build stale', async () => {
    const own = buildStampOf();
    const base = await serve(JSON.stringify({ ...own, build: 'old' }));

    expect(await serverProblemOf({ base, own })).toMatch(/^STALE SERVER .*build old\).*Restart it\.$/);
  });

  it('calls a server without a stamp stale', async () => {
    const own = buildStampOf();
    const base = await serve('<!doctype html><html></html>');

    expect(await serverProblemOf({ base, own })).toMatch(/^STALE SERVER .*reports no build stamp/);
  });

  it('names an unreachable server', async () => {
    const base = await serve('');
    running?.close();

    expect(await serverProblemOf({ base, own: buildStampOf() })).toMatch(
      /^NO SERVER - nothing answers at .*ECONNREFUSED/,
    );
  });
});
