import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { awaitOutput, EMIT_WAIT_MS, settle, watchMutations } from './action-press';

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

describe('awaitOutput', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
  });

  afterAll(async () => {
    await browser?.close();
  });

  const timed = async (content: string, output: string | null) => {
    const page = await (browser as Browser).newPage();

    await page.setContent(content);
    await page.evaluate('window.__etDesignEmits = []');
    await watchMutations(page);
    await page.evaluate('window.start?.()');

    const start = Date.now();

    await awaitOutput(page, output);

    const waited = Date.now() - start;
    const emitted = (await page.evaluate('window.__etDesignEmits.map((emit) => emit.output)')) as string[];

    await page.close();

    return { waited, emitted };
  };

  const BUSY = `<div id="busy"></div><script>
    window.start = () => {
      const timer = setInterval(() => (document.getElementById('busy').textContent = String(Math.random())), 5);
      window.stop = () => clearInterval(timer);
    };
  </script>`;

  it('stops waiting as soon as the expected output fired, even while the DOM keeps changing', async (context) => {
    if (!browser) return context.skip('no browser');

    const { waited, emitted } = await timed(
      `${BUSY}<script>setTimeout(() => window.__etDesignEmits.push({ output: 'go' }), 60)</script>`,
      'go',
    );

    expect(emitted).toEqual(['go']);
    expect(waited).toBeLessThan(EMIT_WAIT_MS - 150);
  });

  it('keeps waiting for an output that fires late while the DOM is still changing', async (context) => {
    if (!browser) return context.skip('no browser');

    const { emitted } = await timed(
      `${BUSY}<script>setTimeout(() => { window.__etDesignEmits.push({ output: 'go' }); window.stop(); }, 250)</script>`,
      'go',
    );

    expect(emitted).toEqual(['go']);
  });

  it('stops waiting once the DOM stays unchanged for a few frames when nothing fires', async (context) => {
    if (!browser) return context.skip('no browser');

    const { waited } = await timed('<div>still</div>', 'go');

    expect(waited).toBeLessThan(EMIT_WAIT_MS - 150);
  });

  it('gives up after EMIT_WAIT_MS when the DOM never settles and the output never fires', async (context) => {
    if (!browser) return context.skip('no browser');

    const { waited, emitted } = await timed(BUSY, 'go');

    expect(emitted).toEqual([]);
    expect(waited).toBeGreaterThanOrEqual(EMIT_WAIT_MS - 20);
    expect(waited).toBeLessThan(EMIT_WAIT_MS + 1000);
  });
}, 30_000);
