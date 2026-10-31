import { crc32, deflateSync, inflateSync } from 'zlib';

export const HARNESS_PATH = '/__design-harness';

export const HARNESS_HOST_SELECTOR = '[data-design-harness-host]';

/** The app's harness page that mounts the component of `part` with the `props` of `state`, under the dev server `url`. */
export const harnessUrlOf = (options: { url: string; part: string; state: string; props: unknown }) =>
  `${options.url.replace(/\/+$/, '')}${HARNESS_PATH}?part=${encodeURIComponent(options.part)}&state=${encodeURIComponent(options.state)}&props=${encodeURIComponent(JSON.stringify(options.props) ?? 'null')}`;

export type Pixels = { width: number; height: number; data: Buffer };

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const paeth = ({ left, up, upLeft }: { left: number; up: number; upLeft: number }) => {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);

  return toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft;
};

/** The RGBA pixels of an 8-bit, non-interlaced RGB or RGBA PNG, as Chromium screenshots write them. */
export const decodePng = (png: Buffer): Pixels => {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');

  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];

  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);

    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;

      if (body[8] !== 8 || channels === 0 || body[12] !== 0)
        throw new Error('only 8-bit, non-interlaced RGB or RGBA PNGs are supported');
    }
    if (type === 'IDAT') data.push(body);
    if (type === 'IEND') break;

    at += length + 12;
  }

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rows = Buffer.alloc(stride * height);
  const out = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    const row = y * stride;

    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? (rows[row + x - channels] ?? 0) : 0;
      const up = y > 0 ? (rows[row - stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= channels ? (rows[row - stride + x - channels] ?? 0) : 0;
      const value = raw[source + x] ?? 0;
      const predicted =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? (left + up) >> 1
              : filter === 4
                ? paeth({ left, up, upLeft })
                : 0;

      rows[row + x] = (value + predicted) & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const from = row + x * channels;
      const to = (y * width + x) * 4;

      out[to] = rows[from] ?? 0;
      out[to + 1] = rows[from + 1] ?? 0;
      out[to + 2] = rows[from + 2] ?? 0;
      out[to + 3] = channels === 4 ? (rows[from + 3] ?? 0) : 255;
    }
  }

  return { width, height, data: out };
};

const chunkOf = (type: string, body: Buffer) => {
  const length = Buffer.alloc(4);
  const sum = Buffer.alloc(4);
  const named = Buffer.concat([Buffer.from(type, 'latin1'), body]);

  length.writeUInt32BE(body.length);
  sum.writeUInt32BE(crc32(named));

  return Buffer.concat([length, named, sum]);
};

/** An 8-bit RGBA PNG of `pixels`. */
export const encodePng = (pixels: Pixels) => {
  const header = Buffer.alloc(13);
  const stride = pixels.width * 4;
  const raw = Buffer.alloc((stride + 1) * pixels.height);

  header.writeUInt32BE(pixels.width, 0);
  header.writeUInt32BE(pixels.height, 4);
  header[8] = 8;
  header[9] = 6;

  for (let y = 0; y < pixels.height; y++) pixels.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);

  return Buffer.concat([
    SIGNATURE,
    chunkOf('IHDR', header),
    chunkOf('IDAT', deflateSync(raw)),
    chunkOf('IEND', Buffer.alloc(0)),
  ]);
};

/** How the app's picture of a state matches the design's at tolerance 0: `ok`, a size mismatch, or a count of differing pixels, with a diff picture unless `ok`. */
export type PixelCompare =
  | { kind: 'ok' }
  | { kind: 'size'; design: Size; app: Size; diff: Buffer }
  | { kind: 'diff'; pixels: number; diff: Buffer };

type Size = { width: number; height: number };

const pixelAt = (pixels: Pixels, { x, y }: { x: number; y: number }) =>
  x < pixels.width && y < pixels.height ? pixels.data.readUInt32BE((y * pixels.width + x) * 4) : null;

/** Compares two PNGs pixel by pixel; the diff picture paints differing pixels red over a faded design. */
export const comparePngs = (options: { design: Buffer; app: Buffer }): PixelCompare => {
  const design = decodePng(options.design);
  const app = decodePng(options.app);
  const width = Math.max(design.width, app.width);
  const height = Math.max(design.height, app.height);
  const data = Buffer.alloc(width * height * 4);
  let pixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = pixelAt(design, { x, y });
      const to = (y * width + x) * 4;

      if (from !== null && from === pixelAt(app, { x, y })) {
        design.data.copy(data, to, (y * design.width + x) * 4, (y * design.width + x) * 4 + 3);
        data[to + 3] = (design.data[(y * design.width + x) * 4 + 3] ?? 0) >> 2;

        continue;
      }

      pixels++;
      data.writeUInt32BE(0xff0000ff, to);
    }
  }

  const sized = design.width === app.width && design.height === app.height;

  if (sized && pixels === 0) return { kind: 'ok' };

  const diff = encodePng({ width, height, data });

  return sized
    ? { kind: 'diff', pixels, diff }
    : {
        kind: 'size',
        design: { width: design.width, height: design.height },
        app: { width: app.width, height: app.height },
        diff,
      };
};

/** The line `design compare` prints for a state. */
export const compareLineOf = (state: string, result: PixelCompare) =>
  result.kind === 'ok'
    ? `${state} ok`
    : result.kind === 'diff'
      ? `${state} DIFF ${result.pixels} px`
      : `${state} SIZE ${result.design.width}x${result.design.height} vs ${result.app.width}x${result.app.height}`;
