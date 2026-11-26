import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { HarnessRefusedError, waitForHarnessHost } from './harness-host-wait';

const REFUSED = '"pages/sketches" did not load: Error: no sample for prop part=x of part pages/sketches';

const PAGES: Record<string, string> = {
  '/ok': '<div data-design-harness-host style="width:10px;height:10px">Part</div>',
  '/late': `<script>setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<div data-design-harness-host style="width:10px;height:10px">Part</div>'), 100)</script>`,
  '/refused': `<p data-design-harness-error>${REFUSED}</p>`,
};

describe('waitForHarnessHost', () => {
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

    server = createServer((request, response) =>
      response
        .writeHead(200, { 'content-type': 'text/html' })
        .end(`<!doctype html><body>${PAGES[(request.url ?? '').split('?')[0] ?? ''] ?? ''}</body>`),
    );
    await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
  });

  const pageOf = async (path: string) => {
    const page = await (await browser?.newContext())?.newPage();

    await page?.goto(`${base}${path}`);

    return page;
  };

  it('resolves once the host shows, also when it renders late', async (context) => {
    if (!browser) return context.skip();

    for (const path of ['/ok', '/late']) {
      const page = await pageOf(path);

      await expect(waitForHarnessHost(page as never, 3000)).resolves.toBeUndefined();
    }
  });

  it('fails fast with the harness error text instead of waiting for the host', async (context) => {
    if (!browser) return context.skip();

    const page = await pageOf('/refused?part=pages%2Fsketches');
    const started = Date.now();
    const failure = await waitForHarnessHost(page as never, 10_000).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HarnessRefusedError);
    expect((failure as Error).message).toBe(`harness refused part pages/sketches: ${REFUSED}`);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
