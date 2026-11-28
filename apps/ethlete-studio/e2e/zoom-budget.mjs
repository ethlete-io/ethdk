import { CANVAS } from './probe-helpers.mjs';

export const FRAME = 'ethlete-canvas-frame, [data-canvas-frame], [data-sk-frame]';

export const ZOOM_BUDGET = { cells: 100, steps: 90, deltaY: 20, p50: 20, p95: 33 };

/**
 * The enforced p50 for `engine`; Infinity reports the p50 only: headless WebKit on the 4-core CI runner framed one
 * unchanged commit at p50 25-153 ms over 27 runs, so no CI budget there separates a regression from the runner.
 */
export const zoomP50BudgetOf = (engine, env = process.env) =>
  env['CI'] && engine === 'webkit' ? Infinity : ZOOM_BUDGET.p50;

export const percentile = (sorted, share) => sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)] ?? Infinity;

/** Ctrl-wheels the sketch canvas in and out over `ZOOM_BUDGET.steps` steps and returns the rAF frame intervals. */
export const measureZoom = async (page, cells) => {
  const box = await page.locator(`ethlete-sketch-view :is(${CANVAS})`).first().boundingBox();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate((FRAME) => {
    const stamps = [];
    const frame = document.querySelector(`ethlete-sketch-view :is(${FRAME})`);

    window.__zoomWidths = [];
    const record = (now) => {
      stamps.push(now);
      window.__zoomWidths.push(frame.getBoundingClientRect().width);
      window.__zoomFrame = requestAnimationFrame(record);
    };

    window.__zoomStamps = stamps;
    window.__zoomFrame = requestAnimationFrame(record);
  }, FRAME);
  await page.keyboard.down('Control');
  for (let step = 0; step < ZOOM_BUDGET.steps; step++) {
    await page.mouse.wheel(0, step < ZOOM_BUDGET.steps / 2 ? -ZOOM_BUDGET.deltaY : ZOOM_BUDGET.deltaY);
  }
  await page.keyboard.up('Control');

  const { stamps, widths } = await page.evaluate(() => {
    cancelAnimationFrame(window.__zoomFrame);

    return { stamps: window.__zoomStamps, widths: window.__zoomWidths };
  });
  const intervals = stamps
    .slice(1)
    .map((stamp, index) => stamp - stamps[index])
    .sort((a, b) => a - b);
  const before = Math.round(widths[0]);
  const zoomedIn = Math.round(Math.max(...widths));

  return {
    cells,
    before,
    zoomedIn,
    zoomed: zoomedIn > before * 1.5,
    p50: percentile(intervals, 0.5),
    p95: percentile(intervals, 0.95),
    frames: intervals.length,
  };
};
