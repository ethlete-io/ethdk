import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { finished, heldAnimations, settleFrames } from './thumb';

const PULSE_PAGE = `<style>
  @keyframes pulse { 50% { opacity: 0.2; } }
  body { margin: 0; background: white; }
  .dot { width: 20px; height: 20px; background: black; animation: pulse 400ms linear infinite; }
  .frozen { animation-play-state: paused; animation-delay: -100ms; }
</style>
<div class="dot"></div>
<div class="dot frozen"></div>`;

const RUNNING_DOT = { x: 0, y: 0, width: 20, height: 20 };

describe('heldAnimations', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });
  });

  afterAll(() => browser?.close());

  const pulsePage = async (browser: Browser) => {
    const page = await browser.newPage({ viewport: { width: 20, height: 40 } });

    await page.setContent(PULSE_PAGE);
    await page.waitForTimeout(200);

    return page;
  };

  const designPicture = async (page: Page) => {
    await page.evaluate(finished);
    await page.evaluate(heldAnimations);

    return page.screenshot({ type: 'png', clip: RUNNING_DOT });
  };

  it('draws a running infinite animation at the frame the app picture with disabled animations shows', async (context) => {
    if (!browser) return context.skip();

    const design = await pulsePage(browser);
    const app = await pulsePage(browser);

    try {
      const designPng = await designPicture(design);
      const appPng = await app.screenshot({ type: 'png', animations: 'disabled', clip: RUNNING_DOT });

      expect(designPng.equals(appPng)).toBe(true);
    } finally {
      await design.close();
      await app.close();
    }
  });

  it('keeps a paused animation at its held frame', async (context) => {
    if (!browser) return context.skip();

    const page = await pulsePage(browser);

    try {
      await designPicture(page);

      const opacity = await page.locator('.frozen').evaluate((element) => getComputedStyle(element).opacity);

      expect(Number(opacity)).toBeCloseTo(0.6, 1);
    } finally {
      await page.close();
    }
  });
});

const EMBEDDED_TRANSITION = `<style>
  body { margin: 0; }
  .bubble { width: 20px; height: 20px; background: white; transition: background-color 10s linear; }
  .bubble.on { background: black; }
</style>
<div class="bubble"></div>
<script>requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('.bubble').classList.add('on')));</script>`;

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
});
