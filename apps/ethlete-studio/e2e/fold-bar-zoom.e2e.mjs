#!/usr/bin/env node
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';
import { copyPart } from './copy-part.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const built = valueOf('--built') ? resolve(valueOf('--built')) : undefined;
const shots = valueOf('--shots');
const only = valueOf('--case');

process.env['DE_PORT'] ??= '4481';

const TARGET = 'components/zoom-chip';
const VIEW = { systemProduct: 'studio', systemEntry: `sketch:${TARGET}` };
const FOLDED_TIMEOUT_MS = 180000;
const SETTLE_MS = 1500;
const TOLERANCE_PX = 2;
const ZOOM_OUT_STEPS = 3;

const checkout = mkdtempSync(join(tmpdir(), 'studio-fold-bar-zoom-e2e-'));

for (const entry of readdirSync(root)) {
  if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(root, entry), join(checkout, entry));
}
cpSync(join(root, '.ethlete/design'), join(checkout, '.ethlete/design'), { recursive: true });
rmSync(join(checkout, '.ethlete/design/studio/sketches'), { recursive: true, force: true });

const sketchFolder = join(checkout, '.ethlete/design/studio/sketches', TARGET.replace('/', '-'));
const variantFile = join(sketchFolder, 'a', TARGET, 'zoom-chip.ts');

mkdirSync(join(sketchFolder, 'a', dirname(TARGET)), { recursive: true });
copyPart(join(checkout, '.ethlete/design/studio', TARGET), join(sketchFolder, 'a', TARGET));

const source = readFileSync(variantFile, 'utf8');
const changed = source.replace('${props.percent} %', "${props.percent === 250 ? 'x' : props.percent} %");

if (changed === source) throw new Error(`${variantFile}: no percent label to change`);
writeFileSync(variantFile, changed);
writeFileSync(
  join(sketchFolder, 'sketch.json'),
  JSON.stringify({
    target: TARGET,
    targets: [TARGET],
    status: 'ready',
    createdAt: '2026-01-01T00:00:00.000Z',
    rounds: [{ key: 'r1', title: '', note: 'fold-bar-zoom e2e' }],
    variantInfo: { a: { authors: ['fold-bar-zoom-e2e'], round: 'r1' } },
  }),
);

const openView = async ({ page, studioUrl }) => {
  await page.goto(studioUrl);
  await page.evaluate(
    ({ view, checkout }) => {
      localStorage.clear();
      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
    },
    { view: VIEW, checkout },
  );
  await page.goto(studioUrl);
};

const measure = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector('ethlete-sketch-view [data-sk-folded]');
    const grid = document.querySelector('ethlete-sketch-view :is([data-sk-matrix], [data-sk-changed])');
    const cells = [...(grid?.querySelectorAll('[data-sk-row], [data-sk-gutter], [data-sk-line-head]') ?? [])]
      .map((element) => element.getBoundingClientRect())
      .filter((box) => box.width > 0);
    const text = bar?.querySelector('[data-sk-fold-label]') ?? bar?.querySelector('.text-ui-sm');

    return {
      bar: bar?.getBoundingClientRect().width ?? null,
      grid: cells.length
        ? Math.max(...cells.map((box) => box.right)) - Math.min(...cells.map((box) => box.left))
        : null,
      text: text?.getBoundingClientRect().height ?? null,
      percent: document.querySelector('ethlete-sketch-view ethlete-zoom-chip [data-camera-reset]')?.textContent?.trim(),
    };
  });

const barMatchesGridAtEveryZoom = async (context) => {
  const { page } = context;

  await openView(context);

  const label = page.locator('ethlete-sketch-view [data-sk-folded]', { hasText: 'unveränderte' }).first();

  try {
    await label.waitFor({ timeout: FOLDED_TIMEOUT_MS });
  } catch {
    return { ok: false, detail: `no fold bar with unchanged states within ${FOLDED_TIMEOUT_MS} ms` };
  }
  await page.waitForTimeout(SETTLE_MS);

  const canvas = await page.locator('ethlete-sketch-view ethlete-canvas-viewport').first().boundingBox();

  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.keyboard.press('Shift+Digit0');
  await page.waitForTimeout(SETTLE_MS);

  const full = await measure(page);

  if (shots) await page.screenshot({ path: `${shots}-100.png` });

  for (let step = 0; step < ZOOM_OUT_STEPS; step++) {
    await page.locator('ethlete-sketch-view ethlete-zoom-chip [data-camera-out] button').first().click();
    await page.waitForTimeout(SETTLE_MS);
  }

  const out = await measure(page);

  if (shots) await page.screenshot({ path: `${shots}-out.png` });

  const matches = (at) => at.bar !== null && at.grid !== null && Math.abs(at.bar - at.grid) <= TOLERANCE_PX;
  const line = (at) =>
    `${at.percent}: bar ${at.bar?.toFixed(1)} px, grid ${at.grid?.toFixed(1)} px, text ${at.text?.toFixed(1)} px high`;

  return {
    ok: matches(full) && matches(out) && out.text < full.text,
    detail: `${line(full)}; ${line(out)}`,
  };
};

const CASES = [
  {
    name: 'the fold bar is as wide as the grid and zooms with it at 100 % and zoomed out',
    run: barMatchesGridAtEveryZoom,
  },
];

const results = await withStudio(
  async (context) => {
    const rows = [];

    for (const testCase of CASES.filter((testCase) => !only || testCase.name.includes(only))) {
      const startedAt = performance.now();

      rows.push({ name: testCase.name, ...(await testCase.run(context)), ms: performance.now() - startedAt });
    }

    return rows;
  },
  { checkout, built },
).finally(() => rmSync(checkout, { recursive: true, force: true }));

for (const result of results)
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${(result.ms / 1000).toFixed(1)}s  ${result.name}: ${result.detail}`);
process.exit(results.length > 0 && results.every((result) => result.ok) ? 0 : 1);
