import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boxedMarkupScriptOf } from './dom-boxes';

const PAGE = `<style>body { margin: 0; } #root { position: absolute; left: 30px; top: 20px; }</style>
<div id="root"><div class="card" style="width: 120px; padding: 10px"><span style="display: block; height: 16.25px">a</span></div></div>`;

describe('boxedMarkupScriptOf', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });
  });

  afterAll(() => browser?.close());

  const markupOf = async (browser: Browser, which: 'inner' | 'outer') => {
    const page = await browser.newPage({ viewport: { width: 400, height: 200 } });

    await page.setContent(PAGE);

    return (await page.evaluate(boxedMarkupScriptOf('#root', which))) as string | null;
  };

  it('marks each element with its box relative to the host, inside the host', async (context) => {
    if (!browser) return context.skip();

    const markup = await markupOf(browser, 'inner');

    expect(markup).toContain('class="card" style="width: 120px; padding: 10px" data-box="x:0 y:0 w:140 h:36.3"');
    expect(markup).toContain('data-box="x:10 y:10 w:120 h:16.3">a</span>');
    expect(markup).not.toContain('id="root"');
  });

  it('marks the host itself at the origin with outer', async (context) => {
    if (!browser) return context.skip();

    expect(await markupOf(browser, 'outer')).toMatch(/^<div id="root" data-box="x:0 y:0 w:140 h:36.3">/);
  });

  it('answers null without the host', async (context) => {
    if (!browser) return context.skip();

    const page = await browser.newPage();

    expect(await page.evaluate(boxedMarkupScriptOf('#missing', 'inner'))).toBeNull();
  });
});
