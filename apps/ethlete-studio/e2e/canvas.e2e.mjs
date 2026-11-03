#!/usr/bin/env node
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;
const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : undefined;

process.env['DE_PORT'] ??= '4473';

const PAGES = [
  {
    name: 'System',
    view: { systemProduct: 'studio', systemEntry: 'pages/system' },
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

const CASES = [
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
    run: async (page, _state, target) => {
      const sketch = target.view.systemEntry.slice('sketch:'.length);
      let release;
      const held = new Promise((resolve) => (release = resolve));
      let listed;

      await page.route('**/__design/sketches?*', async (route) => {
        if (route.request().url().includes('unchanged=no')) return route.continue();

        await held;
        const response = await route.fetch();

        listed = await response.json();
        await route.fulfill({ response, json: listed });
      });
      await page.reload();
      await page.waitForSelector('[data-sk-state]', { timeout: 30000 });
      await settle(page);

      const early = await page.evaluate(() => ({
        marked: document.querySelectorAll('[data-sk-changed="false"]:not([data-sk-variant="current"])').length,
        first: document.querySelectorAll('[data-sk-first-change]').length,
      }));

      release();
      await page.waitForFunction(() => !document.querySelector('[data-sk-changed="pending"]'), null, {
        timeout: 60000,
      });
      await page.unroute('**/__design/sketches?*');

      const entry = listed?.sketches?.find((candidate) => candidate.target === sketch);
      const marks = await page.evaluate(() =>
        [...document.querySelectorAll('[data-sk-variant][data-sk-changed]')].map((cell) => ({
          variant: cell.getAttribute('data-sk-variant'),
          state: cell.getAttribute('data-sk-state'),
          changed: cell.getAttribute('data-sk-changed'),
        })),
      );
      const wrong = marks.filter(({ variant, state, changed }) => {
        const listedTarget = entry?.targets?.find(
          (candidate) => candidate.variant === variant && (candidate.part ?? entry.target) === entry.target,
        );

        if (!listedTarget) return false;

        return changed !== String(!(listedTarget.unchanged ?? []).includes(state));
      });
      const faults = [
        ...(early.marked ? [`${early.marked} marked unchanged before the compare`] : []),
        ...(early.first ? ['"erste Änderung" before the compare'] : []),
        ...(entry ? [] : [`no listed sketch ${sketch}`]),
        ...wrong.slice(0, 3).map(({ variant, state, changed }) => `${variant}/${state} shows ${changed}`),
      ];

      return { ok: faults.length === 0, detail: faults.join('; ') || `${marks.length} marks match the compare` };
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
];

const checkout = mkdtempSync(join(tmpdir(), 'studio-canvas-e2e-'));

for (const entry of readdirSync(root)) {
  if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(root, entry), join(checkout, entry));
}

cpSync(join(root, '.ethlete/design'), join(checkout, '.ethlete/design'), { recursive: true });

rmSync(join(checkout, '.ethlete/design/studio/sketches'), { recursive: true, force: true });

for (const target of ['pages/system', 'components/zoom-chip', 'elements/shell-main']) {
  const folder = join(checkout, '.ethlete/design/studio/sketches', target.replace('/', '-'));

  mkdirSync(join(folder, 'a', dirname(target)), { recursive: true });
  cpSync(join(root, '.ethlete/design/studio', target), join(folder, 'a', target), { recursive: true });
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

const results = await withStudio(
  async ({ page, studioUrl }) => {
    const rows = [];

    for (const target of PAGES) {
      for (const testCase of CASES) {
        if (!(testCase.pages ?? ['System', 'Sketches']).includes(target.name)) continue;
        if (testCase.labels && !testCase.labels.includes(target.label)) continue;
        if (only && !testCase.name.includes(only)) continue;

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
        let result;

        try {
          result = !shown
            ? { ok: false, detail: `the page does not show ${target.shows}` }
            : state
              ? await testCase.run(page, state, target)
              : { ok: false, detail: 'no canvas' };
        } catch (error) {
          result = { ok: false, detail: String(error).split('\n')[0] };
        }

        const pageName = target.label ?? target.name;

        rows.push({ page: pageName, case: testCase.name, ...result });
        console.log(
          `${result.ok ? 'PASS' : 'FAIL'}  ${pageName.padEnd(9)} ${testCase.name.padEnd(36)} ${result.detail}`,
        );
      }
    }

    return rows;
  },
  { built, checkout },
).finally(() => rmSync(checkout, { recursive: true, force: true }));

const failed = results.filter((row) => !row.ok);

console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length || !results.length ? 1 : 0);
