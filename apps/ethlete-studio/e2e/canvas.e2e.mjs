#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;

process.env['DE_PORT'] ??= '4473';

const PAGES = [
  { name: 'System', view: { systemProduct: 'studio', systemEntry: 'pages/system' } },
  { name: 'Sketches', view: { systemProduct: 'studio', systemEntry: 'sketch:pages/system' } },
];

const CANVAS = 'ethlete-design-canvas, ethlete-canvas-viewport';
const FRAME = 'ethlete-canvas-frame, [data-canvas-frame], [data-sk-frame]';
const ARROW_STEP = 80;
const SETTLE_MS = 600;

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

const CASES = [
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
    name: 'Shift+1 fits all, window-wide',
    run: async (page, state) => {
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
      const all = after.frames.every(
        (frame) =>
          frame.right - frame.left < 1 ||
          (frame.left >= view.left - 2 &&
            frame.right <= view.right + 2 &&
            frame.top >= view.top - 2 &&
            frame.bottom <= view.bottom + 2),
      );

      return { ok: all && after.camera?.y !== before.camera?.y, detail: `${describe(before, after)} allInView=${all}` };
    },
  },
];

const results = await withStudio(
  async ({ page, studioUrl }) => {
    const rows = [];

    for (const target of PAGES) {
      await page.goto(studioUrl);
      await page.evaluate(
        ({ view, checkout }) => {
          localStorage.clear();
          localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
        },
        { view: target.view, checkout: root },
      );

      for (const testCase of CASES) {
        await page.goto(studioUrl);
        await page.waitForFunction(
          ({ CANVAS, FRAME }) => document.querySelector(CANVAS)?.querySelector(FRAME),
          { CANVAS, FRAME },
          { timeout: 30000 },
        );
        await page.waitForTimeout(2500);

        const state = await probe(page);
        let result;

        try {
          result = state ? await testCase.run(page, state) : { ok: false, detail: 'no canvas' };
        } catch (error) {
          result = { ok: false, detail: String(error).split('\n')[0] };
        }

        rows.push({ page: target.name, case: testCase.name, ...result });
        console.log(
          `${result.ok ? 'PASS' : 'FAIL'}  ${target.name.padEnd(9)} ${testCase.name.padEnd(36)} ${result.detail}`,
        );
      }
    }

    return rows;
  },
  { built },
);

const failed = results.filter((row) => !row.ok);

console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
