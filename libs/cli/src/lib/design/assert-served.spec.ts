import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { assertServed, FrameUnservedError } from './thumb';

let server: Server | undefined;

const serve = async (status: number) => {
  server = createServer((_, response) => {
    response.statusCode = status;
    response.end(status === 403 ? '403 Restricted' : 'ok');
  });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/frame.html`;
};

const visit = async (url: string) => {
  const response = await fetch(url);
  return { status: () => response.status };
};

describe('assertServed', () => {
  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it('fails a 403 page with the URL and status', async () => {
    const url = await serve(403);
    const response = await visit(url);

    expect(() => assertServed(response, url)).toThrow(FrameUnservedError);
    expect(() => assertServed(response, url)).toThrow(url);
    expect(() => assertServed(response, url)).toThrow('HTTP 403');
  });

  it('lets a 200 page and a missing response through', async () => {
    const url = await serve(200);

    expect(() => assertServed(null, url)).not.toThrow();
    const response = await visit(url);

    expect(() => assertServed(response, url)).not.toThrow();
  });
});
