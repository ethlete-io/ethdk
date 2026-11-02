#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;
const product = args.includes('--product') ? args[args.indexOf('--product') + 1] : 'studio';

process.env['DE_PORT'] ??= '4475';

const BUDGET_MS = 2000;
const RELOADS = 3;

const result = await withStudio(
  async ({ page, studioUrl, designPort }) => {
    const listed = await (
      await fetch(`http://[::1]:${designPort}/__design/sketches?product=${product}&unchanged=no`)
    ).json();
    const first = listed.sketches[0];

    if (!first) throw new Error(`product ${product} has no open sketch to list`);

    const open = async () => {
      const started = Date.now();

      await page.goto(studioUrl);
      await page.waitForFunction(
        (name) =>
          [...document.querySelectorAll('ethlete-part-tree [etTreeNode]')].some(
            (row) => row.textContent?.trim() === name,
          ),
        first.name,
        { timeout: 60000 },
      );

      return Date.now() - started;
    };

    await page.goto(studioUrl);
    await page.evaluate(
      ({ checkout, systemProduct, systemEntry }) => {
        localStorage.clear();
        localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, systemProduct, systemEntry }));
      },
      { checkout: root, systemProduct: product, systemEntry: `sketch:${first.target}` },
    );

    const cold = await open();
    const reloads = [];

    for (let i = 0; i < RELOADS; i++) reloads.push(await open());

    return { cold, reloads };
  },
  { built },
);

const worst = Math.max(...result.reloads);
const ok = worst <= BUDGET_MS;

console.log(`cold load: first sketch row after ${result.cold} ms`);
console.log(
  `${ok ? 'PASS' : 'FAIL'}  first sketch row after reload: ${result.reloads.join(' / ')} ms (budget ${BUDGET_MS} ms)`,
);
process.exit(ok ? 0 : 1);
