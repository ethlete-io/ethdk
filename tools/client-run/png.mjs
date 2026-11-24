import { inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decodes an 8-bit, non-interlaced PNG (what Chromium screenshots are) into `{ width, height, rgba }`. */
export const decodePng = (buffer) => {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let offset = 8;
  let header;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR')
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        color: body[9],
        interlace: body[12],
      };
    else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  const channels = CHANNELS[header?.color];
  if (!header || header.depth !== 8 || header.interlace !== 0 || !channels)
    throw new Error(`unsupported PNG (depth ${header?.depth}, color ${header?.color}, interlace ${header?.interlace})`);
  const { width, height } = header;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      if (predictor === undefined) throw new Error(`unknown PNG filter ${filter}`);
      pixels[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const at = i * channels;
    const gray = channels <= 2;
    rgba[i * 4] = pixels[at];
    rgba[i * 4 + 1] = gray ? pixels[at] : pixels[at + 1];
    rgba[i * 4 + 2] = gray ? pixels[at] : pixels[at + 2];
    rgba[i * 4 + 3] = channels === 4 ? pixels[at + 3] : channels === 2 ? pixels[at + 1] : 255;
  }
  return { width, height, rgba };
};

const NEAR = 12;
const near = (rgba, i, color) =>
  Math.abs(rgba[i] - color[0]) <= NEAR &&
  Math.abs(rgba[i + 1] - color[1]) <= NEAR &&
  Math.abs(rgba[i + 2] - color[2]) <= NEAR;

/** Share of pixels that differ from the most common colour: near 0 means the picture shows nothing. */
export const inkOf = ({ width, height, rgba }) => {
  const counts = new Map();
  for (let i = 0; i < width * height * 4; i += 16) {
    const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const background = [((top >> 10) & 31) << 3, ((top >> 5) & 31) << 3, (top & 31) << 3];
  let ink = 0;
  for (let i = 0; i < width * height * 4; i += 4) if (!near(rgba, i, background)) ink++;
  return ink / (width * height);
};

/** Share of pixels two pictures of the same size draw differently; 1 when the sizes differ. */
export const differenceOf = (one, two) => {
  if (one.width !== two.width || one.height !== two.height) return 1;
  let changed = 0;
  for (let i = 0; i < one.rgba.length; i += 4)
    if (
      !near(one.rgba, i, [two.rgba[i], two.rgba[i + 1], two.rgba[i + 2]]) ||
      Math.abs(one.rgba[i + 3] - two.rgba[i + 3]) > NEAR
    )
      changed++;
  return changed / (one.width * one.height);
};
