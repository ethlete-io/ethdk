#!/usr/bin/env node
import { cpSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const built = valueOf('--built') ? resolve(valueOf('--built')) : undefined;
const shots = valueOf('--shots');
const only = valueOf('--case');
const project = valueOf('--project') ? resolve(valueOf('--project')) : root;

process.env['DE_PORT'] ??= '4483';

const VIEW = {
  systemProduct: valueOf('--product') ?? 'studio',
  systemEntry: valueOf('--entry') ?? 'sketch:pages/system',
};
const CELLS_TIMEOUT_MS = 180000;
const SETTLE_MS = 1500;
const WHEEL_STEPS = 4;
const AFTER_WHEEL_MS = 3000;
const PREVIEW_SAMPLE_MS = 100;
const POSITION_TOLERANCE_PX = 1;
const STROKE_TOLERANCE_PX = 0.25;
const INK_MARGIN_PX = 8;

const checkout = mkdtempSync(join(tmpdir(), 'studio-sketch-zoom-settle-e2e-'));

for (const entry of readdirSync(project)) {
  if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(project, entry), join(checkout, entry));
}
cpSync(join(project, '.ethlete/design'), join(checkout, '.ethlete/design'), { recursive: true });

const openView = async ({ page, studioUrl }) => {
  await page.goto(studioUrl);
  await page.evaluate(
    ({ view, checkout }) => {
      localStorage.clear();
      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
    },
    { view: VIEW, checkout },
  );
  await page.goto(studioUrl);
};

const startProbe = (page) =>
  page.evaluate(() => {
    const scaleOf = (element) => {
      const box = element.getBoundingClientRect();

      return element.offsetWidth > 0 ? box.width / element.offsetWidth : 1;
    };
    const ringOf = (element) => {
      const spreads = [...getComputedStyle(element).boxShadow.matchAll(/0px 0px 0px ([\d.]+)px/g)].map((match) =>
        Number(match[1]),
      );

      return spreads.length === 0 ? null : Math.max(...spreads) * scaleOf(element);
    };
    const read = () =>
      [...document.querySelectorAll('ethlete-sketches ethlete-variant-cell')].flatMap((cell) => {
        const frame = cell.querySelector('[data-sk-frame]');
        const label = cell.querySelector('[data-sk-label-text]');

        if (!frame) return [];
        const frameBox = frame.getBoundingClientRect();
        const labelBox = label && label.getBoundingClientRect().height > 0 ? label.getBoundingClientRect() : null;

        return [
          {
            key: `${cell.getAttribute('data-sk-variant')}/${cell.getAttribute('data-sk-state')}`,
            gap: labelBox ? frameBox.top - labelBox.bottom : null,
            label: labelBox?.height ?? null,
            ring: ringOf(frame),
          },
        ];
      });
    const dashed = () =>
      [
        ...document.querySelectorAll(
          'ethlete-sketches [data-sk-missing].border-dashed, ethlete-sketches [data-sk-missing] .border-dashed, ethlete-sketches [data-sk-missing] [data-sk-dashed]',
        ),
      ].map((edge) =>
        edge.hasAttribute('data-sk-dashed')
          ? Number.parseFloat(getComputedStyle(edge.querySelector('rect')).strokeWidth) * scaleOf(edge.parentElement)
          : Number.parseFloat(getComputedStyle(edge).borderTopWidth) * scaleOf(edge),
      );
    const gutters = () =>
      [...document.querySelectorAll('ethlete-sketches [data-sk-gutter]')].flatMap((gutter) => {
        const text = gutter.querySelector('.font-ui-medium');
        const state = text?.textContent?.trim();
        const frame =
          state &&
          gutter.parentElement?.querySelector(`ethlete-variant-cell[data-sk-state="${state}"] [data-sk-frame]`);

        if (!text || !frame) return [];

        return [{ key: state, top: text.getBoundingClientRect().top - frame.getBoundingClientRect().top }];
      });
    const probe = { samples: [], lastWheel: 0, stop: false };

    window.__zoomSettleProbe = probe;
    window.addEventListener('wheel', () => (probe.lastWheel = performance.now()), { capture: true, passive: true });
    const tick = () => {
      probe.samples.push({ at: performance.now(), cells: read(), dashed: dashed(), gutters: gutters() });
      if (!probe.stop) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });

const stopProbe = (page) =>
  page.evaluate(() => {
    window.__zoomSettleProbe.stop = true;

    return window.__zoomSettleProbe;
  });

const diffOf = (preview, settled) => {
  const faults = [];
  const byKey = new Map(settled.cells.map((cell) => [cell.key, cell]));

  for (const cell of preview.cells) {
    const after = byKey.get(cell.key);

    if (!after) continue;
    if (cell.gap !== null && after.gap !== null && Math.abs(cell.gap - after.gap) > POSITION_TOLERANCE_PX)
      faults.push(`${cell.key} label-to-frame gap ${cell.gap.toFixed(1)} -> ${after.gap.toFixed(1)} px`);
    if (cell.label !== null && after.label !== null && Math.abs(cell.label - after.label) > POSITION_TOLERANCE_PX)
      faults.push(`${cell.key} label height ${cell.label.toFixed(1)} -> ${after.label.toFixed(1)} px`);
    if (cell.ring !== null && after.ring !== null && Math.abs(cell.ring - after.ring) > STROKE_TOLERANCE_PX)
      faults.push(`${cell.key} frame ring ${cell.ring.toFixed(2)} -> ${after.ring.toFixed(2)} px`);
  }
  const gutterOf = new Map(settled.gutters.map((gutter) => [gutter.key, gutter]));

  for (const gutter of preview.gutters) {
    const after = gutterOf.get(gutter.key);

    if (after && Math.abs(gutter.top - after.top) > POSITION_TOLERANCE_PX)
      faults.push(`side label ${gutter.key} top ${gutter.top.toFixed(1)} -> ${after.top.toFixed(1)} px from its frame`);
  }
  preview.dashed.forEach((width, index) => {
    const after = settled.dashed[index];

    if (after !== undefined && Math.abs(width - after) > STROKE_TOLERANCE_PX)
      faults.push(`dashed box ${index} border ${width.toFixed(2)} -> ${after.toFixed(2)} px`);
  });

  return faults;
};

const inPreview = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('ethlete-sketches [data-sk-rows] > div')].some(
      (world) => world.style.willChange === 'transform',
    ),
  );

const inkOf = async (page) => {
  const before = await inPreview(page);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('ethlete-sketches [data-sk-gutter] > .font-ui-medium')].map((text) => {
      const box = text.getBoundingClientRect();

      return {
        key: `${text.parentElement.getAttribute('data-sk-block')}/${text.textContent.trim()}`,
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };
    }),
  );
  const viewport = page.viewportSize();
  const shown = labels.filter(
    (label) => label.top >= 0 && label.left >= 0 && label.top + label.height <= viewport.height,
  );

  if (shown.length === 0) return { labels: [], png: null, clip: null, inPreview: before };
  const clip = { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const png = (await page.screenshot()).toString('base64');

  return { labels: shown, png, clip, inPreview: before && (await inPreview(page)) };
};

const inkFaultsOf = async (page, preview, settled) => {
  if (!preview.png || !settled.png) return [];
  const isolated = await page.context().browser().newContext();
  const scratch = await isolated.newPage();

  try {
    const shifts = await scratch.evaluate(
      async ({ preview, settled, margin }) => {
        const pixelsOf = async (png) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const context = canvas.getContext('2d');

          context.drawImage(bitmap, 0, 0);

          return context.getImageData(0, 0, bitmap.width, bitmap.height);
        };
        const [before, after] = [await pixelsOf(preview.png), await pixelsOf(settled.png)];
        const ratio = before.width / preview.clip.width;
        const lumaAt = (image, x, y) => {
          if (x < 0 || y < 0 || x >= image.width || y >= image.height) return 0;
          const at = (y * image.width + x) * 4;

          return image.data[at] * 0.3 + image.data[at + 1] * 0.59 + image.data[at + 2] * 0.11;
        };
        const settledOf = new Map(settled.labels.map((label) => [label.key, label]));

        return preview.labels.flatMap((label) => {
          const other = settledOf.get(label.key);

          if (!other || label.width === 0) return [];
          const left = Math.round((label.left - preview.clip.x) * ratio);
          const settledLeft = Math.round((other.left - settled.clip.x) * ratio);
          const width = Math.round(label.width * ratio);
          const height = Math.round((label.height + 2 * margin) * ratio);
          const topOf = (box, clip) => Math.round((box.top - margin - clip.y) * ratio);
          const costOf = (shift) => {
            let cost = 0;

            for (let y = 0; y < height; y++)
              for (let x = 0; x < width; x++)
                cost += Math.abs(
                  lumaAt(before, left + x, topOf(label, preview.clip) + y) -
                    lumaAt(after, settledLeft + x, topOf(other, settled.clip) + y + shift),
                );

            return cost;
          };
          let best = 0;

          for (let shift = -margin * ratio; shift <= margin * ratio; shift++)
            if (costOf(shift) < costOf(best)) best = shift;

          return [{ key: label.key, shift: best / ratio }];
        });
      },
      { preview, settled, margin: INK_MARGIN_PX },
    );

    return shifts
      .filter(({ shift }) => Math.abs(shift) > POSITION_TOLERANCE_PX)
      .map(({ key, shift }) => `side label ${key} text drawn ${shift.toFixed(0)} px off its box after the settle`);
  } finally {
    await isolated.close();
  }
};

const chromeHoldsWhenWheelZoomSettles = async (context) => {
  const { page } = context;

  await openView(context);
  try {
    await page.locator('ethlete-sketches ethlete-variant-cell [data-sk-frame]').first().waitFor({
      timeout: CELLS_TIMEOUT_MS,
    });
  } catch {
    if (shots) await page.screenshot({ path: `${shots}-timeout.png` });

    return { ok: false, detail: `no sketch frame within ${CELLS_TIMEOUT_MS} ms` };
  }
  await page.waitForTimeout(SETTLE_MS);

  const list = await page.locator('ethlete-sketches [data-sk-rows]').first().boundingBox();

  if (!list) return { ok: false, detail: 'no sketch rows list' };
  await startProbe(page);
  if (shots) await page.screenshot({ path: `${shots}-before.png` });
  await page.mouse.move(list.x + list.width / 2, list.y + Math.min(list.height / 2, 300));
  await page.keyboard.down('Control');
  for (let step = 0; step < WHEEL_STEPS; step++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(30);
  }
  await page.keyboard.up('Control');
  const previewInk = await inkOf(page);

  if (shots) await page.screenshot({ path: `${shots}-preview.png` });
  await page.waitForTimeout(AFTER_WHEEL_MS);
  const settledInk = await inkOf(page);

  if (shots) await page.screenshot({ path: `${shots}-settled.png` });
  if (!previewInk.inPreview) return { ok: false, detail: 'the preview ended before its screenshot' };

  const { lastWheel, samples } = await stopProbe(page);
  const preview = samples
    .filter((sample) => sample.at > lastWheel && sample.at <= lastWheel + PREVIEW_SAMPLE_MS)
    .at(-1);
  const settled = samples.at(-1);

  if (!preview || !settled) return { ok: false, detail: `no preview sample among ${samples.length} frames` };
  if (preview.cells.length === 0) return { ok: false, detail: 'no sketch frame in the preview' };

  const faults = [...diffOf(preview, settled), ...(await inkFaultsOf(page, previewInk, settledInk))];

  return {
    ok: faults.length === 0,
    detail: `${preview.cells.length} cells, ${preview.gutters.length} side labels, ${preview.dashed.length} dashed boxes compared preview vs settled${
      faults.length
        ? `; ${faults.slice(0, 12).join('; ')}${faults.length > 12 ? `; +${faults.length - 12} more` : ''}`
        : ''
    }`,
  };
};

const CASES = [
  {
    name: 'no row size change after a wheel zoom settles: labels and strokes stay put',
    run: chromeHoldsWhenWheelZoomSettles,
  },
];

const results = await withStudio(
  async (context) => {
    const rows = [];

    for (const testCase of CASES.filter((testCase) => !only || testCase.name.includes(only))) {
      const startedAt = performance.now();

      rows.push({ name: testCase.name, ...(await testCase.run(context)), ms: performance.now() - startedAt });
    }

    return rows;
  },
  { checkout, built },
).finally(() => rmSync(checkout, { recursive: true, force: true }));

for (const result of results)
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${(result.ms / 1000).toFixed(1)}s  ${result.name}: ${result.detail}`);
process.exit(results.length > 0 && results.every((result) => result.ok) ? 0 : 1);
