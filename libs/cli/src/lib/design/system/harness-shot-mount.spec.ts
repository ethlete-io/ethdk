import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { HarnessError, harnessShotOf } from './harness-shot';

const pageOf = (mountMs: number | null) => `<!doctype html>
<style>body { margin: 0; } [data-design-harness-host] { display: block; min-height: 40px; }</style>
<div data-design-harness-host></div>
<script>
  const mount = () => {
    const part = document.createElement('div');
    part.style.cssText = 'width: 200px; height: 80px; background: rgb(200 0 0)';
    document.querySelector('[data-design-harness-host]').append(part);
  };
  ${mountMs === null ? '' : `setTimeout(mount, ${mountMs});`}
</script>`;

const pngHeightOf = (png: Buffer) => png.readUInt32BE(20);

describe('harnessShotOf', () => {
  let browser: Browser | undefined;
  let server: Server | undefined;
  let base = '';

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

    server = createServer((request, response) => {
      const mount = new URL(request.url ?? '', 'http://x').searchParams.get('mount');

      response.writeHead(200, { 'content-type': 'text/html' }).end(pageOf(mount === null ? null : Number(mount)));
    });
    await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
  });

  it('waits for a part the harness host mounts late', async (context) => {
    if (!browser) return context.skip();

    const png = await harnessShotOf({ browser, url: `${base}/?mount=300` });

    expect(pngHeightOf(png)).toBe(80);
  });

  it('fails when the harness host never mounts a part', async (context) => {
    if (!browser) return context.skip();

    await expect(harnessShotOf({ browser, url: `${base}/`, timeout: 500 })).rejects.toThrow(HarnessError);
  });
});
