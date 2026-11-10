import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  awaitOutput,
  dropKeyboardFocus,
  EMIT_WAIT_MS,
  settle,
  SETTLE_TIMEOUT_MS,
  SettleTimeoutError,
  watchMutations,
} from './action-press';

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

  it('names an animation that outruns its cap instead of waiting the caller timeout out silently', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(`<style>
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
        .body { animation: fade 60s linear }
      </style><div class="body">x</div>`);

    const start = Date.now();

    await expect(settle(page, 15_000)).rejects.toBeInstanceOf(SettleTimeoutError);
    expect(Date.now() - start).toBeLessThan(SETTLE_TIMEOUT_MS + 1500);
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
    await page.evaluate('window.__etDesignEmits = []; window.__etOutputReads = 0');
    await watchMutations(page);
    await page.evaluate('window.start?.()');

    const start = Date.now();

    await awaitOutput(page, output);

    const waited = Date.now() - start;
    const { reads, quietFrames } = (await page.evaluate(
      '({ reads: window.__etOutputReads, quietFrames: window.__etQuietFrames })',
    )) as { reads: number; quietFrames: number };
    const emitted = (await page.evaluate('window.__etDesignEmits.map((emit) => emit.output)')) as string[];

    await page.close();

    return { waited, emitted, reads, quietFrames };
  };

  const busy = (emitAtFrame?: number) => `<div id="busy"></div><script>
    window.start = () => {
      let frame = 0;
      const tick = () => {
        document.getElementById('busy').textContent = String(++frame);
        if (frame === ${emitAtFrame ?? -1}) {
          window.__etDesignEmits.push({ get output() { window.__etOutputReads++; return 'go'; } });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
  </script>`;

  it('stops waiting as soon as the expected output fired, even while the DOM keeps changing', async (context) => {
    if (!browser) return context.skip('no browser');

    const { emitted, reads } = await timed(busy(3), 'go');

    expect(emitted).toEqual(['go']);
    expect(reads).toBe(1);
  });

  it('keeps waiting for an output that fires late while the DOM is still changing', async (context) => {
    if (!browser) return context.skip('no browser');

    const { emitted, reads } = await timed(busy(9), 'go');

    expect(emitted).toEqual(['go']);
    expect(reads).toBe(1);
  });

  it('stops waiting once the DOM stays unchanged for a few frames when nothing fires', async (context) => {
    if (!browser) return context.skip('no browser');

    const { quietFrames } = await timed('<div>still</div>', 'go');

    expect(quietFrames).toBe(2);
  });

  it('gives up after EMIT_WAIT_MS when the DOM never settles and the output never fires', async (context) => {
    if (!browser) return context.skip('no browser');

    const { waited, emitted } = await timed(busy(), 'go');

    expect(emitted).toEqual([]);
    expect(waited).toBeGreaterThanOrEqual(EMIT_WAIT_MS - 20);
    expect(waited).toBeLessThan(EMIT_WAIT_MS + 1000);
  });
}, 30_000);

describe('dropKeyboardFocus', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
  });

  afterAll(async () => {
    await browser?.close();
  });

  const TOGGLE = `<style>button:focus-visible { outline: 3px solid red }</style>
    <button aria-expanded="false" onclick="this.ariaExpanded = String(this.ariaExpanded !== 'true'); reason.hidden = !reason.hidden">Pausiert</button>
    <span id="reason" hidden>Wartet</span>`;

  it.for(['Enter', 'Space'])(
    'takes the focus ring off a toggle pressed with %s and keeps the state it reached',
    async (key, context) => {
      if (!browser) return context.skip('no browser');

      const page = await browser.newPage();

      await page.setContent(TOGGLE);
      await page.keyboard.press('Shift');
      await page.locator('button').focus();
      await page.keyboard.press(key);
      await dropKeyboardFocus(page);

      expect(await page.evaluate('document.querySelectorAll(":focus-visible").length')).toBe(0);
      expect(await page.locator('button').getAttribute('aria-expanded')).toBe('true');
      expect(await page.locator('#reason').isVisible()).toBe(true);
      await page.close();
    },
  );
}, 30_000);
