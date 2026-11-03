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
