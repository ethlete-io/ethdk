#!/usr/bin/env node
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { copyPart } from './copy-part.mjs';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const built = valueOf('--built') ? resolve(valueOf('--built')) : undefined;
const shots = valueOf('--shots');
const only = valueOf('--case');
const engine = valueOf('--engine') ?? 'chromium';
const project = valueOf('--project') ? resolve(valueOf('--project')) : root;

process.env['DE_PORT'] ??= '4483';

const FIXTURE_TARGET = 'components/comment-draft';
const CANCEL_LABEL = ['label: COMMENT_DRAFT_LABELS.cancel,', "label: 'Verwerfen',"];
const DROPPED_STATE = "    busy: { text: 'Tonal wirkt neben filled zu blass.', phase: 'busy' },\n";

const VIEW = {
  systemProduct: valueOf('--product') ?? 'studio',
  systemEntry: valueOf('--entry') ?? `sketch:${FIXTURE_TARGET}`,
};
const CELLS_TIMEOUT_MS = 180000;
const SETTLE_MS = 1500;
const WHEEL_STEPS = 4;
const AFTER_WHEEL_MS = 3000;
const PREVIEW_SAMPLE_MS = 100;
const POSITION_TOLERANCE_PX = 1;
const STROKE_TOLERANCE_PX = 0.25;
const INK_MARGIN_PX = 8;
const TEXT_INK_MARGIN_PX = 4;
const TEXT_SELECTORS = [
  '[data-sk-label-text]',
  '[data-sk-same-as-rest]',
  '[data-sk-stack-states]',
  '[data-sk-line-head]',
  '[data-sk-column-head]',
  '[data-sk-folded-cell]',
  '[data-sk-missing] > div',
  '[data-sk-head-name]',
  '[data-sk-head-tag]',
  '[data-sk-note]',
  '[data-sk-withdrawn]',
];

const checkout = mkdtempSync(join(tmpdir(), 'studio-sketch-zoom-settle-e2e-'));

for (const entry of readdirSync(project)) {
  if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(project, entry), join(checkout, entry));
}
cpSync(join(project, '.ethlete/design'), join(checkout, '.ethlete/design'), { recursive: true });

if (!valueOf('--project')) {
  const studioDir = join(checkout, '.ethlete/design/studio');
  const sketchFolder = join(studioDir, 'sketches', FIXTURE_TARGET.replace('/', '-'));

  rmSync(join(studioDir, 'sketches'), { recursive: true, force: true });

  for (const variant of ['a', 'b']) {
    mkdirSync(join(sketchFolder, variant, dirname(FIXTURE_TARGET)), { recursive: true });
    copyPart(join(studioDir, FIXTURE_TARGET), join(sketchFolder, variant, FIXTURE_TARGET));
  }

  const variantFiles = ['a', 'b'].map((variant) => join(sketchFolder, variant, FIXTURE_TARGET, 'comment-draft.ts'));

  for (const file of variantFiles) {
    const source = readFileSync(file, 'utf8');
    const changed = file === variantFiles[1] ? source.replace(...CANCEL_LABEL).replace(DROPPED_STATE, '') : source;

    if (!source.includes('rows: 3') || !source.includes(CANCEL_LABEL[0]) || !source.includes(DROPPED_STATE))
      throw new Error(`${file}: fixture drifted`);
    writeFileSync(file, changed);
  }
  writeFileSync(
    join(sketchFolder, 'sketch.json'),
    JSON.stringify({
      target: FIXTURE_TARGET,
      targets: [FIXTURE_TARGET],
      status: 'ready',
      createdAt: '2026-01-01T00:00:00.000Z',
      rounds: [{ key: 'r1', title: '', note: 'sketch-zoom-settle e2e' }],
      variantInfo: {
        a: { authors: ['sketch-zoom-settle-e2e'], round: 'r1' },
        b: { authors: ['sketch-zoom-settle-e2e'], round: 'r1' },
      },
    }),
  );
}

// WebKit takes longer than the 150 ms wheel idle to screenshot, so the preview settles before its shot unless
// timers that come due while the shot is taken wait until it is done.
const holdableTimers = () => {
  if (window.__timerHold) return;
  const hold = { on: false, due: new Map() };
  const setTimer = window.setTimeout;
  const clearTimer = window.clearTimeout;

  window.__timerHold = hold;
  window.setTimeout = (callback, delay, ...rest) => {
    const run = () => (typeof callback === 'function' ? callback(...rest) : undefined);
    const id = setTimer(() => (hold.on ? hold.due.set(id, run) : run()), delay);

    return id;
  };
  window.clearTimeout = (id) => {
    hold.due.delete(id);
    clearTimer(id);
  };
};

const holdTimers = (page, on) =>
  page.evaluate((on) => {
    const hold = window.__timerHold;
    const due = [...hold.due.values()];

    hold.on = on;
    if (on) return;
    hold.due.clear();
    due.forEach((run) => run());
  }, on);

const openView = async ({ page, studioUrl }) => {
  await page.addInitScript(holdableTimers);
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
    const stacks = () =>
      [...document.querySelectorAll('ethlete-sketches ethlete-variant-cell')].flatMap((cell) => {
        const frame = cell.querySelector('[data-sk-frame]')?.getBoundingClientRect();
        const states = cell.querySelector('[data-sk-stack-states]')?.getBoundingClientRect();
        const heights = [...cell.querySelectorAll('[data-sk-crop-stack]')].map(
          (stack) => stack.getBoundingClientRect().height,
        );

        const text = cell.querySelector('[data-sk-stack-states] > span')?.getBoundingClientRect();

        return frame && states && heights.length > 0
          ? [{ heights, below: states.top - frame.bottom, text: text ? text.top - states.top : null }]
          : [];
      });
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
      probe.samples.push({
        at: performance.now(),
        cells: read(),
        stacks: stacks(),
        dashed: dashed(),
        gutters: gutters(),
      });
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
  preview.stacks.forEach((stack, index) => {
    const after = settled.stacks[index];

    if (!after) return;
    stack.heights.forEach((height, edge) => {
      if (Math.abs(height - after.heights[edge]) > POSITION_TOLERANCE_PX)
        faults.push(`crop stack ${index}.${edge} height ${height.toFixed(1)} -> ${after.heights[edge].toFixed(1)} px`);
    });
    if (Math.abs(stack.below - after.below) > POSITION_TOLERANCE_PX)
      faults.push(`crop stack ${index} label below frame ${stack.below.toFixed(1)} -> ${after.below.toFixed(1)} px`);
    if (stack.text !== null && after.text !== null && Math.abs(stack.text - after.text) > POSITION_TOLERANCE_PX)
      faults.push(
        `crop stack ${index} label text ${stack.text.toFixed(1)} -> ${after.text.toFixed(1)} px below its box`,
      );
  });
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
  const { labels, texts } = await page.evaluate((selectors) => {
    const hostOf = (element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();

        range.selectNodeContents(node);
        if (range.getClientRects().length > 0) return node.parentElement;
      }

      return null;
    };

    const texts = selectors.flatMap((selector) =>
      [...document.querySelectorAll(`ethlete-sketches ${selector}`)].flatMap((anchor, index) => {
        const host = hostOf(anchor);

        if (!host) return [];
        const box = anchor.getBoundingClientRect();
        const text = host.getBoundingClientRect();

        return [
          {
            key: `${selector} ${index}`,
            anchor: box.top,
            left: text.left,
            width: text.width,
            offset: text.top - box.top,
            height: text.height,
          },
        ];
      }),
    );

    return {
      labels: [...document.querySelectorAll('ethlete-sketches [data-sk-gutter] > .font-ui-medium')].map((text) => {
        const box = text.getBoundingClientRect();

        return {
          key: `${text.parentElement.getAttribute('data-sk-block')}/${text.textContent.trim()}`,
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        };
      }),
      texts,
    };
  }, TEXT_SELECTORS);
  const viewport = page.viewportSize();
  const shownTexts = texts.filter(
    (text) => text.anchor >= 0 && text.left >= 0 && text.anchor + text.offset + text.height <= viewport.height,
  );
  const shown = labels.filter(
    (label) => label.top >= 0 && label.left >= 0 && label.top + label.height <= viewport.height,
  );

  if (shown.length === 0 && shownTexts.length === 0)
    return { labels: [], texts: [], png: null, clip: null, inPreview: before };
  const clip = { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const png = (await page.screenshot()).toString('base64');

  return { labels: shown, texts: shownTexts, png, clip, inPreview: before && (await inPreview(page)) };
};

const regionsOf = (preview, settled) => {
  const settledLabelOf = new Map(settled.labels.map((label) => [label.key, label]));
  const settledTextOf = new Map(settled.texts.map((text) => [text.key, text]));
  const labels = preview.labels.flatMap((label) => {
    const other = settledLabelOf.get(label.key);

    if (!other || label.width === 0) return [];

    return [
      {
        name: `side label ${label.key}`,
        margin: INK_MARGIN_PX,
        width: label.width,
        height: label.height,
        before: { left: label.left, top: label.top },
        after: { left: other.left, top: other.top },
      },
    ];
  });
  const texts = preview.texts.flatMap((text) => {
    const other = settledTextOf.get(text.key);

    if (!other || text.width === 0) return [];

    return [
      {
        name: `text ${text.key}`,
        margin: TEXT_INK_MARGIN_PX,
        width: Math.min(text.width, other.width),
        height: other.height,
        before: { left: text.left, top: text.anchor + other.offset },
        after: { left: other.left, top: other.anchor + other.offset },
      },
    ];
  });

  return [...labels, ...texts];
};

const inkFaultsOf = async (page, preview, settled) => {
  if (!preview.png || !settled.png) return [];
  const isolated = await page.context().browser().newContext();
  const scratch = await isolated.newPage();

  try {
    const shifts = await scratch.evaluate(
      async ({ preview, settled, regions }) => {
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

        return regions.map((region) => {
          const { margin } = region;
          const left = Math.round((region.before.left - preview.clip.x) * ratio);
          const settledLeft = Math.round((region.after.left - settled.clip.x) * ratio);
          const width = Math.round(region.width * ratio);
          const height = Math.round((region.height + 2 * margin) * ratio);
          const top = Math.round((region.before.top - margin - preview.clip.y) * ratio);
          const settledTop = Math.round((region.after.top - margin - settled.clip.y) * ratio);
          const costOf = (shift) => {
            let cost = 0;

            for (let y = 0; y < height; y++)
              for (let x = 0; x < width; x++)
                cost += Math.abs(
                  lumaAt(before, left + x, top + y) - lumaAt(after, settledLeft + x, settledTop + y + shift),
                );

            return cost;
          };
          let best = 0;

          for (let shift = -margin * ratio; shift <= margin * ratio; shift++)
            if (costOf(shift) < costOf(best)) best = shift;

          return { name: region.name, shift: best / ratio };
        });
      },
      { preview, settled, regions: regionsOf(preview, settled) },
    );

    return shifts
      .filter(({ shift }) => Math.abs(shift) > POSITION_TOLERANCE_PX)
      .map(({ name, shift }) => `${name} text drawn ${shift.toFixed(0)} px off its box after the settle`);
  } finally {
    await isolated.close();
  }
};

const chromeHoldsWhenWheelZoomSettles = async (
  context,
  { steps = WHEEL_STEPS, onSideLabel = false, tag = '' } = {},
) => {
  const { page } = context;

  await openView(context);
  try {
    await page.locator('ethlete-sketches ethlete-variant-cell [data-sk-frame]').first().waitFor({
      timeout: CELLS_TIMEOUT_MS,
    });
  } catch {
    if (shots) await page.screenshot({ path: `${shots}${tag}-timeout.png` });

    return { ok: false, detail: `no sketch frame within ${CELLS_TIMEOUT_MS} ms` };
  }
  await page.waitForTimeout(SETTLE_MS);

  const list = await page.locator('ethlete-sketches [data-sk-rows]').first().boundingBox();

  if (!list) return { ok: false, detail: 'no sketch rows list' };
  await startProbe(page);
  if (shots) await page.screenshot({ path: `${shots}${tag}-before.png` });
  const sideLabel = onSideLabel
    ? await page.locator('ethlete-sketches [data-sk-gutter] > .font-ui-medium').first().boundingBox()
    : null;

  if (onSideLabel && !sideLabel) return { ok: false, detail: 'no side label to point at' };
  if (sideLabel) await page.mouse.move(sideLabel.x + sideLabel.width / 2, sideLabel.y + sideLabel.height / 2);
  else await page.mouse.move(list.x + list.width / 2, list.y + Math.min(list.height / 2, 300));
  await holdTimers(page, true);
  await page.keyboard.down('Control');
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(30);
  }
  await page.keyboard.up('Control');
  const previewInk = await inkOf(page);

  if (shots) await page.screenshot({ path: `${shots}${tag}-preview.png` });
  await holdTimers(page, false);
  await page.waitForTimeout(AFTER_WHEEL_MS);
  const settledInk = await inkOf(page);

  if (shots) await page.screenshot({ path: `${shots}${tag}-settled.png` });
  if (!previewInk.inPreview) return { ok: false, detail: 'the preview ended before its screenshot' };

  const { lastWheel, samples } = await stopProbe(page);
  const preview = samples
    .filter((sample) => sample.at > lastWheel && sample.at <= lastWheel + PREVIEW_SAMPLE_MS)
    .at(-1);
  const settled = samples.at(-1);

  if (!preview || !settled) return { ok: false, detail: `no preview sample among ${samples.length} frames` };
  if (preview.cells.length === 0) return { ok: false, detail: 'no sketch frame in the preview' };
  if (preview.stacks.length === 0) return { ok: false, detail: 'no crop stack in the preview' };

  const faults = [...diffOf(preview, settled), ...(await inkFaultsOf(page, previewInk, settledInk))];

  return {
    ok: faults.length === 0,
    detail: `${preview.cells.length} cells, ${preview.gutters.length} side labels, ${preview.dashed.length} dashed boxes, ${preview.stacks.length} crop stacks compared preview vs settled${
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
  {
    name: 'side label text stays on its box after a two-step wheel zoom on the first side label',
    run: (context) => chromeHoldsWhenWheelZoomSettles(context, { steps: 2, onSideLabel: true, tag: '-side' }),
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
  { checkout, built, engine },
).finally(() => rmSync(checkout, { recursive: true, force: true }));

for (const result of results)
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${(result.ms / 1000).toFixed(1)}s  ${result.name}: ${result.detail}`);
process.exit(results.length > 0 && results.every((result) => result.ok) ? 0 : 1);
