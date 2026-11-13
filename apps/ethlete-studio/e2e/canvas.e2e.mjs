#!/usr/bin/env node
import { execFileSync, fork, spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { availableParallelism, hostname, loadavg, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { holderLine, takeHeavyLock } from '../../../tools/scripts/heavy-run-lock.mjs';
import { listingHold } from '../../../tools/scripts/studio-e2e-listing-hold.mjs';
import { ensureCli, withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';
import { CANVAS, listingWait, sketchCells } from './probe-helpers.mjs';
import { noMatchLineOf } from './case-filter.mjs';
import { shardShareOf } from './shard-share.mjs';
import { residentSurvivors, survivorLinesOf } from './resident-survivors.mjs';
import { goalLineOf, isNoisy, loadArgOf, runLoadLineOf, startRunLoad, topProcesses } from './run-load.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;
const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : undefined;
const pageGroups = args.includes('--page') ? args[args.indexOf('--page') + 1].split('|') : undefined;
const VIEWS = {
  system: ['System', 'Edited', 'Inbox'],
  sketches: ['Sketches', 'Wide', 'Merge', 'Discard'],
  flow: ['Flow'],
};
const view = args.includes('--view') ? args[args.indexOf('--view') + 1] : undefined;
const listOnly = args.includes('--list');
const waitForLock = !args.includes('--no-wait-lock');
const keepTimings = !args.includes('--no-timings');
const coldShots = args.includes('--cold-shots') || process.env['STUDIO_E2E_COLD_SHOTS'] === '1';

if (coldShots) process.env['STUDIO_E2E_COLD_SHOTS'] = '1';
const perfOnly = args.includes('--perf');
const proofRow = args.includes('--proof') ? args[args.indexOf('--proof') + 1] : undefined;

if (view && !VIEWS[view]) {
  console.error(`unknown --view ${view}, one of: ${Object.keys(VIEWS).join(', ')}`);
  process.exit(2);
}

const shardArg = args.includes('--shard') ? args[args.indexOf('--shard') + 1] : process.env['STUDIO_E2E_SHARD'];
const shard = shardArg ? { index: Number(shardArg.split('/')[0]), count: Number(shardArg.split('/')[1]) } : undefined;

if (
  shard &&
  !(Number.isInteger(shard.index) && Number.isInteger(shard.count) && shard.index >= 1 && shard.index <= shard.count)
) {
  console.error(`invalid shard ${shardArg}, expected <i>/<n> with 1 <= i <= n`);
  process.exit(2);
}

if (args.includes('--hold-listings'))
  process.env['STUDIO_E2E_HOLD_LISTINGS'] = args[args.indexOf('--hold-listings') + 1];

const holdListingsMs = Number(process.env['STUDIO_E2E_HOLD_LISTINGS'] ?? 0);

if (!(Number.isInteger(holdListingsMs) && holdListingsMs >= 0)) {
  console.error(`invalid --hold-listings ${process.env['STUDIO_E2E_HOLD_LISTINGS']}, expected a whole number of ms`);
  process.exit(2);
}

if (args.includes('--delay-pictures'))
  process.env['STUDIO_E2E_DELAY_PICTURES'] = args[args.indexOf('--delay-pictures') + 1];

const delayPicturesMs = Number(process.env['STUDIO_E2E_DELAY_PICTURES'] ?? 0);

if (!(Number.isInteger(delayPicturesMs) && delayPicturesMs >= 0)) {
  console.error(`invalid --delay-pictures ${process.env['STUDIO_E2E_DELAY_PICTURES']}, expected a whole number of ms`);
  process.exit(2);
}

if (args.includes('--delay-frames')) process.env['STUDIO_E2E_DELAY_FRAMES'] = args[args.indexOf('--delay-frames') + 1];

const delayFramesMs = Number(process.env['STUDIO_E2E_DELAY_FRAMES'] ?? 0);

if (!(Number.isInteger(delayFramesMs) && delayFramesMs >= 0)) {
  console.error(`invalid --delay-frames ${process.env['STUDIO_E2E_DELAY_FRAMES']}, expected a whole number of ms`);
  process.exit(2);
}

if (delayFramesMs) process.env['ETHLETE_DESIGN_DELAY_FRAMES_MS'] = String(delayFramesMs);

const framesDelayedNote = delayFramesMs ? `, frame documents delayed ${delayFramesMs} ms` : '';

if (args.includes('--cpu-rate')) process.env['STUDIO_E2E_CPU_RATE'] = args[args.indexOf('--cpu-rate') + 1];

const cpuRate = Number(process.env['STUDIO_E2E_CPU_RATE'] ?? 1);

if (!(Number.isInteger(cpuRate) && cpuRate >= 1)) {
  console.error(`invalid --cpu-rate ${process.env['STUDIO_E2E_CPU_RATE']}, expected a whole number of 1 or more`);
  process.exit(2);
}

const loadArg = loadArgOf(args);

if (!loadArg.ok) {
  console.error(loadArg.line);
  process.exit(2);
}

const busyLoops = loadArg.count;
const slowedNote = `${framesDelayedNote}${cpuRate === 1 ? '' : `, renderer CPU slowed ${cpuRate}x`}${busyLoops ? `, ${busyLoops} busy loops` : ''}`;

const TIMINGS_FILE = join(root, 'node_modules/.cache/studio-e2e/canvas-timings.json');

const cliEntry = resolve(root, process.env['STUDIO_CLI_ENTRY'] ?? 'dist/libs/cli/src/index.js');

const GONE_TARGETS = { Merge: 'components/title-bar', Discard: 'components/tree-row' };

const WIDE_SKETCH = {
  part: 'components/title-bar',
  name: 'notice-hint',
  variants: ['a', 'b', 'c'],
  changed: 'push',
};

const EDITED_PART = 'components/disclosure';
const WAIT_MS = 10000;
const FULL_COMPARE_MS = 60000;
const COLD_START_MS = 60000;
const BUDGET_MS = 5 * 60 * 1000;

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

const underPanel = (page) =>
  page.evaluate(
    ({ CANVAS, FRAME }) => {
      const panel = document.querySelector('main ~ aside')?.getBoundingClientRect();
      const canvas = [...document.querySelectorAll(CANVAS)]
        .map((element) => ({ element, box: element.getBoundingClientRect() }))
        .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0]?.element;

      if (!panel || !canvas) return null;

      const clip = { left: 0, right: innerWidth, top: 0, bottom: innerHeight };

      for (let at = canvas; at instanceof HTMLElement; at = at.parentElement) {
        const style = getComputedStyle(at);
        const rect = at.getBoundingClientRect();

        if (style.overflowX !== 'visible') {
          clip.left = Math.max(clip.left, rect.left + at.clientLeft);
          clip.right = Math.min(clip.right, rect.left + at.clientLeft + at.clientWidth);
        }
        if (style.overflowY !== 'visible') {
          clip.top = Math.max(clip.top, rect.top + at.clientTop);
          clip.bottom = Math.min(clip.bottom, rect.top + at.clientTop + at.clientHeight);
        }
      }

      const x = panel.right + 2;
      const straddling = [...canvas.querySelectorAll(FRAME)]
        .map((frame) => ({ frame, rect: frame.getBoundingClientRect() }))
        .filter(
          ({ rect }) =>
            rect.left < x - 4 && rect.right > x + 4 && rect.bottom > clip.top + 24 && rect.top < clip.bottom - 24,
        )
        .map(({ frame, rect }) => {
          const y = Math.round(Math.min(Math.max((rect.top + rect.bottom) / 2, clip.top + 24), clip.bottom - 24));
          const hit = document.elementFromPoint(x, y);

          return {
            y,
            hit: hit?.closest(FRAME) === frame,
            by: hit ? hit.localName + (hit.className ? '.' + String(hit.className).split(' ')[0] : '') : 'nothing',
          };
        })[0];

      return {
        clip: Object.fromEntries(Object.entries(clip).map(([edge, value]) => [edge, Math.round(value)])),
        panel: { left: Math.round(panel.left), right: Math.round(panel.right) },
        window: innerWidth,
        straddling: straddling ?? null,
      };
    },
    { CANVAS, FRAME },
  );

const stillInFit = async (page, after) =>
  (await page.locator('[data-sk-rows][data-sk-fit]').count())
    ? {
        ok: false,
        detail: `precondition not met: the camera is still in Fit after ${after}, so this fixture cannot test it`,
      }
    : null;

const SCROLL_STEP_PX = 300;
const SCROLL_SAMPLES_MS = [30, 300];
const SHOT_URL = '**/__design/shot?**';
const EDITED_SHOT_DELAY_MS = 3000;
const SKETCH_CSS = {
  current: 'elements/shell-main/shell-main.css',
  a: 'sketches/elements-shell-main/a/elements/shell-main/shell-main.css',
};

const showAllStates = async (page) => {
  const button = page.locator('[data-sk-folded]').getByRole('button', { name: 'Alle Zustände zeigen' }).first();

  await button.waitFor({ timeout: FULL_COMPARE_MS });
  if ((await button.count()) && (await button.getAttribute('aria-expanded')) !== 'true') {
    await button.click();
    await page.waitForTimeout(PAGE_SWITCH_SETTLE_MS);
  }
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

      const active = document.activeElement;

      return {
        focused: active === canvas,
        rings,
        active: active ? `${active.localName}${active.id ? `#${active.id}` : ''}` : 'nothing',
      };
    },
    { CANVAS },
  );

const focusUntil = async (page, done) => {
  let ring = await ringOf(page);

  for (const until = Date.now() + WAIT_MS; !done(ring) && Date.now() < until; ring = await ringOf(page)) {
    await page.waitForTimeout(100);
  }

  return ring;
};

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

const FEEDBACK_MS = 100;
const SLOW_HOST_MS = 3000;

/**
 * Clicks `target` in the page and resolves whether a visible answer follows within `ms`: the element turns disabled
 * or busy, leaves the page, changes its text, or a status, alert or spinner appears.
 */
const expectFeedbackWithin = (target, ms) =>
  target.evaluate(
    (element, ms) =>
      new Promise((done) => {
        const SIGNALS = '[aria-busy="true"], [role="status"]:not(:empty), [role="alert"], et-progress-spinner';
        const before = { text: element.textContent, signals: document.querySelectorAll(SIGNALS).length };
        const answerOf = () => {
          if (!element.isConnected) return 'the button left the page';
          if (element.disabled || element.getAttribute('aria-disabled') === 'true') return 'the button turned disabled';
          if (element.getAttribute('aria-busy') === 'true') return 'the button turned busy';
          if (element.textContent !== before.text) return 'the button changed its text';
          if (document.querySelectorAll(SIGNALS).length > before.signals) return 'a status, alert or spinner appeared';

          return null;
        };
        const startedAt = performance.now();
        const observer = new MutationObserver(() => {
          const answer = answerOf();

          if (answer) finish(answer);
        });
        const timer = setTimeout(() => finish(null), ms);
        const finish = (answer) => {
          observer.disconnect();
          clearTimeout(timer);
          done({
            ok: !!answer,
            detail: answer
              ? `${answer} after ${Math.round(performance.now() - startedAt)} ms`
              : `no visible answer within ${ms} ms of the click`,
          });
        };

        observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        element.click();

        const answer = answerOf();

        if (answer) finish(answer);
      }),
    ms,
  );

const withChangedCliAndSlowRestart = (key) => {
  if (!localStorage.getItem(key)) return;

  const internals = window.__TAURI_INTERNALS__;
  const invoke = internals.invoke;

  internals.invoke = (command, args) => {
    if (command === 'studio_code_state')
      return Promise.resolve({
        cli: { running: 'aaaaaaaaaaaa', latest: 'bbbbbbbbbbbb', dirty: false },
        frontend: { latest: null },
        host: { running: null, latest: null },
      });
    if (command === 'window_chrome_watch') {
      setTimeout(() => args.changes.onmessage({ os: 'linux', left: [], right: ['close'], preferNoCsd: false }));

      return Promise.resolve(null);
    }
    if (command === 'design_server_restart')
      return new Promise((done) => setTimeout(done, Number(localStorage.getItem(key)))).then(() =>
        invoke(command, args),
      );

    return invoke(command, args);
  };
};

const listingCounts = { requested: 0, outstanding: 0 };
let listingHoldOn = true;

const listingAnswered = async (page) => {
  const deadline = Date.now() + FULL_COMPARE_MS;
  let wait;

  for (;;) {
    const pendingMarker = await page.evaluate(() => !!document.querySelector('[data-sk-changed="pending"]'));

    wait = listingWait({ holdActive: !!holdListingsMs && listingHoldOn, ...listingCounts, pendingMarker });
    if (wait.done) return;
    if (Date.now() > deadline) throw new Error(`listingAnswered timed out: ${wait.reason}`);
    await page.waitForTimeout(50);
  }
};

const framesPainted = async (page, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  let same = 0;
  let now = { total: 0, painted: 0 };

  while (Date.now() < deadline) {
    now = await page.evaluate(() => {
      const iframes = [...document.querySelectorAll('[data-sk-frame] iframe')];

      return {
        total: iframes.length,
        painted: iframes.filter((iframe) => !iframe.classList.contains('opacity-0')).length,
        srcs: iframes.map((iframe) => iframe.src).join(' '),
      };
    });
    const done = now.total > 0 && now.painted === now.total;

    same = done && now.srcs === last ? same + 1 : 0;
    if (same >= 2) return null;
    last = done ? now.srcs : null;
    await page.waitForTimeout(250);
  }

  return `[data-sk-frame] iframes painted after ${timeoutMs / 1000} s ${now.painted} of ${now.total} (all must paint before the refreshes start)`;
};

const srcChange = (from, to) => {
  const parse = (url) => (url && URL.canParse(url) ? new URL(url) : null);
  const [before, after] = [parse(from), parse(to)];

  if (!before || !after || before.origin + before.pathname !== after.origin + after.pathname)
    return [before ?? from ?? 'none', after ?? to]
      .map((url) => (url instanceof URL && url.protocol.startsWith('http') ? url.pathname + url.search : String(url)))
      .join(' -> ');

  const keys = [...new Set([...before.searchParams.keys(), ...after.searchParams.keys()])].filter(
    (key) => before.searchParams.getAll(key).join() !== after.searchParams.getAll(key).join(),
  );
  const side = (url) => keys.map((key) => `${key}=${url.searchParams.getAll(key).join() || '-'}`).join('&');

  return keys.length ? `${side(before)} -> ${side(after)}` : `same src ${after.pathname}`;
};

const eventUrl = (url) =>
  URL.canParse(url) && /^https?:/u.test(url) ? new URL(url).pathname + new URL(url).search : String(url);

const eventLog = (startedAt = Date.now()) => {
  const events = [];

  return {
    events,
    restart: (at = Date.now()) => {
      startedAt = at;
    },
    add: (kind, subject, detail = '', at = Date.now()) => {
      events.push({ at, kind, subject, detail });
    },
    lines: async (pick = () => true) => {
      const picked = events.filter(pick).sort((a, b) => a.at - b.at);
      const details = await Promise.all(picked.map((event) => event.detail));

      return picked
        .map(
          (event, i) =>
            `\n  ${Math.round(event.at - startedAt)} ms ${event.kind} ${eventUrl(event.subject)}${details[i] ? `: ${details[i]}` : ''}`,
        )
        .join('');
    },
  };
};

const settled = async (page, selector) => {
  await listingAnswered(page);
  let last = '';
  let same = 0;

  for (let poll = 0; poll < WAIT_MS / 250 && same < 3; poll++) {
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
    await page.waitForFunction(() => !document.querySelector('ethlete-sketch-view'));
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

const openDiscardConfirm = async (page) => {
  await page.locator('ethlete-sketches button', { hasText: 'Verwerfen' }).first().click();

  return page
    .locator('[role="alertdialog"]')
    .waitFor({ timeout: 5000 })
    .then(
      () => true,
      () => false,
    );
};

const discardAsksFirst = async (page) => {
  const dismissals = [
    ['Escape', () => page.keyboard.press('Escape')],
    ['Abbrechen', () => page.locator('[role="alertdialog"] [data-sk-discard-cancel]').click()],
  ];

  for (const [how, dismiss] of dismissals) {
    if (!(await openDiscardConfirm(page))) return { ok: false, detail: 'Verwerfen discarded without a confirm' };

    const focused = await page
      .waitForFunction(() => document.activeElement?.hasAttribute('data-sk-discard-cancel'), null, { timeout: 3000 })
      .then(
        () => true,
        () => false,
      );
    const confirm = await page.evaluate(() => ({
      text: [...document.querySelectorAll('[role="alertdialog"]')]
        .map((dialog) => dialog.textContent.replace(/\s+/g, ' ').trim())
        .join(' | '),
      active: document.activeElement?.outerHTML.slice(0, 160) ?? 'none',
    }));

    if (!focused)
      return {
        ok: false,
        detail: `the confirm does not focus Abbrechen: "${confirm.text}", focus on ${confirm.active}`,
      };

    await dismiss();
    await page.locator('[role="alertdialog"]').waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(1000);

    if (!(await page.locator('ethlete-sketch-view').count()))
      return { ok: false, detail: `${how} on the confirm ("${confirm.text}") discarded the sketch` };
  }

  return { ok: true };
};

const EDIT_PART = 'components/comment-row';
const EDIT_LABEL = { before: 'font-ui-medium">${c.author}</span>', after: 'font-ui-medium">${c.author}:</span>' };
const EDIT_WAIT_MS = 120000;

const withEditSketch = async (page, designPort, run) => {
  const studio = join(checkout, '.ethlete/design/studio');
  const saved = mkdtempSync(join(tmpdir(), 'studio-e2e-edit-'));
  const file = join(studio, EDIT_PART, 'comment-row.ts');
  const before = readFileSync(file, 'utf8');
  const git = (...gitArgs) =>
    execFileSync('git', ['-c', 'user.email=e2e@canvas', '-c', 'user.name=canvas-e2e', ...gitArgs], {
      cwd: checkout,
      stdio: 'pipe',
    });
  const merged = JSON.parse(readFileSync(join(studio, 'merged.json'), 'utf8'));
  const entry = merged[EDIT_PART];

  cpSync(studio, saved, { recursive: true });
  // A part with an open sketch is never a direct edit, so the fixture sketch of the part goes first.
  rmSync(join(studio, 'sketches', EDIT_PART.replace('/', '-')), { recursive: true, force: true });
  merged[EDIT_PART] = typeof entry === 'string' ? '0'.repeat(16) : { ...entry, hash: '0'.repeat(16) };
  writeFileSync(join(studio, 'merged.json'), `${JSON.stringify(merged, null, 2)}\n`);
  git('init', '-q');
  git('add', '--', '.ethlete');
  git('commit', '-qm', 'canvas e2e base', '--', '.ethlete');

  const base = git('rev-parse', 'HEAD').toString().trim();

  const edit = async () => {
    writeFileSync(file, replaceOnce(before, EDIT_LABEL.before, EDIT_LABEL.after));
    const check = spawnSync(
      process.execPath,
      [cliEntry, 'design', 'check', '--product', 'studio', '--part', EDIT_PART],
      { cwd: checkout, stdio: 'pipe', encoding: 'utf8' },
    );
    await page.evaluate(
      ({ checkout, part }) =>
        localStorage.setItem(
          'ethlete-studio.call-view',
          JSON.stringify({ checkout, systemProduct: 'studio', systemEntry: `sketch:${part}@edit` }),
        ),
      { checkout, part: EDIT_PART },
    );
    await page.reload();
    try {
      await page.waitForSelector('ethlete-sketches [data-sk-state]', { timeout: EDIT_WAIT_MS });
    } catch (error) {
      const shown = await page.evaluate(() => ({
        sketchView: !!document.querySelector('ethlete-sketch-view'),
        sketches: !!document.querySelector('ethlete-sketches'),
        missing: !!document.querySelector('[data-sketch-missing]'),
        entry: JSON.parse(localStorage.getItem('ethlete-studio.call-view') ?? '{}').systemEntry,
      }));
      const output = `${check.stdout ?? ''}${check.stderr ?? ''}`.trim().split('\n').slice(-6).join(' | ');

      throw new Error(
        `no edit sketch cell after ${EDIT_WAIT_MS} ms: design check exited ${check.status ?? check.signal} (${output}), sketch folder on disk: ${existsSync(join(studio, 'sketches', `${EDIT_PART.replace('/', '-')}.edit`))}, page ${JSON.stringify(shown)}: ${error.message.split('\n')[0]}`,
        { cause: error },
      );
    }
    await page.waitForFunction(
      () => document.querySelectorAll('[data-sk-variant="new"], [data-sk-variant="old"]').length > 0,
      null,
      { timeout: EDIT_WAIT_MS },
    );
    await page.waitForTimeout(SETTLE_MS);

    return page.evaluate(() => ({
      variants: [...new Set([...document.querySelectorAll('[data-sk-variant]')].map((cell) => cell.dataset.skVariant))],
      folded: !!document.querySelector('[data-sk-folded]'),
      discard: [...document.querySelectorAll('ethlete-sketches button')].some((button) =>
        button.textContent.includes('Verwerfen'),
      ),
    }));
  };
  const pick = async (variant) => {
    await listingAnswered(page);
    await page.evaluate((variant) => {
      for (const button of document.querySelectorAll('[data-sk-merge]')) {
        let row = button.parentElement;

        while (row && !/Variante \S+/.test(row.textContent)) row = row.parentElement;
        if (row?.textContent.match(/Variante (\S+)/)[1].startsWith(variant)) button.setAttribute('data-e2e-pick', '');
      }
    }, variant);
    await page.locator('[data-e2e-pick]').first().click();

    const rows = { changed: 0, outlined: 0 };

    if (variant === 'old') {
      await page.waitForFunction(() => document.querySelector('ethlete-merge li[tabindex="0"]'), null, {
        timeout: EDIT_WAIT_MS,
      });
      Object.assign(
        rows,
        await page.evaluate(() => {
          const texts = [...document.querySelectorAll('ethlete-merge li[tabindex="0"]')].map((row) =>
            [...row.querySelectorAll('*')]
              .filter((node) => node.children.length === 0)
              .map((node) => node.textContent.trim())
              .join(' '),
          );

          return { changed: texts.length, outlined: texts.filter((text) => /\b[1-9]\d* Instanz/.test(text)).length };
        }),
      );
    }

    await page.locator('ethlete-merge button[variant="filled"]').first().click();
    await page.waitForFunction(() => !document.querySelector('ethlete-sketch-view'), null, { timeout: EDIT_WAIT_MS });
    await page.waitForFunction(
      (part) =>
        [...document.querySelectorAll('iframe')].some((frame) => {
          const url = new URL(frame.src, location.href);

          return url.searchParams.get('part') === part && !url.searchParams.has('sketch');
        }),
      EDIT_PART,
      { timeout: EDIT_WAIT_MS },
    );

    const entry = await page.evaluate(
      () => JSON.parse(localStorage.getItem('ethlete-studio.call-view') ?? '{}').systemEntry,
    );

    return { ...rows, opened: entry };
  };

  try {
    return await run({ edit, pick, file, studio, git, base });
  } finally {
    rmSync(join(checkout, '.git'), { recursive: true, force: true });
    rmSync(studio, { recursive: true, force: true });
    cpSync(saved, studio, { recursive: true });
    rmSync(saved, { recursive: true, force: true });
    // The restore leaves the server's rule check cold (4 s on 2 idle cores); without this listing the next case's
    // first frame pays that full rule run inside its WAIT_MS.
    await fetch(`http://[::1]:${designPort}/__design/system`, { signal: AbortSignal.timeout(EDIT_WAIT_MS) }).then(
      (response) => response.arrayBuffer(),
    );
  }
};

const CASES = [
  {
    name: 'a visible edit of a merged design part opens its old/new sketch with nothing folded',
    listingMayPend: 'the evidence is the sketch the design check opens, which the case waits for itself',
    pages: ['System'],
    run: (page, _state, _target, { designPort }) =>
      withEditSketch(page, designPort, async ({ edit }) => {
        const shown = await edit();
        const ok = shown.variants.includes('new') && shown.variants.includes('old') && !shown.folded && !shown.discard;

        return {
          ok,
          detail: `variants ${shown.variants.join(', ')}, folded states: ${shown.folded}, Verwerfen: ${shown.discard}`,
        };
      }),
  },
  {
    name: 'picking old of an edit sketch restores the design, picking new records the edit as merged',
    listingMayPend: 'waits for the listing itself (listingAnswered) before each pick',
    ownShard: true,
    pages: ['System'],
    run: (page, _state, _target, { designPort }) =>
      withEditSketch(page, designPort, async ({ edit, pick, file, studio, git, base }) => {
        const sketchDir = join(studio, 'sketches', `${EDIT_PART.replace('/', '-')}.edit`);
        const first = await edit();

        if (!first.variants.includes('old'))
          return { ok: false, detail: `no old variant: ${first.variants.join(', ')}` };

        const oldPick = await pick('old');

        const design = readFileSync(file, 'utf8');
        const drift = git('diff', base, '--', file).toString();
        const identical = drift === '';
        const restored =
          design.includes(EDIT_LABEL.before) &&
          !design.includes(EDIT_LABEL.after) &&
          identical &&
          !existsSync(sketchDir);

        await edit();

        const newPick = await pick('new');

        const recorded = JSON.parse(readFileSync(join(studio, 'merged.json'), 'utf8'))[EDIT_PART];
        const kept = readFileSync(file, 'utf8').includes(EDIT_LABEL.after);

        const opened = [oldPick.opened, newPick.opened];

        return {
          ok:
            restored &&
            kept &&
            recorded?.variant === 'new' &&
            !existsSync(sketchDir) &&
            oldPick.changed > 0 &&
            oldPick.outlined > 0 &&
            opened.every((part) => part === EDIT_PART),
          detail: `old restored the design byte-identical to HEAD: ${restored}${drift ? ` (${drift.replace(/\s+/g, ' ')})` : ''}, new kept the edit: ${kept}, merged.json: ${JSON.stringify(recorded)}, Geändert rows of old: ${oldPick.changed} (${oldPick.outlined} with an outline), part opened after each merge: ${opened.join(', ')}`,
        };
      }),
  },
  {
    name: 'a sketch merged while its view is open opens the part view of the target',
    listingMayPend:
      'the evidence is the view leaving to the part view after the merge, which does not wait for a listing',
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
    listingMayPend:
      'the evidence is the view leaving to the part view after the discard, which does not wait for a listing',
    pages: ['Discard'],
    run: async (page, _state, target, context) => {
      const kept = await discardAsksFirst(page);

      if (!kept.ok) return kept;

      return goneSketchLeavesToThePart(page, context, target, async () => {
        await openDiscardConfirm(page);
        await page.locator('[role="alertdialog"] [data-sk-discard-confirm]').click();

        return { ok: true };
      });
    },
  },
  {
    name: 'wheel and ctrl-wheel over a frame centre move the camera',
    pages: ['System', 'Sketches', 'Inbox', 'Flow'],
    run: async (page, state, target) => {
      const selector = target.frame ?? FRAME;
      const { view } = state;
      const centreOf = (box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
      const seen = (box) => {
        const { x, y } = centreOf(box);

        return box.width > 8 && x > view.left + 4 && x < view.right - 4 && y > view.top + 4 && y < view.bottom - 4;
      };
      let boxes = await frameBoxes(page, selector);

      // A sketch mounts its frames only once the listing with its targets arrives; until then its cells show pictures.
      for (
        const until = Date.now() + WAIT_MS;
        target.name === 'Sketches' && !boxes.some((box) => box.iframe && seen(box)) && Date.now() < until;
        boxes = await frameBoxes(page, selector)
      )
        await page.waitForTimeout(250);
      const index = [boxes.findIndex((box) => box.iframe && seen(box)), boxes.findIndex(seen)].find((at) => at >= 0);

      if (index === undefined) return { ok: false, detail: 'no frame centre in view' };
      if (target.name === 'Sketches' && !boxes[index].iframe)
        return { ok: false, detail: `no iframe frame within ${WAIT_MS} ms` };

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
      const unzoomed = await stillInFit(page, 'a ctrl-wheel zoom');

      if (unzoomed) return unzoomed;

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

      await listingAnswered(page);
      await settled(page, selector);
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

        const unzoomed = await stillInFit(page, `a ctrl-wheel of ${delta}`);

        if (unzoomed) return unzoomed;

        const after = (await frameBoxes(page, selector))[index];
        const ratio = after.width / before.width;

        drifts.push(
          Math.hypot(
            after.left + (pointer.x - before.left) * ratio - pointer.x,
            after.top + (pointer.y - before.top) * ratio - pointer.y,
          ),
        );
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

              for (const row of canvas.querySelectorAll('[data-sk-row]:not([data-sk-matrix] *)')) {
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
    listingMayPend: 'waits for the listing itself (listingAnswered) before it reads the zoom chip',
    pages: ['Sketches'],
    run: async (page, state) => {
      const { view } = state;

      await listingAnswered(page);
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
      await page.waitForSelector('[data-sk-state]');
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

      const primed = entryOf(await (await page.request.get(listing, { timeout: FULL_COMPARE_MS })).json());
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
      );

      await page.reload();
      await page.waitForSelector('[data-sk-state]');
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
      await listingAnswered(page);
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
      const deadline = Date.now() + WAIT_MS;
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
    name: 'the part tree keeps its scroll position after a reload',
    listingMayPend: 'it waits up to 15 s for the restored scroll position itself',
    pages: ['System'],
    run: async (page) => {
      const scroller = () =>
        page.evaluate(() => {
          const element = document.querySelector('ethlete-part-tree')?.closest('.overflow-y-auto');

          return element
            ? { top: element.scrollTop, max: element.scrollHeight - element.clientHeight }
            : { top: -1, max: -1 };
        });

      await page.waitForSelector('ethlete-part-tree [etTreeNode]');
      const before = await scroller();

      if (before.max < 40) return { ok: false, detail: `the tree cannot scroll, scrollable ${before.max} px` };

      const target = Math.min(300, before.max);

      await page.evaluate((top) => {
        document.querySelector('ethlete-part-tree')?.closest('.overflow-y-auto')?.scrollTo({ top });
      }, target);
      await page.waitForTimeout(600);
      await page.reload();
      await page.waitForSelector('ethlete-part-tree [etTreeNode]');

      let after = await scroller();

      for (let waited = 0; waited < 15000 && Math.abs(after.top - target) > 2; waited += 250) {
        await page.waitForTimeout(250);
        after = await scroller();
      }

      return { ok: Math.abs(after.top - target) <= 2, detail: `scrolled to ${target}, ${after.top} after the reload` };
    },
  },
  {
    name: 'open points chip pressed matches its popup',
    holdListings: false,
    pages: ['System'],
    viewport: WIDE,
    run: async (page) => {
      const chip = page.locator('[data-open-points-chip]').first();
      const steps = [];

      for (let click = 1; click <= 4; click++) {
        await chip.click();
        await page.waitForTimeout(SETTLE_MS);
        if (click === 1)
          await page.locator('ethlete-build-ready-footer et-badge').first().waitFor({ timeout: COLD_START_MS });
        steps.push(
          await page.evaluate(() => ({
            pressed: document.querySelector('[data-open-points-chip]')?.getAttribute('aria-pressed') === 'true',
            open: !!document.querySelector('[role="dialog"][aria-label="Offene Punkte"]'),
            status: document.querySelector('ethlete-build-ready-footer et-badge')?.textContent?.trim() ?? null,
            go: [...document.querySelectorAll('[role="dialog"] button')].some((button) =>
              button.textContent?.includes('Go geben'),
            ),
          })),
        );
      }

      const buildReady = /^(Baubereit|Nicht baubereit \(\d+\)|Wird geprüft)$/.test(steps[0].status ?? '');
      const ok =
        buildReady &&
        !steps[0].go &&
        steps.every((step, index) => step.pressed === step.open && step.open === (index % 2 === 0));

      return {
        ok,
        detail: `${steps.map((step) => `${+step.pressed}/${+step.open}`).join(' ')} status=${steps[0].status} go=${steps[0].go}`,
      };
    },
  },
  {
    name: 'a refused check record still offers the direct edit sketch',
    listingMayPend:
      'the evidence is the footer popover, read from a faked open-points response that the listing does not gate',
    pages: ['System'],
    viewport: WIDE,
    run: async (page) => {
      await page.route('**/__design/open-points?*', (route) =>
        route.fulfill({
          json: {
            points: [{ kind: 'direct-edit', sketch: 'pages/system@edit' }],
            buildReady: {
              ready: false,
              blockers: [
                { kind: 'stale-record', text: 'no check record at the current design' },
                { kind: 'open-point', text: 'changed outside a sketch - pick old or new in sketch pages/system@edit' },
              ],
            },
          },
        }),
      );
      await page.reload();
      await page.locator('[data-open-points-chip]').first().click();

      const open = page.locator('[role="dialog"] button', { hasText: 'Sketch öffnen' });
      const status = page.locator('ethlete-build-ready-footer et-badge').first();

      await page.locator('ethlete-build-ready-footer button', { hasText: 'Gründe' }).first().click({ timeout: 20000 });
      await open.waitFor({ timeout: 5000 });
      await page.unroute('**/__design/open-points?*');

      const offered = await open.count();
      const badge = (await status.textContent().catch(() => null))?.trim() ?? null;

      return { ok: offered === 1 && badge !== 'Wird geprüft', detail: `offered=${offered} badge=${badge}` };
    },
  },
  {
    name: 'a part switch asks for its open points once',
    pages: ['System'],
    run: async (page) => {
      const asked = [];
      const log = eventLog();
      let switched = 0;
      const count = (request) => {
        if (!request.url().includes('/__design/open-points?')) return;
        asked.push(new URL(request.url()).searchParams.get('part'));
        log.add('open-points request', request.url(), `switch ${switched}`);
      };
      const leaves = page.locator('[role="treeitem"][data-kind="leaf"]:not([data-selected])');

      if ((await leaves.count()) < 1) return { ok: false, detail: 'no other part in the tree' };

      page.on('request', count);

      const counts = [];

      for (let step = 0; step < 2; step++) {
        asked.length = 0;
        switched = step + 1;
        log.add('switch', `leaf ${step}`);
        await leaves.nth(step).click();
        await page.waitForTimeout(2500);
        counts.push([...asked]);
      }

      page.off('request', count);

      const ok = counts.every((parts) => parts.length === 1);

      return {
        ok,
        detail: `${counts.map((parts) => `${parts.length} (${parts.join(', ')})`).join(' / ')}${ok ? '' : await log.lines()}`,
      };
    },
  },
  {
    name: 'a part shown before paints every stored picture in the first frame',
    quiet: true,
    delayPictures: false,
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
      const log = eventLog();
      const shotKey = (url) => unranked(eventUrl(new URL(url, 'http://host').href));
      const onShot = (kind) => (request) => {
        if (!request.url().includes('/__design/shot?')) return;
        log.add(
          kind,
          request.url(),
          kind === 'shot failed'
            ? request.failure()?.errorText
            : kind === 'shot request'
              ? ''
              : `${request.timing().responseEnd >= 0 ? Math.round(request.timing().responseEnd) : '-'} ms response end`,
        );
      };
      const listeners = {
        request: onShot('shot request'),
        requestfinished: onShot('shot done'),
        requestfailed: onShot('shot failed'),
      };

      Object.entries(listeners).forEach(([event, listener]) => page.on(event, listener));

      try {
        await open(first);
        const seen = new Set((await loadAll()).filter((picture) => picture.loaded).map(({ src }) => unranked(src)));

        log.add('open', second);
        await open(second);
        await loadAll();

        log.add('back to', first);
        const back = await firstPaint(first);
        const stored = back.shown.filter(({ src }) => seen.has(unranked(src)));
        const empty = stored.filter((picture) => !picture.loaded);
        const ok = seen.size > 0 && stored.length > 0 && empty.length === 0;

        empty.forEach((picture) => log.add('not painted', picture.src, `first paint rAF ${back.frames}`));

        const emptyKeys = new Set(empty.map(({ src }) => shotKey(src)));

        return {
          ok,
          detail: `${first} <- ${second}: ${stored.length - empty.length}/${stored.length} stored pictures painted in rAF ${back.frames} (+${Math.round(back.ms)} ms), ${seen.size} seen${ok ? '' : await log.lines((event) => !event.subject.includes('/__design/shot?') || emptyKeys.has(shotKey(event.subject)))}`,
        };
      } finally {
        Object.entries(listeners).forEach(([event, listener]) => page.off(event, listener));
      }
    },
  },
  {
    name: 'a part edited on disk while away shows its new picture on return',
    listingMayPend: 'the evidence is the part picture tag, read through shot requests that the listing does not gate',
    delayPictures: false,
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
      const shownUntil = async (accept, wait) => {
        for (const until = Date.now() + wait; Date.now() < until;) {
          await page.waitForTimeout(250);
          const shown = await pictures();

          if (shown.length > 0 && accept(shown)) return shown;
        }

        return null;
      };
      const loaded = (accept, wait = WAIT_MS) =>
        shownUntil((shown) => shown.every((picture) => picture.loaded) && accept(shown), wait);
      const tagsOf = (shown) =>
        Promise.all(
          shown.map(({ src }) =>
            page.request.get(src, { timeout: WAIT_MS }).then((answer) => answer.headers()['etag']),
          ),
        );
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
        const returned = Date.now();
        const renewed = await shownUntil((shown) => shown.some(({ src }) => !seen.has(src)), WAIT_MS);

        if (!renewed)
          return { ok: false, detail: `no new picture URL within ${WAIT_MS} ms (${before.length} pictures)` };

        const renewedMs = Date.now() - returned;
        const after = await loaded((shown) => shown.some(({ src }) => !seen.has(src)), FULL_COMPARE_MS);

        if (!after) {
          const last = await pictures();

          return {
            ok: false,
            detail: `new picture URL at ${renewedMs} ms, but ${last.filter((picture) => !picture.loaded).length}/${last.length} pictures not drawn within ${FULL_COMPARE_MS} ms`,
          };
        }

        const drawnMs = Date.now() - returned;
        const changed = (await tagsOf(after)).filter((tag) => !tags.has(tag));

        return {
          ok: changed.length > 0,
          detail: `${changed.length}/${after.length} pictures changed after the edit, new URL at ${renewedMs} ms, drawn at ${drawnMs} ms`,
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
      let reread = 0;

      await showAllStates(page);

      let first = await sketchCells(page);

      for (const until = Date.now() + WAIT_MS; Date.now() < until; first = await sketchCells(page)) {
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

            reread += cells.filter((cell) => cell.gone).length;
            counts.push(`${empty.length}/${visible.length}`);
            empties.push(
              ...empty.map(
                (cell) =>
                  `${name}${step}+${at} ${cell.key}${cell.framed ? ` (iframe: ${cell.probe})` : ''}${cell.gone ? ` (${cell.gone})` : ''}`,
              ),
            );
            note(cells);
          }
          steps.push(`${name}${step} ${counts.join(' ')}`);
        }
      }

      return {
        ok: empties.length === 0,
        detail: `empty/visible cells per step at +${SCROLL_SAMPLES_MS.join(' +')} ms: ${steps.join(', ')}; frames gone before their probe: ${reread}${empties.length ? `; first: ${empties.slice(0, 6).join(' | ')}` : ''}`,
      };
    },
  },
  {
    name: 'B498 R3: scroll, edit and wait never leave a sketch cell or column empty',
    proof: 'B498',
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const had = new Set();
      const empties = new Map();
      const mounted = new Set();
      const left = new Map();
      const sample = async (phase) => {
        const cells = await sketchCells(page);
        const keys = new Set(cells.map((cell) => cell.key));
        const stateOf = (key) => key.slice(key.indexOf(' ') + 1);
        const grouped = await page.evaluate(() =>
          [...document.querySelectorAll('ethlete-sketch-view [data-sk-crop-count]')]
            .map((count) => Number.parseInt(count.textContent ?? '', 10) - 1)
            .filter((extra) => extra > 0)
            .reduce((sum, extra) => sum + extra, 0),
        );
        const covered = new Set([...keys].map(stateOf)).size + grouped;

        if (covered < new Set([...mounted].map(stateOf)).size)
          for (const key of mounted)
            if (!keys.has(key) && !left.has(key)) left.set(key, `${phase} (${keys.size} of ${mounted.size} cells)`);
        if (phase === 'start') for (const key of keys) mounted.add(key);

        for (const cell of cells.filter((each) => each.visible)) {
          if (cell.shows) had.add(cell.key);
          else if (had.has(cell.key) && !empties.has(`${phase} ${cell.key}`))
            empties.set(`${phase} ${cell.key}`, cell.framed ? `iframe ${cell.probe}` : 'no picture');
        }

        return cells;
      };
      const scrollThrough = async (phase, steps) => {
        for (const [name, by] of [
          ['down', SCROLL_STEP_PX],
          ['up', -SCROLL_STEP_PX],
        ])
          for (let step = 1; step <= steps; step++) {
            await wheelCanvas(page, by);
            for (const at of SCROLL_SAMPLES_MS) {
              await page.waitForTimeout(at);
              await sample(`${phase} ${name}${step}+${at}`);
            }
          }
      };
      const urlsOutside = (cells, variant) =>
        new Map(cells.filter((cell) => !cell.key.startsWith(`${variant} `)).map((cell) => [cell.key, cell.pictureSrc]));
      const emptyColumns = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('ethlete-sketch-view [data-sk-variant]')]
            .filter((row) => !row.querySelector('[data-shot]'))
            .map((row) => row.getAttribute('data-sk-variant')),
        );

      await showAllStates(page);

      let first = await sample('start');

      for (const until = Date.now() + FULL_COMPARE_MS; Date.now() < until; first = await sample('start')) {
        const visible = first.filter((cell) => cell.visible);

        if (visible.length > 0 && visible.every((cell) => cell.shows)) break;
        await page.waitForTimeout(250);
      }
      if (had.size === 0) return { ok: false, detail: 'no visible cell shows a picture or a drawn frame' };

      const steps = Math.max(3, Math.ceil(Math.max(...first.map((cell) => cell.below)) / SCROLL_STEP_PX));

      await scrollThrough('scroll', steps);

      const stylesheet = join(checkout, '.ethlete/design/studio', SKETCH_CSS.a);
      const original = readFileSync(stylesheet, 'utf8');
      const before = urlsOutside(await sketchCells(page), 'a');
      let renewed;

      try {
        await page.route(SHOT_URL, async (route) => {
          await new Promise((done) => setTimeout(done, EDITED_SHOT_DELAY_MS));
          await route.fallback().catch(() => undefined);
        });
        writeFileSync(
          stylesheet,
          `${original}\n.st-shell { outline: 3px solid rgb(255 0 0); outline-offset: -3px; }\n`,
        );
        for (const until = Date.now() + WAIT_MS; Date.now() < until;) {
          await sample('edit');
          await page.waitForTimeout(100);
        }
        await scrollThrough('edited scroll', steps);
        for (const until = Date.now() + WAIT_MS; Date.now() < until;) {
          await sample('wait');
          await page.waitForTimeout(250);
        }
        renewed = [...urlsOutside(await sketchCells(page), 'a')].filter(
          ([key, src]) => before.has(key) && before.get(key) && src && before.get(key) !== src,
        );
      } finally {
        writeFileSync(stylesheet, original);
        await page.unroute(SHOT_URL);
      }

      const columns = await emptyColumns();
      const faults = [
        ...(empties.size
          ? [
              `${empties.size} empty samples of cells that had a picture: ${[...empties]
                .slice(0, 8)
                .map(([at, why]) => `${at} (${why})`)
                .join(' | ')}`,
            ]
          : []),
        ...(renewed.length
          ? [
              `an edit of variant a renewed ${renewed.length} picture URLs of other rows: ${renewed
                .slice(0, 3)
                .map(([key]) => key)
                .join(', ')}`,
            ]
          : []),
        ...(columns.length ? [`columns with no cell: ${columns.join(', ')}`] : []),
        ...(left.size
          ? [
              `${left.size} of ${mounted.size} cells left the DOM: ${[...left]
                .slice(0, 4)
                .map(([key, at]) => `${key} at ${at}`)
                .join(' | ')}`,
            ]
          : []),
      ];

      return {
        ok: faults.length === 0,
        detail: faults.length
          ? faults.join('; ')
          : `${had.size} of ${mounted.size} cells kept their picture through ${steps} scroll steps, an edit and a wait`,
      };
    },
  },
  {
    name: 'a sketch opens with one /__design/system request until its first cell',
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const asked = [];
      const count = (request) => {
        if (new URL(request.url()).pathname === '/__design/system') asked.push(request.url());
      };

      page.on('request', count);
      try {
        await page.reload();
        await page.waitForSelector('ethlete-sketch-view [data-shot]');
      } finally {
        page.off('request', count);
      }
      await listingAnswered(page);

      return {
        ok: asked.length === 1,
        detail: `${asked.length} /__design/system request(s) until the first cell${asked.length > 1 ? `: ${asked.join(' | ')}` : ''}`,
      };
    },
  },
  {
    name: 'a sketch first paints the frame count it settles on',
    pages: ['Sketches'],
    labels: ['Large'],
    open: 'B345: the first paint draws every state until the quick listing folds them',
    run: async (page) => {
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          const shots = document.querySelectorAll('ethlete-sketch-view [data-shot]').length;

          if (!shots) return;
          window.__firstSketchShots = shots;
          observer.disconnect();
        });

        observer.observe(document, { childList: true, subtree: true });
      });
      await page.reload();
      await page.waitForFunction(() => window.__firstSketchShots > 0);
      await listingAnswered(page);

      const [first, settled] = await page.evaluate(() => [
        window.__firstSketchShots,
        document.querySelectorAll('ethlete-sketch-view [data-shot]').length,
      ]);

      return {
        ok: first === settled,
        detail:
          first === settled
            ? `${first} frames from the first paint on`
            : `${first} frames at the first paint, ${settled} once settled`,
      };
    },
  },
  {
    name: 'a sketch keeps its frame count and pictures through a sketch edit',
    holdListings: false,
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const count = () => page.evaluate(() => document.querySelectorAll('ethlete-sketch-view [data-shot]').length);
      const shown = (cells) => new Set(cells.filter((cell) => cell.visible && cell.shows).map((cell) => cell.key));
      const faults = [];

      await page.reload();
      await page.waitForSelector('ethlete-sketch-view [data-shot]');
      await listingAnswered(page);
      await showAllStates(page);
      const settledCount = await count();
      const edited = (keys) => [...keys].some((key) => key.startsWith('a '));
      let pictured = shown(await sketchCells(page));

      for (const until = Date.now() + WAIT_MS; !edited(pictured) && Date.now() < until;) {
        await page.waitForTimeout(250);
        pictured = shown(await sketchCells(page));
      }

      if (!edited(pictured)) return { ok: false, detail: 'no visible cell of variant a shows a picture' };

      const stylesheet = join(checkout, '.ethlete/design/studio', SKETCH_CSS.a);
      const original = readFileSync(stylesheet, 'utf8');
      const counts = new Set();
      const lost = new Set();
      const log = eventLog();
      const onListing = (response) => {
        if (response.url().includes('/__design/sketches?')) log.add('listing', response.url(), `${response.status()}`);
      };
      let lastCount = settledCount;

      page.on('response', onListing);
      try {
        log.restart();
        writeFileSync(stylesheet, `${original}\n.st-shell { outline: 1px solid rgb(255 0 0); }\n`);
        for (const until = Date.now() + WAIT_MS; Date.now() < until;) {
          const cells = await sketchCells(page);

          if (cells.length !== lastCount) log.add('frame count', `${lastCount} -> ${cells.length}`);
          lastCount = cells.length;
          counts.add(cells.length);
          cells
            .filter((cell) => cell.visible && !cell.shows && pictured.has(cell.key) && !lost.has(cell.key))
            .forEach((cell) => {
              lost.add(cell.key);
              log.add('lost picture', cell.key);
            });
          await page.waitForTimeout(100);
        }
      } finally {
        page.off('response', onListing);
        writeFileSync(stylesheet, original);
      }

      const drifted = [...counts].filter((seen) => seen !== settledCount);

      if (drifted.length) faults.push(`after the edit the frame count went ${settledCount} -> ${drifted.join(', ')}`);
      if (lost.size)
        faults.push(`after the edit ${lost.size} cells lost their picture: ${[...lost].slice(0, 4).join(', ')}`);

      return {
        ok: faults.length === 0,
        detail: faults.length
          ? `${faults.join('; ')}${await log.lines()}`
          : `${settledCount} frames through the edit, ${pictured.size} pictures kept`,
      };
    },
  },
  {
    name: 'a sketch cell edited on disk while scrolled away shows its new picture on return',
    listingMayPend: 'the evidence is the cell picture tag, read through shot requests that the listing does not gate',
    delayPictures: false,
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const cellOf = async (key) => (await sketchCells(page)).find((cell) => cell.key === key);
      const away = Math.ceil((2 * (NARROW.height + 400)) / SCROLL_STEP_PX);
      const loadedCell = async (key, accept, wait = WAIT_MS) => {
        for (const until = Date.now() + wait; Date.now() < until;) {
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
      const tagOf = async (src) => (await page.request.get(src, { timeout: WAIT_MS })).headers()['etag'];

      await showAllStates(page);
      await page.waitForTimeout(PAGE_SWITCH_SETTLE_MS);
      const top = (await sketchCells(page)).filter((cell) => cell.visible).sort((a, b) => a.top - b.top)[0];

      if (!top) return { ok: false, detail: 'no visible sketch cell' };

      const before = await loadedCell(top.key, () => true, FULL_COMPARE_MS);

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

        const returned = Date.now();
        const renewed = (cell) => !!cell?.pictureSrc && cell.pictureSrc !== before.pictureSrc;
        let cell = await cellOf(top.key);

        for (const until = returned + WAIT_MS; !renewed(cell) && Date.now() < until; cell = await cellOf(top.key))
          await page.waitForTimeout(250);

        if (!renewed(cell))
          return { ok: false, detail: `${top.key} kept its old picture URL for ${WAIT_MS} ms after the edit` };

        const renewedMs = Date.now() - returned;
        const after = await loadedCell(top.key, renewed, FULL_COMPARE_MS);

        if (!after)
          return {
            ok: false,
            detail: `${top.key}: new picture URL at ${renewedMs} ms, but not drawn within ${FULL_COMPARE_MS} ms`,
          };

        const drawnMs = Date.now() - returned;
        const newTag = await tagOf(after.pictureSrc);

        return {
          ok: newTag !== tag,
          detail: `${top.key}: new picture URL at ${renewedMs} ms, drawn at ${drawnMs} ms, ETag ${newTag === tag ? 'unchanged' : 'changed'}`,
        };
      } finally {
        writeFileSync(stylesheet, original);
      }
    },
  },
  {
    name: 'page switch time is logged to the design timings',
    quiet: true,
    perf: true,
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
      const requests = new Map();
      const inFlight = new Map();
      const onRequest = (request) => {
        inFlight.set(request, { url: request.url(), sentAt: Date.now() });
        if (request.url().includes('part=')) requests.set(request.url(), { sentAt: Date.now() });
      };
      const inFlightOf = (clickedAt) => {
        const open = [...inFlight.values()].filter(({ url }) => !url.includes('/__design/shot?'));

        return `\n  in flight at the window end: ${inFlight.size - open.length} picture(s), ${open.length} other${open
          .slice(0, 12)
          .map(({ url, sentAt }) => `\n    ${eventUrl(url).slice(0, 90)} sent +${Math.round(sentAt - clickedAt)}`)
          .join('')}`;
      };
      const onRequestDone = async (request) => {
        inFlight.delete(request);
        const sent = requests.get(request.url());

        if (!sent) return;
        const response = await request.response().catch(() => null);

        const { startTime, requestStart, responseStart } = request.timing();

        Object.assign(sent, {
          endAt: Date.now(),
          onWire: requestStart >= 0 ? startTime + requestStart : undefined,
          firstByte: responseStart >= 0 ? startTime + responseStart : undefined,
          answer: request.failure()?.errorText ?? `status ${response?.status() ?? '-'}`,
        });
      };
      const requestOf = (url, clickedAt) => {
        const sent = requests.get(url);
        const since = (at) => Math.round(at - clickedAt);

        if (!sent) return 'not sent';

        const wire =
          sent.onWire === undefined
            ? ''
            : `, on the wire +${since(sent.onWire)}, first byte ${sent.firstByte === undefined ? '-' : `+${since(sent.firstByte)}`}`;

        return `sent +${since(sent.sentAt)}${wire}, ${sent.endAt ? `${sent.answer} +${since(sent.endAt)}` : 'not answered'}`;
      };
      const switchTo = (part) =>
        page.evaluate(
          ({ part, timeoutMs }) =>
            new Promise((resolveSwitch) => {
              const heard = new Map();
              const loadedAt = new Map();
              const onMessage = (event) => {
                const type = String(event.data?.type ?? '').replace('design-explore:', '');

                if (!type || !event.source) return;
                heard.set(event.source, [...(heard.get(event.source) ?? []), type]);
              };
              const onLoad = (event) => {
                if (event.target instanceof HTMLIFrameElement && !loadedAt.has(event.target))
                  loadedAt.set(event.target, Math.round(performance.now() - started));
              };
              const done = (result) => {
                window.removeEventListener('message', onMessage);
                document.removeEventListener('load', onLoad, true);
                resolveSwitch(result);
              };

              window.addEventListener('message', onMessage);
              document.addEventListener('load', onLoad, true);

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
              const paintedAt = new Map();
              const sourceOf = (frame) => {
                const iframe = frame.querySelector('iframe');
                const img = shotsOf(frame)[0];

                if (iframe)
                  return {
                    src: iframe.getAttribute('src') ?? 'iframe without src',
                    state: [...iframe.classList].includes('opacity-0') ? 'iframe opacity-0' : 'iframe shown',
                  };
                if (img)
                  return {
                    src: img.getAttribute('src'),
                    state: `img complete ${img.complete}, width ${img.naturalWidth}${img.matches('.opacity-0') ? ', opacity-0' : ''}`,
                  };

                return { src: 'no iframe or picture', state: '' };
              };
              const sample = () => {
                const now = performance.now() - started;
                const frames = [...document.querySelectorAll('ethlete-canvas-frame')].filter(
                  (frame) =>
                    !before.has(frame) || shotsOf(frame).some((img) => img.getAttribute('src').includes(marker)),
                );
                const painted = frames.filter(isPainted);

                painted.forEach((frame) => paintedAt.has(frame) || paintedAt.set(frame, now));
                if (frames.length > 0) times.mounted ??= now;
                if (painted.length > 0) times.first ??= now;
                if (frames.length > 0 && painted.length === frames.length) {
                  done({ ...times, all: now, frames: frames.length, clickedAt: performance.timeOrigin + started });
                } else if (now > timeoutMs) {
                  const marked = [...document.querySelectorAll('img, iframe')].filter((node) =>
                    (node.getAttribute('src') ?? '').includes(marker),
                  );
                  const shown = (node) =>
                    node.localName === 'iframe'
                      ? !node.matches('.opacity-0')
                      : node.complete && node.naturalWidth > 0 && !node.matches('.opacity-0');
                  const unpainted = marked
                    .filter((node) => !shown(node))
                    .map((node) => {
                      const src = new URL(node.src, location.href);
                      const { top, left, bottom, right } = node.getBoundingClientRect();
                      const frame = node.closest('ethlete-canvas-frame');
                      const cell = node.closest('[data-cell-id]');

                      return {
                        url: src.href,
                        tag: node.localName,
                        part: src.searchParams.get('part'),
                        state: src.searchParams.get('state') ?? cell?.getAttribute('data-cell-id') ?? '-',
                        opacity: node.matches('.opacity-0') ? 'opacity-0' : 'shown',
                        img: node.localName === 'img' ? `complete ${node.complete}, width ${node.naturalWidth}` : '',
                        iframe:
                          node.localName === 'iframe'
                            ? `load ${loadedAt.get(node) ?? 'none'}, posted ${heard.get(node.contentWindow)?.join('+') || 'none'}`
                            : '',
                        inViewport: bottom > 0 && right > 0 && top < innerHeight && left < innerWidth,
                        live: frame?.getAttribute('data-live') ?? '-',
                        framePainted: frame ? isPainted(frame) : false,
                      };
                    });
                  const chain = [];

                  for (let node = marked[0]?.parentElement; node; node = node.parentElement) {
                    if (node.localName.startsWith('ethlete-')) chain.push(node.localName);
                  }

                  done({
                    ...times,
                    dom: `${marked.length} marked img/iframe, ${document.querySelectorAll('ethlete-canvas-frame').length} canvas frames, first in ${chain.slice(0, 6).join('<')}; shots ${[...document.querySelectorAll('img[src*="/__design/shot?"]')].map((img) => new URL(img.src).searchParams.get('part')).slice(0, 3)}; ${[...document.querySelectorAll('[role="treeitem"]')].filter((row) => row.textContent.trim() === part.split('/')[1]).map((row) => `leaf ${row.dataset.kind}${row.hasAttribute('data-selected') ? ' selected' : ''}`)}; views ${[...new Set([...document.querySelectorAll('[class*="view"], ethlete-system-view *')].map((node) => node.localName).filter((tag) => tag.startsWith('ethlete-')))].slice(0, 25)}`,
                    frames: frames.length,
                    painted: painted.length,
                    frameEvents: frames.map((frame) => ({
                      ms: paintedAt.get(frame) ?? now,
                      painted: paintedAt.has(frame),
                      ...sourceOf(frame),
                    })),
                    unpainted,
                    clickedAt: performance.timeOrigin + started,
                  });
                } else requestAnimationFrame(sample);
              };

              leaf.click();
              requestAnimationFrame(sample);
            }),
          { part, timeoutMs: WAIT_MS },
        );
      const rows = [];
      const seen = new Set(['pages/system']);
      let from = 'pages/system';

      page.on('requestfinished', onShot);
      page.on('request', onRequest);
      page.on('requestfinished', onRequestDone);
      page.on('requestfailed', onRequestDone);

      try {
        for (const to of PAGE_SWITCHES) {
          const firstShot = shots.length;
          const result = await switchTo(to);
          const flying = result.all === undefined ? inFlightOf(result.clickedAt) : '';

          if (result.error) return { ok: false, detail: result.error };
          await page.waitForTimeout(PAGE_SWITCH_SETTLE_MS);

          const marker = `part=${encodeURIComponent(to)}&`;
          const asked = shots
            .slice(firstShot)
            .filter((shot) => shot.url.includes(marker))
            .map(({ url, finishedAt, timing, source }) => ({
              url,
              ms: Math.round(finishedAt - result.clickedAt),
              wait: Math.round(timing.responseStart - timing.requestStart),
              source,
            }));
          const painted = result.all !== undefined;
          const ms = result.all ?? WAIT_MS;
          const mounted = result.mounted ?? ms;
          const log = eventLog(result.clickedAt);

          (result.frameEvents ?? []).forEach((frame) =>
            log.add(frame.painted ? 'painted' : 'not painted', frame.src, frame.state, result.clickedAt + frame.ms),
          );
          asked.forEach((shot) =>
            log.add('shot finished', shot.url, `${shot.source}, wait ${shot.wait} ms`, result.clickedAt + shot.ms),
          );

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
            events: painted
              ? ''
              : `${await log.lines()}${(result.unpainted ?? [])
                  .map(
                    (cell) =>
                      `\n  unpainted ${cell.tag} ${cell.state} ${eventUrl(cell.url).slice(0, 90)}: ${cell.opacity}, ${cell.img || cell.iframe}, request ${requestOf(cell.url, result.clickedAt)}, ${cell.inViewport ? 'in' : 'out of'} viewport, live ${cell.live}, frame ${cell.framePainted ? 'painted' : 'not painted'}`,
                  )
                  .join('')}${flying}`,
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
        page.off('request', onRequest);
        page.off('requestfinished', onRequestDone);
        page.off('requestfailed', onRequestDone);
      }

      const round = (ms) => (ms === undefined ? '-' : Math.round(ms));
      const detail = rows
        .map(
          (row) =>
            `${row.from.split('/')[1]}->${row.to.split('/')[1]} ${row.seen ? 'seen' : 'first'}: mount ${round(row.mounted)}, first ${round(row.first)}, all ${row.painted ? round(row.ms) : `NOT (${row.paintedFrames} painted; ${row.dom})`} ms (${row.frames} frames; ${row.asked.length} shots${row.asked.length ? ` ${row.asked.map((shot) => `${shot.source} +${shot.ms}/${shot.wait}`).join(' ')}` : ''})${row.events}`,
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
      const clicked = await focusUntil(page, (ring) => ring.focused);
      if (!clicked.focused) return { ok: false, detail: `the click left focus on ${clicked.active}` };
      await page.keyboard.press('Shift+Tab');
      const left = await focusUntil(page, (ring) => !ring.focused);
      if (left.focused) return { ok: false, detail: 'Shift+Tab kept focus on the canvas' };
      await page.keyboard.press('Tab');
      const ring = await focusUntil(page, (ring) => ring.focused && ring.rings.length > 0);

      return {
        ok: ring.focused && ring.rings.length > 0,
        detail: `focused=${ring.focused} rings=[${ring.rings}] active=${ring.active}`,
      };
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
    quiet: true,
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
              const seen = (color) =>
                color !== 'transparent' && !/^rgba\(.*,\s*0(\.0*)?\)$|\/\s*0(\.0*)?\)$/.test(color);
              const line = (name, lineStyle, width, color) =>
                lineStyle !== 'none' && lineStyle !== 'hidden' && parseFloat(width) > 0 && seen(color)
                  ? [`${name} ${lineStyle} ${width} ${color}`]
                  : [];
              const shadows =
                style.boxShadow === 'none'
                  ? []
                  : style.boxShadow.split(/,(?![^(]*\))/).filter((shadow) => {
                      const color = shadow.match(/[a-z-]+\([^)]*\)|transparent/)?.[0] ?? 'currentcolor';

                      return seen(color) && (shadow.match(/-?[\d.]+px/g) ?? []).some((length) => parseFloat(length));
                    });
              const visible = [
                ...line('outline', style.outlineStyle, style.outlineWidth, style.outlineColor),
                ...(shadows.length ? [`shadow ${shadows.join(',')}`] : []),
                ...['top', 'right', 'bottom', 'left'].flatMap((side) =>
                  line(
                    `border-${side}`,
                    style.getPropertyValue(`border-${side}-style`),
                    style.getPropertyValue(`border-${side}-width`),
                    style.getPropertyValue(`border-${side}-color`),
                  ),
                ),
              ];
              const marks = [...element.attributes].flatMap((attribute) =>
                attribute.name.startsWith('data-') ? [attribute.name] : [],
              );

              edges[ids.get(element)] = visible.length ? `${element.localName}[${marks}] ${visible.join(' | ')}` : '';
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
        edge === (before[id] ?? '') ? [] : [`${before[id] || 'no edge'} -> ${edge || 'no edge'}`],
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
      await listingAnswered(page);
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
    name: 'the canvas runs under the open panel, clipped only at the window edge',
    pages: ['System', 'Sketches'],
    run: async (page, state) => {
      if (!state.empty) return { ok: false, detail: 'no empty point' };
      const first = await underPanel(page);

      if (!first) return { ok: false, detail: 'no open panel' };
      await page.mouse.click(state.empty.x, state.empty.y);
      let after = first;

      for (let press = 0; press < 30 && !after.straddling; press++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(120);
        after = await underPanel(page);
      }
      await settle(page);
      after = await underPanel(page);

      const { clip, panel, window: right, straddling } = after;
      const faults = [
        ...(clip.left <= panel.left + 1
          ? []
          : [`the canvas clip starts at ${clip.left}, right of the panel at ${panel.left}`]),
        ...(Math.abs(clip.right - right) <= 1
          ? []
          : [`the canvas clip ends at ${clip.right}, not the window edge ${right}`]),
        ...(straddling
          ? straddling.hit
            ? []
            : [`at ${panel.right + 2},${straddling.y} the frame across the panel edge is hidden by ${straddling.by}`]
          : ['no frame reached the panel edge']),
      ];

      return {
        ok: faults.length === 0,
        detail: faults.join('; ') || `clip ${clip.left}..${clip.right}, panel ${panel.left}..${panel.right}`,
      };
    },
  },
  {
    name: 'the sketch view at 30 % and 100 % draws no failed picture and a readable head at both zooms',
    listingMayPend: 'waits for the listing itself (listingAnswered) before it reads heads and pictures',
    pages: ['Sketches', 'Wide'],
    run: async (page, _state, target) => {
      await listingAnswered(page);
      const faults = [];

      try {
        for (const [label, outSteps, heads, refused] of [
          ['100 %', 0, true, false],
          ['30 %', 3, true, false],
          ['30 %, pictures refused', 3, true, true],
        ]) {
          if (refused) {
            await page.route('**/__design/shot?**', (route) => route.fulfill({ status: 404, body: '' }));
            await page.reload();
            await page.waitForFunction(
              () =>
                [...document.querySelectorAll('img[data-shot-picture]')].some(
                  (picture) => picture.complete && picture.naturalWidth === 0,
                ),
              null,
            );
          }
          await page.getByRole('button', { name: 'Auf 100 % zoomen' }).first().click();
          for (let step = 0; step < outSteps; step++)
            await page.getByRole('button', { name: 'Verkleinern' }).first().click();
          await settle(page);
          await settled(page, FRAME);
          if (process.env['STUDIO_E2E_SHOTS'])
            await page.screenshot({
              path: join(
                process.env['STUDIO_E2E_SHOTS'],
                `${target.label ?? target.name}-${label.replace(/\W+/g, '-')}.png`,
              ),
            });

          faults.push(
            ...(await page.evaluate(
              ({ label, heads }) => {
                const viewport = document.querySelector('ethlete-sketches ethlete-canvas-viewport');
                const view = viewport.getBoundingClientRect();
                const inView = (box) =>
                  box.width > 0 &&
                  box.height > 0 &&
                  box.right > view.left &&
                  box.left < view.right &&
                  box.bottom > view.top &&
                  box.top < view.bottom;
                const paints = (element) => {
                  const style = getComputedStyle(element);

                  return (
                    style.visibility !== 'hidden' && style.color !== 'rgba(0, 0, 0, 0)' && Number(style.opacity) > 0
                  );
                };
                const visibleContent = (box) => {
                  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);

                  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
                    const rect = element.getBoundingClientRect();

                    if (rect.width === 0 || rect.height === 0 || !paints(element)) continue;
                    if (
                      node.nodeType === Node.TEXT_NODE ? node.textContent.trim() : element.matches('svg, img, button')
                    )
                      return true;
                  }

                  return false;
                };
                const found = [];

                for (const section of heads ? viewport.querySelectorAll('[data-sk-row]') : []) {
                  const head = section.closest('[data-sk-matrix]') ? section : section.firstElementChild;
                  const box = head.getBoundingClientRect();

                  if (inView(box) && box.height > 8 && !visibleContent(head))
                    found.push(
                      `${label}: head of ${section.dataset['skRow']} is an empty ${Math.round(box.width)}x${Math.round(box.height)} box`,
                    );
                }

                const tags = [...viewport.querySelectorAll('[data-sk-head-tag]')].filter(
                  (tag) => inView(tag.getBoundingClientRect()) && paints(tag),
                );
                const small = tags.find((tag) => parseFloat(getComputedStyle(tag).fontSize) < 9);

                const collapsed = !!viewport.querySelector('[data-sk-head-hidden]');

                if (collapsed && tags.length === 0) found.push(`${label}: heads collapsed but no head tag in view`);
                if (label.startsWith('100') && tags.length > 0)
                  found.push(`${label}: head tag shows beside the full head`);
                if (small) found.push(`${label}: head tag text is ${getComputedStyle(small).fontSize}`);

                for (const picture of viewport.querySelectorAll('img[data-shot-picture]')) {
                  if (
                    inView(picture.getBoundingClientRect()) &&
                    paints(picture) &&
                    picture.complete &&
                    picture.naturalWidth === 0
                  )
                    found.push(`${label}: picture ${picture.alt} failed and shows its alt text`);
                }

                return found;
              },
              { label, heads },
            )),
          );
        }
      } finally {
        await page.unroute('**/__design/shot?**');
      }

      return {
        ok: faults.length === 0,
        detail:
          faults.slice(0, 4).join('; ') ||
          'heads and tags at 30 % and 100 %, pictures at both, refused pictures hidden',
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

            return rect && origin ? { x: rect.left, y: rect.top, canvasLeft: origin.left } : null;
          },
          { CANVAS, FRAME },
        );
      const head = page.getByText('Aktuell', { exact: true });
      const headOffset = async (frame) => ((await head.count()) ? (await head.first().boundingBox()).x - frame.x : 0);
      // Sketches' Fit is sticky and re-fits to the wider canvas, so the case holds a fixed zoom. 100 % stays Fit where
      // the content fits at 100 %, so the case zooms in past any fit.
      if (target.name === 'Sketches') {
        await page.getByRole('button', { name: 'Vergrößern' }).first().click();
        await settle(page);
      }

      const unzoomed = await stillInFit(page, 'Vergrößern');

      if (unzoomed) return unzoomed;

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
        near(frameAfter.x, frameBefore.x) &&
        near(frameAfter.y, frameBefore.y) &&
        near(after.camera.zoom * 1000, before.camera.zoom * 1000) &&
        near(headAfter, headBefore);

      return {
        ok: kept,
        detail: `${describe(before, after)} frame ${frameBefore?.x},${frameBefore?.y} -> ${frameAfter?.x},${frameAfter?.y}, canvas left ${frameBefore?.canvasLeft} -> ${frameAfter?.canvasLeft}, head-frame ${headBefore} -> ${headAfter}`,
      };
    },
  },
  {
    name: 'hiding the panel at a panned and zoomed camera keeps the frames on screen',
    pages: ['System', 'Sketches', 'Flow'],
    run: async (page) => {
      const screenRect = () =>
        page.evaluate(
          ({ CANVAS, FRAME }) => {
            const canvas = [...document.querySelectorAll(CANVAS)].sort(
              (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
            )[0];
            const rect = canvas?.querySelector(`${FRAME}, figure`)?.getBoundingClientRect();

            return rect
              ? { left: rect.left, top: rect.top, width: rect.width, canvasLeft: canvas.getBoundingClientRect().left }
              : null;
          },
          { CANVAS, FRAME },
        );
      const canvasBox = await page.locator(CANVAS).evaluateAll((all) => {
        const widest = all.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        const box = widest.getBoundingClientRect();

        return { x: box.right - box.width / 4, y: box.top + box.height / 2 };
      });

      await page.mouse.move(canvasBox.x, canvasBox.y);
      await page.mouse.wheel(60, 90);
      await settle(page);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -120);
      await page.keyboard.up('Control');
      await settle(page);

      const unzoomed = await stillInFit(page, 'a ctrl-wheel zoom');

      if (unzoomed) return unzoomed;

      const before = await screenRect();
      const cameraBefore = await probe(page);

      await page.getByRole('button', { name: 'Hide panel' }).first().click();
      await settle(page);
      const after = await screenRect();
      const cameraAfter = await probe(page);
      const kept =
        !!before &&
        !!after &&
        Math.abs(after.left - before.left) <= 1 &&
        Math.abs(after.top - before.top) <= 1 &&
        Math.abs(after.width - before.width) <= 1;

      return {
        ok: kept,
        detail: `${describe(cameraBefore, cameraAfter)} frame ${before?.left},${before?.top} w ${before?.width} -> ${after?.left},${after?.top} w ${after?.width}, canvas left ${before?.canvasLeft} -> ${after?.canvasLeft}`,
      };
    },
  },
  {
    name: 'a listing refresh every 1 s for 6 s re-navigates no iframe and leaves no 150px frame',
    quiet: true,
    listingMayPend: 'waits for all frames to paint, which needs the listing, before the refreshes start',
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const sketchJson = join(checkout, '.ethlete/design/studio/sketches/elements-shell-main/sketch.json');
      const original = readFileSync(sketchJson, 'utf8');
      const unpainted = await framesPainted(page, 30_000);

      if (unpainted) return { ok: false, detail: unpainted };

      const log = eventLog();
      const known = new Set(page.frames());
      const srcs = new Map(page.frames().map((frame) => [frame, frame.url()]));
      const onNavigated = (frame) => {
        if (frame === page.mainFrame()) return;
        log.add('navigation', srcChange(srcs.get(frame), frame.url()), known.has(frame) ? '' : 'new iframe');
        srcs.set(frame, frame.url());
      };
      let flip = false;

      page.on('framenavigated', onNavigated);

      const timer = setInterval(() => {
        flip = !flip;
        log.add('refresh write', 'sketch.json');
        writeFileSync(sketchJson, original.trimEnd() + (flip ? '\n\n' : '\n'));
      }, 1000);

      await page.waitForTimeout(6000);
      clearInterval(timer);
      writeFileSync(sketchJson, original);
      page.off('framenavigated', onNavigated);
      await page.waitForTimeout(1000);

      const heights = await page.evaluate(() =>
        [...document.querySelectorAll('[data-sk-frame]')].map((frame) => ({
          key: frame.getAttribute('data-sk-frame'),
          frame: Math.round(frame.getBoundingClientRect().height),
          iframes: [...frame.querySelectorAll('iframe')].map((iframe) => ({
            height: iframe.offsetHeight,
            src: iframe.getAttribute('src') ?? 'no src',
          })),
        })),
      );
      const placeholder = heights.filter((row) => row.frame <= 0 || row.iframes.some(({ height }) => height === 150));
      const navigations = log.events.filter((event) => event.kind === 'navigation');

      placeholder.forEach((row) =>
        log.add(
          'placeholder',
          row.key,
          `frame ${row.frame}px, iframes ${row.iframes.map(({ height, src }) => `${height}px ${eventUrl(src)}`).join(', ') || 'none'}`,
        ),
      );

      const ok = heights.length > 0 && navigations.length === 0 && placeholder.length === 0;

      return {
        ok,
        detail: `frames ${heights.length}, iframe re-navigations in 6 s ${navigations.length} (must be 0), frames with 150px placeholder or no height 1 s after the last refresh ${placeholder.length} (must be 0)${ok ? '' : await log.lines()}`,
      };
    },
  },
  {
    name: 'a variant equal to Aktuell keeps its iframes across a quick and a full listing',
    pages: ['Sketches'],
    labels: ['Large'],
    run: async (page) => {
      const sketchDir = join(checkout, '.ethlete/design/studio/sketches/elements-shell-main');
      const sketchJson = join(sketchDir, 'sketch.json');
      const base = readFileSync(sketchJson, 'utf8');
      const sketch = JSON.parse(base);
      const original = JSON.stringify({ ...sketch, variantInfo: { ...sketch.variantInfo, b: sketch.variantInfo.a } });
      const listings = { quick: 0, full: 0 };
      const log = eventLog();
      const askedAt = new WeakMap();
      let writtenAt = 0;
      const isListing = (request) => request.url().includes('/__design/sketches?');
      const onRequest = (request) => {
        if (isListing(request)) askedAt.set(request, Date.now());
      };
      const onListed = async (request) => {
        if (!isListing(request) || (askedAt.get(request) ?? 0) < writtenAt) return;
        const kind = request.url().includes('unchanged=no') ? 'quick' : 'full';

        listings[kind] += 1;
        log.add(`${kind} listing answered`, request.url(), `${(await request.response())?.status()}`);
      };
      const refresh = async (content) => {
        listings.quick = 0;
        listings.full = 0;
        log.add('write', 'sketch.json');
        writtenAt = Date.now();
        writeFileSync(sketchJson, content);
        const deadline = Date.now() + 2 * FULL_COMPARE_MS;

        while ((listings.quick === 0 || listings.full === 0) && Date.now() < deadline) await page.waitForTimeout(250);
        await page.waitForTimeout(1000);

        return { ...listings };
      };
      const watch = () =>
        page.evaluate(() => {
          const record = { added: 0, removed: 0, events: [] };
          const touches = (node) =>
            node instanceof Element &&
            (node.matches('[data-sk-row="b"], [data-sk-variant="b"], iframe') || !!node.querySelector('iframe'));
          const note = (kind, node) => {
            const iframe = node.matches('iframe') ? node : node.querySelector('iframe');
            const keys = ['data-sk-row', 'data-sk-variant', 'data-sk-frame']
              .filter((name) => node.hasAttribute(name))
              .map((name) => `${name}=${node.getAttribute(name)}`);

            record[kind] += 1;
            record.events.push({
              at: Date.now(),
              kind,
              subject: `<${node.localName}${keys.length ? ` ${keys.join(' ')}` : ''}>`,
              detail: `iframe src ${iframe?.hasAttribute('src') ? ((url) => url.pathname + url.search)(new URL(iframe.getAttribute('src'), location.href)) : 'none'}`,
            });
          };

          window.__sameRow = record;
          window.__sameObserver?.disconnect();
          window.__sameObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              for (const node of mutation.addedNodes) if (touches(node)) note('added', node);
              for (const node of mutation.removedNodes) if (touches(node)) note('removed', node);
            }
          });
          window.__sameObserver.observe(document.body, { childList: true, subtree: true });
        });
      const changes = async (phase) => {
        const record = await page.evaluate(() => ({ ...window.__sameRow }));

        record.events.forEach((event) => log.add(`${phase} ${event.kind}`, event.subject, event.detail, event.at));

        return record;
      };

      page.on('request', onRequest);
      page.on('requestfinished', onListed);

      try {
        cpSync(join(checkout, '.ethlete/design/studio/elements/shell-main'), join(sketchDir, 'b/elements/shell-main'), {
          recursive: true,
        });
        const setupListings = await refresh(original);
        const folded = await page.evaluate(() => !!document.querySelector('[data-sk-same]'));

        await watch();
        const collapsedListings = await refresh(original.trimEnd() + '\n\n');
        const collapsed = await changes('collapsed');

        await page.locator('[data-sk-same] button').first().click();
        await settle(page);
        await page.evaluate(() => {
          window.__sameFrames = [
            ...document.querySelectorAll('[data-sk-row="b"] iframe, [data-sk-variant="b"] iframe'),
          ];
        });
        await watch();
        const openListings = await refresh(original);
        const open = await changes('open');
        const kept = await page.evaluate(() => {
          const now = [...document.querySelectorAll('[data-sk-row="b"] iframe, [data-sk-variant="b"] iframe')];

          return {
            before: window.__sameFrames.length,
            same:
              now.length === window.__sameFrames.length && now.every((frame, i) => frame === window.__sameFrames[i]),
          };
        });

        const listed = (counts) => counts.quick > 0 && counts.full > 0;
        const ok =
          folded &&
          listed(setupListings) &&
          listed(collapsedListings) &&
          listed(openListings) &&
          collapsed.added + collapsed.removed === 0 &&
          open.added + open.removed === 0 &&
          kept.before > 0 &&
          kept.same;

        return {
          ok,
          detail: `setup: listings ${JSON.stringify(setupListings)}, folded ${folded}; collapsed: listings ${JSON.stringify(collapsedListings)}, iframe/row adds ${collapsed.added} removes ${collapsed.removed} (must be 0); open: listings ${JSON.stringify(openListings)}, adds ${open.added} removes ${open.removed} (must be 0), iframes ${kept.before} kept ${kept.same}${ok ? '' : await log.lines()}`,
        };
      } finally {
        page.off('request', onRequest);
        page.off('requestfinished', onListed);
        writeFileSync(sketchJson, base);
        rmSync(join(sketchDir, 'b'), { recursive: true, force: true });
      }
    },
  },
  {
    name: 'first load creates one iframe per frame and aborts no frame request',
    quiet: true,
    listingMayPend:
      'records iframe creation and aborted requests, and is meant to see the first load while the listing is late',
    pages: ['Sketches'],
    run: async (page) => {
      const log = eventLog();
      let oldPageFrames = new Set();
      const onFailed = (request) => {
        if (oldPageFrames.has(request.frame())) return;
        if (request.resourceType() !== 'document' || request.frame() === page.mainFrame()) return;

        const frame = request.frame();
        const head = `${request.failure()?.errorText ?? 'none'}, ${request.isNavigationRequest() ? 'navigation' : 'subrequest'}, initiator ${eventUrl(frame.url())}`;

        log.add(
          'aborted',
          request.url(),
          frame
            .frameElement()
            .then((element) => element.getAttribute('src'))
            .catch(() => 'detached')
            .then((src) => `${head}, iframe src then ${eventUrl(src ?? 'none')}`),
        );
      };

      page.on('requestfailed', onFailed);

      try {
        await page.addInitScript(() => {
          if (window.__frameLoad) return;

          const record = { created: [], createdAt: new Map(), srcAt: new Map(), loadedAt: new Map() };
          const create = Document.prototype.createElement;
          const src = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
          const setAttribute = Element.prototype.setAttribute;
          const noteSrc = (iframe) => {
            if (!record.srcAt.has(iframe)) record.srcAt.set(iframe, performance.now());
          };

          window.__frameLoad = record;
          Document.prototype.createElement = function (tag, ...rest) {
            const element = create.call(this, tag, ...rest);

            if (element instanceof HTMLIFrameElement) {
              record.created.push(element);
              record.createdAt.set(element, Date.now());
            }

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
        log.restart();
        oldPageFrames = new Set(page.frames());
        await page.reload();
        await page.waitForFunction(({ CANVAS, FRAME }) => document.querySelector(CANVAS)?.querySelector(FRAME), {
          CANVAS,
          FRAME,
        });
        await listingAnswered(page);

        const loadState = () =>
          page.evaluate(() => {
            const iframes = [...document.querySelectorAll('[data-sk-frame] iframe')];

            return `${iframes.length}/${iframes.filter((iframe) => window.__frameLoad.loadedAt.has(iframe)).length}`;
          });
        const deadline = Date.now() + WAIT_MS;
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

          const createdForShown = record.created.filter((iframe) => shownKeys.has(keyOf(iframe)));

          return {
            frames: iframes.length,
            created: record.created.length,
            createdForShown: createdForShown.length,
            createdEvents: createdForShown.map((iframe) => ({
              at: record.createdAt.get(iframe),
              key: keyOf(iframe),
              detail: `${iframe.isConnected ? 'connected' : 'detached'}, src ${iframe.getAttribute('src') ?? 'none'}${record.loadedAt.has(iframe) ? `, loaded ${Math.round(record.loadedAt.get(iframe))} ms after reload` : ', not loaded'}`,
            })),
            urls: iframes.map((iframe) => iframe.src),
            visible: visible.length,
            visibleFirst: hidden.length === 0 || Math.max(...visible.map(srcAt)) <= Math.min(...hidden.map(srcAt)),
            visibleLoadedMs: Math.round(Math.max(0, ...visible.map((iframe) => record.loadedAt.get(iframe) ?? NaN))),
            allLoadedMs: Math.round(Math.max(0, ...iframes.map((iframe) => record.loadedAt.get(iframe) ?? NaN))),
          };
        });
        const aborted = log.events.filter((event) => event.kind === 'aborted');
        const shownAborts = aborted.filter((event) => load.urls.includes(event.subject)).length;
        const createdOk = load.createdForShown === load.frames;

        if (!createdOk)
          load.createdEvents.forEach((event) => log.add('iframe created', event.key, event.detail, event.at));

        const ok = stable >= 4 && load.frames > 0 && createdOk && shownAborts === 0;

        return {
          ok,
          detail: `${stable >= 4 ? 'settled' : `not settled in ${WAIT_MS / 1000} s (${last} loaded)`}, iframes ${load.frames}, created for them ${load.createdForShown} (must equal), created in all ${load.created}, aborted requests of shown frames ${shownAborts} of ${aborted.length} (must be 0), ${load.visible} visible got src first ${load.visibleFirst}, visible loaded at ${load.visibleLoadedMs} ms, all at ${load.allLoadedMs} ms after reload${ok ? '' : await log.lines((event) => event.kind !== 'aborted' || load.urls.includes(event.subject))}`,
        };
      } finally {
        page.off('requestfailed', onFailed);
      }
    },
  },
  {
    name: 'Neu starten in the code notice answers within 100 ms',
    perf: true,
    pages: ['System'],
    run: async (page) => {
      const key = 'e2e.slow-restart-ms';

      await page.addInitScript(withChangedCliAndSlowRestart, key);
      await page.evaluate(({ key, ms }) => localStorage.setItem(key, String(ms)), { key, ms: SLOW_HOST_MS });
      await page.reload();

      const restart = page.locator('ethlete-title-bar').getByRole('button', { name: 'Neu starten' });

      await restart.waitFor({ state: 'visible' });

      return expectFeedbackWithin(restart, FEEDBACK_MS);
    },
  },
];

let checkout;

const MARKED_SHELL = '.st-shell { outline: 2px solid rgb(255 0 0); outline-offset: -2px; }';

/**
 * Variant `a` of each canvas sketch changes exactly the `changed` state, so a cold compare draws one state per sketch
 * and every other state folds.
 */
const SKETCH_CHANGES = {
  'components/zoom-chip': {
    file: 'zoom-chip.ts',
    changed: 'reset',
    change: (source) =>
      replaceOnce(
        source,
        'return [name, target ? { ...(props as Props), target } : props];',
        "return [name, name === 'reset' ? { ...(props as Props), percent: 110 } : target ? { ...(props as Props), target } : props];",
      ),
  },
  'elements/shell-main': {
    file: 'shell-main.ts',
    changed: 'hidden',
    change: (source) =>
      replaceOnce(
        source,
        '    shell.render({ ...props, studio: props.studio ?? studioPreview }),',
        [
          '    shell.render({ ...props, studio: props.studio ?? studioPreview }).then((drawn) =>',
          `      props.panel === 'hidden' ? { ...drawn, styles: drawn.styles + ${JSON.stringify(MARKED_SHELL)} } : drawn,`,
          '    ),',
        ].join('\n'),
      ),
  },
  'pages/system': {
    file: 'system.ts',
    changed: 'empty',
    change: (source) =>
      replaceOnce(
        source,
        'styles: shell.styles + menu.styles + copy.styles });',
        `styles: shell.styles + menu.styles + copy.styles + ${JSON.stringify(MARKED_SHELL)} });`,
      ),
  },
};

const replaceOnce = (source, needle, replacement) => {
  const at = source.indexOf(needle);

  if (at < 0 || source.indexOf(needle, at + 1) >= 0) {
    throw new Error(`SKETCH_CHANGES: expected exactly one ${JSON.stringify(needle)} in the fixture source`);
  }

  return source.replace(needle, () => replacement);
};

const FIXTURE_CHANGES = [
  ...Object.entries(SKETCH_CHANGES).map(([target, { changed }]) => ({
    target,
    part: target,
    variants: ['a'],
    changed,
  })),
  {
    target: `${WIDE_SKETCH.part}@${WIDE_SKETCH.name}`,
    part: WIDE_SKETCH.part,
    variants: WIDE_SKETCH.variants,
    changed: WIDE_SKETCH.changed,
  },
];

const PROBE_MS = 2000;

const serverProbe = async (designPort) => {
  const startedAt = performance.now();
  const answer = await fetch(`http://[::1]:${designPort}/__design/queue`, { signal: AbortSignal.timeout(PROBE_MS) })
    .then((response) => `answered ${response.status}`)
    .catch(() => `did not answer within ${PROBE_MS} ms, so the server is busy or down`);

  return `a /__design/queue probe ${answer} after ${Math.round(performance.now() - startedAt)} ms`;
};

const assertSketchFixtures = async (page, designPort, assertStates) => {
  const url = `http://[::1]:${designPort}/__design/sketches?product=studio`;
  const startedAt = performance.now();
  const listing = await page.request
    .get(url, { timeout: COLD_START_MS })
    .then((response) => response.json())
    .catch(async (error) => {
      const waited = seconds(performance.now() - startedAt).trim();
      const probe = await serverProbe(designPort);

      throw new Error(
        `sketch fixture check could not list the sketches: GET ${url} failed after ${waited} (limit ${COLD_START_MS} ms); ${probe}: ${String(error).split('\n')[0]}`,
      );
    });

  if (!assertStates) return;

  const faults = FIXTURE_CHANGES.flatMap(({ target, part, variants, changed }) => {
    const sketch = listing?.sketches?.find((candidate) => candidate.target === target);

    return variants.flatMap((variant) => {
      const unchanged = sketch?.targets?.find(
        (candidate) => candidate.variant === variant && (candidate.part ?? part) === part,
      )?.unchanged;

      if (!unchanged) return [`${target}/${variant}: not listed with compared states`];
      if (unchanged.includes(changed))
        return [`${target}/${variant}: fixture folds every state, ${changed} draws like Aktuell`];
      if (unchanged.length === 0) return [`${target}/${variant}: changes every state, not only ${changed}`];

      return [];
    });
  });

  if (faults.length) throw new Error(`sketch fixture check failed: ${faults.join('; ')}`);
};

const prepareCheckout = () => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-canvas-e2e-'));

  for (const entry of readdirSync(root)) {
    if (entry === '.ethlete' || entry === '.git' || (coldShots && entry === 'node_modules')) continue;
    symlinkSync(join(root, entry), join(dir, entry));
  }

  if (coldShots) {
    mkdirSync(join(dir, 'node_modules'));
    for (const entry of readdirSync(join(root, 'node_modules'))) {
      if (entry !== '.design-explore') symlinkSync(join(root, 'node_modules', entry), join(dir, 'node_modules', entry));
    }
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

    const { file, change } = SKETCH_CHANGES[target] ?? {};

    if (file) {
      const variantFile = join(folder, 'a', target, file);

      writeFileSync(variantFile, change(readFileSync(variantFile, 'utf8')));
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
  const wideTs = join(WIDE_SKETCH.part, `${WIDE_SKETCH.part.split('/')[1]}.ts`);

  WIDE_SKETCH.variants.forEach((variant, index) => {
    cpSync(join(root, '.ethlete/design/studio', WIDE_SKETCH.part), join(wide, variant, WIDE_SKETCH.part), {
      recursive: true,
    });
    writeFileSync(
      join(wide, variant, wideTs),
      replaceOnce(
        readFileSync(join(wide, variant, wideTs), 'utf8'),
        "styles: [styles, tooltipStyles, loaderStyles, notificationStyles, badgeStyles].join('\\n'),",
        `styles: [styles, tooltipStyles, loaderStyles, notificationStyles, badgeStyles].join('\\n') + (props.push ? '.st-title-bar { opacity: ${0.4 + index * 0.2}; }' : ''),`,
      ),
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

const warmUp = async (page, studioUrl) => {
  await page.goto(studioUrl);
  await page.waitForFunction(
    ({ CANVAS, FRAME }) => document.querySelector(CANVAS)?.querySelector(FRAME),
    { CANVAS, FRAME },
    { timeout: COLD_START_MS },
  );
};

const waitForFirstFrame = async (page, studioUrl, designPort, frame) => {
  const startedAt = performance.now();
  const at = () => Math.round(performance.now() - startedAt);
  const port = `:${designPort}/`;
  const requests = new Map();
  const onRequest = (request) =>
    request.url().includes(port) && requests.set(request, { url: request.url(), start: at(), end: null });
  const onDone = (request) => requests.has(request) && (requests.get(request).end = at());
  const pings = [];
  let pinging = true;
  const ping = async () => {
    while (pinging) {
      const sent = at();

      await fetch(`http://[::1]${port}__design/e2e-ping`, { signal: AbortSignal.timeout(WAIT_MS) }).catch(
        () => undefined,
      );
      pings.push(at() - sent);
      await new Promise((done) => setTimeout(done, 250));
    }
  };

  page.on('request', onRequest);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);
  const pinged = ping();

  try {
    await page.goto(studioUrl);
    await page.waitForFunction(({ CANVAS, FRAME }) => document.querySelector(CANVAS)?.querySelector(FRAME), {
      CANVAS,
      FRAME: frame,
    });
  } catch (error) {
    const short = (url) => url.slice(url.indexOf(port) + port.length - 1).slice(0, 90);
    const slow = [...requests.values()]
      .map((request) => ({ ...request, ms: (request.end ?? at()) - request.start }))
      .filter((request) => request.end === null || request.ms > 1000)
      .map(
        (request) => `${short(request.url)} @${request.start} ${request.end === null ? 'pending' : `${request.ms}ms`}`,
      );

    throw new Error(
      `${String(error).split('\n')[0]} - no frame after ${at()} ms; slow design requests: ${slow.join(', ') || 'none'}; ${requests.size} sent; server pings max ${Math.max(0, ...pings)} ms of ${pings.length}`,
      { cause: error },
    );
  } finally {
    pinging = false;
    page.off('request', onRequest);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onDone);
    await pinged;
  }
};

const BLANK_PATH = '/__canvas-e2e-blank';

const cpuSessions = new WeakMap();

const throttleCpu = async (page) => {
  if (cpuRate === 1) return;
  if (!cpuSessions.has(page)) cpuSessions.set(page, await page.context().newCDPSession(page));
  await cpuSessions.get(page).send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
};

const runCase = async (page, studioUrl, designPort, target, testCase) => {
  await page.goto(`${studioUrl}${BLANK_PATH}`);
  await throttleCpu(page);
  await page.evaluate(
    ({ view, checkout }) => {
      localStorage.clear();
      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
    },
    { view: target.view, checkout },
  );
  await page.setViewportSize(testCase.viewport ?? NARROW);
  await waitForFirstFrame(page, studioUrl, designPort, target.frame ?? FRAME);
  await settled(page, target.frame ?? FRAME);

  const shown = await page.evaluate(
    ({ shows, hides }) => !!document.querySelector(shows) && !(hides && document.querySelector(hides)),
    { shows: target.shows, hides: target.hides ?? null },
  );
  const state = await probe(page);

  heldListings.startRun();

  const result = !shown
    ? { ok: false, detail: `the page does not show ${target.shows}` }
    : state
      ? await testCase.run(page, state, target, { designPort })
      : { ok: false, detail: 'no canvas' };

  if (!testCase.open || !shown || !state) return result;

  return result.ok
    ? { ok: false, detail: `passes now - drop \`open\` from the case (${testCase.open}): ${result.detail}` }
    : { ok: true, detail: `open, ${testCase.open}: ${result.detail}` };
};

const heldListings = listingHold(holdListingsMs);

const holdListings = (page) =>
  page.context().route(
    (url) => url.pathname === '/__design/sketches' && url.searchParams.get('targets') !== 'no',
    async (route) => {
      if (listingHoldOn && route.request().method() === 'GET') {
        listingCounts.requested++;
        listingCounts.outstanding++;
        try {
          await heldListings.hold();
        } finally {
          listingCounts.outstanding--;
        }
      }
      await route.fallback().catch(() => undefined);
    },
  );

let pictureDelayOn = true;

const delayPictures = (page) =>
  page.context().route(/__design\/shot\?/, async (route) => {
    if (pictureDelayOn) await new Promise((done) => setTimeout(done, delayPicturesMs));
    await route.fallback().catch(() => undefined);
  });

const trackRoutes = (page) => {
  const routes = new Set();
  const route = page.route.bind(page);
  const unroute = page.unroute.bind(page);

  page.route = (url, ...rest) => {
    routes.add(String(url));

    return route(url, ...rest);
  };
  page.unroute = (url, ...rest) => {
    routes.delete(String(url));

    return unroute(url, ...rest);
  };

  return routes;
};

const studioBuilt = new Promise((done) => {
  const onBuilt = (message) => {
    if (message?.type !== 'built') return;
    process.off('message', onBuilt);
    done();
  };

  process.on('message', onBuilt);
});

const nextJob = () =>
  new Promise((done) => {
    process.once('message', done);
    process.send({ type: 'next' });
  });

const crashOnAsyncError = (error) => {
  console.error(error);
  process.exit(1);
};

let reportAsyncError = crashOnAsyncError;

process.on('unhandledRejection', (error) => reportAsyncError(error));
process.on('uncaughtException', (error) => reportAsyncError(error));

const drawsSoFar = (designPort) =>
  fetch(`http://[::1]:${designPort}/__design/queue`)
    .then((answer) => answer.json())
    .then((report) => ({ drawn: report.drawnTotal ?? null, waited: report.waitedTotal ?? null }))
    .catch(() => ({ drawn: null, waited: null }));

const drawsSince = (now, before) => ({
  drawn: now.drawn === null || before.drawn === null ? null : now.drawn - before.drawn,
  waited: now.waited === null || before.waited === null ? null : now.waited - before.waited,
});

const work = async () => {
  checkout = prepareCheckout();
  process.send({ type: 'checkout', checkout: realpathSync(checkout) });

  await withStudio(
    async ({ page, studioUrl, designPort }) => {
      page.setDefaultTimeout(WAIT_MS);
      const routes = trackRoutes(page);

      const opened = performance.now();

      await page
        .context()
        .route(`${studioUrl}${BLANK_PATH}`, (route) => route.fulfill({ contentType: 'text/html', body: '' }));
      await assertSketchFixtures(page, designPort, args.includes('--check-fixtures')).catch((error) => {
        process.send({ type: 'fixtures', detail: error.message });
        throw error;
      });
      const fixed = performance.now();

      await studioBuilt;
      const builtAt = performance.now();

      await warmUp(page, studioUrl);
      let draws = await drawsSoFar(designPort);

      process.send({
        type: 'ready',
        ...draws,
        phases: {
          open: opened,
          fixtures: fixed - opened,
          build: builtAt - fixed,
          warmUp: performance.now() - builtAt,
        },
      });
      if (holdListingsMs) await holdListings(page);
      if (delayPicturesMs) await delayPictures(page);
      for (let { job } = await nextJob(); job; { job } = await nextJob()) {
        const startedAt = performance.now();
        let result;

        pictureDelayOn = CASES[job.case].delayPictures !== false;
        listingHoldOn = CASES[job.case].holdListings !== false;
        heldListings.startJob();
        listingCounts.requested = 0;

        try {
          result = await Promise.race([
            runCase(page, studioUrl, designPort, PAGES[job.target], CASES[job.case]),
            new Promise((_, reject) => (reportAsyncError = reject)),
          ]);
        } catch (error) {
          result = { ok: false, detail: String(error).split('\n')[0] };
        }

        if (!CASES[job.case].open && !CASES[job.case].listingMayPend) result = heldListings.check(result);

        reportAsyncError = crashOnAsyncError;

        const leftRoutes = [...routes];

        routes.clear();
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        if (leftRoutes.length)
          result = { ok: false, detail: `left route ${leftRoutes.join(', ')} active after the case: ${result.detail}` };

        const ms = performance.now() - startedAt;
        const drawsBefore = draws;

        draws = await drawsSoFar(designPort);
        process.send({ type: 'result', ok: result.ok, detail: result.detail, ms, ...drawsSince(draws, drawsBefore) });
      }
    },
    { built, checkout, echoDesign: true },
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
const minutes = (ms) => {
  const total = Math.round(ms / 1000);

  return `${Math.floor(total / 60)}m${total % 60 ? `${String(total % 60).padStart(2, '0')}s` : ''}`;
};

const buildStudioAsync = (outputPath) =>
  new Promise((done) => {
    console.log('[canvas-e2e] studio build starting');
    const child = spawn(
      'npx',
      ['nx', 'build', 'ethlete-studio', `--outputPath=${outputPath}`, '--excludeTaskDependencies', '--skip-nx-cache'],
      { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, NX_NO_CLOUD: 'true' } },
    );

    child.on('error', () => done(1));
    child.on('exit', (code) => done(code ?? 1));
  });

const workerCount = () => {
  const asked = Number(
    args.includes('--workers') ? args[args.indexOf('--workers') + 1] : process.env['STUDIO_E2E_WORKERS'],
  );

  return asked >= 1 ? Math.floor(asked) : Math.max(1, Math.min(8, Math.floor(availableParallelism() / 4)));
};

const lead = async () => {
  if (!listOnly) {
    const lock = await takeHeavyLock('studio:e2e', { wait: waitForLock });

    if (!lock.ok) {
      console.error(`[canvas-e2e] ${holderLine(lock.holder)}`);
      process.exit(2);
    }
    await startRunLoad(busyLoops);
  }

  const runStartedAt = performance.now();
  const loadAtStart = loadavg()[0];
  const noReason = CASES.filter(
    (testCase) =>
      'listingMayPend' in testCase && (typeof testCase.listingMayPend !== 'string' || !testCase.listingMayPend.trim()),
  );

  if (noReason.length) {
    for (const testCase of noReason)
      console.error(
        `[canvas-e2e] listingMayPend needs a reason string, not ${testCase.listingMayPend}: ${testCase.name}`,
      );
    process.exit(2);
  }

  const known = existsSync(TIMINGS_FILE) ? JSON.parse(readFileSync(TIMINGS_FILE, 'utf8')) : {};
  const queue = PAGES.flatMap((target, targetIndex) =>
    CASES.flatMap((testCase, caseIndex) =>
      !!testCase.perf === perfOnly &&
      testCase.proof === proofRow &&
      (testCase.pages ?? ['System', 'Sketches']).includes(target.name) &&
      (!testCase.labels || testCase.labels.includes(target.label)) &&
      (!only || only.split('|').some((part) => testCase.name.includes(part))) &&
      (!view || VIEWS[view].includes(target.name)) &&
      (!pageGroups || pageGroups.includes(target.label ?? target.name))
        ? [
            {
              target: targetIndex,
              case: caseIndex,
              page: target.label ?? target.name,
              name: testCase.name,
              ownShard: !!testCase.ownShard,
            },
          ]
        : [],
    ),
  );
  const matched = queue.length;

  if (!matched && (only || pageGroups)) {
    console.error(
      only
        ? noMatchLineOf({ flag: '--case', only, names: CASES.map((testCase) => testCase.name) })
        : noMatchLineOf({
            flag: '--page',
            only: pageGroups.join('|'),
            names: PAGES.map((page) => page.label ?? page.name),
          }),
    );
    process.exit(2);
  }
  const skippedPerf = perfOnly ? 0 : CASES.filter((testCase) => testCase.perf).length;

  if (shard) queue.splice(0, queue.length, ...shardShareOf(queue, shard, keyOf));
  const quiet = (job) => !!job && !!CASES[job.case].quiet;

  queue.sort((a, b) => quiet(a) - quiet(b) || (known[keyOf(b)] ?? Infinity) - (known[keyOf(a)] ?? Infinity));

  const shardLabel = shard ? ` (shard ${shard.index}/${shard.count})` : '';

  if (listOnly) {
    const knownMs = queue.reduce((sum, job) => sum + (known[keyOf(job)] ?? 0), 0);

    console.log(
      `${queue.length} of ${matched} cases${shardLabel}, ${seconds(knownMs).trim()} by the last local timings:`,
    );
    for (const job of queue) {
      const undelayed = delayPicturesMs && CASES[job.case].delayPictures === false ? '  [pictures not delayed]' : '';
      const unheld = holdListingsMs && CASES[job.case].holdListings === false ? '  [listings not held]' : '';

      console.log(`${seconds(known[keyOf(job)] ?? 0)}  ${job.page.padEnd(9)} ${job.name}${undelayed}${unheld}`);
    }
    process.exit(0);
  }

  if (!queue.length && matched) {
    console.log(`0 of ${matched} cases fall to${shardLabel.replace(/[()]/g, '')}, nothing to run`);
    process.exit(0);
  }

  const declared = [...queue];
  const total = queue.length;
  const workers = Math.min(total, workerCount());
  const rows = [];
  const busy = new Set();
  let quietTail = false;
  let firstCase = false;
  const scratch = built ? undefined : mkdtempSync(join(tmpdir(), 'studio-canvas-e2e-build-'));
  const record = (job, result) => {
    rows.push({ ...job, ...result });
    console.log(
      `  ${result.ok ? '✓' : '✘'}  ${rows.length} [${job.page}] › ${job.name} ${result.detail}${result.ok ? '' : ` - load ${loadavg()[0].toFixed(1)} on ${busy.size || 1} worker(s)${slowedNote}`} (${seconds(result.ms ?? 0).trim()})`,
    );
  };
  let fixtureFault;
  const teardowns = new Map();

  try {
    ensureCli();
    const children = new Set();
    let builtOk = !scratch;
    let fixturesAsked = false;
    const build = scratch ? buildStudioAsync(scratch) : Promise.resolve(0);
    const failBuild = (code) => {
      console.log(`[canvas-e2e] studio build failed with ${code}`);
      for (const child of children) child.kill();
      process.exit(1);
    };

    void build.then((code) => {
      if (code !== 0) return failBuild(code);
      builtOk = true;
      console.log(`[canvas-e2e] studio build done at ${seconds(performance.now() - runStartedAt).trim()}`);
      for (const child of children) child.send({ type: 'built' });
    });
    console.log(
      `[canvas-e2e] ${total} cases${shardLabel} on ${workers} worker(s)${perfOnly ? ' (perf only)' : skippedPerf ? `, ${skippedPerf} perf case(s) skipped (--perf runs them)` : ''}${slowedNote}`,
    );
    console.log(`Running ${total} test${total === 1 ? '' : 's'} using ${workers} worker${workers === 1 ? '' : 's'}`);

    const runWorker = async (index) => {
      const port = await freePort();
      const checkFixtures = index === 0 && !fixturesAsked;

      fixturesAsked ||= checkFixtures;
      const child = fork(
        fileURLToPath(import.meta.url),
        ['--worker', '--built', built ?? scratch, ...(checkFixtures ? ['--check-fixtures'] : [])],
        {
          env: { ETHLETE_DESIGN_SLOW_CHECKS: 'off', ...process.env, DE_PORT: String(port) },
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        },
      );

      children.add(child);
      child.on('exit', () => children.delete(child));
      if (builtOk) child.send({ type: 'built' });
      let output = '';
      let current;
      let tookJob = false;
      let workerCheckout;

      const giveJob = async () => {
        if (quiet(queue[0]) && index !== 0) return child.send({ job: null });
        while (quiet(queue[0]) && [...busy].some((other) => other !== index))
          await new Promise((done) => setTimeout(done, 200));
        if (quiet(queue[0]) && !quietTail) {
          quietTail = true;
          console.log(
            `[canvas-e2e] quiet tail: ${queue.length} case(s) on worker ${index} after the parallel cases, at ${seconds(performance.now() - runStartedAt).trim()}`,
          );
        }
        current = queue.shift();
        tookJob ||= !!current;
        if (current) busy.add(index);
        if (current && !firstCase) {
          firstCase = true;
          console.log(`[canvas-e2e] first case starting at ${seconds(performance.now() - runStartedAt).trim()}`);
        }
        child.send({ job: current ?? null });
      };

      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (output += chunk));
      child.on('message', (message) => {
        if (message.type === 'result') {
          record(current, message);
          if (!message.ok) console.log(`[canvas-e2e] worker ${index} output tail:\n${output.slice(-3000)}`);
          console.log(
            `[canvas-e2e] worker ${index} drew ${message.drawn ?? '?'} picture(s) in the case, waited for ${message.waited ?? '?'}`,
          );
          current = undefined;
          busy.delete(index);
        }
        if (message.type === 'fixtures') {
          fixtureFault = message.detail;
          console.log(`[canvas-e2e] ${fixtureFault}, stopping the run`);
          queue.splice(0);
        }
        if (message.type === 'ready')
          console.log(
            `[canvas-e2e] worker ${index} ready: ${Object.entries(message.phases)
              .map(([phase, ms]) => `${phase} ${seconds(ms).trim()}`)
              .join(', ')}, ${message.drawn ?? '?'} picture(s) drawn, ${message.waited ?? '?'} waited for`,
          );
        if (message.type === 'next') void giveJob();
        if (message.type === 'checkout') workerCheckout = message.checkout;
      });

      const code = await new Promise((done) => child.on('exit', done));

      if (workerCheckout) teardowns.set(workerCheckout, Date.now());

      if (code !== 0 || current) {
        console.log(`[canvas-e2e] worker ${index} on port ${port} exited with ${code}\n${output.slice(-4000)}`);
        if (current) record(current, { ok: false, detail: `worker exited with ${code}` });
        busy.delete(index);
      }

      return tookJob;
    };

    await Promise.all(
      Array.from({ length: workers }, async (_, index) => {
        while (queue.length && (index === 0 || !quiet(queue[0])) && (await runWorker(index)));
      }),
    );
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }

  const survivors = await residentSurvivors({ teardowns });

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

  if (keepTimings) {
    mkdirSync(dirname(TIMINGS_FILE), { recursive: true });
    writeFileSync(
      TIMINGS_FILE,
      JSON.stringify({
        ...known,
        ...Object.fromEntries(rows.filter((row) => row.ms).map((row) => [keyOf(row), Math.round(row.ms)])),
      }),
    );
  }

  const failed = rows.filter((row) => !row.ok);
  const ran = new Set(rows.map(keyOf));
  const notRun = declared.filter((job) => !ran.has(keyOf(job)));

  if (notRun.length) {
    console.log(`\n${notRun.length} case(s) did not run:`);
    for (const job of notRun) console.log(`NOT RUN  ${job.page.padEnd(9)} ${job.name}`);
  }

  const suiteMs = performance.now() - runStartedAt;
  const loadAtEnd = loadavg()[0];
  const overBudget = suiteMs > BUDGET_MS;
  const enforceBudget = process.env['STUDIO_E2E_BUDGET_ENFORCE'] === '1';

  const optedOut = CASES.filter((testCase) => testCase.listingMayPend && !testCase.open);

  if (holdListingsMs && optedOut.length) {
    console.log('\nopted out of the held-listing check (listingMayPend):');
    for (const testCase of optedOut) console.log(`  ${testCase.name}: ${testCase.listingMayPend}`);
  }

  console.log('');
  failed.forEach((row, at) => console.log(`  ${at + 1}) [${row.page}] › ${row.name}`));
  console.log(`  ${rows.length - failed.length} passed (${seconds(suiteMs).trim()})`);
  if (failed.length) console.log(`  ${failed.length} failed`);
  if (fixtureFault) console.log(`  ${fixtureFault}`);
  if (notRun.length) console.log(`  ${notRun.length} did not run`);
  for (const line of survivorLinesOf(survivors)) console.log(`  ${line}`);
  console.log(
    `\n${rows.length - failed.length}/${total} passed${shardLabel} in ${seconds(suiteMs).trim()} on ${workers} worker(s)`,
  );
  console.log(
    `suite${shard ? ` shard ${shard.index}/${shard.count}` : ''} ${minutes(suiteMs)} of ${minutes(BUDGET_MS)} budget${overBudget ? ` - over budget${enforceBudget ? ', failing the run' : ' (STUDIO_E2E_BUDGET_ENFORCE=1 fails the run)'}` : ''}`,
  );
  const load = { start: loadAtStart, end: loadAtEnd, cores: availableParallelism() };
  console.log(runLoadLineOf({ ...load, workers, machine: hostname() }));
  if (
    !only &&
    !pageGroups &&
    !view &&
    !shard &&
    !perfOnly &&
    !holdListingsMs &&
    !delayPicturesMs &&
    !delayFramesMs &&
    !busyLoops
  )
    console.log(
      goalLineOf({
        ms: suiteMs,
        machine: hostname(),
        noisy: isNoisy(load),
        goalMachine: process.env['STUDIO_E2E_GOAL_MACHINE'] || undefined,
      }),
    );
  if (isNoisy(load)) console.log(['top processes by cpu:', ...topProcesses()].join('\n'));
  process.exit(
    fixtureFault ||
      failed.length ||
      survivors.length ||
      rows.length < total ||
      !matched ||
      (overBudget && enforceBudget)
      ? 1
      : 0,
  );
};

if (args.includes('--prepare-checkout')) console.log(prepareCheckout());
else await (args.includes('--worker') ? work() : lead());
