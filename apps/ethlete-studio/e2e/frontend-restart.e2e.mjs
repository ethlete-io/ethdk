#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const args = process.argv.slice(2);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const built = valueOf('--built') && resolve(valueOf('--built'));
const shot = valueOf('--shot') && resolve(valueOf('--shot'));

process.env['DE_PORT'] ??= '4478';

const CHROME = { os: 'linux', left: [], right: ['minimize', 'maximize', 'close'], preferNoCsd: false };
const NAME = 'a frontend restart with its page server down keeps a page and reloads once it answers';
const DOWN_MS = 3000;
const NOTICE_TIMEOUT_MS = 30000;
const RELOAD_TIMEOUT_MS = 30000;
const ERROR_PAGE = 'chrome-error://';
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

let frontendLatest = A;
let duringRestart = () => Promise.resolve();

const codeState = () => ({
  cli: { running: null, latest: null, dirty: false },
  frontend: { latest: frontendLatest },
  host: { running: null, latest: null },
});

const host = async (command) => {
  if (command === 'studio_code_state') return codeState();
  if (command === 'design_server_restart') await duringRestart();

  return undefined;
};

const waitFor = async (check, timeout) => {
  const until = Date.now() + timeout;

  while (Date.now() < until) {
    const result = await check().catch(() => null);

    if (result) return result;
    await new Promise((done) => setTimeout(done, 250));
  }

  return null;
};

const startedAt = Date.now();
const result = await withStudio(
  async ({ page, studioUrl, studioServer }) => {
    await page.goto(studioUrl);
    await page.locator('ethlete-title-bar').waitFor({ timeout: 60000 });

    frontendLatest = B;
    const notice = page.locator('ethlete-title-bar button', { hasText: 'Neu starten' });

    if (!(await waitFor(() => notice.isVisible(), NOTICE_TIMEOUT_MS))) {
      return { ok: false, detail: 'the "Oberfläche geändert" notice never showed' };
    }

    await page.evaluate(() => (window.__beforeRestart = true));
    duringRestart = () => studioServer.stop();
    await notice.click();
    await new Promise((done) => setTimeout(done, DOWN_MS));

    const down = {
      url: page.url(),
      reloading: await page
        .locator('[data-studio-reloading]')
        .isVisible()
        .catch(() => false),
    };

    if (shot) await page.screenshot({ path: shot });

    await studioServer.start();

    const reloaded = await waitFor(
      () =>
        page.evaluate(
          () =>
            !window.__beforeRestart &&
            !!document.querySelector('ethlete-title-bar') &&
            !document.querySelector('[data-studio-reloading]'),
        ),
      RELOAD_TIMEOUT_MS,
    );
    const after = page.url();
    const ok = !down.url.startsWith(ERROR_PAGE) && down.reloading && !!reloaded && !after.startsWith(ERROR_PAGE);

    return {
      ok,
      detail: `while down ${JSON.stringify(down)}, after ${after}, reloaded ${!!reloaded}`,
    };
  },
  { built, chrome: { value: CHROME, delayMs: 0 }, host },
);

console.log(
  `${result.ok ? 'PASS' : 'FAIL'}  ${((Date.now() - startedAt) / 1000).toFixed(1)}s  ${NAME}: ${result.detail}`,
);
console.log(`\n${result.ok ? 1 : 0}/1 passed`);
process.exit(result.ok ? 0 : 1);
