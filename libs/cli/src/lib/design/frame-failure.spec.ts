import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { paintFailure } from '../../../design/web/frame-failure';

type ViteDevServer = import('vite', { with: { 'resolution-mode': 'import' } }).ViteDevServer;

const WEB = resolve(__dirname, '../../../design/web');

const HERO_FAILURE =
  `design-explore: state "dune" of "elements/hero" failed\n` +
  `The requested module '/@fs/home/tom/dev/client-runs/2026-11-25-0236/tomflix/node_modules/@ethlete/components/design/sdk/components/button/button.ts?design-product=tomflix&design-sketch=elements%2Fhero&design-variant=a' does not provide an export named 'tfButton'`;

const BADGE_BUILD_ERROR = {
  plugin: 'vite:css',
  message:
    "[postcss] tailwindcss: /home/user/dev/ethlete-sdk/.ethlete/design/studio/styles.css?design-product=studio&design-sketch=components%2Fsketch-status-badge%40edit&design-variant=old:1:1: Can't resolve '../../../sdk/foundations/colors/faces.css' in '/home/user/dev/ethlete-sdk/.ethlete/design/studio'",
  id: '/home/user/dev/ethlete-sdk/.ethlete/design/studio/styles.css?design-product=studio&design-sketch=components%2Fsketch-status-badge%40edit&design-variant=old',
  stack: '',
};

const overflowOf = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const element = document.querySelector(selector)!;

    return {
      hidden: element.scrollWidth - element.clientWidth,
      right: Math.ceil(element.getBoundingClientRect().right) - innerWidth,
    };
  }, selector);

describe('frame failure views', () => {
  let browser: Browser | undefined;
  let vite: ViteDevServer | undefined;
  let dir = '';

  beforeAll(async () => {
    browser = await chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });

    dir = mkdtempSync(join(tmpdir(), 'frame-failure-'));
    writeFileSync(
      join(dir, 'frame.html'),
      readFileSync(join(WEB, 'frame.html'), 'utf8').replace(
        '<script type="module" src="./frame.ts"></script>',
        `<script type="module">
          const { ErrorOverlay } = await import('/@vite/client');
          document.body.appendChild(new ErrorOverlay(${JSON.stringify(BADGE_BUILD_ERROR)}));
        </script>`,
      ),
    );

    const { createServer } = await import('vite');

    vite = await createServer({ configFile: false, root: dir, logLevel: 'silent', server: { port: 0, hmr: false } });
    await vite.listen();
  });

  afterAll(async () => {
    await browser?.close();
    await vite?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('wraps the failure of a sketch state inside a 390 px frame', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage({ viewport: { width: 390, height: 200 } });

    await page.setContent('<html><body style="margin:0"><div id="root"></div></body></html>');
    await page.evaluate(
      ([paint, message]) => new Function('message', `(${paint})(document.getElementById('root'), message)`)(message),
      [paintFailure.toString(), HERO_FAILURE] as const,
    );

    const view = await overflowOf(page, '#root pre');

    expect(view.hidden).toBe(0);
    expect(view.right).toBeLessThanOrEqual(0);
    await page.close();
  });

  it('keeps the vite build error overlay inside a narrow frame and grows the frame to show all of it', async (context) => {
    if (!browser || !vite) return context.skip('no browser');

    const page = await browser.newPage({ viewport: { width: 240, height: 120 } });
    const address = vite.httpServer?.address();

    await page.goto(`http://localhost:${address && typeof address === 'object' ? address.port : 0}/frame.html`);
    await page.locator('vite-error-overlay').waitFor({ state: 'attached' });

    const overlay = await page.evaluate(() => {
      const shadow = document.querySelector('vite-error-overlay')!.shadowRoot!;
      const message = shadow.querySelector('.message')!;
      const window = shadow.querySelector('.window')!.getBoundingClientRect();

      return {
        hidden: message.scrollWidth - message.clientWidth,
        right: Math.ceil(window.right) - innerWidth,
        below: Math.ceil(window.bottom) - Math.ceil(document.documentElement.getBoundingClientRect().height),
      };
    });

    expect(overlay.hidden).toBe(0);
    expect(overlay.right).toBeLessThanOrEqual(0);
    expect(overlay.below).toBeLessThanOrEqual(0);
    await page.close();
  });
}, 60_000);
