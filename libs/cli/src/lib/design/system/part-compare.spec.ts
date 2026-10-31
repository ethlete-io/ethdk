import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromium, type Browser } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { crc32, deflateSync } from 'zlib';
import { DESIGN_DIR } from '../paths';
import { compareFrameOf, comparePart, designCompare, harnessShotOf, ShootStates } from './compare-command';
import { StartHarnessServer } from './harness-server';
import { comparePngs, decodePng, encodePng, harnessUrlOf, Pixels } from './part-compare';
import { markPartGo } from './part-go';
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

describe('part compare', () => {
  afterEach(() => vi.restoreAllMocks());

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
    expect(comparePngs({ design, app: pngOf(4, 3, () => RED - 1) })).toMatchObject({ kind: 'diff', pixels: 12 });
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
      });

    expect(await compare(['--state'])).toBe(2);
    expect(await compare(['--url', 'http://localhost:9'])).toBe(1);
    expect(lines.join('\n')).toContain('has no go');

    markPartGo({ product: resolveProduct({ target, name: 'app-a', config: {} }), part: 'components/chip', by: 'tom' });

    expect(await compare(['--url', 'http://localhost:9', '--state', 'default'])).toBe(0);
    expect(shoot).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://localhost:9', only: 'default', preset: null }),
    );
    expect(await compare(['--url', 'http://localhost:9', '--preset', 'phone'])).toBe(0);
    expect(shoot).toHaveBeenLastCalledWith(expect.objectContaining({ preset: 'phone' }));

    shoot.mockResolvedValueOnce('the harness page http://localhost:9/__design-harness did not load');
    lines.length = 0;
    expect(await compare(['--url', 'http://localhost:9'])).toBe(1);
    expect(lines).toEqual(['the harness page http://localhost:9/__design-harness did not load']);
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
      designCompare({ target, argv: ['components/chip', '--product', 'app-a'], invocation: 'et design', shoot, start });

    markPartGo({ product: resolveProduct({ target, name: 'app-a', config: {} }), part: 'components/chip', by: 'tom' });

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
});

describe('harnessShotOf', () => {
  let browser: Browser | undefined;
  let server: Server;
  let url = '';

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
    server = createServer((request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end(
        request.url?.startsWith('/__design-harness') && request.url.includes('layout=page')
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

  it('shoots a page host in the viewport of the preset size', async (context) => {
    if (!browser) return context.skip('no browser');

    const png = await harnessShotOf({
      browser,
      url: harnessUrlOf({ url, part: 'pages/inbox', state: 'a', props: {}, layout: 'page' }),
      size: { width: 40, height: 30 },
    });

    expect(decodePng(png)).toEqual(pixelsOf(40, 30, () => BLUE));
  });

  it('names the url when the page has no host element', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(harnessShotOf({ browser, url: `${url}/other`, timeout: 500 })).rejects.toThrow(
      `the harness page ${url}/other showed no [data-design-harness-host] element within 500 ms`,
    );
  });
}, 30_000);
