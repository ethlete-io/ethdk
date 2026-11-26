#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const built = args.includes('--built') ? resolve(valueOf('--built')) : undefined;
const product = valueOf('--product', 'studio');
const target = valueOf('--sketch', 'pages/sketches');

process.env['DE_PORT'] ??= '4476';

const LIVE_CAP = 6;
const SETTLE_MS = 8000;

const result = await withStudio(
  async ({ page, studioUrl }) => {
    await page.goto(studioUrl);
    await page.evaluate(
      ({ checkout, systemProduct, systemEntry }) => {
        localStorage.clear();
        localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, systemProduct, systemEntry }));
      },
      { checkout: root, systemProduct: product, systemEntry: `sketch:${target}` },
    );
    await page.goto(studioUrl);
    await page.waitForSelector('ethlete-sketch-view [data-shot]', { timeout: 120000 });
    await page.waitForTimeout(SETTLE_MS);

    return page.evaluate(() => ({
      cells: document.querySelectorAll('ethlete-sketch-view [data-shot]').length,
      live: document.querySelectorAll('ethlete-sketch-view iframe[data-state]').length,
      pictures: document.querySelectorAll('ethlete-sketch-view img[data-shot-picture]').length,
    }));
  },
  { built },
);

const ok = result.cells > 0 && result.live <= LIVE_CAP;

console.log(
  `${ok ? 'PASS' : 'FAIL'}  ${target}: ${result.live} live frames (cap ${LIVE_CAP}), ${result.pictures} pictures, ${result.cells} cells`,
);
console.log(`\n${ok ? 1 : 0}/1 passed`);
process.exit(ok ? 0 : 1);
