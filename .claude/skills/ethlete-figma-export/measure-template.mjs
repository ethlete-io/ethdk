/**
 * Measure real rendered geometry against the numbers in a Figma export.
 *
 * Copy into a scratch directory next to a `styles.css` copied out of a production build,
 * replace MARKUP / WIDTHS / DESIGN / probe(), then `node measure-template.mjs`.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

// This runs from a scratch directory, so Playwright cannot be resolved by name — point
// createRequire at the repo root. Playwright is CommonJS; a named import fails.
const REPO_ROOT = '/absolute/path/to/repo'; // <-- change me
const { chromium } = createRequire(`${REPO_ROOT}/`)('playwright');

/** One instance of the thing under test. Keep the real component classes verbatim. */
const MARKUP = (id) => `
  <div id="${id}-card" class="…">
    <h4 id="${id}-title" class="…">Some realistically long label</h4>
  </div>`;

/** Container widths to probe, taken from the export's frames — not from viewport breakpoints. */
const WIDTHS = [956, 640];

/** What the export says each width should produce. */
const DESIGN = {
  956: { cols: 4, cardW: 219, cardH: 60 },
  640: { cols: 3, cardW: 192, cardH: 60 },
};

// Column, never row: in a flex row the harness items shrink, and container queries then
// report results for a width the component would never actually see.
const page = (blocks) => `<!doctype html><html class="et-surface--dark"><head><meta charset="utf-8">
<link rel="stylesheet" href="./styles.css"></head>
<body class="et-surface--dark" style="margin:0;padding:24px;display:flex;flex-direction:column;gap:24px;align-items:flex-start">
${blocks}
</body></html>`;

const block = (width) => `<div id="w${width}" class="@container" style="width:${width}px">
  <div class="…">${MARKUP(`w${width}`)}</div>
</div>`;

// page.setContent() renders on about:blank, which blocks file:// subresources — the
// stylesheet would silently never load. Write a real file and navigate to it.
writeFileSync('harness.html', page(WIDTHS.map(block).join('\n')));

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });

await tab.goto(`file://${process.cwd()}/harness.html`);
await tab.waitForTimeout(300);

const measured = await tab.evaluate((widths) => {
  const round = (value) => Math.round(value * 100) / 100;
  const box = (id) => document.getElementById(id).getBoundingClientRect();
  const font = (id) => getComputedStyle(document.getElementById(id));

  return widths.map((width) => {
    const card = box(`w${width}-card`);
    const title = font(`w${width}-title`);

    return {
      width,
      cardW: round(card.width),
      cardH: round(card.height),
      titleInset: round(box(`w${width}-title`).left - card.left),
      fontSize: title.fontSize,
      lineHeight: title.lineHeight,
      letterSpacing: title.letterSpacing,
    };
  });
}, WIDTHS);

let failures = 0;

for (const row of measured) {
  const want = DESIGN[row.width];
  const ok = Math.abs(row.cardW - want.cardW) < 1 && Math.abs(row.cardH - want.cardH) < 0.5;

  if (!ok) failures++;

  console.log(`${String(row.width).padStart(4)}px | ${ok ? 'OK ' : 'BAD'} |`, row);
}

console.log(failures === 0 ? '\nALL GEOMETRY MATCHES' : `\n${failures} MISMATCHES`);

await tab.screenshot({ path: 'verify.png', fullPage: true });
await browser.close();
