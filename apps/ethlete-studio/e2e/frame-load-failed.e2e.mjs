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
import { copyPart } from './copy-part.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;

process.env['DE_PORT'] ??= '4478';

const SYSTEM_VIEW = { systemProduct: 'studio', systemEntry: 'components/zoom-chip' };
const SKETCH_TARGET = 'components/zoom-chip';
const SKETCH_VIEW = { systemProduct: 'studio', systemEntry: `sketch:${SKETCH_TARGET}` };
const SKETCH_MODULE = `/sketches/components-zoom-chip/a/${SKETCH_TARGET}/zoom-chip.ts`;
const UNRELATED_PART = '.ethlete/design/studio/components/error-toast/error-toast.ts';
const FAILED_TIMEOUT_MS = 60000;
const PAGE_TARGET = 'pages/sketches';
const PAGE_SKETCH_VIEW = { systemProduct: 'studio', systemEntry: `sketch:${PAGE_TARGET}` };
const PAGE_VARIANTS = { a: 'red', b: 'green', c: 'blue' };
const DRAWN_TIMEOUT_MS = 180000;
const CHANGE_SETTLE_MS = 1000;
const QUEUED_TIMEOUT_MS = 30000;
const QUEUED_BEFORE_ABANDON = 50;
const SILENT_PAGE = '<!doctype html><html><body></body></html>';

const checkout = mkdtempSync(join(tmpdir(), 'studio-frame-load-failed-e2e-'));

for (const entry of readdirSync(root)) {
  if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(root, entry), join(checkout, entry));
}

cpSync(join(root, '.ethlete/design'), join(checkout, '.ethlete/design'), { recursive: true });
rmSync(join(checkout, '.ethlete/design/studio/sketches'), { recursive: true, force: true });

const sketchFolder = join(checkout, '.ethlete/design/studio/sketches', SKETCH_TARGET.replace('/', '-'));

mkdirSync(join(sketchFolder, 'a', dirname(SKETCH_TARGET)), { recursive: true });
copyPart(join(checkout, '.ethlete/design/studio', SKETCH_TARGET), join(sketchFolder, 'a', SKETCH_TARGET));
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

for (const [variant, colour] of Object.entries(PAGE_VARIANTS)) {
  copyPart(join(checkout, '.ethlete/design/studio', PAGE_TARGET), join(pageSketchFolder, variant, PAGE_TARGET));

  const pageFile = join(pageSketchFolder, variant, PAGE_TARGET, 'sketches.ts');

  const source = readFileSync(pageFile, 'utf8');
  const marked = source.replace(/kit \+\s+styles,/, `kit + styles + 'body * { outline: 1px solid ${colour}; }',`);

  if (marked === source) throw new Error(`${pageFile}: no \`kit + styles\` to mark variant ${variant} with`);

  writeFileSync(pageFile, marked);
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
      Object.keys(PAGE_VARIANTS).map((variant) => [variant, { authors: ['frame-load-failed-e2e'], round: 'r1' }]),
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

  const startedAt = Date.now();
  const seen = { system: null, document: null, documents: 0, server: null };
  const onResponse = (response) => {
    if (seen.system === null && new URL(response.url()).pathname === '/__design/system')
      seen.system = `${response.status()} at ${Date.now() - startedAt} ms`;
  };
  const inFlight = new Map();
  const reasons = { asked: 0, answered: 0 };
  const onRequest = (request) => {
    const url = new URL(request.url());

    inFlight.set(request, { url, at: Date.now() });

    if (!isPartFrame(url)) return;
    if (request.resourceType() !== 'document') {
      reasons.asked++;
      return;
    }
    seen.documents++;
    seen.document ??= Date.now() - startedAt;
    seen.server ??= url.origin;
  };
  const onDone = (request) => {
    const entry = inFlight.get(request);

    inFlight.delete(request);
    if (entry && isPartFrame(entry.url) && request.resourceType() !== 'document') reasons.answered++;
  };
  const pending = () => {
    const now = Date.now();
    const byPath = new Map();

    for (const { url, at } of inFlight.values()) {
      if (url.origin !== seen.server) continue;
      const path = isPartFrame(url) ? `${url.pathname}?part` : url.pathname;
      const [count = 0, oldest = 0] = byPath.get(path) ?? [];

      byPath.set(path, [count + 1, Math.max(oldest, now - at)]);
    }

    return [...byPath].map(([path, [count, oldest]]) => `${path} ${count}x oldest ${oldest} ms`).join(', ') || 'none';
  };

  await page.route(isPartFrame, silence);
  page.on('response', onResponse);
  page.on('request', onRequest);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);

  try {
    await openView(context, SYSTEM_VIEW);

    const banner = page.locator('[data-frame-failed]').first();

    try {
      await banner.waitFor({ timeout: FAILED_TIMEOUT_MS });
    } catch {
      const frames = await page.locator('ethlete-canvas-frame').count();

      return {
        ok: false,
        detail: `no failed-load banner for a frame page that sends no frame message: /__design/system ${seen.system ?? 'never answered'}, first part frame page asked at ${seen.document ?? '-'} ms (${seen.documents} asked), ${frames} canvas frames, failed-load reason fetches ${reasons.answered}/${reasons.asked} answered, design server requests in flight: ${pending()}`,
      };
    }

    const text = (await banner.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
    const reload = await page.locator('[data-frame-reload]').count();
    const marked = await page.locator('ethlete-canvas-frame[data-load-failed]').count();

    return {
      ok: text.includes('Laden fehlgeschlagen.') && text.includes('keine Frame-Nachricht') && reload > 0 && marked > 0,
      detail: `banner "${text}", reload buttons ${reload}, marked frames ${marked}`,
    };
  } finally {
    page.off('response', onResponse);
    page.off('request', onRequest);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onDone);
    await page.unroute(isPartFrame, silence);
  }
};

const cellsOf = async (page, variant) => {
  const cells = await page.$$(`ethlete-sketch-view [data-shot${variant ? `^="${variant} "` : ''}]`);

  return Promise.all(
    cells.map(async (cell) => {
      const key = (await cell.getAttribute('data-shot')) ?? '';
      const picture = await cell
        .$$eval('img[data-shot-picture]', (images) =>
          images.some((image) => image.complete && image.naturalWidth > 0 && !image.classList.contains('hidden')),
        )
        .catch(() => false);
      const frame = await (await cell.$('iframe[data-painted]'))?.contentFrame();
      const text = (await frame?.evaluate(() => (document.body?.innerText ?? '').trim()).catch(() => '')) ?? '';
      const failed = text.startsWith('design-explore:');

      const state = await cell.evaluate((element) => {
        const image = element.querySelector('img[data-shot-picture]');
        const frames = element.querySelectorAll('iframe').length;

        return `${image ? (image.classList.contains('hidden') ? 'picture failed' : image.complete ? 'picture empty' : 'picture loading') : 'no picture'}, ${frames} frame(s)`;
      });

      return {
        key,
        failed,
        error: failed ? text.split('\n').at(-1) : '',
        drawn: !failed && (picture || !!text),
        state,
      };
    }),
  );
};

const drawnCells = async (page, { variant, timeout, rows = [], failedSettles = true }) => {
  const deadline = Date.now() + timeout;
  const settled = (cells) =>
    cells.length > 0 &&
    cells.every((cell) => cell.drawn || (failedSettles && cell.failed)) &&
    rows.every((row) => cells.some((cell) => cell.key.startsWith(`${row} `)));
  let cells = await cellsOf(page, variant);

  while (Date.now() < deadline && !settled(cells)) {
    await page.waitForTimeout(1000);
    cells = await cellsOf(page, variant);
  }

  return cells;
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

  const badge = (await page.locator('[data-sk-render-error] [data-sk-status-button]').getAttribute('aria-label')) ?? '';
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

  const after = await drawnCells(page, { variant: 'a', timeout: FAILED_TIMEOUT_MS, failedSettles: false });
  const drawnAfter = after.filter((cell) => cell.drawn).length;

  return {
    ok:
      badge === 'Fehler prüfen' &&
      mergeWhileFailed === 0 &&
      failedBefore.all > 0 &&
      failedBefore.failed === failedBefore.all &&
      recovered &&
      after.length > 0 &&
      drawnAfter === after.length,
    detail: `badge "${badge}", Übernehmen while failed ${mergeWhileFailed}, frames failed ${failedBefore.failed}/${failedBefore.all}, recovered after a change ${recovered}, variant cells drawn after it ${drawnAfter}/${after.length}${
      drawnAfter < after.length
        ? ` (not drawn: ${after
            .filter((cell) => !cell.drawn)
            .map((cell) => `${cell.key} ${cell.failed ? `failed "${cell.error}"` : 'empty'}, ${cell.state}`)
            .join('; ')})`
        : ''
    }`,
  };
};

const everyPageFrameDraws = async (context) => {
  const { page, designPort } = context;
  const listed = await (await fetch(`http://[::1]:${designPort}/__design/sketches?product=studio`)).json();
  const sketch = listed.sketches.find((candidate) => candidate.target === PAGE_TARGET);
  const unloaded = sketch.targets
    .filter((target) => target.error)
    .map((target) => `${target.variant}: ${target.error}`);

  const drawnTotal = async () => (await (await fetch(`http://[::1]:${designPort}/__design/queue`)).json()).drawnTotal;
  const drawnByListing = await drawnTotal();
  await openView(context, PAGE_SKETCH_VIEW);

  const cells = await drawnCells(page, { timeout: DRAWN_TIMEOUT_MS, rows: Object.keys(PAGE_VARIANTS) });
  const redrawn = (await drawnTotal()) - drawnByListing;
  const drawn = cells.filter((cell) => cell.drawn).length;
  const failed = cells.filter((cell) => cell.failed).map((cell) => `${cell.key}: ${cell.error}`);
  const missing = Object.keys(PAGE_VARIANTS).filter(
    (variant) => !cells.some((cell) => cell.key.startsWith(`${variant} `)),
  );
  const badges = await page.locator('[data-sk-render-error]').count();
  const undrawn = cells.filter((cell) => !cell.drawn && !cell.failed).map((cell) => `${cell.key} (${cell.state})`);

  return {
    ok:
      !redrawn &&
      !unloaded.length &&
      cells.length > 0 &&
      drawn === cells.length &&
      !failed.length &&
      !missing.length &&
      !badges,
    detail: `${drawn}/${cells.length} cells drawn, variants without a cell ${missing.length}${missing.length ? ': ' + missing.join(', ') : ''}, render-error badges ${badges}, failed ${failed.length}${failed.length ? ': ' + failed.slice(0, 4).join('; ') : ''}, unloaded variants ${unloaded.length}${unloaded.length ? ': ' + unloaded.join('; ').slice(0, 300) : ''}, pictures drawn again after the listing compared them ${redrawn}${undrawn.length ? `, undrawn: ${undrawn.slice(0, 8).join('; ')}` : ''}`,
  };
};

const queueOf = async (designPort) => (await fetch(`http://[::1]:${designPort}/__design/queue`)).json();

const abandonedListingLeavesQueue = async (context) => {
  const { page, designPort } = context;

  await page.goto('about:blank');
  appendFileSync(join(checkout, UNRELATED_PART), '\n');
  await page.waitForTimeout(CHANGE_SETTLE_MS);

  const asker = new AbortController();
  const listing = fetch(`http://[::1]:${designPort}/__design/sketches?product=studio`, { signal: asker.signal }).catch(
    () => undefined,
  );
  const deadline = Date.now() + QUEUED_TIMEOUT_MS;
  let queued = (await queueOf(designPort)).queued;

  while (queued < QUEUED_BEFORE_ABANDON && Date.now() < deadline) {
    await page.waitForTimeout(100);
    queued = (await queueOf(designPort)).queued;
  }

  asker.abort();
  await listing;
  await page.waitForTimeout(CHANGE_SETTLE_MS);

  const left = (await queueOf(designPort)).queued;

  return {
    ok: queued >= QUEUED_BEFORE_ABANDON && left === 0,
    detail: `drawings queued when the listing was abandoned ${queued}, still queued ${CHANGE_SETTLE_MS} ms later ${left}`,
  };
};

const CASES = [
  { name: 'a frame that sends no frame message shows the failed load', run: silentFrame },
  {
    name: 'a sketch view of a page with many states draws every frame without a render error',
    run: everyPageFrameDraws,
  },
  {
    name: 'a sketch variant whose module fails shows a render error, no Übernehmen, and recovers on the next change',
    run: failedSketchModule,
  },
  {
    name: 'a sketch listing abandoned after a change to a part the sketch imports leaves no drawing queued',
    run: abandonedListingLeavesQueue,
  },
];

const results = await withStudio(
  async (context) => {
    const rows = [];

    for (const testCase of CASES) {
      const startedAt = performance.now();

      rows.push({ name: testCase.name, ...(await testCase.run(context)), ms: performance.now() - startedAt });
    }

    return rows;
  },
  { checkout, built },
).finally(() => rmSync(checkout, { recursive: true, force: true }));

for (const result of results)
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${(result.ms / 1000).toFixed(1)}s  ${result.name}: ${result.detail}`);
process.exit(results.every((result) => result.ok) ? 0 : 1);
