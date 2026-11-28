import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { harnessShotOf } from './harness-shot';
import { decodePng } from './part-compare';

const PAGE = `<!doctype html>
<style>body { margin: 0; } [data-design-harness-host] { display: block; }</style>
<div data-design-harness-host>
  <div style="width: 200px; height: 100px; padding: 10px; box-sizing: border-box; background: rgb(0 0 200)">
    <div data-et-projected="canvas" style="width: 120px; height: 60px">
      <b style="display: block; height: 100%; background: rgb(200 0 0)">button</b>
    </div>
  </div>
</div>`;

const pixelsOf = (png: Buffer) => {
  const image = decodePng(png);
  const count = (red: number, blue: number) => {
    let found = 0;

    for (let at = 0; at < image.data.length; at += 4)
      if (image.data[at] === red && image.data[at + 1] === 0 && image.data[at + 2] === blue) found++;

    return found;
  };

  return { fallback: count(200, 0), part: count(0, 200), all: image.width * image.height };
};

describe('harnessShotOf with markSlots', () => {
  let browser: Browser | undefined;
  let server: Server | undefined;
  let url = '';

  beforeAll(async () => {
    const loaded = await chromiumOf(process.cwd());

    if (!loaded) {
      if (process.env['CI']) throw new Error('No playwright in CI');

      return;
    }

    browser = await loaded.chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });

    server = createServer((_request, response) => response.writeHead(200, { 'content-type': 'text/html' }).end(PAGE));
    await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
  });

  it('draws the fallback the app puts into a slot region without it', async (context) => {
    if (!browser) return context.skip();

    expect(pixelsOf(await harnessShotOf({ browser, url })).fallback).toBeGreaterThan(0);
  });

  it('draws a slot region as filled by the app instead of the app fallback', async (context) => {
    if (!browser) return context.skip();

    const { fallback, part, all } = pixelsOf(await harnessShotOf({ browser, url, markSlots: true }));

    expect(fallback).toBe(0);
    expect(all - part).toBeGreaterThan(0);
  });
});
