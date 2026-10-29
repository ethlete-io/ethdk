import { Browser } from './thumb';

/**
 * One picture on a contact sheet: its label, and the PNG, the reason it could not be drawn, or two PNGs whose
 * changed pixels it marks.
 */
export type SheetCell =
  | { label: string; png: Buffer }
  | { label: string; error: string }
  | { label: string; before: Buffer; after: Buffer; over?: string };

type Pixels = { width: number; height: number; data: Uint8ClampedArray };

/**
 * `after` faded to grey with each pixel that differs from `before` in red, over the larger of both sizes; a pixel
 * only one of them covers counts as changed. Runs in the sheet's page through its source, so it may use nothing
 * outside its own body.
 */
export function diffPixelsOf(before: Pixels, after: Pixels) {
  const width = Math.max(before.width, after.width);
  const height = Math.max(before.height, after.height);
  const data = new Uint8ClampedArray(width * height * 4);
  let changed = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      const inBefore = x < before.width && y < before.height;
      const inAfter = x < after.width && y < after.height;
      const b = (y * before.width + x) * 4;
      const a = (y * after.width + x) * 4;
      let same = inBefore && inAfter;

      for (let channel = 0; same && channel < 4; channel++) same = before.data[b + channel] === after.data[a + channel];

      if (same) {
        const grey = ((after.data[a] ?? 0) + (after.data[a + 1] ?? 0) + (after.data[a + 2] ?? 0)) / 3;

        data.fill(Math.round(255 - (255 - grey) * 0.25), out, out + 3);
      } else {
        changed++;
        data[out] = 255;
      }

      data[out + 3] = 255;
    }
  }

  return { width, height, data, changed };
}

const drawDiffs = (diff: string) => `(async (diffPixelsOf) => {
  const pixelsOf = async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };
  const lines = [];
  for (const figure of document.querySelectorAll('figure[data-diff]')) {
    const caption = figure.firstElementChild;
    const label = caption.textContent;
    const canvas = figure.querySelector('canvas');
    let result = 'no pixel change';
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
        : entry.before.equals(entry.after)
          ? `<pre class="same">no pixel change</pre>`
          : `<canvas data-before="${dataUrlOf(entry.before)}" data-after="${dataUrlOf(entry.after)}"></canvas>`;
  const cell = (entry: SheetCell) =>
    `<figure${'before' in entry ? ` data-diff data-over="${escapeHtml(entry.over ?? '')}"` : ''}><figcaption>${escapeHtml(entry.label)}</figcaption>${pictureOf(entry)}</figure>`;

  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:16px;width:max-content;background:#d4d4d8;font:600 13px/1.2 system-ui,sans-serif;color:#18181b}
.row{display:flex;align-items:flex-start;gap:16px}.row+.row{margin-top:24px}
figure{margin:0}figcaption{margin-bottom:6px}
img,canvas{display:block;background:#fff}canvas{height:auto}
pre{margin:0;max-width:420px;padding:8px;background:#fee2e2;color:#7f1d1d;font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap}
.same{background:#dcfce7;color:#14532d}
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
      ? ((await page.evaluate(drawDiffs(diffPixelsOf.toString()))) as string[])
      : [];

    const width = (await page.evaluate('document.body.scrollWidth')) as number;

    await page.setViewportSize({ width: Math.max(width, 1), height: 1 });

    return { png: await page.screenshot({ fullPage: true, type: 'png' }), diffs };
  } finally {
    await context.close();
  }
};
