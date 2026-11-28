import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hostComponentsOnPage, slotComponentsOnPage } from './slot-hosts';

const PAGE = `<style>
  body { margin: 0; }
  app-shell { display: block; position: absolute; left: 10px; top: 10px; width: 400px; height: 300px; }
  app-canvas { display: contents; }
  .canvas-body { position: absolute; left: 100px; top: 0; width: 300px; height: 300px; }
  app-old-frames { display: block; position: absolute; left: 0; top: 0; width: 100px; height: 100px; }
  app-pin { display: block; position: absolute; left: 110px; top: 10px; width: 20px; height: 20px; }
</style>
<app-shell>
  <app-old-frames></app-old-frames>
  <app-canvas><div class="canvas-body"><app-pin></app-pin></div></app-canvas>
</app-shell>`;

const SELECTORS = ['app-shell', 'app-canvas', 'app-old-frames', 'app-pin', 'app-missing'];

describe('slotComponentsOnPage', { timeout: 30_000 }, () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('names the components drawn at each slot from the live host origin, also through display: contents', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(PAGE);

    const found = await slotComponentsOnPage({
      page,
      host: 'app-shell',
      selectors: SELECTORS,
      slots: [
        { part: 'elements/canvas', x: 110, y: 10, width: 280, height: 280 },
        { part: 'elements/frames', x: 0, y: 20, width: 100, height: 100 },
        { part: 'components/pin', x: 210, y: 10, width: 20, height: 20 },
        { part: 'elements/shell', x: 0, y: 0, width: 400, height: 300 },
      ],
    });

    expect(found).toEqual([
      { part: 'elements/canvas', selectors: ['app-canvas'] },
      { part: 'elements/frames', selectors: ['app-old-frames'] },
      { part: 'components/pin', selectors: ['app-pin'] },
      { part: 'elements/shell', selectors: ['app-canvas'] },
    ]);
  });

  it('skips the live host and the components around it', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(
      `<app-root style="display: block"><app-view style="display: contents">${PAGE}</app-view></app-root>`,
    );

    const found = await slotComponentsOnPage({
      page,
      host: 'app-shell',
      selectors: ['app-root', 'app-view', ...SELECTORS],
      slots: [{ part: 'elements/canvas', x: 110, y: 10, width: 280, height: 280 }],
    });

    expect(found).toEqual([{ part: 'elements/canvas', selectors: ['app-canvas'] }]);
  });

  it('answers null when the live host is missing', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(PAGE);

    expect(
      await slotComponentsOnPage({
        page,
        host: 'app-gone',
        selectors: SELECTORS,
        slots: [{ part: 'elements/canvas', x: 0, y: 0, width: 10, height: 10 }],
      }),
    ).toBeNull();
  });

  it('names the live host and the components around it, innermost first, and null without the host', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(
      `<app-root style="display: block"><app-view style="display: contents">${PAGE}</app-view></app-root>`,
    );

    expect(
      await hostComponentsOnPage({ page, host: 'app-shell', selectors: ['app-root', 'app-view', ...SELECTORS] }),
    ).toEqual(['app-shell', 'app-view', 'app-root']);
    expect(await hostComponentsOnPage({ page, host: 'app-gone', selectors: SELECTORS })).toBeNull();
  });
});
