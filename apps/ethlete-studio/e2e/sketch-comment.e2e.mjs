#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';
import { placeSketchDraft } from './sketch-comment-draft.mjs';

const args = process.argv.slice(2);
const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const checkout = resolve(valueOf('--checkout', resolve(import.meta.dirname, '../../..')));
const built = args.includes('--built') ? resolve(valueOf('--built')) : undefined;
const product = valueOf('--product', 'studio');
const target = valueOf('--sketch', 'pages/system');
const shot = valueOf('--shot');

const result = await withStudio(
  async ({ page, studioUrl }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(studioUrl);
    await page.evaluate(
      ({ checkout, systemProduct, systemEntry }) => {
        localStorage.clear();
        localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, systemProduct, systemEntry }));
      },
      { checkout, systemProduct: product, systemEntry: `sketch:${target}` },
    );
    await page.goto(studioUrl);
    await page.waitForSelector('ethlete-sketches [data-sk-frame]', { timeout: 120_000 });
    await page.waitForTimeout(5000);

    const placed = await placeSketchDraft(page);

    if (shot) await page.screenshot({ path: shot });

    return placed;
  },
  { checkout, built },
);

console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${product} sketch ${target}: ${result.detail}`);
console.log(`\n${result.ok ? 1 : 0}/1 passed`);
process.exit(result.ok ? 0 : 1);
