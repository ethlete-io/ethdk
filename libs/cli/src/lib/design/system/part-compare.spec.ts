import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { originOf } from './write-origin';
import { noVerdictOf } from './no-verdict';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromium, type Browser } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { crc32, deflateSync } from 'zlib';
import { DESIGN_DIR } from '../design-config';
import type { TextAmbient } from '../shot';
import { appShotProblemOf, comparePart, compareWidthOf, designCompare, ShootStates } from './compare-command';
import { compareFrameOf, harnessShotOf, missingPanesProblemOf } from './harness-shot';
import { partActionFailuresOf } from './actions-command';
import { StartHarnessServer } from './harness-server';
import {
  comparePngs,
  decodePng,
  designOnlyPropsOf,
  drawsSelectedOf,
  drawnSurfacesOf,
  droppedPropsOf,
  encodePng,
  forcedElementsOf,
  forcesInFramesOf,
  frameLooksOf,
  harnessUrlOf,
  Pixels,
  pointerOpensOf,
  slotOnlyStatesOf,
} from './part-compare';
import { markPartReady, readyPartOf } from './part-ready';
import { markImplemented } from './part-task';
import { resolveProduct } from './resolve-product';

const pixelsOf = (width: number, height: number, colour: (x: number, y: number) => number): Pixels => {
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.writeUInt32BE(colour(x, y) >>> 0, (y * width + x) * 4);

  return { width, height, data };
};

const pngOf = (width: number, height: number, colour: (x: number, y: number) => number) =>
  encodePng(pixelsOf(width, height, colour));

const chunkOf = (type: string, body: Buffer) => {
  const named = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const head = Buffer.alloc(4);
  const sum = Buffer.alloc(4);

  head.writeUInt32BE(body.length);
  sum.writeUInt32BE(crc32(named));

  return Buffer.concat([head, named, sum]);
};

const filteredRgbPngOf = (pixels: Pixels, filters: number[]) => {
  const stride = pixels.width * 3;
  const rgb = Buffer.alloc(stride * pixels.height);

  for (let at = 0; at < pixels.width * pixels.height; at++) pixels.data.copy(rgb, at * 3, at * 4, at * 4 + 3);

  const raw = Buffer.alloc((stride + 1) * pixels.height);

  for (let y = 0; y < pixels.height; y++) {
    const filter = filters[y % filters.length] ?? 0;

    raw[y * (stride + 1)] = filter;

    for (let x = 0; x < stride; x++) {
      const left = x >= 3 ? (rgb[y * stride + x - 3] ?? 0) : 0;
      const up = y > 0 ? (rgb[(y - 1) * stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= 3 ? (rgb[(y - 1) * stride + x - 3] ?? 0) : 0;
      const estimate = left + up - upLeft;
      const paeth =
        Math.abs(estimate - left) <= Math.abs(estimate - up) && Math.abs(estimate - left) <= Math.abs(estimate - upLeft)
          ? left
          : Math.abs(estimate - up) <= Math.abs(estimate - upLeft)
            ? up
            : upLeft;
      const predicted = [0, left, up, (left + up) >> 1, paeth][filter] ?? 0;

      raw[y * (stride + 1) + 1 + x] = ((rgb[y * stride + x] ?? 0) - predicted) & 0xff;
    }
  }

  const header = Buffer.alloc(13);

  header.writeUInt32BE(pixels.width, 0);
  header.writeUInt32BE(pixels.height, 4);
  header[8] = 8;
  header[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkOf('IHDR', header),
    chunkOf('IDAT', deflateSync(raw)),
    chunkOf('IEND', Buffer.alloc(0)),
  ]);
};

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-compare-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(join(design, 'app-a/components/chip'), { recursive: true });
  writeFileSync(
    join(design, 'app-a/components/chip/chip.ts'),
    "export default definePart({ implements: 'libs/chip/chip.component.ts', states: { default: {} } });\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return target;
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

const RED = 0xff0000ff;
const BLUE = 0x0000ffff;
const DARK_SQUARE = 0x6e6e6eff;
const LIGHT_SQUARE = 0x969696ff;
const checkerAt = (x: number, y: number) =>
  Math.floor(x / 8) % 2 === Math.floor(y / 8) % 2 ? DARK_SQUARE : LIGHT_SQUARE;

describe('part compare', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the forced elements of a design picture with their aria-label, role and text', () => {
    expect(
      forcedElementsOf(
        '<div><button class="a" aria-label="Tom &amp; Co" data-et-force="hover active">x</button><span data-et-force="focus-visible"></span>' +
          '<div role="treeitem" data-et-force="hover"><span>Com</span><div>ponents\n <!-- c --><i>3</i></div></div><input data-et-force="hover"></div>',
      ),
    ).toEqual([
      { interaction: 'hover', label: 'Tom & Co', role: 'button', text: 'x' },
      { interaction: 'active', label: 'Tom & Co', role: 'button', text: 'x' },
      { interaction: 'focus-visible', label: null, role: 'span', text: '' },
      { interaction: 'hover', label: null, role: 'treeitem', text: 'Components 3' },
      { interaction: 'hover', label: null, role: 'input', text: '' },
    ]);
  });

  it('leaves out a forced element of a drawing a slot region frames, and reads the looks of that region', () => {
    const chip = (force: string) =>
      `<div data-et-part="components/zoom-chip" data-et-slot="elements/variant-cell"><span data-camera-fit><button aria-label="Einpassen" data-et-force="${force}">Fit</button></span></div>`;
    const page =
      '<div data-et-part="pages/sketches"><button aria-label="Zoom" data-et-force="hover">Z</button>' +
      `<div data-et-part="elements/variant-cell"><div class="w-4 [&amp;_[data-camera-fit]_button]:font-ui-strong **:data-canvas-zoom:rounded-full [&>.a_b]:p-1" data-et-projected="shot">${chip('hover')}</div></div>` +
      `<div data-et-projected="shot">${chip('active')}</div></div>`;

    expect(forcedElementsOf(page)).toEqual([{ interaction: 'hover', label: 'Zoom', role: 'button', text: 'Z' }]);
    expect(forcesInFramesOf(page)).toBe(true);
    expect(forcesInFramesOf('<div data-et-projected="shot"><button data-et-force="hover">x</button></div>')).toBe(
      false,
    );
    expect(frameLooksOf(page)).toEqual([
      {
        look: '[&_[data-camera-fit]_button]:font-ui-strong',
        selector: '[data-camera-fit] button',
        part: 'components/zoom-chip',
      },
      { look: '**:data-canvas-zoom:rounded-full', selector: '[data-canvas-zoom]', part: 'components/zoom-chip' },
      { look: '[&>.a_b]:p-1', selector: '> .a b', part: 'components/zoom-chip' },
    ]);
  });

  it('opens each surface state of a control by a click from the state nearest its props', () => {
    expect(
      pointerOpensOf({
        states: {
          picker: { panel: 'open', picker: 'open' },
          open: { panel: 'open' },
          hidden: { panel: 'hidden' },
          'unchanged-open': { unchanged: true },
          unchanged: { unchanged: false },
        },
        controls: {
          project: { kind: 'select', surfaces: { open: 'picker' } },
          toggle: { kind: 'disclosure', surfaces: { body: 'unchanged-open' } },
          popover: { kind: 'disclosure', surfaces: { body: 'not-a-state' } },
          collapse: { kind: 'button' },
        },
      }),
    ).toEqual({
      picker: { control: 'project', from: 'open' },
      'unchanged-open': { control: 'toggle', from: 'unchanged' },
    });
  });

  it('opens a surface state from the nearest state of the same interaction', () => {
    expect(
      pointerOpensOf({
        states: {
          rest: { open: false },
          'rest-hover': { open: false, interaction: 'hover' },
          open: { open: true },
          'open-hover': { open: true, interaction: 'hover' },
          'open-active': { open: true, interaction: 'active' },
        },
        controls: { toggle: { surfaces: { body: 'open' } } },
      }),
    ).toEqual({ open: { control: 'toggle', from: 'rest' } });
  });

  it('never opens a surface from a state that already draws it open, and opens every state drawing it by that click', () => {
    expect(
      pointerOpensOf({
        states: {
          closed: { open: false },
          open: { open: true },
          'option-hover': { open: true, option: 'hover' },
          'option-selected': { open: true, option: 'selected' },
          'open-hover': { open: true, interaction: 'hover' },
        },
        controls: { project: { surfaces: { open: 'open' } } },
        drawn: {
          closed: [],
          open: ['project.open'],
          'option-hover': ['project.open'],
          'option-selected': drawnSurfacesOf('<div data-et-surface="project.open"><span role="option"></span></div>'),
          'open-hover': ['project.open'],
        },
      }),
    ).toEqual({
      open: { control: 'project', from: 'closed' },
      'option-hover': { control: 'project', from: 'closed', props: { open: false, option: 'hover' } },
      'option-selected': { control: 'project', from: 'closed', props: { open: false, option: 'selected' } },
      'open-hover': { control: 'project', from: 'closed', props: { open: false, interaction: 'hover' } },
    });
  });

  it('reads no surface from a surface element marked hidden', () => {
    expect(
      drawnSurfacesOf(
        '<div data-et-surface="menu.open" hidden><span></span></div><div\n  data-et-surface="menu.sub"\n  hidden\n></div><div data-et-surface="menu.other" data-hidden="x"></div>',
      ),
    ).toEqual(['menu.other']);
  });

  it('names the states a surface state is equally close to', () => {
    expect(
      pointerOpensOf({
        states: { picker: { picker: 'open' }, a: { tone: 'dark' }, b: { size: 'small' } },
        controls: { project: { surfaces: { open: 'picker' } } },
      }),
    ).toEqual({
      picker: 'picker opens a surface of control project, but states a, b are equally close to click it open from',
    });
  });

  it('clicks a surface open from the first of equally close states that share the same props', () => {
    expect(
      pointerOpensOf({
        states: { picker: { picker: 'open', side: '' }, open: { side: '' }, section: { side: '' } },
        controls: { project: { surfaces: { open: 'picker' } } },
      }),
    ).toEqual({ picker: { control: 'project', from: 'open' } });
  });

  it('builds the harness url with the props as encoded JSON', () => {
    expect(
      harnessUrlOf({ url: 'http://localhost:4300/', part: 'pages/inbox', state: 'empty list', props: { q: 'a&b' } }),
    ).toBe(
      'http://localhost:4300/__design-harness?part=pages%2Finbox&state=empty%20list&props=%7B%22q%22%3A%22a%26b%22%7D',
    );
  });

  it('asks the app host to fill the viewport for a page', () => {
    expect(
      harnessUrlOf({ url: 'http://localhost:4300', part: 'pages/inbox', state: 'a', props: {}, layout: 'page' }),
    ).toBe('http://localhost:4300/__design-harness?part=pages%2Finbox&state=a&props=%7B%7D&layout=page');
  });

  it('draws a page at a product preset, the first by default, and any other part fitted', () => {
    const presets = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

    expect(compareFrameOf({ presets, part: 'pages/inbox', preset: null })).toEqual({
      preset: 'desktop',
      size: { width: 1440, height: 900 },
      layout: 'page',
    });
    expect(compareFrameOf({ presets, part: 'pages/inbox', preset: 'phone' })).toEqual({
      preset: 'phone',
      size: { width: 390, height: 844 },
      layout: 'page',
    });
    expect(compareFrameOf({ presets, part: 'pages/inbox', preset: 'tablet' })).toBe(
      'the product has no preset "tablet" - its presets: desktop, phone',
    );
    expect(compareFrameOf({ presets, part: 'components/chip', preset: null })).toEqual({
      preset: null,
      size: null,
      layout: null,
    });
    expect(compareFrameOf({ presets, part: 'components/chip', preset: 'phone' })).toBe(
      '--preset applies to a pages part only, components/chip is fitted to its content',
    );
  });

  it('compares a part with widths at its first width, a page or a part without them fitted', () => {
    expect(compareWidthOf({ part: 'components/title-bar', widths: [1440, 900] })).toBe(1440);
    expect(compareWidthOf({ part: 'components/chip', widths: undefined })).toBeNull();
    expect(compareWidthOf({ part: 'components/chip', widths: [0] })).toBeNull();
    expect(compareWidthOf({ part: 'pages/inbox', widths: [1440] })).toBeNull();
  });

  it('decodes every PNG row filter and round-trips its own PNGs', () => {
    const pixels = pixelsOf(5, 10, (x, y) => ((x * 53 + y * 31) << 24) | ((x * y * 17) << 16) | ((y * 7) << 8) | 255);

    expect(decodePng(filteredRgbPngOf(pixels, [0, 1, 2, 3, 4]))).toEqual(pixels);
    expect(decodePng(encodePng(pixels))).toEqual(pixels);
  });

  it('is ok on equal pictures, counts differing pixels, and fails a size mismatch', () => {
    const design = pngOf(4, 3, () => RED);

    expect(comparePngs({ design, app: pngOf(4, 3, () => RED) })).toEqual({ kind: 'ok' });

    const diff = comparePngs({ design, app: pngOf(4, 3, (x, y) => (x === 0 && y < 2 ? BLUE : RED)) });

    expect(diff).toMatchObject({ kind: 'diff', pixels: 2 });
    expect('diff' in diff && decodePng(diff.diff).width).toBe(4);
    expect(comparePngs({ design, app: pngOf(4, 3, () => RED + 0x0100) })).toEqual({ kind: 'ok' });
    expect(comparePngs({ design, app: pngOf(4, 3, () => RED + 0x0100 * 9) })).toMatchObject({
      kind: 'diff',
      pixels: 12,
    });
    expect(comparePngs({ design, app: pngOf(4, 4, () => RED) })).toMatchObject({
      kind: 'size',
      design: { width: 4, height: 3 },
      app: { width: 4, height: 4 },
    });
  });

  it('prints a line per state and keeps the pictures of failing states only', async () => {
    const target = checkout();
    const product = resolveProduct({ target, name: 'app-a', config: {} });
    const lines = output();
    const shoot: ShootStates = async () => ({
      states: { a: {}, b: {}, c: {} },
      shots: [
        { state: 'a', design: pngOf(2, 2, () => RED), app: pngOf(2, 2, () => RED) },
        { state: 'b', design: pngOf(2, 2, () => RED), app: pngOf(2, 2, (x) => (x ? BLUE : RED)) },
        { state: 'c', design: pngOf(2, 2, () => RED), app: pngOf(3, 2, () => RED) },
      ],
    });

    const result = await comparePart({
      target,
      config: {},
      product,
      part: 'components/chip',
      url: 'u',
      only: null,
      shoot,
    });

    expect(result).toMatchObject({ green: false });
    expect(lines.slice(0, 3)).toEqual(['a ok', 'b DIFF 2 px', 'c SIZE 2x2 vs 3x2']);

    const dir = lines[3]?.replace('pictures: ', '') ?? '';

    expect(readdirSync(dir).sort()).toEqual([
      'b.app.png',
      'b.design.png',
      'b.diff.png',
      'c.app.png',
      'c.design.png',
      'c.diff.png',
    ]);

    lines.length = 0;
    expect(
      await comparePart({
        target,
        config: {},
        product,
        part: 'components/chip',
        url: 'u',
        only: null,
        shoot: async () => ({
          states: { a: {} },
          shots: [{ state: 'a', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => RED) }],
        }),
      }),
    ).toEqual({ green: true, states: { a: {} } });
    expect(lines).toEqual(['a ok']);
  });

  it('refuses without a go, and exits 0 only when every state is ok', async () => {
    const target = checkout();
    const lines = output();
    const shoot = vi.fn<ShootStates>(async () => ({
      states: { default: {} },
      shots: [{ state: 'default', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => RED) }],
    }));
    const compare = (argv: string[]) =>
      designCompare({
        target,
        argv: ['components/chip', '--product', 'app-a', ...argv],
        invocation: 'et design',
        shoot,
        actions: async () => [],
      });

    expect(await compare(['--state'])).toBe(2);
    expect(await compare(['--url', 'http://localhost:9'])).toBe(0);

    expect(await compare(['--url', 'http://localhost:9', '--state', 'default'])).toBe(0);
    expect(shoot).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://localhost:9', only: 'default', preset: null }),
    );
    expect(await compare(['--url', 'http://localhost:9', '--preset', 'phone'])).toBe(0);
    expect(shoot).toHaveBeenLastCalledWith(expect.objectContaining({ preset: 'phone' }));

    shoot.mockResolvedValueOnce('the harness page http://localhost:9/__design-harness did not load');
    lines.length = 0;
    expect(await compare(['--url', 'http://localhost:9'])).toBe(1);
    expect(lines).toEqual([
      'the harness page http://localhost:9/__design-harness did not load',
      'every declared action works',
    ]);
  });

  it('runs the action check of a part with a go, and fails on a miss or when the check cannot run', async () => {
    const target = checkout();
    const lines = output();
    const shoot = vi.fn<ShootStates>(async () => ({
      states: { default: {} },
      shots: [{ state: 'default', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => RED) }],
    }));
    const actions = vi.fn<typeof partActionFailuresOf>(async (options) => {
      options.onNote?.('host DesignCanvas: not checked');

      return [];
    });
    const compare = () =>
      designCompare({
        target,
        argv: ['components/chip', '--product', 'app-a', '--url', 'http://localhost:9'],
        invocation: 'et design',
        shoot,
        actions,
      });

    expect(await compare()).toBe(0);
    expect(actions).toHaveBeenCalledWith(
      expect.objectContaining({ part: 'components/chip', url: 'http://localhost:9' }),
    );
    expect(lines).toEqual(['default ok', 'host DesignCanvas: not checked', 'every declared action works']);

    actions.mockResolvedValueOnce(['default button "Pausiert" click FAILED the state paused was not reached']);
    lines.length = 0;
    expect(await compare()).toBe(1);
    expect(lines).toEqual([
      'default ok',
      'default button "Pausiert" click FAILED the state paused was not reached',
      '1 action missed',
    ]);

    actions.mockResolvedValueOnce(noVerdictOf('the harness map is stale'));
    lines.length = 0;
    expect(await compare()).toBe(1);
    expect(lines).toEqual([
      'default ok',
      'actions: no verdict - the harness map is stale, retry',
      'FAILED actions: not checked, so no action counts as working',
    ]);
  });

  it('runs the action check while the states are shot, and prints the same lines and exit code as in turn', async () => {
    const target = checkout();
    const lines = output();
    let actionsStarted = (): void => undefined;
    const started = new Promise<void>((resolve) => (actionsStarted = resolve));
    const shoot = vi.fn<ShootStates>(async (options) => {
      await started;
      console.log('design shots taken');
      options.onDesignShots?.();

      return {
        states: { default: {}, open: {} },
        shots: [
          { state: 'default', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => RED) },
          { state: 'open', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => BLUE) },
        ],
      };
    });
    const actions = vi.fn<typeof partActionFailuresOf>(async (options) => {
      actionsStarted();
      await options.designsDrawn;
      console.log('action designs drawn');
      options.onNote?.('host DesignCanvas: not checked');

      return ['open button "Zu" click FAILED the state default was not reached'];
    });

    const code = await designCompare({
      target,
      argv: ['components/chip', '--product', 'app-a', '--url', 'http://localhost:9'],
      invocation: 'et design',
      shoot,
      actions,
    });

    expect(code).toBe(1);
    expect(lines.slice(0, 4)).toEqual(['design shots taken', 'action designs drawn', 'default ok', 'open DIFF 1 px']);
    expect(lines.slice(5)).toEqual([
      'host DesignCanvas: not checked',
      'open button "Zu" click FAILED the state default was not reached',
      '1 action missed',
    ]);
  });

  it('says a foundation has nothing to compare and exits 0', async () => {
    const target = checkout();
    const lines = output();
    const shoot = vi.fn<ShootStates>();

    mkdirSync(join(target, DESIGN_DIR, 'app-a/foundations/colors'), { recursive: true });
    writeFileSync(
      join(target, DESIGN_DIR, 'app-a/foundations/colors/colors.ts'),
      'export default definePart({ states: { default: {} } });\n',
    );

    expect(
      await designCompare({
        target,
        argv: ['foundations/colors', '--product', 'app-a'],
        invocation: 'et design',
        shoot,
      }),
    ).toBe(0);
    expect(lines).toEqual(['foundations/colors: foundation, nothing to compare']);
    expect(shoot).not.toHaveBeenCalled();
  });

  it('--all compares every done part and fails when one cannot be compared or deviates', async () => {
    const target = checkout();
    const lines = output();
    const product = () => resolveProduct({ target, name: 'app-a', config: {} });
    const all = (shoot: ShootStates) =>
      designCompare({
        target,
        argv: ['--all', '--product', 'app-a', '--url', 'http://localhost:9'],
        invocation: 'et design',
        shoot,
      });
    const same = vi.fn<ShootStates>(async () => ({
      states: { default: {} },
      shots: [{ state: 'default', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => RED) }],
    }));

    expect(await all(same)).toBe(0);
    expect(lines).toEqual(['app-a: no done parts to compare']);

    markImplemented({ product: product(), part: 'components/chip', states: { default: {} } });

    const found = readyPartOf({ product: product(), part: 'components/chip' });

    await markPartReady({
      product: product(),
      origin: originOf('spec'),
      part: 'components/chip',
      hash: typeof found === 'string' ? found : found.hash,
      pointsOf: async () => [],
      actionsOf: async () => [],
    });
    lines.length = 0;
    expect(await all(same)).toBe(0);
    expect(lines).toEqual(['== components/chip', 'default ok']);

    const deviating = vi.fn<ShootStates>(async () => ({
      states: { default: {} },
      shots: [{ state: 'default', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => BLUE) }],
    }));

    expect(await all(deviating)).toBe(1);
    expect(
      await designCompare({ target, argv: ['--all', '--live', '--product', 'app-a'], invocation: 'et design' }),
    ).toBe(2);
  });

  it('compares a part without a check record and with a changed design, with no gate note', async () => {
    const target = checkout();
    const lines = output();
    const shoot = vi.fn<ShootStates>(async () => ({
      states: { default: {} },
      shots: [{ state: 'default', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => RED) }],
    }));
    const argv = ['components/chip', '--product', 'app-a', '--url', 'http://localhost:9'];

    expect(await designCompare({ target, argv, invocation: 'et design', shoot, actions: async () => [] })).toBe(0);

    const source = join(target, DESIGN_DIR, 'app-a/components/chip/chip.ts');

    writeFileSync(source, `${readFileSync(source, 'utf8')}// changed\n`);
    lines.length = 0;
    expect(await designCompare({ target, argv, invocation: 'et design', shoot, actions: async () => [] })).toBe(0);
    expect(lines.join('\n')).not.toContain('unapproved');
  });

  it('without --url starts the harness app, compares against it and always stops it', async () => {
    const target = checkout();
    const lines = output();
    const stop = vi.fn(async () => undefined);
    const start = vi.fn<StartHarnessServer>(async () => ({ url: 'http://127.0.0.1:50001', stop }));
    const shoot = vi.fn<ShootStates>(async () => ({
      states: { default: {} },
      shots: [{ state: 'default', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => RED) }],
    }));
    const compare = () =>
      designCompare({
        target,
        argv: ['components/chip', '--product', 'app-a'],
        invocation: 'et design',
        shoot,
        start,
        actions: async () => [],
      });

    expect(await compare()).toBe(0);
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ target }));
    expect(shoot).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://127.0.0.1:50001' }));
    expect(stop).toHaveBeenCalledTimes(1);

    shoot.mockResolvedValueOnce('the harness page did not load');
    expect(await compare()).toBe(1);
    expect(stop).toHaveBeenCalledTimes(2);

    shoot.mockRejectedValueOnce(new Error('chromium crashed'));
    await expect(compare()).rejects.toThrow('chromium crashed');
    expect(stop).toHaveBeenCalledTimes(3);

    start.mockResolvedValueOnce('product "app-a" has no harness in config.json - pass --url <app dev server url>');
    lines.length = 0;
    expect(await compare()).toBe(1);
    expect(lines.at(-1)).toContain('pass --url');
    expect(stop).toHaveBeenCalledTimes(3);
  });

  it('starts the harness app once for the states and the actions of a part, and stops it once', async () => {
    const target = checkout();

    output();

    const stop = vi.fn(async () => undefined);
    const start = vi.fn<StartHarnessServer>(async () => ({ url: 'http://127.0.0.1:50001', stop }));
    const shoot = vi.fn<ShootStates>(async () => ({
      states: { default: {} },
      shots: [{ state: 'default', design: pngOf(1, 1, () => RED), app: pngOf(1, 1, () => RED) }],
    }));
    const check = vi.fn(async () => ({ lines: [], pictures: null }));
    const compare = () =>
      designCompare({
        target,
        argv: ['components/chip', '--product', 'app-a'],
        invocation: 'et design',
        shoot,
        start,
        actions: (options) => partActionFailuresOf({ ...options, check }),
      });

    expect(await compare()).toBe(0);
    expect(start).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://127.0.0.1:50001' }));
    expect(stop).toHaveBeenCalledTimes(1);

    check.mockRejectedValueOnce(new Error('chromium crashed'));
    await expect(compare()).rejects.toThrow('chromium crashed');
    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(2);
  });
});

describe('harnessShotOf', () => {
  let browser: Browser | undefined;
  let server: Server;
  let url = '';

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
    server = createServer((request, response) => {
      response.setHeader('content-type', 'text/html');
      const em = (size: number) =>
        `<body style="margin:0;font:${size}px/${size}px monospace"><div data-design-harness-host style="display:flow-root;width:fit-content"><span style="display:inline-block;width:1em;height:1em;background:#0000ff"></span></div></body>`;

      response.end(
        request.url?.includes('components%2Fambient')
          ? em(20)
          : request.url?.includes('components%2Fnative')
            ? em(5)
            : request.url?.includes('components%2Finputs')
              ? '<body style="margin:0"><div data-design-harness-host style="width:7px;height:5px;background:#0000ff"><i></i></div><script>window.ng={getComponent:()=>({}),getDirectiveMetadata:()=>({inputs:{label:"label"}})};</script></body>'
              : request.url?.includes('components%2Ferroring')
                ? '<body style="margin:0"><div data-design-harness-host style="width:7px;height:5px;background:#0000ff"></div><script>console.error("ERROR", new Error("ET1234: The control has no accessible name."));console.error("plain error");</script></body>'
                : request.url?.includes('components%2Fclear')
                  ? '<body style="margin:0"><div data-design-harness-host style="width:7px;height:5px"></div></body>'
                  : request.url?.includes('components%2Fupward')
                    ? "<style>button{all:unset;display:block;width:7px;height:5px;color:transparent;background:#0000ff}.et-overlay-runtime-root{position:fixed;top:0;left:0}.et-overlay-runtime-pane{position:absolute;width:7px;height:4px;background:#ff0000}</style><body style=\"margin:0\"><div data-design-harness-host style=\"width:7px;height:5px\"><button aria-expanded=\"false\" onclick=\"const {top,left}=this.getBoundingClientRect();this.setAttribute('aria-expanded', 'true');document.body.insertAdjacentHTML('beforeend', '<div class=et-overlay-runtime-root><div class=et-overlay-runtime-pane style=top:'+(top>=4?top-4:top+5)+'px;left:'+(left>=2?left-2:left)+'px></div></div>')\">Pick</button></div></body>"
                    : request.url?.includes('components%2Ffraction')
                      ? '<body style="margin:0"><div data-design-harness-host style="width:7.25px;height:5px;background:#0000ff"></div></body>'
                      : request.url?.includes('components%2Fbadge')
                        ? '<body style="margin:0"><div data-design-harness-host style="position:relative;width:7px;height:5px;background:#0000ff"><span style="position:absolute;left:5px;top:-2px;width:4px;height:3px;background:#ff0000"></span></div></body>'
                        : request.url?.includes('components%2Finpane')
                          ? '<style>button{all:unset;display:block;width:7px;height:5px;color:transparent;background:#0000ff}button[aria-expanded=true]{background:#ff0000}.et-overlay-runtime-root{position:fixed;top:0;left:0}</style><body style="margin:0"><div data-design-harness-host style="width:7px;height:5px"></div><div class="et-overlay-runtime-root"><button aria-expanded="false" onclick="this.setAttribute(\'aria-expanded\', \'true\')">Why</button></div></body>'
                          : request.url?.includes('components%2Fpicker')
                            ? '<style>button{all:unset;display:block;width:7px;height:5px;color:transparent;background:#0000ff}button[aria-expanded=true]{background:#ff0000}button:hover{background:#00ff00}button:focus-visible{background:#00ffff}</style><body style="margin:0"><div data-design-harness-host style="width:7px;height:5px"><button aria-expanded="false" onclick="this.setAttribute(\'aria-expanded\', \'true\')">Pick</button></div></body>'
                            : request.url?.includes('components%2Fpaned')
                              ? "<style>button{all:unset;display:block;width:7px;height:5px;color:transparent;background:#0000ff}.et-overlay-runtime-root{position:fixed;top:0;left:0}.et-overlay-runtime-pane{position:absolute;width:7px;height:4px;background:#ff0000}</style><body style=\"margin:0\"><div data-design-harness-host style=\"width:7px;height:5px\"><button aria-expanded=\"false\" onclick=\"this.setAttribute('aria-expanded', 'true');document.body.insertAdjacentHTML('beforeend', '<div class=et-overlay-runtime-root><div class=et-overlay-runtime-pane style=top:'+this.getBoundingClientRect().bottom+'px;left:'+this.getBoundingClientRect().left+'px></div></div>')\">Pick</button></div></body>"
                              : request.url?.includes('components%2Fportal')
                                ? '<style>button{all:unset;display:block;width:7px;height:5px;color:transparent}.et-overlay-runtime-root{position:absolute;top:0;left:0}.et-overlay-runtime-root button:hover{background:#ff0000}</style><body style="margin:0"><div data-design-harness-host style="position:relative;width:7px;height:5px;background:#0000ff"><div class="et-overlay-runtime-root"><button> G o </button></div></div><p><button>Go</button></p></body>'
                                : request.url?.includes('components%2Ftwice')
                                  ? '<body style="margin:0"><div data-design-harness-host style="width:7px;height:5px;background:#0000ff"><button>Go</button><button>Go</button></div></body>'
                                  : request.url?.includes('components%2Fframed')
                                    ? '<style>i{display:block;width:7px;height:5px;background:#0000ff}i:hover{background:#ff0000}</style><body style="margin:0"><div data-design-harness-host style="width:7px;height:5px"><div class="look"><i data-et-force="hover"></i></div></div></body>'
                                    : request.url?.includes('components%2Fhover')
                                      ? '<style>button{all:unset;display:block;width:7px;height:5px;background:#0000ff}button:hover{background:#ff0000}</style><body style="margin:0"><div data-design-harness-host style="width:7px;height:5px"><button aria-label="Go"></button></div></body>'
                                      : request.url?.startsWith('/__design-harness') &&
                                          request.url.includes('layout=page')
                                        ? '<body style="margin:0"><div data-design-harness-host style="width:100vw;height:100vh;background:#0000ff"></div></body>'
                                        : request.url?.startsWith('/__design-harness')
                                          ? '<body style="margin:0"><div data-design-harness-host style="width:7px;height:5px;background:#0000ff"></div></body>'
                                          : '<body>no harness</body>',
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  });

  it('shoots the harness host element', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/chip', state: 'a', props: {} }),
    });

    expect(decodePng(png)).toEqual(pixelsOf(7, 5, () => BLUE));
  });

  it('fails a state whose design prop has no input on the mounted component', async (context) => {
    if (!browser) return context.skip('no browser');

    const shoot = (sent: Record<string, unknown>) =>
      harnessShotOf({
        browser: browser as Browser,
        url: harnessUrlOf({ url, part: 'components/inputs', state: 'a', props: sent }),
        props: { sent, designOnly: new Set(['class']) },
      });

    await expect(shoot({ label: 'Go', class: 'x' })).resolves.toBeInstanceOf(Buffer);
    await expect(shoot({ label: 'Go', server: 'stopped' })).rejects.toThrow(
      'the design prop server has no input on the app component',
    );
  });

  it("draws a part that inherits its type in the design frame's text style, not the app body's", async (context) => {
    if (!browser) return context.skip('no browser');

    const shoot = (part: string, ambient?: TextAmbient) =>
      harnessShotOf({
        browser: browser as Browser,
        url: harnessUrlOf({ url, part, state: 'a', props: {} }),
        ...(ambient ? { ambient } : {}),
      });
    const native = await shoot('components/native');

    expect(comparePngs({ design: native, app: await shoot('components/ambient') })).not.toMatchObject({ kind: 'ok' });
    expect(
      comparePngs({
        design: native,
        app: await shoot('components/ambient', {
          fontFamily: 'monospace',
          fontSize: '5px',
          fontWeight: '400',
          fontStyle: 'normal',
          lineHeight: '5px',
          letterSpacing: 'normal',
        }),
      }),
    ).toMatchObject({ kind: 'ok' });
  });

  it('rounds a fractional host to whole pixels as the design picture does', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/fraction', state: 'a', props: {} }),
    });

    expect(decodePng(png)).toEqual(pixelsOf(7, 5, () => BLUE));
  });

  it('draws a transparent host as the bare checkerboard and an opaque one over it', async (context) => {
    if (!browser) return context.skip('no browser');

    const clear = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/clear', state: 'a', props: {} }),
    });
    const opaque = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/chip', state: 'a', props: {} }),
    });

    expect(decodePng(opaque)).toEqual(pixelsOf(7, 5, () => BLUE));
    expect(decodePng(clear)).toEqual(pixelsOf(7, 5, checkerAt));
    expect(comparePngs({ design: clear, app: opaque })).toMatchObject({ kind: 'diff', pixels: 35 });
    expect(comparePngs({ design: clear, app: clear })).toMatchObject({ kind: 'ok' });
  });

  it('grows the shot to the right and down over a positioned descendant, as a design frame grows its root', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/badge', state: 'a', props: {} }),
    });

    expect(decodePng(png)).toEqual(
      pixelsOf(9, 5, (x, y) => (y === 0 && x >= 5 ? RED : x < 7 ? BLUE : checkerAt(x, y))),
    );
  });

  it('grows the shot up too with room above, as a design frame drawn above its part root', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/badge', state: 'a', props: {} }),
      roomAbove: true,
    });

    expect(decodePng(png)).toEqual(
      pixelsOf(9, 7, (x, y) => (y < 3 && x >= 5 ? RED : y >= 2 && x < 7 ? BLUE : checkerAt(x, y))),
    );
  });

  it('leaves room above and before a fitted host, so an overlay that opens above neither flips nor shifts', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/upward', state: 'a', props: {} }),
      roomAbove: true,
      opened: { control: 'pick', markup: '<button data-et-control="pick" aria-expanded="true"> Pick </button>' },
    });

    expect(decodePng(png)).toEqual(
      pixelsOf(9, 9, (x, y) => (y < 4 ? (x < 7 ? RED : checkerAt(x, y)) : x >= 2 ? BLUE : checkerAt(x, y))),
    );
  });

  it('sizes a fitted host to the width the design draws the part at', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/chip', state: 'a', props: {} }),
      width: 12,
    });

    expect(decodePng(png)).toEqual(pixelsOf(12, 5, () => BLUE));
  });

  it('shoots a page host in the viewport of the preset size', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'pages/inbox', state: 'a', props: {}, layout: 'page' }),
      size: { width: 40, height: 30 },
    });

    expect(decodePng(png)).toEqual(pixelsOf(40, 30, () => BLUE));
  });

  it('hovers a forced element before the shot', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/hover', state: 'a', props: {} }),
      forced: [{ interaction: 'hover', label: 'Go', role: 'button', text: '' }],
    });

    expect(decodePng(png)).toEqual(pixelsOf(7, 5, () => RED));
  });

  it('keeps the pointer off a top-left element in a rest shot', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/hover', state: 'a', props: {} }),
    });

    expect(decodePng(png)).toEqual(pixelsOf(7, 5, () => BLUE));
  });

  it('forces an element named by its role and text in an overlay root, not one elsewhere on the page', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/portal', state: 'a', props: {} }),
      forced: [{ interaction: 'hover', label: null, role: 'button', text: 'Go' }],
    });

    expect(decodePng(png)).toEqual(pixelsOf(7, 5, () => RED));
  });

  it('refuses to force a name more than one element carries', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(
      harnessShotOf({
        browser,
        url: harnessUrlOf({ url, part: 'components/twice', state: 'a', props: {} }),
        forced: [{ interaction: 'hover', label: null, role: 'button', text: 'Go' }],
        timeout: 500,
      }),
    ).rejects.toThrow('has 2 elements with the button "Go" to force hover on');
  });

  it('draws an app element with data-et-force forced for a design that forces one in a frame', async (context) => {
    if (!browser) return context.skip('no browser');

    const shoot = (forcesInFrames: boolean) =>
      harnessShotOf({
        browser: browser as Browser,
        url: harnessUrlOf({ url, part: 'components/framed', state: 'a', props: {} }),
        forcesInFrames,
      });

    expect(decodePng(await shoot(false))).toEqual(pixelsOf(7, 5, () => BLUE));
    expect(decodePng(await shoot(true))).toEqual(pixelsOf(7, 5, () => RED));
  });

  it('fails a state whose app draws nothing a look of the design targets, naming the look, selector and part', async (context) => {
    if (!browser) return context.skip('no browser');

    const shoot = (selector: string) =>
      harnessShotOf({
        browser: browser as Browser,
        url: harnessUrlOf({ url, part: 'components/framed', state: 'a', props: {} }),
        looks: [{ look: 'look', selector, part: 'components/zoom-chip' }],
      });

    await expect(shoot('> i')).resolves.toBeInstanceOf(Buffer);
    expect(await shoot('.st-chip').catch(appShotProblemOf)).toEqual({
      problem:
        'the look "look" targets ".st-chip" in components/zoom-chip, but no element inside the app\'s element with that look matches it',
    });
  });

  it('opens a surface by a pointer click on the trigger, then leaves it unhovered', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/picker', state: 'a', props: {} }),
      opened: { control: 'pick', markup: '<button data-et-control="pick" aria-expanded="true"> Pick </button>' },
    });

    expect(decodePng(png)).toEqual(pixelsOf(7, 5, () => RED));
  });

  it.for([{ size: null }, { size: { width: 40, height: 30 } }])(
    'shoots the overlay pane a click opened outside the host with the host (size $size)',
    async ({ size }, context) => {
      if (!browser) return context.skip('no browser');

      const png = await harnessShotOf({
        browser,
        url: harnessUrlOf({ url, part: 'components/paned', state: 'a', props: {} }),
        size,
        opened: { control: 'pick', markup: '<button data-et-control="pick" aria-expanded="true"> Pick </button>' },
      });

      expect(decodePng(png)).toEqual(pixelsOf(7, 9, (_x, y) => (y < 5 ? BLUE : RED)));
    },
  );

  it('fails the state when fewer overlay panes open than the design draws', async (context) => {
    if (!browser) return context.skip('no browser');

    const target = harnessUrlOf({ url, part: 'components/picker', state: 'a', props: {} });

    await expect(harnessShotOf({ browser, url: target })).resolves.toBeInstanceOf(Buffer);
    expect(await harnessShotOf({ browser, url: target, panes: 1 }).catch(appShotProblemOf)).toEqual({
      problem: missingPanesProblemOf({ drawn: 1, opened: 0 }),
    });
  });

  it('opens a surface by a trigger inside an overlay root', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'components/inpane', state: 'a', props: {} }),
      opened: { control: 'why', markup: '<button data-et-control="why" aria-expanded="true">Why</button>' },
    });

    expect(decodePng(png)).toEqual(pixelsOf(7, 5, () => RED));
  });

  it('names the trigger the harness page lacks', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(
      harnessShotOf({
        browser,
        url: harnessUrlOf({ url, part: 'components/picker', state: 'a', props: {} }),
        opened: { control: 'pick', markup: '<button data-et-control="pick" aria-expanded="true">Other</button>' },
        timeout: 500,
      }),
    ).rejects.toThrow('has no [aria-expanded] trigger named "Other" to click control pick open');
  });

  it('fails with the code and message of each SDK error the harness page logs', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = harnessUrlOf({ url, part: 'components/erroring', state: 'a', props: {} });

    await expect(harnessShotOf({ browser, url: page })).rejects.toThrow(
      `the harness page ${page} logged SDK errors:\n  ET1234: The control has no accessible name.`,
    );
  });

  it('names the url when the page has no host element', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(harnessShotOf({ browser, url: `${url}/other`, timeout: 500 })).rejects.toThrow(
      `the harness page ${url}/other showed no [data-design-harness-host] element within 500 ms`,
    );
  });
}, 30_000);

describe('dropped design props', () => {
  const states = {
    closed: { open: false, content: '' },
    open: { open: true, content: '' },
    stopped: { open: true, server: 'stopped', content: '' },
    'row-hover': { open: false, force: { label: 'Go', interaction: 'hover' }, content: '' },
    'chip-hover': { open: false, target: 'out', interaction: 'hover', content: '' },
    'option-selected': { open: true, option: 'selected', content: '' },
  };
  const opens = pointerOpensOf({
    states,
    controls: { menu: { surfaces: { open: 'open' } } },
    drawn: { open: ['menu.open'], stopped: ['menu.open'], 'option-selected': ['menu.open'] },
  });
  const droppedOf = (state: keyof typeof states, forced: string[] = [], selected = false) =>
    droppedPropsOf({
      props: states[state],
      inputs: [],
      designOnly: designOnlyPropsOf({
        states,
        opens,
        state,
        forced,
        forcing: new Set(['row-hover', 'chip-hover']),
        selected,
      }),
    });

  it('lets the harness drop a prop set to selected in a state whose design draws a selected option', () => {
    expect(droppedOf('option-selected', [], true)).toEqual([]);
    expect(droppedOf('option-selected')).toEqual(['option']);
  });

  it('reads a selected option from the design markup', () => {
    expect(drawsSelectedOf('<button role="menuitemradio" aria-checked="true"></button>')).toBe(true);
    expect(drawsSelectedOf('<a aria-current="page"></a>')).toBe(true);
    expect(drawsSelectedOf('<button aria-checked="false" aria-current="false"></button>')).toBe(false);
  });

  it('lets the harness drop the props compare reproduces: one no state differs by, a pointer open, a forced interaction', () => {
    expect(droppedOf('closed')).toEqual([]);
    expect(droppedOf('row-hover', ['hover'])).toEqual([]);
    expect(droppedOf('chip-hover', ['hover'])).toEqual([]);
  });

  it('names a prop the app component has no input for and compare cannot reproduce', () => {
    expect(droppedOf('stopped')).toEqual(['server']);
    expect(droppedOf('row-hover')).toEqual(['force']);
    expect(droppedOf('chip-hover')).toEqual(['target', 'interaction']);
    expect(
      droppedPropsOf({ props: states.stopped, inputs: ['server'], designOnly: new Set(['open', 'content']) }),
    ).toEqual([]);
  });
});

describe('slotOnlyStatesOf', () => {
  const png = (text: string) => Buffer.from(text);

  it('names a state that draws like an earlier one once its slots are emptied, but not with them', async () => {
    const full = vi.fn(async (state: string) =>
      png(
        (
          { open: 'shell+canvas', stopped: 'shell+log', hidden: 'narrow', twin: 'shell+canvas' } as Record<
            string,
            string
          >
        )[state] ?? '',
      ),
    );
    const slotOnly = await slotOnlyStatesOf({
      states: ['open', 'stopped', 'hidden', 'twin'],
      emptied: new Map([
        ['open', png('shell')],
        ['stopped', png('shell')],
        ['hidden', png('narrow')],
        ['twin', png('shell')],
      ]),
      full,
    });

    expect([...slotOnly]).toEqual([['stopped', 'open']]);
    expect(full).not.toHaveBeenCalledWith('hidden');
  });
});
