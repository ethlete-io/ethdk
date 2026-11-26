import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keptFacesOf } from '../../../design/web/frame-faces';
import { openFrame, switchFrame } from './thumb';

const FONT = readFileSync(
  resolve(__dirname, '../../../../../apps/storybook/src/assets/fonts/archivo/archivo-v18-latin-300.woff2'),
);

const FRAME = `<!doctype html>
<style>
  @font-face { font-family: Slow; src: url('/slow.woff2') format('woff2'); }
  body { margin: 0; font: 40px monospace; }
  span { font-family: Slow, monospace; }
</style>
<div id="root"></div>
<script>
  const root = document.getElementById('root');
  const draw = (state) => {
    root.replaceChildren();
    const label = document.createElement('span');
    label.textContent = 'state ' + state + ' iiiiiiiiii';
    root.append(label);
    root.dataset.measured = String(label.getBoundingClientRect().width);
  };
  window.etSwitchState = async (state) => draw(state);
  draw(new URL(location.href).searchParams.get('state'));
</script>`;

const STATE_SHEET_FRAME = `<!doctype html>
<style>
  body { margin: 0; font: 40px monospace; }
  span { font-family: Slow, monospace; }
</style>
<div id="root"></div>
<script>
  const root = document.getElementById('root');
  window.draws = 0;
  let sheet = null;
  const draw = (state) => {
    window.draws++;
    sheet?.remove();
    sheet = document.createElement('style');
    [sheet.textContent] = window.keptFaces([
      "@font-face { font-family: Slow; src: url('/slow.woff2') format('woff2'); unicode-range: U+0-7F; }" +
        (state === 'b' ? "@font-face { font-family: Slow; src: url('/slow.woff2') format('woff2'); unicode-range: U+80-FF; }" : '') +
        '.state-' + state + ' {}',
    ]);
    document.head.append(sheet);
    root.replaceChildren();
    const label = document.createElement('span');
    label.textContent = state === 'b' ? 'state b \u00e9\u00e9\u00e9' : 'state ' + state + ' iiiiiiiiii';
    root.append(label);
    root.dataset.measured = String(label.getBoundingClientRect().width);
  };
  window.etSwitchState = async (state) => draw(state);
  draw(new URL(location.href).searchParams.get('state'));
</script>`;

const servedOn = async (page: Page, frame = FRAME) => {
  await page.addInitScript({ content: `window.keptFaces = (${keptFacesOf.toString()})(document);` });
  await page.route('http://frame.test/**', async (route) => {
    if (route.request().url().endsWith('/slow.woff2')) {
      await new Promise((done) => setTimeout(done, 300));

      return route.fulfill({ body: FONT, contentType: 'font/woff2' });
    }

    return route.fulfill({ body: frame, contentType: 'text/html' });
  });

  return page;
};

const measuredOf = (page: Page) => page.locator('#root').getAttribute('data-measured');

describe('openFrame and switchFrame', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });
  });

  afterAll(() => browser?.close());

  it('draw a state that measures its text alike, fresh or switched into after its web font loaded', async (context) => {
    if (!browser) return context.skip();

    const fresh = await servedOn(await browser.newPage());
    const switched = await servedOn(await browser.newPage());

    try {
      await openFrame(fresh, 'http://frame.test/frame.html?state=a');
      await openFrame(switched, 'http://frame.test/frame.html?state=b');
      await switched.evaluate(() => document.fonts.ready);

      expect(await switchFrame(switched, 'a')).toBe(true);
      expect(await measuredOf(fresh)).toBe(await measuredOf(switched));
    } finally {
      await fresh.close();
      await switched.close();
    }
  });

  it('draw a switch once when its sheet keeps one loaded font face and drops another, measured alike to a fresh load', async (context) => {
    if (!browser) return context.skip();

    const fresh = await servedOn(await browser.newPage(), STATE_SHEET_FRAME);
    const switched = await servedOn(await browser.newPage(), STATE_SHEET_FRAME);

    try {
      await openFrame(fresh, 'http://frame.test/frame.html?state=a');
      await openFrame(switched, 'http://frame.test/frame.html?state=b');
      await switched.evaluate(() => Object.assign(window, { draws: 0 }));

      expect(await switchFrame(switched, 'a')).toBe(true);
      expect(await switched.evaluate(() => (window as unknown as { draws: number }).draws)).toBe(1);
      expect(await measuredOf(fresh)).toBe(await measuredOf(switched));
    } finally {
      await fresh.close();
      await switched.close();
    }
  });
});
