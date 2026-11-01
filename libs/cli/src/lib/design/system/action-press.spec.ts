import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { settle } from './action-press';

describe('settle', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('does not wait for a scroll-driven animation, which runs as long as its scroller exists', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(`<style>
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
        .body { height: 40px; overflow: auto; animation: fade linear both; animation-timeline: scroll(self) }
      </style><div class="body"><div style="height: 200px"></div></div>`);

    const start = Date.now();

    await settle(page, 3000);

    expect(Date.now() - start).toBeLessThan(1500);
    await page.close();
  });
}, 30_000);
