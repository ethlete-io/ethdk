import { mkdtempSync, rmSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { studioListWidthMiddleware, studioListWidthOf } from './studio-list-width';

const servers: Server[] = [];
const targets: string[] = [];

const serve = async () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-studio-list-width-'));
  const server = createServer(studioListWidthMiddleware(target));

  targets.push(target);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return { target, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/` };
};

afterEach(() => {
  servers.splice(0).forEach((server) => server.close());
  targets.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true }));
});

describe('studio list width', () => {
  it('keeps the width Studio posts where the look-alike check reads it', async () => {
    const { target, url } = await serve();

    expect(studioListWidthOf(target)).toBeNull();

    const response = await fetch(url, { method: 'POST', body: JSON.stringify({ width: 2087.6 }) });

    expect(response.status).toBe(204);
    expect(studioListWidthOf(target)).toBe(2088);
  });

  it('refuses a body without a positive width and keeps the last one', async () => {
    const { target, url } = await serve();

    await fetch(url, { method: 'POST', body: JSON.stringify({ width: 900 }) });

    expect((await fetch(url, { method: 'POST', body: JSON.stringify({ width: 0 }) })).status).toBe(400);
    expect((await fetch(url, { method: 'POST', body: 'nope' })).status).toBe(400);
    expect((await fetch(url)).status).toBe(405);
    expect(studioListWidthOf(target)).toBe(900);
  });
});
