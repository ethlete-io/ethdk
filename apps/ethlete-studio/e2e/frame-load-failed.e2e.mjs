#!/usr/bin/env node
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;

process.env['DE_PORT'] ??= '4478';

const SYSTEM_VIEW = { systemProduct: 'studio', systemEntry: 'pages/system' };
const SKETCH_TARGET = 'components/zoom-chip';
const SKETCH_VIEW = { systemProduct: 'studio', systemEntry: `sketch:${SKETCH_TARGET}` };
const SKETCH_MODULE = `/sketches/components-zoom-chip/a/${SKETCH_TARGET}/zoom-chip.ts`;
const UNRELATED_PART = '.ethlete/design/studio/components/error-toast/error-toast.ts';
const FAILED_TIMEOUT_MS = 60000;
const SILENT_PAGE = '<!doctype html><html><body></body></html>';

const checkout = mkdtempSync(join(tmpdir(), 'studio-frame-load-failed-e2e-'));

for (const entry of readdirSync(root)) {
  if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(root, entry), join(checkout, entry));
}

cpSync(join(root, '.ethlete/design'), join(checkout, '.ethlete/design'), { recursive: true });
rmSync(join(checkout, '.ethlete/design/studio/sketches'), { recursive: true, force: true });

const sketchFolder = join(checkout, '.ethlete/design/studio/sketches', SKETCH_TARGET.replace('/', '-'));

mkdirSync(join(sketchFolder, 'a', dirname(SKETCH_TARGET)), { recursive: true });
cpSync(join(root, '.ethlete/design/studio', SKETCH_TARGET), join(sketchFolder, 'a', SKETCH_TARGET), {
  recursive: true,
});
const variantFile = join(sketchFolder, 'a', SKETCH_TARGET, 'zoom-chip.ts');

writeFileSync(variantFile, readFileSync(variantFile, 'utf8').replace('${props.percent} %', '${props.percent} pct'));
writeFileSync(
  join(sketchFolder, 'sketch.json'),
  JSON.stringify({
    target: SKETCH_TARGET,
    targets: [SKETCH_TARGET],
    status: 'ready',
    createdAt: '2026-01-01T00:00:00.000Z',
    rounds: [{ key: 'r1', title: '', note: 'frame-load-failed e2e' }],
    variantInfo: { a: { authors: ['frame-load-failed-e2e'], round: 'r1' } },
  }),
);

const openView = async ({ page, studioUrl }, view) => {
  await page.goto(studioUrl);
  await page.evaluate(
    ({ view, checkout }) => {
      localStorage.clear();
      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
    },
    { view, checkout },
  );
  await page.goto(studioUrl);
};

const silentFrame = async (context) => {
  const { page } = context;
  const isPartFrame = (url) => url.searchParams.has('product') && url.searchParams.has('part');
  const silence = (route) =>
    route.request().resourceType() === 'document'
      ? route.fulfill({ status: 200, contentType: 'text/html', body: SILENT_PAGE })
      : route.continue();

  await page.route(isPartFrame, silence);

  try {
    await openView(context, SYSTEM_VIEW);

    const banner = page.locator('[data-frame-failed]').first();

    try {
      await banner.waitFor({ timeout: FAILED_TIMEOUT_MS });
    } catch {
      return { ok: false, detail: 'no failed-load banner for a frame page that sends no frame message' };
    }

    const text = (await banner.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
    const reload = await page.locator('[data-frame-reload]').count();
    const marked = await page.locator('ethlete-canvas-frame[data-load-failed]').count();

    return {
      ok: text.includes('Load failed.') && text.includes('sent no frame message') && reload > 0 && marked > 0,
      detail: `banner "${text}", reload buttons ${reload}, marked frames ${marked}`,
    };
  } finally {
    await page.unroute(isPartFrame, silence);
  }
};

const failedSketchModule = async (context) => {
  const { page } = context;
  const isSketchModule = (url) => url.pathname.endsWith(SKETCH_MODULE);
  const fail = (route) => route.abort('failed');
  const variantFrames = 'iframe[data-variant="a"]';

  await page.route(isSketchModule, fail);
  await openView(context, SKETCH_VIEW);

  try {
    await page.locator('[data-sk-render-error]').waitFor({ timeout: FAILED_TIMEOUT_MS });
  } catch {
    await page.unroute(isSketchModule, fail);
    return { ok: false, detail: 'no render-error badge for a variant whose module fails to import' };
  }

  const badge = (await page.locator('[data-sk-render-error]').textContent())?.trim() ?? '';
  const mergeWhileFailed = await page.locator('[data-sk-row="a"] [data-sk-merge]').count();

  await page.unroute(isSketchModule, fail);
  appendFileSync(join(checkout, UNRELATED_PART), '\n');

  let recovered = true;

  try {
    await page.locator('[data-sk-row="a"] [data-sk-merge]').waitFor({ timeout: FAILED_TIMEOUT_MS });
    await page.locator('[data-sk-render-error]').waitFor({ state: 'detached', timeout: FAILED_TIMEOUT_MS });
  } catch {
    recovered = false;
  }

  const retried = await page.$$eval(variantFrames, (frames) =>
    frames.every((frame) => new URL(frame.src).searchParams.has('retry')),
  );

  return {
    ok: badge === 'Render-Fehler in dieser Runde' && mergeWhileFailed === 0 && recovered && retried,
    detail: `badge "${badge}", Übernehmen while failed ${mergeWhileFailed}, recovered after a change ${recovered}, variant frames retried ${retried}`,
  };
};

const CASES = [
  { name: 'a frame that sends no frame message shows the failed load', run: silentFrame },
  {
    name: 'a sketch variant whose module fails shows a render error, no Übernehmen, and recovers on the next change',
    run: failedSketchModule,
  },
];

const results = await withStudio(
  async (context) => {
    const rows = [];

    for (const testCase of CASES) rows.push({ name: testCase.name, ...(await testCase.run(context)) });

    return rows;
  },
  { checkout, built },
).finally(() => rmSync(checkout, { recursive: true, force: true }));

for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}: ${result.detail}`);
process.exit(results.every((result) => result.ok) ? 0 : 1);
