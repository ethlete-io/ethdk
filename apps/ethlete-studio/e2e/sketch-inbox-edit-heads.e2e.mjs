#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const name = 'inbox@edit column heads wrap at 5 % and 2 %';
const only = value('--case');

assert.ok(!only || name.includes(only), `No case matches ${only}`);
process.env['DE_PORT'] ??= '4486';

const checkout = resolve(value('--checkout') ?? resolve(import.meta.dirname, '../../..'));
const built = value('--built');
const shots = value('--shots');
const engine = value('--engine') ?? 'chromium';
const started = performance.now();
const entry = 'sketch:pages/inbox@edit';
const names = ['Änderung behalten', 'Zuletzt gemergter Stand'];
const faults = [];

try {
  await withStudio(
    async ({ page, studioUrl }) => {
      await page.setViewportSize({ width: 1553, height: 1226 });
      await page.goto(studioUrl);
      const sketch = page.locator('ethlete-sketch-view ethlete-sketches');
      const matrix = sketch.locator('[data-sk-matrix]');
      const reset = sketch.locator('[data-camera-reset] button');
      await page.evaluate(
        ({ checkout, entry }) =>
          localStorage.setItem(
            'ethlete-studio.call-view',
            JSON.stringify({ checkout, systemProduct: 'studio', systemEntry: entry }),
          ),
        { checkout, entry },
      );
      await page.reload();
      await page.locator('ethlete-shell-collapse button').click({ timeout: 30_000 });
      await matrix.waitFor({ state: 'attached', timeout: 60_000 });
      const zoomOut = sketch.locator('[data-camera-out] button');
      for (const zoom of [5, 2]) {
        for (let step = 0; step < 40; step++) {
          const label = await reset.innerText();
          if (Number.parseInt(label, 10) <= zoom) break;
          await zoomOut.click();
          await page.waitForTimeout(150);
        }
        await reset.filter({ hasText: new RegExp(`^\\s*${zoom} %\\s*$`) }).waitFor({ timeout: 10_000 });
        await page.getByText('zeichnet').waitFor({ state: 'hidden', timeout: 60_000 });
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const heads = await matrix
          .locator('[data-sk-head-tag]:visible, [data-sk-head-name]:visible')
          .evaluateAll((chips) =>
            chips.map((chip) => {
              const range = document.createRange();
              range.selectNodeContents(chip);
              const box = chip.getBoundingClientRect();
              const text = range.getBoundingClientRect();
              return {
                label: chip.textContent.trim(),
                overflow: Math.max(box.left - text.left, text.right - box.right, text.bottom - box.bottom),
                width: box.width,
              };
            }),
          );
        assert.deepEqual(
          heads.map(({ label }) => label),
          [...names, ...names],
          `${zoom} % matrix heads`,
        );
        for (const [index, { label, overflow, width }] of heads.entries()) {
          if (overflow > 1) {
            faults.push(
              `${zoom} %, group ${1 + Math.floor(index / 2)}, ${label}: ${overflow.toFixed(1)} px outside a ${width.toFixed(1)} px chip`,
            );
          }
        }
        if (shots) await page.screenshot({ path: `${shots}-${zoom}pct.png` });
      }
    },
    { checkout, built, engine },
  );
  assert.deepEqual(faults, []);
  console.log(
    `PASS  ${((performance.now() - started) / 1000).toFixed(1)}s  ${name}: all four labels fit at both zooms`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
