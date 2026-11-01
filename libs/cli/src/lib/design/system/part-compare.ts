import { crc32, deflateSync, inflateSync } from 'zlib';

export const HARNESS_PATH = '/__design-harness';

export const HARNESS_HOST_SELECTOR = '[data-design-harness-host]';

/**
 * The app's harness page that mounts the component of `part` with the `props` of `state`, under the dev server `url`.
 * With `layout: 'page'` the harness host fills the viewport, otherwise it fits its content.
 */
export const harnessUrlOf = (options: {
  url: string;
  part: string;
  state: string;
  props: unknown;
  layout?: 'page' | null;
}) =>
  `${options.url.replace(/\/+$/, '')}${HARNESS_PATH}?part=${encodeURIComponent(options.part)}&state=${encodeURIComponent(options.state)}&props=${encodeURIComponent(JSON.stringify(options.props) ?? 'null')}${options.layout ? `&layout=${options.layout}` : ''}`;

/**
 * A script that measures the harness host in page pixels as a design frame fits its root: grown down and right to cover each absolutely or fixed positioned descendant as far as the overflow boxes that clip it.
 */
export const HOST_BOX_SCRIPT = `(() => {
  const host = document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)});
  const box = host.getBoundingClientRect();
  const fillsViewport = (style) =>
    style.position === 'fixed' && [style.top, style.right, style.bottom, style.left].every((edge) => parseFloat(edge) === 0);
  const clips = (style) => [style.overflow, style.overflowX, style.overflowY].some((overflow) => overflow && overflow !== 'visible');
  const holdsAbsolute = (style) => !['static', ''].includes(style.position) || !['none', ''].includes(style.transform);
  const clipped = (element) => {
    let { top, right, bottom, left } = element.getBoundingClientRect();
    let escaping = true;

    for (let ancestor = element.parentElement; ancestor && ancestor !== host; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);

      if (escaping && holdsAbsolute(style)) escaping = false;
      if (!escaping && clips(style)) {
        const outer = ancestor.getBoundingClientRect();

        top = Math.max(top, outer.top);
        right = Math.min(right, outer.right);
        bottom = Math.min(bottom, outer.bottom);
        left = Math.max(left, outer.left);
      }
      if (style.position === 'fixed') break;
      if (style.position === 'absolute') escaping = true;
    }

    return { top, right, bottom, left, width: right - left, height: bottom - top };
  };
  const outOfFlow = [...host.querySelectorAll('*')]
    .map((element) => ({ element, style: getComputedStyle(element) }))
    .filter(({ style }) => ['absolute', 'fixed'].includes(style.position) && !fillsViewport(style))
    .map(({ element, style }) => (style.position === 'fixed' ? element.getBoundingClientRect() : clipped(element)))
    .filter((rect) => rect.width > 0 && rect.height > 0);
  const extentOf = (side, start) => Math.max(0, ...outOfFlow.map((rect) => Math.ceil(rect[side] - start)));

  return {
    x: box.left + scrollX,
    y: box.top + scrollY,
    width: Math.max(box.width, extentOf('right', box.left)),
    height: Math.max(box.height, extentOf('bottom', box.top)),
  };
})()`;

/**
 * An element the design picture forces into `interaction`, found in the app by its accessible name: its `aria-label`,
 * or else its `role` (or tag) and text.
 */
export type ForcedElement = { interaction: string; label: string | null; role: string; text: string };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

const unescaped = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? '');

const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'wbr']);

const contentOf = ({ markup, tag, from }: { markup: string; tag: string; from: number }) => {
  if (VOID_TAGS.has(tag) || markup[from - 2] === '/') return '';

  const tags = /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g;
  let depth = 1;

  tags.lastIndex = from;

  for (let found = tags.exec(markup); found; found = tags.exec(markup)) {
    const [, closing, name = '', selfClosing] = found;

    if (name.toLowerCase() !== tag || selfClosing) continue;

    depth += closing ? -1 : 1;

    if (depth === 0) return markup.slice(from, found.index);
  }

  return markup.slice(from);
};

const textOf = (content: string) =>
  unescaped(content.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** The elements a design picture's markup forces with `data-et-force`, one entry per interaction. */
export const forcedElementsOf = (markup: string): ForcedElement[] =>
  [...markup.matchAll(/<([a-zA-Z][\w-]*)[^>]*?\sdata-et-force="([^"]*)"[^>]*>/g)].flatMap((found) => {
    const [tag, name = '', names = ''] = found;
    const label = /\saria-label="([^"]*)"/.exec(tag)?.[1];
    const role = /\srole="([^"]*)"/.exec(tag)?.[1] ?? name.toLowerCase();
    const text = textOf(contentOf({ markup, tag: name.toLowerCase(), from: found.index + tag.length }));

    return names
      .split(/\s+/)
      .filter(Boolean)
      .map((interaction) => ({ interaction, label: label === undefined ? null : unescaped(label), role, text }));
  });

/** A state compare reaches in the app by a pointer click on `control`'s trigger, from the props of state `from`. */
/** A click on `control` from state `from`, its harness page loaded with `props`, or with `from`'s own props when left out. */
export type PointerOpen = { control: string; from: string; props?: Record<string, unknown> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const differingKeysOf = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  new Set([...Object.keys(a), ...Object.keys(b)]).size -
  Object.keys(a).filter((key) => key in b && JSON.stringify(a[key]) === JSON.stringify(b[key])).length;

/** The `data-et-surface` ids a design picture's markup draws. */
export const drawnSurfacesOf = (markup: string) =>
  [...markup.matchAll(/\sdata-et-surface="([^"]*)"/g)].map(([, id = '']) => id);

/**
 * Each state a part's `controls` names as a surface it opens, with the control and the other state of the same
 * `interaction` prop whose props differ from it in the fewest keys; a string where no single such state exists.
 * A state whose `drawn` surface ids already include the opened surface is never a state to click it open from;
 * any other state that draws it is clicked open from the same state, with its own props but the opening ones of that state.
 */
export const pointerOpensOf = (options: {
  states: Record<string, unknown>;
  controls: unknown;
  drawn?: Record<string, readonly string[]>;
}) => {
  const { states, drawn = {} } = options;
  const opens: Record<string, PointerOpen | string> = {};

  for (const [control, declared] of Object.entries(isRecord(options.controls) ? options.controls : {})) {
    const surfaces = isRecord(declared) && isRecord(declared['surfaces']) ? declared['surfaces'] : {};

    for (const [surface, state] of Object.entries(surfaces)) {
      if (typeof state !== 'string' || !(state in states)) continue;

      const props = isRecord(states[state]) ? states[state] : {};
      const ranked = Object.entries(states)
        .filter(
          ([name, other]) =>
            name !== state &&
            !drawn[name]?.includes(`${control}.${surface}`) &&
            JSON.stringify((isRecord(other) ? other : {})['interaction']) === JSON.stringify(props['interaction']),
        )
        .map(([name, other]) => ({ name, distance: differingKeysOf(props, isRecord(other) ? other : {}) }))
        .sort((a, b) => a.distance - b.distance);
      const [nearest, next] = ranked;

      opens[state] = !nearest
        ? `${state} opens a surface of control ${control}, but the part has no other state to click it open from`
        : next && next.distance === nearest.distance
          ? `${state} opens a surface of control ${control}, but states ${ranked
              .filter(({ distance }) => distance === nearest.distance)
              .map(({ name }) => name)
              .join(', ')} are equally close to click it open from`
          : { control, from: nearest.name };

      const open = opens[state];

      if (typeof open === 'string') continue;

      const fromState = states[open.from];
      const from = isRecord(fromState) ? fromState : {};

      for (const [name, other] of Object.entries(states)) {
        if (name === state || name in opens || !drawn[name]?.includes(`${control}.${surface}`)) continue;

        const opened = { ...(isRecord(other) ? other : {}) };

        for (const key of new Set([...Object.keys(props), ...Object.keys(from)])) {
          if (JSON.stringify(props[key]) === JSON.stringify(from[key])) continue;
          if (key in from) opened[key] = from[key];
          else delete opened[key];
        }

        opens[name] = { ...open, props: opened };
      }
    }
  }

  return opens;
};

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
