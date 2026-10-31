import { Browser } from './thumb';

/**
 * One picture on a contact sheet: its label, and the PNG with the markup it drew, the reason it could not be drawn, a
 * note, or two PNGs whose changed pixels it marks, and whether the markup behind them differs.
 */
export type SheetCell =
  | { label: string; png: Buffer; markup?: string }
  | { label: string; error: string }
  | { label: string; note: string }
  | { label: string; before: Buffer; after: Buffer; over?: string; markupDiffers?: boolean };

const SAME_PIXELS = 'no pixel change';

const SAME_PIXELS_OTHER_MARKUP = 'no pixel change, but the markup differs';

type Pixels = { width: number; height: number; data: Uint8ClampedArray };

/** A rectangle of changed pixels, in pixels from the top left of the picture. */
export type ChangedBox = { x: number; y: number; width: number; height: number };

const CLUSTER_GAP = 16;
const MAX_BOXES = 8;

/**
 * `after` faded to grey with each pixel that differs from `before` in red, over the larger of both sizes, with the
 * count of changed pixels and one box per group of them (16 pixel tiles that touch); a pixel only one of them covers
 * counts as changed. Runs in a browser page through its source, so it may use nothing outside its own body.
 */
export function diffPixelsOf(before: Pixels, after: Pixels) {
  const width = Math.max(before.width, after.width);
  const height = Math.max(before.height, after.height);
  const data = new Uint8ClampedArray(width * height * 4);
  const words = (pixels: Pixels) =>
    new Uint32Array(pixels.data.buffer, pixels.data.byteOffset, pixels.width * pixels.height);
  const beforeWords = words(before);
  const afterWords = words(after);
  const out = new Uint32Array(data.buffer);
  // Word layout is little-endian RGBA (red in the low byte), as on every platform a browser runs on.
  const red = 0xff0000ff;
  const tile = 16;
  const columns = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);
  const tileBounds = new Int32Array(columns * rows * 4).fill(-1);
  let changed = 0;

  for (let y = 0; y < height; y++) {
    const inBoth = y < before.height && y < after.height;
    const commonWidth = inBoth ? Math.min(before.width, after.width) : 0;

    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const pixel = afterWords[y * after.width + x] as number;

      if (x < commonWidth && beforeWords[y * before.width + x] === pixel) {
        const grey = Math.round(
          255 - (255 - ((pixel & 255) + ((pixel >>> 8) & 255) + ((pixel >>> 16) & 255)) / 3) * 0.25,
        );

        out[index] = 0xff000000 | (grey << 16) | (grey << 8) | grey;
      } else {
        changed++;
        out[index] = red;

        const at = (Math.floor(y / tile) * columns + Math.floor(x / tile)) * 4;

        if ((tileBounds[at + 2] as number) < 0) {
          tileBounds.set([x, y, x, y], at);
        } else {
          tileBounds[at] = Math.min(tileBounds[at] as number, x);
          tileBounds[at + 2] = Math.max(tileBounds[at + 2] as number, x);
          tileBounds[at + 3] = y;
        }
      }
    }
  }

  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  const seen = new Uint8Array(columns * rows);
  const isChanged = (cell: number) => (tileBounds[cell * 4 + 2] as number) >= 0;

  for (let start = 0; start < columns * rows; start++) {
    if (seen[start] || !isChanged(start)) continue;

    const stack = [start];
    let [left, top, right, bottom] = [width, height, -1, -1];

    seen[start] = 1;

    while (stack.length > 0) {
      const cell = stack.pop() as number;
      const column = cell % columns;
      const row = (cell - column) / columns;

      left = Math.min(left, tileBounds[cell * 4] as number);
      top = Math.min(top, tileBounds[cell * 4 + 1] as number);
      right = Math.max(right, tileBounds[cell * 4 + 2] as number);
      bottom = Math.max(bottom, tileBounds[cell * 4 + 3] as number);

      for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y++) {
        for (let x = Math.max(0, column - 1); x <= Math.min(columns - 1, column + 1); x++) {
          const next = y * columns + x;

          if (!seen[next] && isChanged(next)) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
    }

    boxes.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 });
  }

  return { width, height, data, changed, boxes };
}

const unionOf = (a: ChangedBox, b: ChangedBox): ChangedBox => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/** The smallest box around every one of `boxes`, or `null` for none. */
export const boundsOf = (boxes: ChangedBox[]) =>
  boxes.length === 0 ? null : boxes.reduce((all, box) => unionOf(all, box));

const isNear = ([a, b]: [ChangedBox, ChangedBox], gap: number) =>
  a.x - gap <= b.x + b.width &&
  b.x - gap <= a.x + a.width &&
  a.y - gap <= b.y + b.height &&
  b.y - gap <= a.y + a.height;

/**
 * `boxes` with every two at most `gap` apart merged into one, top to bottom, then left to right. While more than
 * `max` remain, the gap doubles.
 */
export const clusteredBoxesOf = (boxes: ChangedBox[], options: { gap: number; max?: number }): ChangedBox[] => {
  const { max = MAX_BOXES } = options;
  const clusters = [...boxes];
  let gap = options.gap;
  let merged = true;

  while (merged) {
    merged = false;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = clusters.length - 1; j > i; j--) {
        if (isNear([clusters[i] as ChangedBox, clusters[j] as ChangedBox], gap)) {
          clusters[i] = unionOf(clusters[i] as ChangedBox, clusters[j] as ChangedBox);
          clusters.splice(j, 1);
          merged = true;
        }
      }
    }

    if (!merged && clusters.length > max) {
      gap = Math.max(1, gap * 2);
      merged = true;
    }
  }

  return clusters.sort((a, b) => a.y - b.y || a.x - b.x);
};

// tsx (esbuild keepNames) wraps named inner functions in `__name(...)`, which a browser page does not define.
const diffSourceOf = () => `((__name) => ${diffPixelsOf.toString()})((fn) => fn)`;

/** The width and height a PNG declares in its header. */
export const pngSizeOf = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

/**
 * One crop in CSS pixels per cluster of changed `boxes` (in picture pixels, `scale` per CSS pixel), each widened by
 * `margin` CSS pixels on each side and kept inside the `frame` picture; crops that touch merge. Empty without a box.
 */
export const changedCropsOf = (options: {
  boxes: ChangedBox[];
  frame: { width: number; height: number };
  scale?: number;
  margin?: number;
}): ChangedBox[] => {
  const { boxes, frame, scale = 1, margin = 16 } = options;
  const frameWidth = Math.ceil(frame.width / scale);
  const frameHeight = Math.ceil(frame.height / scale);
  const crops = boxes.map((box) => {
    const x = Math.max(0, Math.floor(box.x / scale) - margin);
    const y = Math.max(0, Math.floor(box.y / scale) - margin);

    return {
      x,
      y,
      width: Math.max(1, Math.min(frameWidth, Math.ceil((box.x + box.width) / scale) + margin) - x),
      height: Math.max(1, Math.min(frameHeight, Math.ceil((box.y + box.height) / scale) + margin) - y),
    };
  });

  return clusteredBoxesOf(crops, { gap: 0 });
};

const drawDiffs = (diff: string) => `(async (diffPixelsOf) => {
  const pixelsOf = async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };
  const lines = [];
  for (const figure of document.querySelectorAll('figure[data-diff]')) {
    const caption = figure.firstElementChild;
    const label = caption.textContent;
    const canvas = figure.querySelector('canvas');
    let result = '${SAME_PIXELS}';
    if (figure.hasAttribute('data-markup-differs')) result = '${SAME_PIXELS_OTHER_MARKUP}';
    if (canvas) {
      const [before, after] = await Promise.all([pixelsOf(canvas.dataset.before), pixelsOf(canvas.dataset.after)]);
      const diff = diffPixelsOf(before, after);
      canvas.width = diff.width;
      canvas.height = diff.height;
      canvas.getContext('2d').putImageData(new ImageData(diff.data, diff.width, diff.height), 0, 0);
      const above = [...(figure.parentElement.previousElementSibling?.children ?? [])].find(
        (sibling) => sibling.firstElementChild.textContent === figure.dataset.over,
      );
      if (above) canvas.style.width = above.getBoundingClientRect().width + 'px';
      if (diff.changed > 0) result = diff.changed + ' px changed';
      caption.textContent += ' - ' + result;
    }
    lines.push(label + ': ' + result);
  }
  return lines;
})(${diff})`;

const changedBoxesIn = (diff: string, urls: string[]) => `(async ([before, after]) => {
  const pixelsOf = async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };
  const [beforePixels, afterPixels] = await Promise.all([pixelsOf(before), pixelsOf(after)]);
  return (${diff})(beforePixels, afterPixels).boxes;
})(${JSON.stringify(urls)})`;

/**
 * One box per cluster of the pixels `after` changes from `before`: groups closer than 16 pixels merge, and at most
 * eight remain. Empty when both draw the same pixels.
 */
export const changedBoxesOf = async (options: { browser: Browser; before: Buffer; after: Buffer }) => {
  const { browser, before, after } = options;

  if (before.equals(after)) return [];

  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    const urls = [before, after].map((png) => `data:image/png;base64,${png.toString('base64')}`);
    const groups = (await page.evaluate(changedBoxesIn(diffSourceOf(), urls))) as ChangedBox[];

    return clusteredBoxesOf(groups, { gap: CLUSTER_GAP });
  } finally {
    await context.close();
  }
};

const escapeHtml = (text: string) =>
  text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');

/** The page that lays each row of cells side by side, a label above every cell, the rows stacked. */
export const contactSheetHtml = (rows: SheetCell[][]) => {
  const dataUrlOf = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;
  const pictureOf = (entry: SheetCell) =>
    'png' in entry
      ? `<img alt="" src="${dataUrlOf(entry.png)}">`
      : 'error' in entry
        ? `<pre>${escapeHtml(entry.error)}</pre>`
        : 'note' in entry
          ? `<pre class="note">${escapeHtml(entry.note)}</pre>`
          : entry.before.equals(entry.after)
            ? `<pre class="same">${entry.markupDiffers ? SAME_PIXELS_OTHER_MARKUP : SAME_PIXELS}</pre>`
            : `<canvas data-before="${dataUrlOf(entry.before)}" data-after="${dataUrlOf(entry.after)}"></canvas>`;
  const cell = (entry: SheetCell) =>
    `<figure${'before' in entry ? ` data-diff data-over="${escapeHtml(entry.over ?? '')}"${entry.markupDiffers ? ' data-markup-differs' : ''}` : ''}><figcaption>${escapeHtml(entry.label)}</figcaption>${pictureOf(entry)}</figure>`;

  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:16px;width:max-content;background:#d4d4d8;font:600 13px/1.2 system-ui,sans-serif;color:#18181b}
.row{display:flex;align-items:flex-start;gap:16px}.row+.row{margin-top:24px}
figure{margin:0}figcaption{margin-bottom:6px}
img,canvas{display:block;background:#fff}canvas{height:auto}
pre{margin:0;max-width:420px;padding:8px;background:#fee2e2;color:#7f1d1d;font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap}
.same{background:#dcfce7;color:#14532d}.note{background:#e4e4e7;color:#3f3f46}
</style>${rows.map((row) => `<div class="row">${row.map(cell).join('')}</div>`).join('')}`;
};

/** Draws the cells into one PNG in the given browser, and returns one line per diff cell with its pixel result. */
export const contactSheetOf = async (options: { browser: Browser; rows: SheetCell[][] }) => {
  const context = await options.browser.newContext({ viewport: { width: 1280, height: 1 } });

  try {
    const page = await context.newPage();

    await page.setContent(contactSheetHtml(options.rows));
    await page.evaluate(`Promise.all([...document.images].map((image) => image.decode()))`);

    const diffs = options.rows.some((row) => row.some((cell) => 'before' in cell))
      ? ((await page.evaluate(drawDiffs(diffSourceOf()))) as string[])
      : [];

    const width = (await page.evaluate('document.body.scrollWidth')) as number;

    await page.setViewportSize({ width: Math.max(width, 1), height: 1 });

    return { png: await page.screenshot({ fullPage: true, type: 'png' }), diffs };
  } finally {
    await context.close();
  }
};
