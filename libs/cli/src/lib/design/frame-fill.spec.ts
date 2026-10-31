import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { paintFill } from '../../../design/web/frame-fill';

const PAGE_COLOUR = 'rgb(250, 250, 250)';

describe('paintFill', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });
  });

  afterAll(() => browser?.close());

  const paintedPixel = async (browser: Browser, rootRule: string) => {
    const page = await browser.newPage({ viewport: { width: 20, height: 20 }, colorScheme: 'dark' });

    await page.setContent(`<style>${rootRule} body { margin: 0; background: ${PAGE_COLOUR}; }</style>`);
    await page.evaluate(`(${paintFill.toString()})(document.body, 'surface')`);

    const shot = await page.screenshot({ clip: { x: 5, y: 5, width: 1, height: 1 } });
    const pixel = await page.evaluate(async (base64) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = new OffscreenCanvas(1, 1);
      const context = canvas.getContext('2d')!;

      context.drawImage(image, 0, 0);

      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    }, shot.toString('base64'));

    await page.close();

    return `rgb(${pixel.join(', ')})`;
  };

  it('keeps the page colour of a product without the token', async (context) => {
    if (!browser) return context.skip('no browser');

    expect(await paintedPixel(browser, '')).toBe(PAGE_COLOUR);
  });

  it('paints the token of a product that has it', async (context) => {
    if (!browser) return context.skip('no browser');

    expect(await paintedPixel(browser, ':root { --surface: rgb(10, 20, 30); }')).toBe('rgb(10, 20, 30)');
  });
}, 30_000);
