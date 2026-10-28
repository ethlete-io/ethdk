import { Browser } from './thumb';

/** One picture on a contact sheet: its label, and the PNG or the reason it could not be drawn. */
export type SheetCell = { label: string; png: Buffer } | { label: string; error: string };

const escapeHtml = (text: string) =>
  text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');

/** The page that lays each row of cells side by side, a label above every cell, the rows stacked. */
export const contactSheetHtml = (rows: SheetCell[][]) => {
  const cell = (entry: SheetCell) =>
    `<figure><figcaption>${escapeHtml(entry.label)}</figcaption>${
      'png' in entry
        ? `<img alt="" src="data:image/png;base64,${entry.png.toString('base64')}">`
        : `<pre>${escapeHtml(entry.error)}</pre>`
    }</figure>`;

  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:16px;width:max-content;background:#d4d4d8;font:600 13px/1.2 system-ui,sans-serif;color:#18181b}
.row{display:flex;align-items:flex-start;gap:16px}.row+.row{margin-top:24px}
figure{margin:0}figcaption{margin-bottom:6px}
img{display:block;background:#fff}
pre{margin:0;max-width:420px;padding:8px;background:#fee2e2;color:#7f1d1d;font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap}
</style>${rows.map((row) => `<div class="row">${row.map(cell).join('')}</div>`).join('')}`;
};

/** Draws the cells into one PNG in the given browser. */
export const contactSheetOf = async (options: { browser: Browser; rows: SheetCell[][] }) => {
  const context = await options.browser.newContext({ viewport: { width: 1280, height: 1 } });

  try {
    const page = await context.newPage();

    await page.setContent(contactSheetHtml(options.rows));
    await page.evaluate(`Promise.all([...document.images].map((image) => image.decode()))`);

    const width = (await page.evaluate('document.body.scrollWidth')) as number;

    await page.setViewportSize({ width: Math.max(width, 1), height: 1 });

    return await page.screenshot({ fullPage: true, type: 'png' });
  } finally {
    await context.close();
  }
};
