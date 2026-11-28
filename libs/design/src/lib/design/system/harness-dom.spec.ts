import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { harnessDomOf, harnessDriveOf } from './harness-shot';

const PAGE = `<!doctype html>
<style>body { margin: 0; } .et-overlay-runtime-pane { position: fixed; top: 100px; left: 0; width: 120px; height: 40px; }</style>
<div data-design-harness-host>
  <button aria-expanded="false" style="width: 80px; height: 30px">Menu</button>
  <button style="width: 60px; height: 30px">Go</button>
</div>
<script>
  const trigger = document.querySelector('[aria-expanded]');

  trigger.addEventListener('click', () => {
    trigger.setAttribute('aria-expanded', 'true');
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="et-overlay-runtime-root"><div class="et-overlay-runtime-pane"><a>Item</a></div></div>',
    );
  });
</script>`;

const DESIGN = `<div>
  <button data-et-control="menu">Menu</button>
  <button data-et-force="hover">Go</button>
  <div data-et-control-surface="menu.panel" class="et-overlay-runtime-pane"><a>Item</a></div>
</div>`;

describe('harnessDomOf', () => {
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

    server = createServer((_, response) => response.writeHead(200, { 'content-type': 'text/html' }).end(PAGE));
    await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
  });

  it('prints the host after the click open and the forces compare drives, with the opened pane after it', async (context) => {
    if (!browser) return context.skip();

    const html = await harnessDomOf({
      browser,
      url: `${base}/`,
      ...harnessDriveOf({ markup: DESIGN, open: { control: 'menu', from: 'rest' } }),
    });

    expect(html).toContain('aria-expanded="true"');
    expect(html).toMatch(/<button style="[^"]*" data-et-forced="hover" data-box="[^"]*">Go<\/button>/);
    expect(html).toMatch(
      /<\/div><div class="et-overlay-runtime-pane" data-box="x:0 y:100 w:120 h:40"><a data-box="[^"]*">Item<\/a><\/div>$/,
    );
  });
});
