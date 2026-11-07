import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { slotHostsOnPage } from './slot-hosts';

const PAGE = `<style>
  body { margin: 0; }
  app-shell { display: block; position: absolute; left: 10px; top: 10px; width: 400px; height: 300px; }
  app-canvas { display: contents; }
  .canvas-body { position: absolute; left: 100px; top: 0; width: 300px; height: 300px; }
  app-old-frames { display: block; position: absolute; left: 0; top: 0; width: 100px; height: 100px; }
</style>
<app-shell>
  <app-old-frames></app-old-frames>
  <app-canvas><div class="canvas-body"></div></app-canvas>
</app-shell>`;

describe('slotHostsOnPage', { timeout: 30_000 }, () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('finds the host at the slot from the live host origin, also through a display: contents host', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(PAGE);

    const slot = { x: 250, y: 100, width: 50, height: 50 };
    const hosts = await slotHostsOnPage({
      page,
      host: 'app-shell',
      slots: [
        { part: 'elements/canvas', selector: 'app-canvas', ...slot },
        { part: 'elements/canvas', selector: 'app-old-frames', ...slot },
        { part: 'elements/canvas', selector: 'app-missing', ...slot },
      ],
    });

    expect(hosts.map(({ rendered }) => rendered)).toEqual([true, false, false]);
  });

  it('counts a host drawn up to one slot size away from the slot as rendered there', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(PAGE);

    const hosts = await slotHostsOnPage({
      page,
      host: 'app-shell',
      slots: [
        { part: 'elements/frames', selector: 'app-old-frames', x: 0, y: 140, width: 100, height: 60 },
        { part: 'elements/frames', selector: 'app-old-frames', x: 0, y: 240, width: 100, height: 60 },
      ],
    });

    expect(hosts.map(({ rendered }) => rendered)).toEqual([true, false]);
  });

  it('answers null for every slot when the live host is missing', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(PAGE);

    const hosts = await slotHostsOnPage({
      page,
      host: 'app-gone',
      slots: [{ part: 'elements/canvas', selector: 'app-canvas', x: 0, y: 0, width: 10, height: 10 }],
    });

    expect(hosts).toEqual([{ part: 'elements/canvas', selector: 'app-canvas', rendered: null }]);
  });
});
