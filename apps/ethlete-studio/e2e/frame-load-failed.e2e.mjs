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
const PAGE_TARGET = 'pages/sketches';
const PAGE_SKETCH_VIEW = { systemProduct: 'studio', systemEntry: `sketch:${PAGE_TARGET}` };
const PAGE_VARIANTS = ['a', 'b', 'c'];
const DRAWN_TIMEOUT_MS = 180000;
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

const pageSketchFolder = join(checkout, '.ethlete/design/studio/sketches', PAGE_TARGET.replace('/', '-'));

for (const variant of PAGE_VARIANTS) {
  cpSync(join(root, '.ethlete/design/studio', PAGE_TARGET), join(pageSketchFolder, variant, PAGE_TARGET), {
    recursive: true,
  });

  const pageFile = join(pageSketchFolder, variant, PAGE_TARGET, 'sketches.ts');

  writeFileSync(
    pageFile,
    readFileSync(pageFile, 'utf8').replace("label: 'Verwerfen'", `label: 'Verwerfen ${variant}'`),
  );
}
writeFileSync(
  join(pageSketchFolder, 'sketch.json'),
  JSON.stringify({
    target: PAGE_TARGET,
    targets: [PAGE_TARGET],
    status: 'ready',
    createdAt: '2026-01-01T00:00:00.000Z',
    rounds: [{ key: 'r1', title: '', note: 'frame-load-failed e2e' }],
    variantInfo: Object.fromEntries(
      PAGE_VARIANTS.map((variant) => [variant, { authors: ['frame-load-failed-e2e'], round: 'r1' }]),
    ),
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
  const failedFrames = async () => {
    const frames = await Promise.all((await page.$$(variantFrames)).map((frame) => frame.contentFrame()));
    const texts = await Promise.all(
      frames.map((frame) => frame?.evaluate(() => document.body?.innerText ?? '').catch(() => '') ?? ''),
    );

    return { all: texts.length, failed: texts.filter((text) => text.trim().startsWith('design-explore:')).length };
  };
  const failDeadline = Date.now() + FAILED_TIMEOUT_MS;
  let failedBefore = await failedFrames();

  while (failedBefore.failed < failedBefore.all && Date.now() < failDeadline) {
    await page.waitForTimeout(250);
    failedBefore = await failedFrames();
  }

  await page.unroute(isSketchModule, fail);
  appendFileSync(join(checkout, UNRELATED_PART), '\n');

  let recovered = true;

  try {
    await page.locator('[data-sk-row="a"] [data-sk-merge]').waitFor({ timeout: FAILED_TIMEOUT_MS });
    await page.locator('[data-sk-render-error]').waitFor({ state: 'detached', timeout: FAILED_TIMEOUT_MS });
  } catch {
    recovered = false;
  }

  const retried = await page.$$eval(
    variantFrames,
    (frames) => frames.filter((frame) => new URL(frame.src).searchParams.has('retry')).length,
  );

  return {
    ok:
      badge === 'Render-Fehler in dieser Runde' &&
      mergeWhileFailed === 0 &&
      failedBefore.all > 0 &&
      failedBefore.failed === failedBefore.all &&
      recovered &&
      retried === failedBefore.all,
    detail: `badge "${badge}", Übernehmen while failed ${mergeWhileFailed}, frames failed ${failedBefore.failed}/${failedBefore.all}, recovered after a change ${recovered}, variant frames retried ${retried}/${failedBefore.all}`,
  };
};

const everyPageFrameDraws = async (context) => {
  const { page, designPort } = context;
  const listed = await (await fetch(`http://[::1]:${designPort}/__design/sketches?product=studio`)).json();
  const sketch = listed.sketches.find((candidate) => candidate.target === PAGE_TARGET);
  const unloaded = sketch.targets
    .filter((target) => target.error)
    .map((target) => `${target.variant}: ${target.error}`);
  const expected =
    sketch.targets.reduce((sum, target) => sum + target.states.length, 0) + sketch.targets[0].states.length;

  await openView(context, PAGE_SKETCH_VIEW);

  const deadline = Date.now() + DRAWN_TIMEOUT_MS;
  let seen = { frames: 0, drawn: 0, failed: [] };

  while (Date.now() < deadline) {
    const shots = page.frames().filter((frame) => new URL(frame.url()).searchParams.get('part') === PAGE_TARGET);
    const texts = await Promise.all(
      shots.map((frame) =>
        frame
          .evaluate(() => (document.body?.innerText ?? '').trim())
          .then((text) => ({ text, at: new URL(frame.url()).searchParams }))
          .catch(() => ({ text: '', at: new URL(frame.url()).searchParams })),
      ),
    );
    const failed = texts
      .filter(({ text }) => text.startsWith('design-explore:'))
      .map(({ at, text }) => `${at.get('variant') ?? 'current'} ${at.get('state')}: ${text.split('\n').at(-1)}`);

    seen = { frames: expected, drawn: texts.filter(({ text }) => text.length > 0).length - failed.length, failed };

    if (failed.length || (await page.locator('[data-sk-render-error]').count())) break;
    if (expected > 0 && seen.drawn >= expected) break;

    await page.waitForTimeout(1000);
  }

  const badge = (await page.locator('[data-sk-render-error]').allTextContents()).join(' ').trim();

  return {
    ok: !unloaded.length && seen.frames > 0 && seen.drawn >= seen.frames && !seen.failed.length && !badge,
    detail: `${seen.drawn}/${seen.frames} frames drawn, badge "${badge}", failed ${seen.failed.length}${seen.failed.length ? ': ' + seen.failed.slice(0, 4).join('; ') : ''}, unloaded variants ${unloaded.length}${unloaded.length ? ': ' + unloaded.join('; ').slice(0, 300) : ''}`,
  };
};

const CASES = [
  { name: 'a frame that sends no frame message shows the failed load', run: silentFrame },
  {
    name: 'a sketch variant whose module fails shows a render error, no Übernehmen, and recovers on the next change',
    run: failedSketchModule,
  },
  {
    name: 'a sketch view of a page with many states draws every frame without a render error',
    run: everyPageFrameDraws,
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
