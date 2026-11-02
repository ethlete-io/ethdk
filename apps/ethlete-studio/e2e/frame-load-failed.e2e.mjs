#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;

process.env['DE_PORT'] ??= '4478';

const VIEW = { systemProduct: 'studio', systemEntry: 'pages/system' };
const FAILED_TIMEOUT_MS = 60000;
const SILENT_PAGE = '<!doctype html><html><body></body></html>';

const result = await withStudio(
  async ({ page, studioUrl }) => {
    await page.route(
      (url) => url.searchParams.has('product') && url.searchParams.has('part'),
      (route) =>
        route.request().resourceType() === 'document'
          ? route.fulfill({ status: 200, contentType: 'text/html', body: SILENT_PAGE })
          : route.continue(),
    );
    await page.goto(studioUrl);
    await page.evaluate(
      ({ view, checkout }) => {
        localStorage.clear();
        localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
      },
      { view: VIEW, checkout: root },
    );
    await page.goto(studioUrl);

    const banner = page.locator('[data-frame-failed]').first();

    try {
      await banner.waitFor({ timeout: FAILED_TIMEOUT_MS });
    } catch {
      return { ok: false, detail: 'no failed-load banner for a frame page that sends no frame message' };
    }

    const text = (await banner.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
    const reload = await page.locator('[data-frame-reload]').count();
    const marked = await page.locator('ethlete-canvas-frame[data-load-failed]').count();

    return {
      ok: text.includes('Load failed.') && text.includes('sent no frame message') && reload > 0 && marked > 0,
      detail: `banner "${text}", reload buttons ${reload}, marked frames ${marked}`,
    };
  },
  { built },
);

console.log(
  `${result.ok ? 'PASS' : 'FAIL'}  a frame that sends no frame message shows the failed load: ${result.detail}`,
);
process.exit(result.ok ? 0 : 1);
