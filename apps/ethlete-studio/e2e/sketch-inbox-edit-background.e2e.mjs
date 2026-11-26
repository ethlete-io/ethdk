#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const name = 'inbox@edit backgrounds stay dark at 9 %, 5 % and 2 %';
const only = value('--case');
const checkout = resolve(value('--checkout') ?? resolve(import.meta.dirname, '../../..'));
const built = value('--built');
const engine = value('--engine') ?? 'chromium';
const shots = value('--shots');
const entry = 'sketch:pages/inbox@edit';
const started = performance.now();

assert.ok(!only || name.includes(only), `No case matches ${only}`);

const cellsOf = () =>
  [...document.querySelectorAll('ethlete-sketch-view [data-shot]')].flatMap((cell) => {
    const box = cell.getBoundingClientRect();
    const frame = cell.querySelector('iframe[data-painted]');
    const picture = cell.querySelector('img[data-shot-picture]');
    const visible = (element) => {
      const style = element && getComputedStyle(element);

      return !!style && style.opacity !== '0' && style.visibility === 'visible' && style.display !== 'none';
    };

    if (box.top < 0 || box.bottom >= innerHeight || box.left < 0 || box.right >= innerWidth || box.height < 15)
      return [];

    return [
      {
        key: cell.dataset.shot,
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        hasPicture: !!picture?.naturalWidth,
        source: visible(frame) ? 'iframe' : visible(picture) && picture.naturalWidth ? 'picture' : null,
      },
    ];
  });

try {
  const faults = await withStudio(
    async ({ page, studioUrl }) => {
      await page.setViewportSize({ width: 1550, height: 1750 });
      await page.goto(studioUrl);
      const faults = [];

      for (const zoom of [9, 5, 2]) {
        await page.evaluate(
          ({ checkout, entry, zoom }) => {
            localStorage.setItem(
              'ethlete-studio.call-view',
              JSON.stringify({
                checkout,
                systemProduct: 'studio',
                systemEntry: entry,
                movedCameras: { [`studio ${entry}`]: { x: 0, y: 0, zoom: zoom / 100 } },
              }),
            );
          },
          { checkout, entry, zoom },
        );
        await page.reload();
        await page
          .locator('[data-camera-reset] button')
          .filter({ hasText: new RegExp(`^\\s*${zoom} %\\s*$`) })
          .waitFor();
        await page
          .locator('ethlete-sketch-view iframe[data-painted]')
          .first()
          .waitFor({ state: 'attached', timeout: 45_000 });

        const deadline = Date.now() + 45_000;
        let cells;
        do {
          cells = await page.evaluate(cellsOf);
          if (cells.length >= 6 && cells.every(({ source, hasPicture }) => source && hasPicture)) break;
          await page.waitForTimeout(150);
        } while (Date.now() < deadline);

        assert.ok(
          cells.length >= 6 && cells.every(({ source, hasPicture }) => source && hasPicture),
          `${zoom} % visible cells did not settle`,
        );
        if (zoom === 9)
          assert.ok(
            cells.some(({ source }) => source === 'iframe'),
            '9 % never showed a live frame',
          );

        const png = await page.screenshot({ path: shots && `${shots}-${zoom}pct.png`, scale: 'css' });
        const samples = await page.evaluate(
          async ({ base64, cells }) => {
            const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const context = canvas.getContext('2d');

            context.drawImage(bitmap, 0, 0);

            return cells.map(({ key, left, top, width, height, source }) => {
              const values = [0.86, 0.9, 0.94].flatMap((ratio) =>
                [0.62, 0.67, 0.72].map((column) => {
                  const x = Math.round(left + width * column);
                  const y = Math.round(top + height * ratio);

                  return context.getImageData(x, y, 1, 1).data[0];
                }),
              );

              return { key, source, median: values.sort((a, b) => a - b)[4] };
            });
          },
          { base64: png.toString('base64'), cells },
        );

        for (const { key, source, median } of samples)
          if (median > 30) faults.push(`${zoom} %, ${key}, ${source}: expected dark background, sampled ${median}`);
      }

      return faults;
    },
    { checkout, built, engine },
  );

  assert.deepEqual(faults, []);
  console.log(
    `PASS  ${((performance.now() - started) / 1000).toFixed(1)}s  ${name}: visible cells have dark backgrounds`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
