import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { settleFrames } from './settle-frames';

const EMBEDDED_TRANSITION = `<style>
  body { margin: 0; }
  .bubble { width: 20px; height: 20px; background: white; transition: background-color 10s linear; }
  .bubble.on { background: black; }
</style>
<div class="bubble"></div>
<script>requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('.bubble').classList.add('on')));</script>`;

const FONT = readFileSync(
  resolve(__dirname, '../../../../../apps/storybook/src/assets/fonts/archivo/archivo-v18-latin-300.woff2'),
);

const UNUSED_FACE = `<style>@font-face { font-family: Unused; src: url('/unused.woff2') format('woff2'); }</style>
<p>text in the default font</p>`;

const rangedFace = (
  text: string,
) => `<style>@font-face { font-family: Ranged; src: url('/ranged.woff2') format('woff2'); unicode-range: U+2190-21FF; }</style>
<p>${text}</p>`;

describe('settleFrames', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });
  });

  afterAll(() => browser?.close());

  it('finishes a transition an embedded frame starts after its load, as in the top page', async (context) => {
    if (!browser) return context.skip();

    const page = await browser.newPage({ viewport: { width: 40, height: 40 } });

    try {
      await page.setContent(
        `<iframe srcdoc="${EMBEDDED_TRANSITION.replace(/"/gu, '&quot;')}" style="border:0;width:20px;height:20px"></iframe>`,
      );

      const embedded = page.frames()[1];

      await embedded?.waitForFunction(() => document.getAnimations().length > 0);
      await settleFrames(page);

      const background = await embedded
        ?.locator('.bubble')
        .evaluate((element) => getComputedStyle(element).backgroundColor);

      expect(background).toBe('rgb(0, 0, 0)');
    } finally {
      await page.close();
    }
  });

  it('loads a face of an embedded frame that no text uses', async (context) => {
    if (!browser) return context.skip();

    const page = await browser.newPage({ viewport: { width: 40, height: 40 } });

    try {
      await page.route('**/unused.woff2', (route) => route.fulfill({ body: FONT, contentType: 'font/woff2' }));
      await page.route('http://frame.test/', (route) =>
        route.fulfill({ body: `<iframe src="/inner"></iframe>`, contentType: 'text/html' }),
      );
      await page.route('http://frame.test/inner', (route) =>
        route.fulfill({ body: UNUSED_FACE, contentType: 'text/html' }),
      );
      await page.goto('http://frame.test/');
      await settleFrames(page);

      const statuses = await page.frames()[1]?.evaluate(() => [...document.fonts].map((face) => face.status));

      expect(statuses).toEqual(['loaded']);
    } finally {
      await page.close();
    }
  });

  it('settles a frame whose face fails, and leaves that face an error', async (context) => {
    if (!browser) return context.skip();

    const page = await browser.newPage({ viewport: { width: 40, height: 40 } });

    try {
      await page.route('**/unused.woff2', (route) => route.fulfill({ status: 404 }));
      await page.route('http://frame.test/', (route) => route.fulfill({ body: UNUSED_FACE, contentType: 'text/html' }));
      await page.goto('http://frame.test/');
      await settleFrames(page);

      expect(await page.evaluate(() => [...document.fonts].map((face) => face.status))).toEqual(['error']);
    } finally {
      await page.close();
    }
  });

  it.each([
    { text: 'plain text', status: 'unloaded', fetched: 0 },
    { text: 'an arrow →', status: 'loaded', fetched: 1 },
  ])('settles the ranged face of "$text" as $status', async ({ text, status, fetched }, context) => {
    if (!browser) return context.skip();

    const page = await browser.newPage({ viewport: { width: 40, height: 40 } });
    let requests = 0;

    try {
      await page.route('**/ranged.woff2', (route) => {
        requests += 1;

        return route.fulfill({ body: FONT, contentType: 'font/woff2' });
      });
      await page.route('http://frame.test/', (route) =>
        route.fulfill({ body: rangedFace(text), contentType: 'text/html; charset=utf-8' }),
      );
      await page.goto('http://frame.test/');
      await settleFrames(page);

      expect(await page.evaluate(() => [...document.fonts].map((face) => face.status))).toEqual([status]);
      expect(requests).toBe(fetched);
    } finally {
      await page.close();
    }
  });
});
