import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { harnessShotOf } from './harness-shot';

const QUIET_PAGE = `<!doctype html>
<div data-design-harness-host><div style="width: 100px; height: 50px">static</div></div>`;

const BUSY_PAGE = `<!doctype html>
<div data-design-harness-host><div id="slot" style="width: 100px; height: 50px">busy</div></div>
<script>
  let ticks = 0;
  const tick = setInterval(() => {
    document.getElementById('slot').dataset.tick = String(++ticks);

    if (ticks === 40) {
      clearInterval(tick);
      document.getElementById('slot').insertAdjacentHTML('afterend', '<button aria-label="late">late</button>');
    }
  }, 50);
</script>`;

const forced = [{ interaction: 'hover', label: 'late', role: 'button', text: '' }];

describe('forced element wait', () => {
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
      response.writeHead(200, { 'content-type': 'text/html' }).end(request.url === '/busy' ? BUSY_PAGE : QUIET_PAGE),
    );
    await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
  });

  it('fails a missing element once the page is quiet, well before the timeout', async (context) => {
    if (!browser) return context.skip();

    const started = Date.now();

    await expect(harnessShotOf({ browser, url: `${base}/quiet`, forced, timeout: 15_000 })).rejects.toThrow(
      /has no element with the aria-label "late"/,
    );
    expect(Date.now() - started).toBeLessThan(6000);
  }, 20_000);

  it('still finds an element that mounts late while the DOM keeps changing', async (context) => {
    if (!browser) return context.skip();

    const png = await harnessShotOf({ browser, url: `${base}/busy`, forced, timeout: 15_000 });

    expect(png.length).toBeGreaterThan(0);
  }, 20_000);
});
