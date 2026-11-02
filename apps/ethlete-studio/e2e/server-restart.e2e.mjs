#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;

process.env['DE_PORT'] ??= '4477';

const VIEW = { systemProduct: 'studio', systemEntry: 'pages/system' };
const DOWN_MS = 3000;
const PAINT_TIMEOUT_MS = 120000;
const RECOVERY_MS = 60000;
const SETTLE_MS = 4000;
const ERROR_PAGE = 'chrome-error://';

const frameState = (page) =>
  page.evaluate(() => {
    const iframes = [...document.querySelectorAll('ethlete-canvas-frame iframe')];
    const shown = iframes.filter((iframe) => !iframe.classList.contains('opacity-0'));

    return {
      shown: shown.length,
      failedBanners: document.querySelectorAll('[data-frame-failed]').length,
    };
  });

const epochOf = (page) =>
  page.evaluate(() =>
    Math.max(
      -1,
      ...[...document.querySelectorAll('ethlete-canvas-frame iframe')].map((iframe) => {
        const epoch = URL.canParse(iframe.src) ? new URL(iframe.src).searchParams.get('epoch') : null;

        return epoch === null ? -1 : Number(epoch);
      }),
    ),
  );

const errorPages = (page) =>
  page
    .frames()
    .filter((frame) => frame.url().startsWith(ERROR_PAGE))
    .map((frame) => frame.name() || frame.url());

const waitFor = async (check, timeout) => {
  const until = Date.now() + timeout;

  while (Date.now() < until) {
    const result = await check();

    if (result) return result;
    await new Promise((done) => setTimeout(done, 500));
  }

  return null;
};

const result = await withStudio(
  async ({ page, studioUrl, restartDesign }) => {
    await page.goto(studioUrl);
    await page.evaluate(
      ({ view, checkout }) => {
        localStorage.clear();
        localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
      },
      { view: VIEW, checkout: root },
    );
    await page.goto(studioUrl);

    const painted = await waitFor(async () => (await frameState(page)).shown > 0, PAINT_TIMEOUT_MS);

    if (!painted) return { ok: false, detail: 'no live frame painted before the restart' };

    const before = await frameState(page);
    const restarted = restartDesign(DOWN_MS);

    await new Promise((done) => setTimeout(done, 300));
    const reloaded = await page.evaluate(() => {
      const iframe = [...document.querySelectorAll('ethlete-canvas-frame iframe')].find(
        (candidate) => !candidate.classList.contains('opacity-0'),
      );

      if (!iframe) return false;

      iframe.src = iframe.src;

      return true;
    });

    await page.keyboard.press('Escape');
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 600);
    await new Promise((done) => setTimeout(done, DOWN_MS / 2));

    const down = { errorPages: errorPages(page).length, ...(await frameState(page)) };

    await restarted;

    const recovered = await waitFor(async () => {
      const state = await frameState(page);
      const errors = errorPages(page);

      return state.shown > 0 && state.failedBanners === 0 && errors.length === 0 ? state : null;
    }, RECOVERY_MS);
    const after = { errorPages: errorPages(page), ...(await frameState(page)) };

    const epochBefore = await epochOf(page);

    await page.click('ethlete-studio-menu button[aria-label="Studio-Menü"]');
    await page.getByRole('menuitem', { name: 'Neu starten' }).click();
    await restartDesign(DOWN_MS);
    await waitFor(async () => {
      const state = await frameState(page);

      return state.shown > 0 && state.failedBanners === 0 ? state : null;
    }, RECOVERY_MS);
    await new Promise((done) => setTimeout(done, SETTLE_MS));

    const bumps = (await epochOf(page)) - epochBefore;

    return {
      ok: reloaded && !!recovered && bumps === 1,
      detail:
        `before ${JSON.stringify(before)}, while down ${JSON.stringify(down)}, ` +
        `after ${JSON.stringify(after)}${reloaded ? '' : ', no shown iframe to reload'}; ` +
        `Restart bumped the frame epoch ${bumps} times, expected 1`,
    };
  },
  { built },
);

console.log(
  `${result.ok ? 'PASS' : 'FAIL'}  frames recover from a design server restart during a load: ${result.detail}`,
);
process.exit(result.ok ? 0 : 1);
