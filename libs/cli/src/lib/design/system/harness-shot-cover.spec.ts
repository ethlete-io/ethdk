import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { harnessShotOf, viewportCoveringOf } from './harness-shot';
import { decodePng } from './part-compare';

const PAGE = `<!doctype html>
<style>
  body { margin: 0; }
  [data-design-harness-host] { display: block; }
  .part { position: relative; width: 300px; height: 1000px; background: rgb(255 255 255); }
  .anchor { position: absolute; top: 950px; left: 0; width: 300px; height: 50px; }
  .et-overlay-runtime-pane { position: fixed; left: 0; width: 300px; height: 100px; background: rgb(200 0 0); }
</style>
<div data-design-harness-host><div class="part"><div class="anchor"></div></div></div>
<div class="et-overlay-runtime-pane"></div>
<script>
  const place = () => {
    const anchor = document.querySelector('.anchor').getBoundingClientRect();
    const top = Math.min(Math.max(anchor.top - 100, 0), innerHeight - 100);

    document.querySelector('.et-overlay-runtime-pane').style.top = top + 'px';
  };
  const later = () => setTimeout(place, 20);

  place();
  addEventListener('resize', later);
  addEventListener('scroll', later);
</script>`;

const redRowsOf = (png: Buffer) => {
  const image = decodePng(png);
  const rows: number[] = [];

  for (let y = 0; y < image.height; y++) {
    const at = y * image.width * 4;

    if (image.data[at] === 200 && image.data[at + 1] === 0) rows.push(y);
  }

  return rows;
};

describe('harnessShotOf on a part taller than the viewport', () => {
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

  it('draws an overlay anchored to the part where it rests at the captured size', async (context) => {
    if (!browser) return context.skip();

    const rows = redRowsOf(await harnessShotOf({ browser, url: `${base}/` }));

    expect([rows[0], rows.at(-1)]).toEqual([850, 949]);
  });

  it('grows the viewport only to cover the box', () => {
    const viewport = { width: 1280, height: 800 };

    expect(viewportCoveringOf({ viewport, box: { x: 0, y: 0, width: 300, height: 1000 } })).toEqual({
      width: 1280,
      height: 1000,
    });
    expect(viewportCoveringOf({ viewport, box: { x: 0, y: 0, width: 300, height: 800 } })).toBeNull();
  });
});
