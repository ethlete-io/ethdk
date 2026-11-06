#!/usr/bin/env node
import { execFileSync, fork } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStudio, ensureCli, withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;
const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : undefined;

const TIMINGS_FILE = join(root, 'node_modules/.cache/studio-e2e/canvas-timings.json');

const cliEntry = resolve(root, process.env['STUDIO_CLI_ENTRY'] ?? 'dist/libs/cli/src/index.js');

const GONE_TARGETS = { Merge: 'components/title-bar', Discard: 'components/tree-row' };

const WIDE_SKETCH = { part: 'components/title-bar', name: 'notice-hint', variants: ['a', 'b', 'c'] };

const EDITED_PART = 'components/disclosure';
const EDITED_PART_TIMEOUT_MS = 30000;

const PAGE_SWITCHES = [
  'foundations/icons',
  'foundations/logo',
  'foundations/icons',
  'foundations/logo',
  'foundations/icons',
  'elements/shell-main',
  'foundations/icons',
  'elements/shell-main',
];
const PAGE_SWITCH_TIMEOUT_MS = 15000;
const PAGE_SWITCH_SETTLE_MS = 1500;

const PAGES = [
  ...Object.entries(GONE_TARGETS).map(([name, target]) => ({
    name,
    view: { systemProduct: 'studio', systemEntry: `sketch:${target}` },
    shows: 'ethlete-sketch-view ethlete-sketches',
    hides: 'ethlete-system-view [data-sketch-missing]',
  })),
  {
    name: 'System',
    view: { systemProduct: 'studio', systemEntry: 'pages/system' },
    shows: 'ethlete-system-view ethlete-open-points-chip',
    hides: 'ethlete-sketch-view',
  },
  {
    name: 'Edited',
    view: { systemProduct: 'studio', systemEntry: EDITED_PART },
    shows: 'ethlete-system-view ethlete-open-points-chip',
    hides: 'ethlete-sketch-view',
  },
  {
    name: 'Sketches',
    view: { systemProduct: 'studio', systemEntry: 'sketch:pages/system' },
    shows: 'ethlete-sketch-view ethlete-sketches',
    fits: 'width',
  },
  {
    name: 'Sketches',
    label: 'Chip',
    view: { systemProduct: 'studio', systemEntry: 'sketch:components/zoom-chip' },
    shows: 'ethlete-sketch-view ethlete-sketches',
    fits: 'width',
  },
  {
    name: 'Sketches',
    label: 'Large',
    view: { systemProduct: 'studio', systemEntry: 'sketch:elements/shell-main' },
    shows: 'ethlete-sketch-view ethlete-sketches',
    fits: 'width',
  },
  {
    name: 'Wide',
    view: { systemProduct: 'studio', systemEntry: `sketch:${WIDE_SKETCH.part}@${WIDE_SKETCH.name}` },
    shows: 'ethlete-sketch-view ethlete-sketches',
  },
  {
    name: 'Inbox',
    view: { systemProduct: 'studio', systemEntry: 'pages/system', commentsOpen: true },
    shows: 'ethlete-inbox',
    hides: 'ethlete-sketch-view',
  },
  {
    name: 'Flow',
    view: { systemProduct: 'studio-lab', systemEntry: 'flow:sign-in' },
    frame: 'figure',
    shows: 'ethlete-flow-view',
  },
];

const NARROW = { width: 1440, height: 900 };
const WIDE = { width: 2000, height: 1100 };
const CHIP_INSET = 12;

const CANVAS = 'ethlete-design-canvas, ethlete-canvas-viewport';
const FRAME = 'ethlete-canvas-frame, [data-canvas-frame], [data-sk-frame]';
const ARROW_STEP = 80;
const SETTLE_MS = 600;
const EDGE_ROOM = 200;
const ARROWS_BY = {
  ArrowLeft: { x: ARROW_STEP, y: 0 },
  ArrowRight: { x: -ARROW_STEP, y: 0 },
  ArrowUp: { x: 0, y: ARROW_STEP },
  ArrowDown: { x: 0, y: -ARROW_STEP },
};
const PAN_EDGES = [
  { name: 'left', key: 'ArrowLeft', room: (content, view) => view.left + EDGE_ROOM - content.left },
  { name: 'top', key: 'ArrowUp', room: (content, view) => view.top + EDGE_ROOM - content.top },
  { name: 'right', key: 'ArrowRight', room: (content, view) => content.right - (view.right - EDGE_ROOM) },
  { name: 'bottom', key: 'ArrowDown', room: (content, view) => content.bottom - (view.bottom - EDGE_ROOM) },
];

const contentOf = (frames) =>
  frames.length
    ? {
        left: Math.min(...frames.map((frame) => frame.left)),
        top: Math.min(...frames.map((frame) => frame.top)),
        right: Math.max(...frames.map((frame) => frame.left + frame.width)),
        bottom: Math.max(...frames.map((frame) => frame.top + frame.height)),
      }
    : null;

const probe = (page) =>
  page.evaluate(
    ({ CANVAS, FRAME }) => {
      const canvas = [...document.querySelectorAll(CANVAS)]
        .map((element) => ({ element, box: element.getBoundingClientRect() }))
        .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0];

      if (!canvas) return null;

      const world = [...canvas.element.querySelectorAll('*')].find((element) =>
        element.style?.transform?.startsWith('translate('),
      );
      const match = /translate\(([-\d.e]+)px(?:, ([-\d.e]+)px)?\) scale\(([-\d.e]+)\)/.exec(
        world?.style.transform ?? '',
      );
      const covered =
        Number.parseFloat(getComputedStyle(canvas.element).getPropertyValue('--st-shell-inset-left')) || 0;
      const box = canvas.box;
      const view = { left: box.left + covered, top: box.top, right: box.right, bottom: box.bottom };
      const frames = [...canvas.element.querySelectorAll(FRAME)].map((frame, index) => {
        const rect = frame.getBoundingClientRect();

        return {
          index,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          selected: frame.hasAttribute('data-selected') || !!frame.querySelector('[data-selected]'),
        };
      });
      const inside = (x, y) => x > view.left + 4 && x < view.right - 4 && y > view.top + 4 && y < view.bottom - 4;
      const ownFrame = (element) => element?.closest(FRAME);
      const grid = [];

      for (let y = view.top + 8; y < view.bottom - 8; y += 12) {
        for (let x = view.left + 8; x < view.right - 8; x += 12) grid.push({ x, y });
      }

      const hit = (point) => document.elementFromPoint(point.x, point.y);
      const empty = grid.find((point) => {
        const element = hit(point);

        return (
          element &&
          canvas.element.contains(element) &&
          !ownFrame(element) &&
          !element.closest('button, a, input, select, [role="button"], ethlete-zoom-chip, ethlete-comment-pin')
        );
      });
      const framePoint = frames
        .map((frame) => {
          const element = [...canvas.element.querySelectorAll(FRAME)][frame.index];
          const point = grid.find(
            (candidate) =>
              candidate.x > frame.left + 4 &&
              candidate.x < frame.right - 4 &&
              candidate.y > frame.top + 4 &&
              candidate.y < frame.bottom - 4 &&
              inside(candidate.x, candidate.y) &&
              hit(candidate)?.localName !== 'iframe' &&
              ownFrame(hit(candidate)) === element &&
              !hit(candidate)?.closest('button, a, input, select, [role="button"], ethlete-comment-pin'),
          );

          return point ? { ...point, index: frame.index } : null;
        })
        .find(Boolean);

      return {
        camera: match ? { x: Number(match[1]), y: Number(match[2] ?? 0), zoom: Number(match[3]) } : null,
        view,
        frames,
        empty: empty ?? null,
        frame: framePoint ?? null,
        focused: canvas.element.contains(document.activeElement) || document.activeElement === canvas.element,
      };
    },
    { CANVAS, FRAME },
  );

const settle = (page) => page.waitForTimeout(SETTLE_MS);

const SCROLL_STEP_PX = 300;
const SCROLL_SAMPLES_MS = [30, 300];
const SKETCH_CSS = {
  current: 'elements/shell-main/shell-main.css',
  a: 'sketches/elements-shell-main/a/elements/shell-main/shell-main.css',
};

const drawnIn = async (iframe) => {
  const frame = await iframe.contentFrame();

  if (!frame) return false;

  return Promise.race([
    frame
      .evaluate(
        () =>
          document.readyState !== 'loading' &&
          [...(document.body?.children ?? [])].some(
            (child) => child.tagName !== 'SCRIPT' && child.getBoundingClientRect().height > 0,
          ),
      )
      .catch(() => false),
    new Promise((done) => setTimeout(() => done(false), 250)),
  ]);
};

const sketchCells = async (page) => {
  const cells = await page.evaluate(
    ({ CANVAS }) => {
      const shots = [...document.querySelectorAll('ethlete-sketch-view [data-shot]')];
      const view = shots[0]?.closest(CANVAS)?.getBoundingClientRect();
      const showing = (node) => {
        const style = node && getComputedStyle(node);

        return !!style && style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
      };

      return shots.map((cell, index) => {
        const box = cell.getBoundingClientRect();
        const img = cell.querySelector('img');
        const iframe = cell.querySelector('iframe');

        if (iframe) iframe.dataset['census'] = String(index);

        return {
          index,
          key: cell.dataset['shot'],
          top: box.top - view.top,
          below: box.bottom - view.bottom,
          visible:
            box.height > 0 &&
            box.bottom > view.top &&
            box.top < view.bottom &&
            box.right > view.left &&
            box.left < view.right,
          picture: !!img && img.complete && img.naturalWidth > 0 && showing(img),
          pictureSrc: img?.src ?? null,
          framed: !!iframe && showing(iframe),
        };
      });
    },
    { CANVAS },
  );

  for (const cell of cells) {
    const iframe = cell.visible && cell.framed && (await page.$(`iframe[data-census="${cell.index}"]`));

    cell.drawn = iframe ? await drawnIn(iframe) : false;
    cell.shows = cell.framed ? cell.drawn : cell.picture;
  }

  return cells;
};

const showAllStates = async (page) => {
  const button = page.getByRole('button', { name: 'Alle Zustände zeigen' });

  await button.waitFor({ timeout: EDITED_PART_TIMEOUT_MS }).catch(() => undefined);
  if (await button.count()) await button.first().click();
};

const wheelCanvas = async (page, deltaY) => {
  const box = await page.locator(`ethlete-sketch-view :is(${CANVAS})`).first().boundingBox();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, deltaY);
};

const ringOf = (page) =>
  page.evaluate(
    ({ CANVAS }) => {
      const canvas = [...document.querySelectorAll(CANVAS)].sort(
        (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
      )[0];
      const transparent = /^transparent$|\/\s*0(\.0+)?\s*\)$|,\s*0(\.0+)?\s*\)$/;
      const rings = [];

      for (let at = canvas; at && at !== document.body; at = at.parentElement) {
        const style = getComputedStyle(at);
        const visible =
          style.outlineStyle !== 'none' &&
          Number.parseFloat(style.outlineWidth) > 0 &&
          !transparent.test(style.outlineColor.trim());

        if (visible) rings.push(`${at.localName} ${style.outlineWidth} ${style.outlineColor}`);
      }

      return { focused: document.activeElement === canvas, rings };
    },
    { CANVAS },
  );

const noRingAfterPointer = async (page, point) => {
  await page.mouse.click(point.x, point.y);
  await settle(page);
  const clicked = await ringOf(page);
  await page.keyboard.press('Shift');
  await settle(page);
  const shifted = await ringOf(page);
  await page.keyboard.press('ArrowRight');
  await settle(page);
  const panned = await ringOf(page);
  const rings = [...clicked.rings, ...shifted.rings, ...panned.rings];

  return {
    ok: clicked.focused && rings.length === 0,
    detail: `focused=${clicked.focused} click=[${clicked.rings}] shift=[${shifted.rings}] arrow=[${panned.rings}]`,
  };
};

const drag = async (page, from, by, button = 'left') => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(from.x + (by.x * step) / 6, from.y + (by.y * step) / 6);
  }
  await page.mouse.up({ button });
  await settle(page);
};

const near = (a, b) => Math.abs(a - b) <= 1.5;

const moved = (before, after, by) =>
  !!before?.camera &&
  !!after?.camera &&
  near(after.camera.x - before.camera.x, by.x) &&
  near(after.camera.y - before.camera.y, by.y);

const describe = (before, after) =>
  before?.camera && after?.camera
    ? `camera ${before.camera.x.toFixed(1)},${before.camera.y.toFixed(1)}@${before.camera.zoom.toFixed(3)} -> ${after.camera.x.toFixed(1)},${after.camera.y.toFixed(1)}@${after.camera.zoom.toFixed(3)}`
    : 'no camera';

const frameBoxes = (page, selector) =>
  page.evaluate(
    ({ CANVAS, selector }) => {
      const canvas = [...document.querySelectorAll(CANVAS)].sort(
        (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
      )[0];

      return [...(canvas?.querySelectorAll(selector) ?? [])].map((frame) => {
        const { left, top, width, height } = frame.getBoundingClientRect();

        return { left, top, width, height, iframe: !!frame.querySelector('iframe') };
      });
    },
    { CANVAS, selector },
  );

const settled = async (page, selector) => {
  let last = '';
  let same = 0;

  for (let poll = 0; poll < 80 && same < 3; poll++) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(
      ({ CANVAS, selector }) =>
        document.querySelector('[data-sk-changed="pending"]')
          ? 'pending'
          : [...(document.querySelector(CANVAS)?.querySelectorAll(selector) ?? [])]
              .map((frame) => {
                const { left, top, width, height } = frame.getBoundingClientRect();

                return [left, top, width, height].map(Math.round).join();
              })
              .join(' '),
      { CANVAS, selector },
    );

    same = now !== 'pending' && now === last ? same + 1 : 0;
    last = now;
  }
};

const goneSketchLeavesToThePart = async (page, { designPort }, target, decide) => {
  const part = GONE_TARGETS[target.name];
  const ask = (path, body) =>
    fetch(`http://[::1]:${designPort}/__design/${path}?product=studio&sketch=${encodeURIComponent(part)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  const overlays = () =>
    Promise.all(page.frames().map((frame) => frame.locator('vite-error-overlay').count())).then((counts) =>
      counts.reduce((sum, count) => sum + count, 0),
    );

  const answer = await decide(ask);

  if (!answer.ok) return { ok: false, detail: `the design server refused: ${answer.status} ${await answer.text()}` };

  try {
    await page.waitForFunction(() => !document.querySelector('ethlete-sketch-view'), undefined, { timeout: 30000 });
  } catch {
    return { ok: false, detail: 'the sketch view stays open after the sketch dropped from the listing' };
  }

  await page.waitForTimeout(3000);

  const shown = await page.evaluate((part) => {
    const frames = [...document.querySelectorAll('iframe')].map((frame) => new URL(frame.src, location.href));

    return {
      partFrames: frames.filter((url) => url.searchParams.get('part') === part && !url.searchParams.has('sketch'))
        .length,
      sketchFrames: frames.filter((url) => url.searchParams.has('sketch')).length,
      missing: !!document.querySelector('[data-sketch-missing]'),
      blank: !document.querySelector('ethlete-system-view'),
    };
  }, part);
  const overlayCount = await overlays();

  return {
    ok: shown.partFrames > 0 && !shown.sketchFrames && !shown.missing && !shown.blank && overlayCount === 0,
    detail: `frames of ${part}: ${shown.partFrames}, frames of the gone sketch: ${shown.sketchFrames}, not-found note: ${shown.missing}, blank: ${shown.blank}, error overlays: ${overlayCount}`,
  };
};

const CASES = [
  {
    name: 'a sketch merged while its view is open opens the part view of the target',
    pages: ['Merge'],
    run: (page, _state, target, context) =>
      goneSketchLeavesToThePart(page, context, target, async (ask) => {
        execFileSync(
          process.execPath,
          [cliEntry, 'design', 'sketch', 'rebase', GONE_TARGETS.Merge, '--product', 'studio', '--by', 'canvas-e2e'],
          { cwd: checkout, stdio: 'pipe' },
        );

        const picked = await ask('sketch-decision', { kind: 'pick', variant: 'a' });

        return picked.ok ? ask('sketch-merge', {}) : picked;
      }),
  },
  {
    name: 'a sketch discarded while its view is open opens the part view of the target',
    pages: ['Discard'],
    run: (page, _state, target, context) =>
      goneSketchLeavesToThePart(page, context, target, async () => {
        await page.locator('ethlete-sketches button', { hasText: 'Verwerfen' }).first().click();

        return { ok: true };
      }),
  },
  {
    name: 'wheel and ctrl-wheel over a frame centre move the camera',
    pages: ['System', 'Sketches', 'Inbox', 'Flow'],
    run: async (page, state, target) => {
      const selector = target.frame ?? FRAME;
      const { view } = state;
      const boxes = await frameBoxes(page, selector);
      const centreOf = (box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
      const seen = (box) => {
        const { x, y } = centreOf(box);

        return box.width > 8 && x > view.left + 4 && x < view.right - 4 && y > view.top + 4 && y < view.bottom - 4;
      };
      const index = [boxes.findIndex((box) => box.iframe && seen(box)), boxes.findIndex(seen)].find((at) => at >= 0);

      if (index === undefined) return { ok: false, detail: 'no frame centre in view' };
      if (target.name === 'Sketches' && !boxes[index].iframe) return { ok: false, detail: 'no iframe frame' };

      const before = boxes[index];
      const towardsMiddle = centreOf(before).y < (view.top + view.bottom) / 2 ? -120 : 120;
      await page.mouse.move(centreOf(before).x, centreOf(before).y);
      await page.mouse.wheel(0, towardsMiddle);
      await settle(page);
      const panned = (await frameBoxes(page, selector))[index];

      if (!seen(panned)) return { ok: false, detail: `the pan moved the frame centre out of view, top ${panned.top}` };
      await page.mouse.move(centreOf(panned).x, centreOf(panned).y);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -240);
      await page.keyboard.up('Control');
      await settle(page);
      const zoomed = (await frameBoxes(page, selector))[index];
      const pans = Math.abs(panned.top - before.top) > 20 || Math.abs(panned.left - before.left) > 20;
      const zooms = zoomed.width > panned.width * 1.05;

      return {
        ok: pans && zooms,
        detail: `iframe=${before.iframe} top ${before.top.toFixed(0)} -> ${panned.top.toFixed(0)} width ${panned.width.toFixed(0)} -> ${zoomed.width.toFixed(0)}`,
      };
    },
  },
  {
    name: 'wheel over an iframe pans when iframes take pointer events, as in WKWebView',
    pages: ['System', 'Sketches', 'Flow'],
    run: async (page, state) => {
      const { view } = state;
      const point = await page.evaluate(
        ({ CANVAS, view }) => {
          const canvas = document.querySelector(CANVAS);

          for (const iframe of canvas?.querySelectorAll('iframe') ?? []) {
            if (iframe.closest('[data-active]')) continue;

            const box = iframe.getBoundingClientRect();
            const x = Math.max(box.left, view.left) / 2 + Math.min(box.right, view.right) / 2;
            const y = Math.max(box.top, view.top) / 2 + Math.min(box.bottom, view.bottom) / 2;

            if (box.width > 8 && x > view.left + 4 && x < view.right - 4 && y > view.top + 4 && y < view.bottom - 4)
              return { x, y };
          }

          return null;
        },
        { CANVAS, view },
      );

      if (!point) return { ok: false, detail: 'no iframe in view' };

      const style = await page.addStyleTag({ content: 'iframe { pointer-events: auto !important; }' });

      try {
        const before = (await probe(page)).camera;
        await page.mouse.move(point.x, point.y);
        await page.mouse.wheel(0, point.y < (view.top + view.bottom) / 2 ? -120 : 120);
        await settle(page);
        const after = (await probe(page)).camera;
        const moved = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);

        return { ok: moved > 20, detail: `camera moved ${moved.toFixed(0)}px with the pointer over an iframe` };
      } finally {
        await style.evaluate((element) => element.remove());
      }
    },
  },
  {
    name: 'ctrl-wheel keeps the world point under the pointer',
    pages: ['System', 'Sketches', 'Inbox', 'Flow'],
    run: async (page, state, target) => {
      const selector = target.frame ?? FRAME;
      const { view } = state;
      const boxes = await frameBoxes(page, selector);
      const index = boxes.findIndex(
        (box) =>
          box.width > 16 &&
          box.left + box.width / 2 > view.left + 40 &&
          box.left + box.width / 2 < view.right - 40 &&
          box.top + box.height / 2 > view.top + 40 &&
          box.top + box.height / 2 < view.bottom - 40,
      );

      if (index < 0) return { ok: false, detail: 'no frame centre in view' };

      const start = boxes[index];
      const pointer = { x: start.left + start.width * 0.3, y: start.top + start.height * 0.4 };
      const drifts = [];
      let before = start;

      await page.mouse.move(pointer.x, pointer.y);

      for (const delta of [-240, 240, 240]) {
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, delta);
        await page.keyboard.up('Control');
        await settle(page);

        const after = (await frameBoxes(page, selector))[index];
        const fx = (pointer.x - before.left) / before.width;
        const fy = (pointer.y - before.top) / before.height;

        drifts.push(Math.hypot(after.left + fx * after.width - pointer.x, after.top + fy * after.height - pointer.y));
        before = after;
      }

      return {
        ok: drifts.every((drift) => drift <= 2) && before.width < start.width,
        detail: `drift ${drifts.map((drift) => drift.toFixed(1)).join(' / ')} px, width ${start.width.toFixed(0)} -> ${before.width.toFixed(0)}`,
      };
    },
  },
  {
    name: 'no text leaves its box at min zoom, Fit, 100 % and max zoom',
    pages: ['System', 'Sketches', 'Inbox', 'Flow'],
    run: async (page, state) => {
      const { view } = state;
      const centre = { x: (view.left + view.right) / 2, y: (view.top + view.bottom) / 2 };
      const wheelZoom = async (delta) => {
        await page.mouse.move(centre.x, centre.y);
        await page.keyboard.down('Control');
        for (let step = 0; step < 30; step++) await page.mouse.wheel(0, delta);
        await page.keyboard.up('Control');
        await settle(page);
      };
      const shortcut = async (key) => {
        await page.mouse.click(centre.x, centre.y);
        await page.keyboard.press(key);
        await settle(page);
      };
      const zooms = [
        ['min', () => wheelZoom(100)],
        ['Fit', () => shortcut('Shift+Digit1')],
        ['100 %', () => shortcut('Shift+Digit0')],
        ['max', () => wheelZoom(-100)],
      ];
      const faults = [];

      for (const [label, zoom] of zooms) {
        await zoom();
        faults.push(
          ...(await page.evaluate(
            ({ CANVAS, label }) => {
              const canvas = [...document.querySelectorAll(CANVAS)].sort(
                (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
              )[0];
              const found = [];

              if (!canvas) return [`${label}: no canvas`];

              const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT);

              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const box = node.parentElement?.getBoundingClientRect();

                if (!node.textContent.trim() || !box || box.width === 0) continue;

                const range = document.createRange();
                range.selectNodeContents(node);

                const text = range.getBoundingClientRect();

                if (
                  text.width > 0 &&
                  (text.left < box.left - 1 ||
                    text.right > box.right + 1 ||
                    text.top < box.top - 1 ||
                    text.bottom > box.bottom + 1)
                )
                  found.push(`${label}: "${node.textContent.trim().slice(0, 30)}" leaves its box`);
              }

              for (const row of canvas.querySelectorAll('[data-sk-row]')) {
                const [head, stage] = row.children;

                if (head && stage && head.getBoundingClientRect().right > stage.getBoundingClientRect().left + 0.5)
                  found.push(`${label}: head overlaps the frames in row ${row.getAttribute('data-sk-row')}`);
              }

              return found;
            },
            { CANVAS, label },
          )),
        );
      }

      return { ok: faults.length === 0, detail: faults.slice(0, 4).join('; ') || '4 zooms' };
    },
  },
  {
    name: 'Fit is stable, + steps from it, 25 % report',
    pages: ['Sketches'],
    run: async (page, state) => {
      const { view } = state;

      await page.waitForFunction(() => !document.querySelector('[data-sk-changed="pending"]'), null, {
        timeout: 60000,
      });
      await page.mouse.click((view.left + view.right) / 2, (view.top + view.bottom) / 2);
      await page.keyboard.press('Shift+Digit1');
      await settle(page);

      const shown = () =>
        page.evaluate(() => {
          const match = /(\d+)\s*%/.exec(
            document.querySelector('ethlete-sketches ethlete-zoom-chip')?.textContent ?? '',
          );

          return match ? Number(match[1]) : null;
        });
      const percent = await shown();

      if (percent === null) return { ok: false, detail: 'no zoom chip percent' };

      await page.reload();
      await page.waitForSelector('[data-sk-state]', { timeout: 30000 });
      await settled(page, FRAME);
      await page.getByRole('button', { name: 'Einpassen' }).first().click();
      await settle(page);
      const again = await shown();

      await page.getByRole('button', { name: 'Vergrößern' }).first().click();
      await settle(page);
      const stepped = await shown();
      const faults = [
        ...(again !== null && Math.abs(again - percent) <= 1
          ? []
          : [`Fit ${percent} % then ${again} % after a reload`]),
        ...(stepped !== null && Math.abs(stepped - Math.round(again * 1.5)) <= 1
          ? []
          : [`+ from Fit ${again} % shows ${stepped} %, expected ${Math.round(again * 1.5)} %`]),
      ];
      const report = percent >= 25 ? `Fit ${percent} %` : `too large for Fit: ${percent} %`;

      return { ok: faults.length === 0, detail: [report, ...faults].join('; ') };
    },
  },
  {
    name: 'no state is marked before the compare answers',
    pages: ['Sketches'],
    labels: ['Chip'],
    run: async (page, _state, target) => {
      const sketch = target.view.systemEntry.slice('sketch:'.length);
      const listing = `http://localhost:${process.env['DE_PORT']}/__design/sketches?product=${target.view.systemProduct}`;
      const entryOf = (answer) => answer?.sketches?.find((candidate) => candidate.target === sketch);
      const listedTargetOf = (entry, variant) =>
        entry?.targets?.find(
          (candidate) => candidate.variant === variant && (candidate.part ?? entry.target) === entry.target,
        );
      const cells = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[data-sk-variant][data-sk-changed]')]
            .filter((cell) => cell.getAttribute('data-sk-variant') !== 'current')
            .map((cell) => ({
              variant: cell.getAttribute('data-sk-variant'),
              state: cell.getAttribute('data-sk-state'),
              changed: cell.getAttribute('data-sk-changed'),
            })),
        );

      const primed = entryOf(await (await page.request.get(listing)).json());
      let release;
      const held = new Promise((resolve) => (release = resolve));
      let answered;
      const fullAnswered = new Promise((resolve) => (answered = resolve));
      let listed;

      await page.route('**/__design/sketches?*', async (route) => {
        if (route.request().url().includes('unchanged=no')) return route.continue();

        await held;
        const response = await route.fetch();

        listed = await response.json();
        await route.fulfill({ response, json: listed });
        answered();
      });
      const quickAnswered = page.waitForResponse(
        (response) => /unchanged=no$/.test(response.url()) && response.url().includes('/__design/sketches?'),
        { timeout: 30000 },
      );

      await page.reload();
      await page.waitForSelector('[data-sk-state]', { timeout: 30000 });
      await quickAnswered;
      await settle(page);

      const early = await cells();
      const first = await page.evaluate(() => document.querySelectorAll('[data-sk-first-change]').length);
      const kept = early.filter(({ changed }) => changed !== 'pending');
      const fresh = kept.filter(
        ({ variant, state, changed }) =>
          changed !== String(!(listedTargetOf(primed, variant)?.unchanged ?? []).includes(state)),
      );

      release();
      await fullAnswered;
      await page.waitForFunction(() => !document.querySelector('[data-sk-changed="pending"]'), null, {
        timeout: 60000,
      });
      await page.unroute('**/__design/sketches?*');

      const entry = entryOf(listed);
      const marks = await cells();
      const wrong = marks.filter(({ variant, state, changed }) => {
        const listedTarget = listedTargetOf(entry, variant);

        if (!listedTarget) return false;

        return changed !== String(!(listedTarget.unchanged ?? []).includes(state));
      });
      const faults = [
        ...(primed?.targets?.some((candidate) => candidate.unchanged?.length)
          ? []
          : [`the earlier full listing of ${sketch} kept no unchanged state`]),
        ...fresh
          .slice(0, 3)
          .map(({ variant, state, changed }) => `${variant}/${state} marked ${changed} before the compare`),
        ...(first && !kept.some(({ changed }) => changed === 'true') ? ['"erste Änderung" before any kept mark'] : []),
        ...(entry ? [] : [`no listed sketch ${sketch}`]),
        ...wrong.slice(0, 3).map(({ variant, state, changed }) => `${variant}/${state} shows ${changed}`),
      ];

      return {
        ok: faults.length === 0,
        detail: faults.join('; ') || `${kept.length} kept marks before the compare, ${marks.length} marks match it`,
      };
    },
  },
  {
    name: 'frames of one grid row share their top edge',
    pages: ['Sketches'],
    run: async (page) => {
      const spread = await page.evaluate(() => {
        let worst = 0;

        for (const stage of document.querySelectorAll('[data-sk-stage]')) {
          const rows = new Map();

          for (const cell of stage.querySelectorAll('[data-sk-state]')) {
            const frame = cell.querySelector('[data-sk-frame]');
            const line = Math.round(cell.getBoundingClientRect().top);

            if (frame) rows.set(line, [...(rows.get(line) ?? []), frame.getBoundingClientRect().top]);
          }

          for (const tops of rows.values()) worst = Math.max(worst, Math.max(...tops) - Math.min(...tops));
        }

        return worst;
      });

      return { ok: spread <= 1, detail: `widest top spread ${spread.toFixed(1)} px` };
    },
  },
  {
    name: 'a frame renders real content, not an error page',
    pages: ['System', 'Sketches'],
    run: async (page) => {
      const deadline = Date.now() + 15000;
      let texts = [];

      while (Date.now() < deadline) {
        texts = [];

        for (const frame of page.frames().filter((candidate) => candidate !== page.mainFrame())) {
          texts.push(await frame.evaluate(() => document.body?.innerText.trim() ?? '').catch(() => ''));
        }

        if (texts.some((text) => text && !/403|restricted|forbidden|cannot (get|find)|error/i.test(text))) {
          return { ok: true, detail: `${texts.length} frames` };
        }

        await page.waitForTimeout(500);
      }

      return { ok: false, detail: `no frame shows content: ${JSON.stringify(texts.map((text) => text.slice(0, 60)))}` };
    },
  },
  {
    name: 'zoom chip sits at the canvas bottom right',
    pages: ['System', 'Sketches', 'Inbox'],
    viewport: WIDE,
    run: async (page) => {
      const placed = await page.evaluate(
        ({ CANVAS }) =>
          [...document.querySelectorAll('ethlete-zoom-chip')]
            .map((chip) => ({ chip, box: chip.getBoundingClientRect() }))
            .filter(({ box }) => box.width > 0)
            .map(({ chip, box }) => {
              const area = (chip.closest(CANVAS) ?? chip.offsetParent).getBoundingClientRect();

              return { right: area.right - box.right, bottom: area.bottom - box.bottom, left: box.left };
            }),
        { CANVAS },
      );
      const ok =
        placed.length > 0 &&
        placed.every((gap) => Math.abs(gap.right - CHIP_INSET) <= 2 && Math.abs(gap.bottom - CHIP_INSET) <= 2);

      return { ok, detail: JSON.stringify(placed) };
    },
  },
  {
    name: 'open points chip pressed matches its popup',
    pages: ['System'],
    viewport: WIDE,
    run: async (page) => {
      const chip = page.locator('[data-open-points-chip]').first();
      const steps = [];

      for (let click = 1; click <= 4; click++) {
        await chip.click();
        await page.waitForTimeout(SETTLE_MS);
        steps.push(
          await page.evaluate(() => ({
            pressed: document.querySelector('[data-open-points-chip]')?.getAttribute('aria-pressed') === 'true',
            open: !!document.querySelector('[role="dialog"][aria-label="Offene Punkte"]'),
          })),
        );
      }

      const ok = steps.every((step, index) => step.pressed === step.open && step.open === (index % 2 === 0));

      return { ok, detail: steps.map((step) => `${+step.pressed}/${+step.open}`).join(' ') };
    },
  },
  {
    name: 'a part switch asks for its open points once',
    pages: ['System'],
    run: async (page) => {
      const asked = [];
      const count = (request) => {
        if (request.url().includes('/__design/open-points?'))
          asked.push(new URL(request.url()).searchParams.get('part'));
      };
      const leaves = page.locator('[role="treeitem"][data-kind="leaf"]:not([data-selected])');

      if ((await leaves.count()) < 1) return { ok: false, detail: 'no other part in the tree' };

      page.on('request', count);

      const counts = [];

      for (let step = 0; step < 2; step++) {
        asked.length = 0;
        await leaves.nth(step).click();
        await page.waitForTimeout(2500);
        counts.push([...asked]);
      }

      page.off('request', count);

      const ok = counts.every((parts) => parts.length === 1);

      return { ok, detail: counts.map((parts) => `${parts.length} (${parts.join(', ')})`).join(' / ') };
    },
  },
  {
    name: 'a part shown before paints every stored picture in the first frame',
    pages: ['System'],
    run: async (page) => {
      const leafTexts = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[role="treeitem"][data-kind="leaf"]')].map((leaf) => leaf.textContent.trim()),
        );
      const open = async (text) => {
        const at = (await leafTexts()).indexOf(text);

        if (at < 0) throw new Error(`no part ${text} in the tree`);
        await page.locator('[role="treeitem"][data-kind="leaf"]').nth(at).click();
      };
      const pictures = () =>
        page.evaluate(
          ({ CANVAS }) =>
            [
              ...(document
                .querySelector(CANVAS)
                ?.querySelectorAll('ethlete-canvas-frame img[src*="/__design/shot?"]') ?? []),
            ].map((img) => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 })),
          { CANVAS },
        );
      const loadAll = async () => {
        for (let poll = 0; poll < 120; poll++) {
          await page.waitForTimeout(250);
          const shown = await pictures();

          if (shown.length > 0 && shown.every((picture) => picture.loaded)) return shown;
        }

        return pictures();
      };
      const firstPaint = (text) =>
        page.evaluate(
          ({ CANVAS, text }) =>
            new Promise((done) => {
              const leaves = [...document.querySelectorAll('[role="treeitem"][data-kind="leaf"]')];
              const started = performance.now();
              let frames = 0;
              const sample = () => {
                frames++;
                const shown = [
                  ...(document
                    .querySelector(CANVAS)
                    ?.querySelectorAll('ethlete-canvas-frame img[src*="/__design/shot?"]') ?? []),
                ].map((img) => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 }));

                if (shown.length > 0 || frames > 30) done({ frames, ms: performance.now() - started, shown });
                else requestAnimationFrame(sample);
              };

              leaves.find((leaf) => leaf.textContent.trim() === text)?.click();
              requestAnimationFrame(sample);
            }),
          { CANVAS, text },
        );
      const unranked = (src) => src.replace(/&(view|rank)=[^&]*/gu, '');
      const texts = (await leafTexts()).filter((text) => text);

      if (texts.length < 2) return { ok: false, detail: 'fewer than two parts in the tree' };

      const [first, second] = texts;

      await open(first);
      const seen = new Set((await loadAll()).filter((picture) => picture.loaded).map(({ src }) => unranked(src)));

      await open(second);
      await loadAll();

      const back = await firstPaint(first);
      const stored = back.shown.filter(({ src }) => seen.has(unranked(src)));
      const empty = stored.filter((picture) => !picture.loaded);

      return {
        ok: seen.size > 0 && stored.length > 0 && empty.length === 0,
        detail: `${first} <- ${second}: ${stored.length - empty.length}/${stored.length} stored pictures painted in rAF ${back.frames} (+${Math.round(back.ms)} ms), ${seen.size} seen`,
      };
    },
  },
  {
    name: 'a part edited on disk while away shows its new picture on return',
    pages: ['Edited'],
    run: async (page) => {
      const rows = page.locator('[role="treeitem"]');
      const pictures = () =>
        page.evaluate(
          ({ CANVAS }) =>
            [
              ...(document
                .querySelector(CANVAS)
                ?.querySelectorAll('ethlete-canvas-frame img[src*="/__design/shot?"]') ?? []),
            ].map((img) => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 })),
          { CANVAS },
        );
      const loaded = async (accept) => {
        for (const until = Date.now() + EDITED_PART_TIMEOUT_MS; Date.now() < until;) {
          await page.waitForTimeout(250);
          const shown = await pictures();

          if (shown.length > 0 && shown.every((picture) => picture.loaded) && accept(shown)) return shown;
        }

        return null;
      };
      const tagsOf = (shown) =>
        Promise.all(shown.map(({ src }) => page.request.get(src).then((answer) => answer.headers()['etag'])));
      const leaves = await rows.evaluateAll((all) =>
        all.flatMap((row) => (row.dataset.kind === 'leaf' ? [row.textContent.trim()] : [])),
      );
      const home = EDITED_PART.split('/')[1];
      const away = leaves.find((text) => text !== home);

      if (!leaves.includes(home) || !away) return { ok: false, detail: `no ${home} leaf or no other leaf` };

      const rowOf = (text) => rows.filter({ hasText: new RegExp(`^\\s*${text}\\s*$`, 'u') }).first();

      const before = await loaded(() => true);

      if (!before) return { ok: false, detail: `${EDITED_PART} shows no loaded picture` };

      const tags = new Set(await tagsOf(before));
      const stylesheet = join(checkout, '.ethlete/design/studio', EDITED_PART, 'disclosure.css');
      const original = readFileSync(stylesheet, 'utf8');

      await rowOf(away).click();
      await loaded(() => true);

      try {
        writeFileSync(
          stylesheet,
          `${original}\n.st-disclosure { background: rgb(255 0 0); outline: 6px solid rgb(0 128 255); }\n`,
        );
        await page.waitForTimeout(PAGE_SWITCH_SETTLE_MS);
        await rowOf(home).click();

        const seen = new Set(before.map(({ src }) => src));
        const after = await loaded((shown) => shown.some(({ src }) => !seen.has(src)));
        const changed = after && (await tagsOf(after)).filter((tag) => !tags.has(tag));

        return {
          ok: !!changed && changed.length > 0,
          detail: after
            ? `${changed.length}/${after.length} pictures changed after the edit`
            : `no new picture URL within ${EDITED_PART_TIMEOUT_MS} ms (${before.length} pictures)`,
        };
      } finally {
        writeFileSync(stylesheet, original);
      }
    },
  },
  {
    name: 'a sketch scroll never empties a cell that had a picture',
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const had = new Set();
      const loadedPictures = new Set();
      const note = (cells) =>
        cells.forEach((cell) => {
          if ((cell.visible && cell.shows) || cell.picture) had.add(cell.key);
          if (cell.picture) loadedPictures.add(cell.pictureSrc);
        });
      const steps = [];
      const empties = [];

      await showAllStates(page);

      let first = await sketchCells(page);

      for (const until = Date.now() + EDITED_PART_TIMEOUT_MS; Date.now() < until; first = await sketchCells(page)) {
        const visible = first.filter((cell) => cell.visible);

        if (visible.length > 0 && visible.every((cell) => cell.shows)) break;
        await page.waitForTimeout(250);
      }
      const scrollSteps = Math.ceil(Math.max(...first.map((cell) => cell.below)) / SCROLL_STEP_PX);

      note(first);
      if (had.size === 0) {
        return {
          ok: false,
          detail: `no visible cell shows a picture or a drawn frame: ${first
            .filter((cell) => cell.visible)
            .map(
              (cell) =>
                `${cell.key} ${cell.framed ? 'iframe' : '-'}/${cell.drawn ? 'drawn' : '-'}/${cell.pictureSrc ? (cell.picture ? 'picture' : 'pending') : '-'}`,
            )
            .join(
              ', ',
            )} of ${first.length} cells; ${await page.evaluate(() => (document.querySelector('ethlete-sketch-view')?.textContent ?? 'no sketch view').replace(/\s+/gu, ' ').slice(0, 300))}`,
        };
      }
      if (scrollSteps < 3)
        return { ok: false, detail: `the sketch is ${scrollSteps} scroll steps tall, not 3 or more` };

      for (const [name, by] of [
        ['down', SCROLL_STEP_PX],
        ['up', -SCROLL_STEP_PX],
      ]) {
        for (let step = 1; step <= scrollSteps; step++) {
          let waited = 0;
          const counts = [];

          await wheelCanvas(page, by);
          for (const at of SCROLL_SAMPLES_MS) {
            await page.waitForTimeout(at - waited);
            waited = at;

            const cells = await sketchCells(page);
            const visible = cells.filter((cell) => cell.visible);
            const empty = visible.filter(
              (cell) => !cell.shows && (had.has(cell.key) || loadedPictures.has(cell.pictureSrc)),
            );

            counts.push(`${empty.length}/${visible.length}`);
            empties.push(
              ...empty.map((cell) => `${name}${step}+${at} ${cell.key}${cell.framed ? ' (blank iframe)' : ''}`),
            );
            note(cells);
          }
          steps.push(`${name}${step} ${counts.join(' ')}`);
        }
      }

      return {
        ok: empties.length === 0,
        detail: `empty/visible cells per step at +${SCROLL_SAMPLES_MS.join(' +')} ms: ${steps.join(', ')}${empties.length ? `; first: ${empties.slice(0, 6).join(' | ')}` : ''}`,
      };
    },
  },
  {
    name: 'a sketch cell edited on disk while scrolled away shows its new picture on return',
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const cellOf = async (key) => (await sketchCells(page)).find((cell) => cell.key === key);
      const away = Math.ceil((2 * (NARROW.height + 400)) / SCROLL_STEP_PX);
      const loadedCell = async (key, accept) => {
        for (const until = Date.now() + EDITED_PART_TIMEOUT_MS; Date.now() < until;) {
          const cell = await cellOf(key);

          if (
            cell?.pictureSrc &&
            (await page.evaluate(
              (src) => [...document.images].some((img) => img.src === src && img.complete && img.naturalWidth > 0),
              cell.pictureSrc,
            )) &&
            accept(cell)
          )
            return cell;
          await page.waitForTimeout(250);
        }

        return null;
      };
      const tagOf = async (src) => (await page.request.get(src)).headers()['etag'];

      await showAllStates(page);
      await page.waitForTimeout(PAGE_SWITCH_SETTLE_MS);
      const top = (await sketchCells(page)).filter((cell) => cell.visible).sort((a, b) => a.top - b.top)[0];

      if (!top) return { ok: false, detail: 'no visible sketch cell' };

      const before = await loadedCell(top.key, () => true);

      if (!before) return { ok: false, detail: `${top.key} loads no picture` };

      const tag = await tagOf(before.pictureSrc);
      const stylesheet = join(checkout, '.ethlete/design/studio', SKETCH_CSS[top.key.split(' ')[0]]);
      const original = readFileSync(stylesheet, 'utf8');

      for (let step = 0; step < away; step++) {
        await wheelCanvas(page, SCROLL_STEP_PX);
        await page.waitForTimeout(100);
      }

      const gone = await cellOf(top.key);

      if (gone?.visible) return { ok: false, detail: `${top.key} still visible after ${away} steps` };

      try {
        writeFileSync(
          stylesheet,
          `${original}\n.st-shell { outline: 12px solid rgb(255 0 0); outline-offset: -12px; }\n`,
        );
        await page.waitForTimeout(PAGE_SWITCH_SETTLE_MS);
        for (let step = 0; step < away; step++) {
          await wheelCanvas(page, -SCROLL_STEP_PX);
          await page.waitForTimeout(100);
        }

        const after = await loadedCell(top.key, (cell) => cell.pictureSrc !== before.pictureSrc);
        const newTag = after && (await tagOf(after.pictureSrc));

        return {
          ok: !!after && newTag !== tag,
          detail: after
            ? `${top.key}: new picture URL, ETag ${newTag === tag ? 'unchanged' : 'changed'}`
            : `${top.key} kept its old picture URL for ${EDITED_PART_TIMEOUT_MS} ms after the edit`,
        };
      } finally {
        writeFileSync(stylesheet, original);
      }
    },
  },
  {
    name: 'page switch time is logged to the design timings',
    pages: ['System'],
    run: async (page) => {
      const { recordPageSwitch, timingsFileOf } = createRequire(import.meta.url)(
        resolve(dirname(cliEntry), 'lib/design/timings.js'),
      );
      const shots = [];
      const onShot = async (request) => {
        if (!request.url().includes('/__design/shot?')) return;
        const finishedAt = Date.now();
        const response = await request.response();

        shots.push({
          url: request.url(),
          finishedAt,
          timing: request.timing(),
          source: response?.headers()['x-design-shot'] ?? `status ${response?.status() ?? '-'}`,
        });
      };
      const switchTo = (part) =>
        page.evaluate(
          ({ part, timeoutMs }) =>
            new Promise((done) => {
              const named = [
                ...document.querySelectorAll(
                  '[role="treeitem"][data-kind="part"], [role="treeitem"][data-kind="leaf"]',
                ),
              ].filter((candidate) => candidate.textContent.trim() === part.split('/')[1]);
              const leaf = named.find((candidate) => candidate.dataset.kind === 'part') ?? named[0];

              if (!leaf) return done({ error: `no part ${part} in the tree` });

              const marker = `part=${encodeURIComponent(part)}&`;
              const before = new Set(document.querySelectorAll('ethlete-canvas-frame'));
              const shotsOf = (frame) => [...frame.querySelectorAll('img[src*="/__design/shot?"]')];
              const isPainted = (frame) =>
                !!frame.querySelector('iframe:not(.opacity-0)') ||
                shotsOf(frame).some((img) => img.complete && img.naturalWidth > 0 && !img.matches('.opacity-0'));
              const started = performance.now();
              const times = {};
              const sample = () => {
                const now = performance.now() - started;
                const frames = [...document.querySelectorAll('ethlete-canvas-frame')].filter(
                  (frame) =>
                    !before.has(frame) || shotsOf(frame).some((img) => img.getAttribute('src').includes(marker)),
                );
                const painted = frames.filter(isPainted);

                if (frames.length > 0) times.mounted ??= now;
                if (painted.length > 0) times.first ??= now;
                if (frames.length > 0 && painted.length === frames.length) {
                  done({ ...times, all: now, frames: frames.length, clickedAt: performance.timeOrigin + started });
                } else if (now > timeoutMs) {
                  const marked = [...document.querySelectorAll('img, iframe')].filter((node) =>
                    (node.getAttribute('src') ?? '').includes(marker),
                  );
                  const chain = [];

                  for (let node = marked[0]?.parentElement; node; node = node.parentElement) {
                    if (node.localName.startsWith('ethlete-')) chain.push(node.localName);
                  }

                  done({
                    ...times,
                    dom: `${marked.length} marked img/iframe, ${document.querySelectorAll('ethlete-canvas-frame').length} canvas frames, first in ${chain.slice(0, 6).join('<')}; shots ${[...document.querySelectorAll('img[src*="/__design/shot?"]')].map((img) => new URL(img.src).searchParams.get('part')).slice(0, 3)}; ${[...document.querySelectorAll('[role="treeitem"]')].filter((row) => row.textContent.trim() === part.split('/')[1]).map((row) => `leaf ${row.dataset.kind}${row.hasAttribute('data-selected') ? ' selected' : ''}`)}; views ${[...new Set([...document.querySelectorAll('[class*="view"], ethlete-system-view *')].map((node) => node.localName).filter((tag) => tag.startsWith('ethlete-')))].slice(0, 25)}`,
                    frames: frames.length,
                    painted: painted.length,
                    clickedAt: performance.timeOrigin + started,
                  });
                } else requestAnimationFrame(sample);
              };

              leaf.click();
              requestAnimationFrame(sample);
            }),
          { part, timeoutMs: PAGE_SWITCH_TIMEOUT_MS },
        );
      const rows = [];
      const seen = new Set(['pages/system']);
      let from = 'pages/system';

      page.on('requestfinished', onShot);

      try {
        for (const to of PAGE_SWITCHES) {
          const firstShot = shots.length;
          const result = await switchTo(to);

          if (result.error) return { ok: false, detail: result.error };
          await page.waitForTimeout(PAGE_SWITCH_SETTLE_MS);

          const marker = `part=${encodeURIComponent(to)}&`;
          const asked = shots
            .slice(firstShot)
            .filter((shot) => shot.url.includes(marker))
            .map(({ finishedAt, timing, source }) => ({
              ms: Math.round(finishedAt - result.clickedAt),
              wait: Math.round(timing.responseStart - timing.requestStart),
              source,
            }));
          const painted = result.all !== undefined;
          const ms = result.all ?? PAGE_SWITCH_TIMEOUT_MS;
          const mounted = result.mounted ?? ms;

          rows.push({
            from,
            to,
            seen: seen.has(to),
            painted,
            ms,
            mounted,
            first: result.first,
            frames: result.frames,
            paintedFrames: result.painted,
            dom: result.dom,
            asked,
          });
          await recordPageSwitch({
            file: timingsFileOf(root),
            from,
            to,
            seen: seen.has(to),
            ms,
            painted,
            start: new Date(result.clickedAt),
            phases: [
              { name: 'frame-mount', ms: Math.round(mounted), at: 0 },
              { name: 'picture-wait', ms: Math.round(ms - mounted), at: Math.round(mounted) },
            ],
          });
          seen.add(to);
          from = to;
        }
      } finally {
        page.off('requestfinished', onShot);
      }

      const round = (ms) => (ms === undefined ? '-' : Math.round(ms));
      const detail = rows
        .map(
          (row) =>
            `${row.from.split('/')[1]}->${row.to.split('/')[1]} ${row.seen ? 'seen' : 'first'}: mount ${round(row.mounted)}, first ${round(row.first)}, all ${row.painted ? round(row.ms) : `NOT (${row.paintedFrames} painted; ${row.dom})`} ms (${row.frames} frames; ${row.asked.length} shots${row.asked.length ? ` ${row.asked.map((shot) => `${shot.source} +${shot.ms}/${shot.wait}`).join(' ')}` : ''})`,
        )
        .join(' | ');

      return { ok: rows.every((row) => row.painted), detail };
    },
  },
  {
    name: 'pointer click on an empty area keeps the ring off',
    pages: ['System', 'Sketches', 'Inbox'],
    viewport: WIDE,
    run: async (page, state) =>
      state.empty ? noRingAfterPointer(page, state.empty) : { ok: false, detail: 'no empty point' },
  },
  {
    name: 'pointer click on a frame keeps the ring off',
    pages: ['System', 'Sketches', 'Inbox'],
    viewport: WIDE,
    run: async (page, state) =>
      state.frame ? noRingAfterPointer(page, state.frame) : { ok: false, detail: 'no frame point' },
  },
  {
    name: 'window blur keeps the pointer mark',
    pages: ['System', 'Sketches', 'Inbox'],
    viewport: WIDE,
    run: async (page, state) => {
      if (!state.empty) return { ok: false, detail: 'no empty point' };
      await page.mouse.click(state.empty.x, state.empty.y);
      await settle(page);
      const mark = (blurred) =>
        page.evaluate(
          ({ CANVAS, blurred }) => {
            const canvas = [...document.querySelectorAll(CANVAS)].sort(
              (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
            )[0];

            if (blurred) {
              document.hasFocus = () => false;
              canvas.dispatchEvent(new FocusEvent('blur'));
              delete document.hasFocus;
            }

            return canvas.hasAttribute('data-pointer-focus');
          },
          { CANVAS, blurred },
        );
      const clicked = await mark(false);
      await mark(true);
      await settle(page);
      const kept = await mark(false);
      const ring = await ringOf(page);

      return {
        ok: clicked && kept && ring.focused && ring.rings.length === 0,
        detail: `clicked=${clicked} kept=${kept} focused=${ring.focused} rings=[${ring.rings}]`,
      };
    },
  },
  {
    name: 'Tab focus shows the ring',
    pages: ['System', 'Sketches', 'Inbox'],
    viewport: WIDE,
    run: async (page, state) => {
      if (!state.empty) return { ok: false, detail: 'no empty point' };
      await page.mouse.click(state.empty.x, state.empty.y);
      await settle(page);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await settle(page);
      const ring = await ringOf(page);

      return { ok: ring.focused && ring.rings.length > 0, detail: `focused=${ring.focused} rings=[${ring.rings}]` };
    },
  },
  {
    name: 'left drag on an empty area pans',
    run: async (page, state) => {
      if (!state.empty) return { ok: false, detail: 'no empty point' };
      const by = { x: 90, y: 60 };
      await drag(page, state.empty, by);
      const after = await probe(page);

      return { ok: moved(state, after, by), detail: describe(state, after) };
    },
  },
  {
    name: 'left click on a frame selects it',
    run: async (page, state) => {
      if (!state.frame) return { ok: false, detail: 'no frame point' };
      await page.mouse.click(state.frame.x, state.frame.y);
      await settle(page);
      const after = await probe(page);
      const frame = after.frames[state.frame.index];

      return { ok: !!frame?.selected, detail: `selected=${!!frame?.selected}` };
    },
  },
  {
    name: 'selected frame draws the selection outline',
    run: async (page, state) => {
      if (!state.frame) return { ok: false, detail: 'no frame point' };
      await page.mouse.click(state.frame.x, state.frame.y);
      await settle(page);
      const outline = await page.evaluate(
        ({ CANVAS }) => {
          const canvas = [...document.querySelectorAll(CANVAS)].sort(
            (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
          )[0];
          const border = canvas?.querySelector('[data-selected] [data-frame-border]');

          if (!border) return null;

          const style = getComputedStyle(border);
          const box = border.getBoundingClientRect();
          const host = border.closest('[data-selected]').getBoundingClientRect();

          return {
            width: style.outlineWidth,
            style: style.outlineStyle,
            color: style.outlineColor,
            fills: Math.abs(box.width - host.width) < 1 && Math.abs(box.height - host.height) < 1,
          };
        },
        { CANVAS },
      );

      return {
        ok: !!outline && outline.style === 'solid' && Number.parseFloat(outline.width) > 1 && outline.fills,
        detail: JSON.stringify(outline),
      };
    },
  },
  {
    name: 'hover alone draws no frame border',
    run: async (page, state) => {
      if (!state.frame || !state.empty) return { ok: false, detail: 'no frame or empty point' };
      const edges = () =>
        page.evaluate(
          ({ CANVAS, FRAME, index }) => {
            const canvas = [...document.querySelectorAll(CANVAS)].sort(
              (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
            )[0];
            const box = [...canvas.querySelectorAll(FRAME)][index].getBoundingClientRect();
            const ids = (window.__hoverEdgeIds ??= new WeakMap());
            const edges = {};

            for (const element of document.querySelectorAll('*')) {
              const rect = element.getBoundingClientRect();
              const over =
                rect.right >= box.left - 8 &&
                rect.left <= box.right + 8 &&
                rect.bottom >= box.top - 8 &&
                rect.top <= box.bottom + 8;

              if (!over) continue;
              if (!ids.has(element)) ids.set(element, (window.__hoverEdgeCount = (window.__hoverEdgeCount ?? 0) + 1));

              const style = getComputedStyle(element);
              const marks = [...element.attributes].flatMap((attribute) =>
                attribute.name.startsWith('data-') ? [attribute.name] : [],
              );

              edges[ids.get(element)] =
                `${element.localName}[${marks}] outline ${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} | shadow ${style.boxShadow} | border ${style.borderStyle} ${style.borderWidth} ${style.borderColor}`;
            }

            return edges;
          },
          { CANVAS, FRAME, index: state.frame.index },
        );

      await page.mouse.move(state.empty.x, state.empty.y);
      await settle(page);
      const before = await edges();

      await page.mouse.move(state.frame.x, state.frame.y);
      await settle(page);
      const after = await edges();
      const changed = Object.entries(after).flatMap(([id, edge]) =>
        edge === before[id] ? [] : [`${before[id] ?? 'new'} -> ${edge}`],
      );

      return { ok: changed.length === 0, detail: changed.length ? changed.join('; ') : 'unchanged' };
    },
  },
  {
    name: 'arrow key pans',
    run: async (page, state) => {
      if (!state.empty) return { ok: false, detail: 'no empty point' };
      await page.mouse.click(state.empty.x, state.empty.y);
      await settle(page);
      const before = await probe(page);
      await page.keyboard.press('ArrowRight');
      await settle(page);
      const after = await probe(page);

      return { ok: moved(before, after, { x: -ARROW_STEP, y: 0 }), detail: describe(before, after) };
    },
  },
  {
    name: 'double-click focuses a frame',
    run: async (page, state) => {
      if (!state.frame) return { ok: false, detail: 'no frame point' };
      await page.mouse.dblclick(state.frame.x, state.frame.y);
      await settle(page);
      const after = await probe(page);
      const frame = after.frames[state.frame.index];
      const { view } = after;
      const within =
        frame.left >= view.left - 2 &&
        frame.right <= view.right + 2 &&
        frame.top >= view.top - 2 &&
        frame.bottom <= view.bottom + 2;
      const fills =
        (frame.right - frame.left) / (view.right - view.left) > 0.6 ||
        (frame.bottom - frame.top) / (view.bottom - view.top) > 0.6;

      return { ok: within && fills, detail: `${describe(state, after)} within=${within} fills=${fills}` };
    },
  },
  {
    name: 'Space+drag pans',
    run: async (page, state) => {
      const from = state.frame ?? state.empty;
      if (!from) return { ok: false, detail: 'no point' };
      const by = { x: 70, y: 40 };
      await page.keyboard.down('Space');
      await drag(page, from, by);
      await page.keyboard.up('Space');
      await settle(page);
      const after = await probe(page);

      return { ok: moved(state, after, by), detail: describe(state, after) };
    },
  },
  {
    name: 'middle drag pans',
    run: async (page, state) => {
      const from = state.frame ?? state.empty;
      if (!from) return { ok: false, detail: 'no point' };
      const by = { x: -50, y: 30 };
      await drag(page, from, by, 'middle');
      const after = await probe(page);

      return { ok: moved(state, after, by), detail: describe(state, after) };
    },
  },
  {
    name: 'pan beyond every edge of the content',
    pages: ['System', 'Sketches', 'Inbox', 'Flow'],
    run: async (page, state, target) => {
      if (!state.empty) return { ok: false, detail: 'no empty point' };
      await page.mouse.click(state.empty.x, state.empty.y);
      await settle(page);

      const selector = target.frame ?? FRAME;
      const failed = [];

      for (const edge of PAN_EDGES) {
        const before = await probe(page);
        const content = contentOf(await frameBoxes(page, selector));

        if (!content) return { ok: false, detail: 'no frames' };

        const presses = Math.max(1, Math.ceil(edge.room(content, before.view) / ARROW_STEP) + 1);

        for (let press = 0; press < presses; press++) await page.keyboard.press(edge.key);
        await settle(page);

        const after = await probe(page);
        const by = { x: ARROWS_BY[edge.key].x * presses, y: ARROWS_BY[edge.key].y * presses };
        const beyond = edge.room(contentOf(await frameBoxes(page, selector)), after.view) < 0;

        if (!moved(before, after, by) || !beyond) {
          failed.push(`${edge.name}: ${presses} x ${edge.key} ${describe(before, after)} beyond=${beyond}`);
        }
      }

      return { ok: failed.length === 0, detail: failed.join('; ') || 'all four edges' };
    },
  },
  {
    name: 'Shift+1 fits all, window-wide',
    run: async (page, state, target) => {
      await page.mouse.move(state.view.left + 20, state.view.top + 20);
      await page.mouse.wheel(0, 900);
      await settle(page);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      const before = await probe(page);
      await page.keyboard.press('Shift+Digit1');
      await settle(page);
      const after = await probe(page);
      const { view } = after;
      const fitsHeight = target.fits !== 'width';
      const shown = after.frames.filter((frame) => frame.right - frame.left >= 1);
      const all =
        shown.every(
          (frame) =>
            frame.left >= view.left - 2 &&
            frame.right <= view.right + 2 &&
            (!fitsHeight || (frame.top >= view.top - 2 && frame.bottom <= view.bottom + 2)),
        ) &&
        (fitsHeight || (shown.length > 0 && Math.min(...shown.map((frame) => frame.top)) >= view.top - 2));

      return { ok: all && after.camera?.y !== before.camera?.y, detail: `${describe(before, after)} allInView=${all}` };
    },
  },
  {
    name: 'Fit shows every column of a wide sketch, heads at the top',
    pages: ['Wide'],
    viewport: WIDE,
    run: async (page) => {
      await page.waitForFunction(() => !document.querySelector('[data-sk-changed="pending"]'), null, {
        timeout: 60000,
      });
      await page.getByRole('button', { name: 'Einpassen' }).first().click();
      await settle(page);
      await settled(page, FRAME);

      const { view, columns, headTop, crops } = await page.evaluate(() => {
        const viewport = document.querySelector('ethlete-sketches ethlete-canvas-viewport');
        const box = viewport.getBoundingClientRect();
        const covered = Number.parseFloat(getComputedStyle(viewport).getPropertyValue('--st-shell-inset-left')) || 0;
        const columns = Object.entries(
          Object.groupBy(viewport.querySelectorAll('[data-sk-variant]'), (cell) => cell.dataset['skVariant']),
        ).map(([key, cells]) => {
          const frames = cells.map((cell) => cell.querySelector('[data-sk-frame]').getBoundingClientRect());

          return {
            key,
            left: Math.min(...frames.map((frame) => frame.left)),
            right: Math.max(...frames.map((frame) => frame.right)),
          };
        });
        const crops = [...viewport.querySelectorAll('[data-sk-frame]')].flatMap((frame) => {
          const outer = frame.getBoundingClientRect();
          const inner = frame.firstElementChild.getBoundingClientRect();

          return Math.abs(inner.left - outer.left) > 1 || Math.abs(inner.width - outer.width) > 1
            ? [
                `${frame.dataset['skFrame']} content ${Math.round(inner.left - outer.left)}+${Math.round(inner.width)} in ${Math.round(outer.width)}`,
              ]
            : [];
        });
        const heads = [...viewport.querySelectorAll('[data-sk-row]')].map((head) => head.getBoundingClientRect().top);

        return {
          view: { left: box.left + covered, top: box.top, right: box.right },
          columns,
          headTop: heads.length ? Math.min(...heads) : null,
          crops,
        };
      });
      const shown = columns.map((column) => column.key).sort();
      const expected = ['current', ...WIDE_SKETCH.variants];
      const cut = columns.filter((column) => column.left < view.left - 2 || column.right > view.right + 2);
      const gap = headTop === null ? null : Math.round(headTop - view.top);
      const faults = [
        ...(expected.every((key) => shown.includes(key)) ? [] : [`columns ${shown.join(',')}, expected ${expected}`]),
        ...cut.map(
          (column) =>
            `${column.key} spans ${Math.round(column.left)}..${Math.round(column.right)} outside ${Math.round(view.left)}..${Math.round(view.right)}`,
        ),
        ...(gap !== null && gap <= 40 ? [] : [`first head ${gap} px below the canvas top`]),
        ...crops.slice(0, 3),
      ];

      return {
        ok: faults.length === 0,
        detail: faults.join('; ') || `${shown.length} columns inside, head gap ${gap} px`,
      };
    },
  },
  {
    name: 'hiding the panel keeps the frames',
    pages: ['System', 'Sketches', 'Flow'],
    run: async (page, _state, target) => {
      const firstFrame = () =>
        page.evaluate(
          ({ CANVAS, FRAME }) => {
            const canvas = [...document.querySelectorAll(CANVAS)].sort(
              (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
            )[0];
            const rect = canvas?.querySelector(`${FRAME}, figure`)?.getBoundingClientRect();
            const origin = canvas?.getBoundingClientRect();

            return rect && origin ? { left: rect.left - origin.left, top: rect.top - origin.top, x: rect.left } : null;
          },
          { CANVAS, FRAME },
        );
      const head = page.getByText('Aktuell', { exact: true });
      const headOffset = async (frame) => ((await head.count()) ? (await head.first().boundingBox()).x - frame.x : 0);
      // Sketches' Fit is sticky and re-fits to the wider canvas, so the case holds a fixed zoom.
      if (target.name === 'Sketches') {
        await page.getByRole('button', { name: 'Auf 100 % zoomen' }).click();
        await settle(page);
      }

      const before = await probe(page);
      const frameBefore = await firstFrame();
      const headBefore = frameBefore ? await headOffset(frameBefore) : 0;

      await page.getByRole('button', { name: 'Hide panel' }).first().click();
      await settle(page);
      const after = await probe(page);
      const frameAfter = await firstFrame();
      const headAfter = frameAfter ? await headOffset(frameAfter) : 0;
      const kept =
        !!before?.camera &&
        !!after?.camera &&
        !!frameBefore &&
        !!frameAfter &&
        near(frameAfter.left, frameBefore.left) &&
        near(frameAfter.top, frameBefore.top) &&
        near(after.camera.zoom * 1000, before.camera.zoom * 1000) &&
        near(headAfter, headBefore);

      return {
        ok: kept,
        detail: `${describe(before, after)} frame ${frameBefore?.left},${frameBefore?.top} -> ${frameAfter?.left},${frameAfter?.top} head-frame ${headBefore} -> ${headAfter}`,
      };
    },
  },
  {
    name: 'a listing refresh every 1 s for 6 s re-navigates no iframe and leaves no 150px frame',
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const sketchJson = join(checkout, '.ethlete/design/studio/sketches/elements-shell-main/sketch.json');
      const original = readFileSync(sketchJson, 'utf8');
      const navigations = [];
      const onNavigated = (frame) => {
        if (frame !== page.mainFrame()) navigations.push(frame.url());
      };
      let flip = false;

      page.on('framenavigated', onNavigated);

      const timer = setInterval(() => {
        flip = !flip;
        writeFileSync(sketchJson, original.trimEnd() + (flip ? '\n\n' : '\n'));
      }, 1000);

      await page.waitForTimeout(6000);
      clearInterval(timer);
      writeFileSync(sketchJson, original);
      page.off('framenavigated', onNavigated);
      await page.waitForTimeout(1000);

      const heights = await page.evaluate(() =>
        [...document.querySelectorAll('[data-sk-frame]')].map((frame) => ({
          frame: Math.round(frame.getBoundingClientRect().height),
          iframes: [...frame.querySelectorAll('iframe')].map((iframe) => iframe.offsetHeight),
        })),
      );
      const placeholder = heights.filter((row) => row.frame <= 0 || row.iframes.some((height) => height === 150));

      return {
        ok: heights.length > 0 && navigations.length === 0 && placeholder.length === 0,
        detail: `frames ${heights.length}, iframe re-navigations in 6 s ${navigations.length} (must be 0), frames with 150px placeholder or no height 1 s after the last refresh ${placeholder.length} (must be 0)`,
      };
    },
  },
  {
    name: 'a variant equal to Aktuell keeps its iframes across a quick and a full listing',
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const sketchJson = join(checkout, '.ethlete/design/studio/sketches/elements-shell-main/sketch.json');
      const original = readFileSync(sketchJson, 'utf8');
      const listings = { quick: 0, full: 0 };
      const onResponse = (response) => {
        if (!response.url().includes('/__design/sketches?')) return;
        listings[response.url().includes('unchanged=no') ? 'quick' : 'full'] += 1;
      };
      const refresh = async (content) => {
        listings.quick = 0;
        listings.full = 0;
        writeFileSync(sketchJson, content);
        const deadline = Date.now() + 15000;

        while ((listings.quick === 0 || listings.full === 0) && Date.now() < deadline) await page.waitForTimeout(250);
        await page.waitForTimeout(1000);

        return { ...listings };
      };
      const watch = () =>
        page.evaluate(() => {
          const record = { added: 0, removed: 0 };
          const touches = (node) =>
            node instanceof Element &&
            (node.matches('[data-sk-row="a"], [data-sk-variant="a"], iframe') || !!node.querySelector('iframe'));

          window.__sameRow = record;
          window.__sameObserver?.disconnect();
          window.__sameObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              for (const node of mutation.addedNodes) if (touches(node)) record.added += 1;
              for (const node of mutation.removedNodes) if (touches(node)) record.removed += 1;
            }
          });
          window.__sameObserver.observe(document.body, { childList: true, subtree: true });
        });
      const changes = () => page.evaluate(() => ({ ...window.__sameRow }));

      page.on('response', onResponse);

      try {
        const folded = await page.evaluate(() => !!document.querySelector('[data-sk-same]'));

        await watch();
        const collapsedListings = await refresh(original.trimEnd() + '\n\n');
        const collapsed = await changes();

        await page.locator('[data-sk-same] button').first().click();
        await settle(page);
        await page.evaluate(() => {
          window.__sameFrames = [
            ...document.querySelectorAll('[data-sk-row="a"] iframe, [data-sk-variant="a"] iframe'),
          ];
        });
        await watch();
        const openListings = await refresh(original);
        const open = await changes();
        const kept = await page.evaluate(() => {
          const now = [...document.querySelectorAll('[data-sk-row="a"] iframe, [data-sk-variant="a"] iframe')];

          return {
            before: window.__sameFrames.length,
            same:
              now.length === window.__sameFrames.length && now.every((frame, i) => frame === window.__sameFrames[i]),
          };
        });

        const listed = (counts) => counts.quick > 0 && counts.full > 0;

        return {
          ok:
            folded &&
            listed(collapsedListings) &&
            listed(openListings) &&
            collapsed.added + collapsed.removed === 0 &&
            open.added + open.removed === 0 &&
            kept.before > 0 &&
            kept.same,
          detail: `folded ${folded}; collapsed: listings ${JSON.stringify(collapsedListings)}, iframe/row adds ${collapsed.added} removes ${collapsed.removed} (must be 0); open: listings ${JSON.stringify(openListings)}, adds ${open.added} removes ${open.removed} (must be 0), iframes ${kept.before} kept ${kept.same}`,
        };
      } finally {
        page.off('response', onResponse);
        writeFileSync(sketchJson, original);
      }
    },
  },
  {
    name: 'first load creates one iframe per frame and aborts no frame request',
    pages: ['Sketches'],
    run: async (page) => {
      const aborted = [];
      const onFailed = (request) => {
        if (request.resourceType() === 'document' && request.frame() !== page.mainFrame()) aborted.push(request.url());
      };

      page.on('requestfailed', onFailed);

      try {
        await page.addInitScript(() => {
          if (window.__frameLoad) return;

          const record = { created: [], srcAt: new Map(), loadedAt: new Map() };
          const create = Document.prototype.createElement;
          const src = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
          const setAttribute = Element.prototype.setAttribute;
          const noteSrc = (iframe) => {
            if (!record.srcAt.has(iframe)) record.srcAt.set(iframe, performance.now());
          };

          window.__frameLoad = record;
          Document.prototype.createElement = function (tag, ...rest) {
            const element = create.call(this, tag, ...rest);

            if (element instanceof HTMLIFrameElement) record.created.push(element);

            return element;
          };
          Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
            ...src,
            set(value) {
              noteSrc(this);
              src.set.call(this, value);
            },
          });
          Element.prototype.setAttribute = function (name, value) {
            if (this instanceof HTMLIFrameElement && name === 'src') noteSrc(this);

            return setAttribute.call(this, name, value);
          };
          document.addEventListener(
            'load',
            (event) => {
              const iframe = event.target;

              if (iframe instanceof HTMLIFrameElement && iframe.hasAttribute('src') && !record.loadedAt.has(iframe)) {
                record.loadedAt.set(iframe, performance.now());
              }
            },
            true,
          );
        });
        await page.reload();
        await page.waitForFunction(
          ({ CANVAS, FRAME }) => document.querySelector(CANVAS)?.querySelector(FRAME),
          { CANVAS, FRAME },
          { timeout: 30000 },
        );

        const loadState = () =>
          page.evaluate(() => {
            const iframes = [...document.querySelectorAll('[data-sk-frame] iframe')];

            return `${iframes.length}/${iframes.filter((iframe) => window.__frameLoad.loadedAt.has(iframe)).length}`;
          });
        const deadline = Date.now() + 90000;
        let stable = 0;
        let last = '';

        while (stable < 4 && Date.now() < deadline) {
          await page.waitForTimeout(500);
          const now = await loadState();
          const [frames, loaded] = now.split('/');

          stable = now === last && frames === loaded && frames !== '0' ? stable + 1 : 0;
          last = now;
        }

        const load = await page.evaluate(() => {
          const record = window.__frameLoad;
          const iframes = [...document.querySelectorAll('[data-sk-frame] iframe')];
          const keyOf = (iframe) => `${iframe.dataset['variant']} ${iframe.dataset['state']}`;
          const shownKeys = new Set(iframes.map(keyOf));
          const inView = (iframe) => {
            const box = iframe.getBoundingClientRect();

            return box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight;
          };
          const srcAt = (iframe) => record.srcAt.get(iframe) ?? Infinity;
          const visible = iframes.filter(inView);
          const hidden = iframes.filter((iframe) => !inView(iframe));

          return {
            frames: iframes.length,
            created: record.created.length,
            createdForShown: record.created.filter((iframe) => shownKeys.has(keyOf(iframe))).length,
            urls: iframes.map((iframe) => iframe.src),
            visible: visible.length,
            visibleFirst: hidden.length === 0 || Math.max(...visible.map(srcAt)) <= Math.min(...hidden.map(srcAt)),
            visibleLoadedMs: Math.round(Math.max(0, ...visible.map((iframe) => record.loadedAt.get(iframe) ?? NaN))),
            allLoadedMs: Math.round(Math.max(0, ...iframes.map((iframe) => record.loadedAt.get(iframe) ?? NaN))),
          };
        });
        const shownAborts = aborted.filter((url) => load.urls.includes(url)).length;

        return {
          ok: stable >= 4 && load.frames > 0 && load.createdForShown === load.frames && shownAborts === 0,
          detail: `${stable >= 4 ? 'settled' : `not settled in 90 s (${last} loaded)`}, iframes ${load.frames}, created for them ${load.createdForShown} (must equal), created in all ${load.created}, aborted requests of shown frames ${shownAborts} of ${aborted.length} (must be 0), ${load.visible} visible got src first ${load.visibleFirst}, visible loaded at ${load.visibleLoadedMs} ms, all at ${load.allLoadedMs} ms after reload`,
        };
      } finally {
        page.off('requestfailed', onFailed);
      }
    },
  },
];

let checkout;

const prepareCheckout = () => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-canvas-e2e-'));

  for (const entry of readdirSync(root)) {
    if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(root, entry), join(dir, entry));
  }

  cpSync(join(root, '.ethlete/design'), join(dir, '.ethlete/design'), { recursive: true });

  rmSync(join(dir, '.ethlete/design/studio/sketches'), { recursive: true, force: true });

  for (const target of [
    'pages/system',
    'components/zoom-chip',
    'elements/shell-main',
    ...Object.values(GONE_TARGETS),
  ]) {
    const folder = join(dir, '.ethlete/design/studio/sketches', target.replace('/', '-'));

    mkdirSync(join(folder, 'a', dirname(target)), { recursive: true });
    cpSync(join(root, '.ethlete/design/studio', target), join(folder, 'a', target), { recursive: true });

    if (target === 'components/zoom-chip') {
      const variantFile = join(folder, 'a', target, 'zoom-chip.ts');

      writeFileSync(
        variantFile,
        readFileSync(variantFile, 'utf8').replace('reset: { percent: 100 }', 'reset: { percent: 110 }'),
      );
    }
    writeFileSync(
      join(folder, 'sketch.json'),
      JSON.stringify({
        target,
        targets: [target],
        status: 'ready',
        createdAt: '2026-01-01T00:00:00.000Z',
        rounds: [{ key: 'r1', title: '', note: 'canvas e2e' }],
        variantInfo: { a: { authors: ['canvas-e2e'], round: 'r1' } },
      }),
    );
  }

  const wide = join(
    dir,
    '.ethlete/design/studio/sketches',
    `${WIDE_SKETCH.part.replace('/', '-')}.${WIDE_SKETCH.name}`,
  );
  const wideCss = join(WIDE_SKETCH.part, `${WIDE_SKETCH.part.split('/')[1]}.css`);

  WIDE_SKETCH.variants.forEach((variant, index) => {
    cpSync(join(root, '.ethlete/design/studio', WIDE_SKETCH.part), join(wide, variant, WIDE_SKETCH.part), {
      recursive: true,
    });
    writeFileSync(
      join(wide, variant, wideCss),
      `${readFileSync(join(wide, variant, wideCss), 'utf8')}\n.st-title-bar { opacity: ${0.4 + index * 0.2}; }\n`,
    );
  });
  writeFileSync(
    join(wide, 'sketch.json'),
    JSON.stringify({
      target: `${WIDE_SKETCH.part}@${WIDE_SKETCH.name}`,
      targets: [WIDE_SKETCH.part],
      status: 'ready',
      createdAt: '2026-01-01T00:00:00.000Z',
      rounds: [{ key: 'r1', title: '', note: 'canvas e2e' }],
      variantInfo: Object.fromEntries(
        WIDE_SKETCH.variants.map((variant) => [variant, { authors: ['canvas-e2e'], round: 'r1' }]),
      ),
    }),
  );

  return dir;
};

const runCase = async (page, studioUrl, designPort, target, testCase) => {
  await page.goto(studioUrl);
  await page.evaluate(
    ({ view, checkout }) => {
      localStorage.clear();
      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
    },
    { view: target.view, checkout },
  );
  await page.setViewportSize(testCase.viewport ?? NARROW);
  await page.goto(studioUrl);
  await page.waitForFunction(
    ({ CANVAS, FRAME }) => document.querySelector(CANVAS)?.querySelector(FRAME),
    { CANVAS, FRAME: target.frame ?? FRAME },
    { timeout: 30000 },
  );
  await page.waitForTimeout(2500);
  await settled(page, target.frame ?? FRAME);

  const shown = await page.evaluate(
    ({ shows, hides }) => !!document.querySelector(shows) && !(hides && document.querySelector(hides)),
    { shows: target.shows, hides: target.hides ?? null },
  );
  const state = await probe(page);

  return !shown
    ? { ok: false, detail: `the page does not show ${target.shows}` }
    : state
      ? await testCase.run(page, state, target, { designPort })
      : { ok: false, detail: 'no canvas' };
};

const nextJob = () =>
  new Promise((done) => {
    process.once('message', done);
    process.send({ type: 'next' });
  });

const work = async () => {
  checkout = prepareCheckout();

  await withStudio(
    async ({ page, studioUrl, designPort }) => {
      for (let { job } = await nextJob(); job; { job } = await nextJob()) {
        const startedAt = performance.now();
        let result;

        try {
          result = await runCase(page, studioUrl, designPort, PAGES[job.target], CASES[job.case]);
        } catch (error) {
          result = { ok: false, detail: String(error).split('\n')[0] };
        }

        process.send({ type: 'result', ok: result.ok, detail: result.detail, ms: performance.now() - startedAt });
      }
    },
    { built, checkout },
  ).finally(() => rmSync(checkout, { recursive: true, force: true }));

  process.exit(0);
};

const freePort = () =>
  new Promise((done, fail) => {
    const server = createServer();

    server.on('error', fail);
    server.listen(0, '::1', () => {
      const { port } = server.address();

      server.close(() => done(port));
    });
  });

const keyOf = (job) => `${job.page} :: ${job.name}`;
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`.padStart(7);

const workerCount = () => {
  const asked = Number(
    args.includes('--workers') ? args[args.indexOf('--workers') + 1] : process.env['STUDIO_E2E_WORKERS'],
  );

  return asked >= 1 ? Math.floor(asked) : Math.max(1, Math.min(8, Math.floor(availableParallelism() / 4)));
};

const lead = async () => {
  const runStartedAt = performance.now();
  const known = existsSync(TIMINGS_FILE) ? JSON.parse(readFileSync(TIMINGS_FILE, 'utf8')) : {};
  const queue = PAGES.flatMap((target, targetIndex) =>
    CASES.flatMap((testCase, caseIndex) =>
      (testCase.pages ?? ['System', 'Sketches']).includes(target.name) &&
      (!testCase.labels || testCase.labels.includes(target.label)) &&
      (!only || testCase.name.includes(only))
        ? [{ target: targetIndex, case: caseIndex, page: target.label ?? target.name, name: testCase.name }]
        : [],
    ),
  ).sort((a, b) => (known[keyOf(b)] ?? Infinity) - (known[keyOf(a)] ?? Infinity));
  const total = queue.length;
  const workers = Math.min(total, workerCount());
  const rows = [];
  const scratch = built ? undefined : mkdtempSync(join(tmpdir(), 'studio-canvas-e2e-build-'));
  const record = (job, result) => {
    rows.push({ ...job, ...result });
    console.log(
      `${result.ok ? 'PASS' : 'FAIL'}  ${job.page.padEnd(9)} ${job.name.padEnd(36)} ${result.detail} (${seconds(result.ms ?? 0).trim()})`,
    );
  };

  try {
    ensureCli();
    if (scratch) buildStudio(scratch, (phase) => console.log(`[canvas-e2e] ${phase}`));
    console.log(`[canvas-e2e] ${total} cases on ${workers} worker(s)`);

    await Promise.all(
      Array.from({ length: workers }, async (_, index) => {
        const port = await freePort();
        const child = fork(fileURLToPath(import.meta.url), ['--worker', '--built', built ?? scratch], {
          env: { ETHLETE_DESIGN_SLOW_CHECKS: 'off', ...process.env, DE_PORT: String(port) },
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        });
        let output = '';
        let current;

        child.stdout.on('data', (chunk) => (output += chunk));
        child.stderr.on('data', (chunk) => (output += chunk));
        child.on('message', (message) => {
          if (message.type === 'result') {
            record(current, message);
            current = undefined;
          }
          if (message.type === 'next') {
            current = queue.shift();
            child.send({ job: current ?? null });
          }
        });

        const code = await new Promise((done) => child.on('exit', done));

        if (code !== 0 || current) {
          console.log(`[canvas-e2e] worker ${index} on port ${port} exited with ${code}\n${output.slice(-4000)}`);
          if (current) record(current, { ok: false, detail: `worker exited with ${code}` });
        }
      }),
    );
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }

  const groups = Object.entries(Object.groupBy(rows, (row) => row.page)).map(([page, pageRows]) => ({
    page,
    ms: pageRows.reduce((sum, row) => sum + (row.ms ?? 0), 0),
    count: pageRows.length,
  }));

  console.log('\nTime per page group, slowest first:');
  for (const group of groups.sort((a, b) => b.ms - a.ms)) {
    console.log(`${seconds(group.ms)}  ${group.page} (${group.count} cases)`);
  }
  console.log('\nTime per case, slowest first:');
  for (const row of rows.toSorted((a, b) => (b.ms ?? 0) - (a.ms ?? 0))) {
    console.log(`${seconds(row.ms ?? 0)}  ${row.page.padEnd(9)} ${row.name}`);
  }

  mkdirSync(dirname(TIMINGS_FILE), { recursive: true });
  writeFileSync(
    TIMINGS_FILE,
    JSON.stringify({
      ...known,
      ...Object.fromEntries(rows.filter((row) => row.ms).map((row) => [keyOf(row), Math.round(row.ms)])),
    }),
  );

  const failed = rows.filter((row) => !row.ok);

  console.log(
    `\n${rows.length - failed.length}/${total} passed in ${seconds(performance.now() - runStartedAt).trim()} on ${workers} worker(s)`,
  );
  process.exit(failed.length || rows.length < total || !total ? 1 : 0);
};

await (args.includes('--worker') ? work() : lead());
