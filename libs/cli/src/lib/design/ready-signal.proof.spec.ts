import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import { join, resolve } from 'path';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chromiumOf } from './browser';
import { readConfig } from './design-config';
import { createDesignServer } from './serve';
import { settleFrames } from './settle-frames';
import { pixelBoxOf, viewportOf } from './shot';
import { shootStatesWith } from './system/compare-command';
import { withHarnessUrl } from './system/harness-server';
import { harnessShotOf } from './system/harness-shot';
import { comparePngs, HARNESS_PATH } from './system/part-compare';
import { partKeyOf } from './system/resolve-product';
import { reachableBaseOf } from './system/served-cache';
import { createSystemModules, productModuleIdOf } from './system/system-modules';
import { createDrawQueue, DRAW_BROWSER_ARGS, openFrame, switchFrame } from './thumb';

// A worker thread cannot load the TypeScript source of the render worker, so the parts drawn by an app render need it bundled.
vi.mock('./package-root', async (importOriginal) => {
  const { buildSync } = await import('esbuild');
  const { mkdtempSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const original = await importOriginal<typeof import('./package-root')>();
  const worker = join(mkdtempSync(join(tmpdir(), 'ready-proof-')), 'render-worker.js');

  buildSync({
    entryPoints: [join(__dirname, 'render-worker.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    outfile: worker,
    logLevel: 'error',
  });

  return {
    ...original,
    packageFileOf: (file: string) => (file.endsWith('render-worker.js') ? worker : original.packageFileOf(file)),
  };
});

const TARGET = resolve(__dirname, '../../../../..');
const LATE_MS = Number(process.env['B498_LATE_MS'] ?? 1500);
const PAGES_AT_ONCE = Number(process.env['B498_PAGES'] ?? 6);
const OUT = resolve(TARGET, process.env['B498_OUT'] ?? 'tmp/b498-ready-proof');
const PRODUCTS = process.env['B498_PRODUCTS']?.split(',') ?? null;
const PARTS = process.env['B498_PARTS']?.split(',') ?? null;
const SHOWN = 60;

type Drift = { side: 'design' | 'app'; where: string; state: string; pixels: number | string };

const keepDrift = (drifts: Drift[], drift: Omit<Drift, 'pixels'>, ready: Buffer, late: Buffer | null) => {
  if (!late) {
    drifts.push({ ...drift, pixels: 'no late picture' });
    return;
  }

  const result = comparePngs({ design: ready, app: late });

  if (result.kind === 'ok') return;

  const base = join(OUT, `${drift.side} ${drift.where} ${drift.state}`.replace(/[^a-z0-9@.-]+/giu, '_'));

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${base}.ready.png`, ready);
  writeFileSync(`${base}.late.png`, late);
  writeFileSync(`${base}.diff.png`, result.diff);
  drifts.push({
    ...drift,
    pixels:
      result.kind === 'diff'
        ? result.pixels
        : `${result.design.width}x${result.design.height} -> ${result.app.width}x${result.app.height}`,
  });
};

const lineOf = ({ side, where, state, pixels }: Drift) => `${side} ${where} "${state}": ${pixels} px`;

const report = (title: string, drifts: Drift[], shot: number, skipped: string[]) => {
  const lines = [...drifts].map(lineOf).sort();

  const text = [
    `${title}: ${drifts.length} of ${shot} pictures differ ${LATE_MS} ms after ready${drifts.length ? `, pictures in ${OUT}` : ''}`,
    ...lines.slice(0, SHOWN).map((line) => `  ${line}`),
    ...(lines.length > SHOWN ? [`  ... ${lines.length - SHOWN} more`] : []),
    ...(skipped.length ? [`  not shot (${skipped.length}): ${skipped.slice(0, 12).join('; ')}`] : []),
  ].join('\n');

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${title.split(' ')[0]}.txt`), `${text}\n`);
  console.log(text);

  return lines;
};

const undrawnOf = `(() => {
  const root = document.documentElement;
  return root.getAttribute('data-et-error') ?? (root.hasAttribute('data-et-building') ? 'still building' : null);
})()`;

type Frame = { product: string; part: string; file: string; sketch: { target: string; variant: string } | null };

const framesOf = (system: ReturnType<typeof createSystemModules>, product: string): Frame[] => [
  ...(system.productOf(product)?.parts ?? []).map((part) => ({
    product,
    part: partKeyOf(part),
    file: part.file,
    sketch: null,
  })),
  ...system.sketchesOf(product).flatMap((sketch) =>
    sketch.variants.flatMap((variant) => {
      const drawn = system.drawnOf(product, { target: sketch.target, variant });

      return !drawn || 'sketchGone' in drawn
        ? []
        : drawn.parts
            .filter((part) => sketch.targets.includes(partKeyOf(part)))
            .map((part) => ({
              product,
              part: partKeyOf(part),
              file: part.file,
              sketch: { target: sketch.target, variant },
            }));
    }),
  ),
];

const rootShotOf = async (page: Page) => {
  const box = await page.locator('#root').boundingBox();

  return page.screenshot({
    type: 'png',
    fullPage: true,
    omitBackground: true,
    ...(box && box.width > 0 && box.height > 0 ? { clip: pixelBoxOf(box) } : {}),
  });
};

type Pair = { url: string; ready: Buffer; late: Buffer | null };

/** A Chromium whose screenshots on a harness page each take a second picture `LATE_MS` later, into `pairs`. */
const recordingChromiumOf = (pairs: Pair[]): typeof chromiumOf => {
  const opened = new WeakMap<Page, string>();
  const paired = async (page: Page, shoot: () => Promise<Buffer>) => {
    const ready = await shoot();
    const url = opened.get(page) ?? page.url();

    if (!url.includes(HARNESS_PATH)) return ready;

    await page.waitForTimeout(LATE_MS);
    pairs.push({ url, ready, late: await shoot().catch(() => null) });

    return ready;
  };
  const bound = <T extends object>(target: T, overrides: Record<string, unknown>): T =>
    new Proxy(target, {
      get: (object, key) => {
        if (typeof key === 'string' && key in overrides) return overrides[key];

        const value: unknown = Reflect.get(object, key, object);

        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(object) : value;
      },
    });
  type Locator = ReturnType<Page['locator']>;
  const locatorOf = (page: Page, locator: Locator): Locator =>
    bound(locator, {
      screenshot: (options?: Parameters<Locator['screenshot']>[0]) => paired(page, () => locator.screenshot(options)),
      first: () => locatorOf(page, locator.first()),
      last: () => locatorOf(page, locator.last()),
      nth: (index: number) => locatorOf(page, locator.nth(index)),
    });
  const pageOf = (page: Page): Page =>
    bound(page, {
      screenshot: (options?: Parameters<Page['screenshot']>[0]) => paired(page, () => page.screenshot(options)),
      locator: (...args: Parameters<Page['locator']>) => locatorOf(page, page.locator(...args)),
      goto: (...args: Parameters<Page['goto']>) => {
        opened.set(page, args[0]);

        return page.goto(...args);
      },
    });
  const contextOf = (context: Awaited<ReturnType<Browser['newContext']>>) =>
    bound(context, { newPage: async () => pageOf(await context.newPage()) });
  const browserOf = (browser: Browser) =>
    bound(browser, {
      newContext: async (...args: Parameters<Browser['newContext']>) => contextOf(await browser.newContext(...args)),
    });

  return async (target) => {
    const found = await chromiumOf(target);

    if (!found) return null;

    return {
      from: found.from,
      chromium: bound(found.chromium, {
        launch: async (...args: Parameters<typeof found.chromium.launch>) =>
          browserOf(await found.chromium.launch(...args)),
      }),
    };
  };
};

const lateChildHtml = (mountMs: number) => `<!doctype html>
<style>body { margin: 0; } [data-design-harness-host] { display: block; min-height: 40px; }</style>
<div data-design-harness-host></div>
<script>
  const mount = () => {
    const part = document.createElement('div');
    part.textContent = 'deferred part';
    part.style.cssText = 'width: 200px; height: 80px; background: rgb(200 0 0); color: white';
    document.querySelector('[data-design-harness-host]').append(part);
  };
  ${mountMs ? `setTimeout(mount, ${mountMs});` : 'mount();'}
</script>`;

const listening = async (server: Server) => {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

describe('B498 R2: a picture taken at the ready signal equals one taken later', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    rmSync(OUT, { recursive: true, force: true });
    browser = await chromium.launch({ args: DRAW_BROWSER_ARGS });
  });

  afterAll(() => browser?.close());

  it('R2.1 an app picture waits for a part the harness host mounts late (finding 543)', async () => {
    if (!browser) throw new Error('no browser');

    const server = createServer((request, response) => {
      const mountMs = Number(new URL(request.url ?? '', 'http://x').searchParams.get('mount') ?? 0);

      response.writeHead(200, { 'content-type': 'text/html' }).end(lateChildHtml(mountMs));
    });
    const base = await listening(server);

    try {
      const shot = (mountMs: number) =>
        harnessShotOf({ browser: browser as Browser, url: `${base}${HARNESS_PATH}?part=x&mount=${mountMs}` });
      const drifts: Drift[] = [];

      keepDrift(
        drifts,
        { side: 'app', where: 'synthetic harness', state: 'mounted 1000 ms late' },
        await shot(0),
        await shot(1000),
      );
      report('R2.1 late-mounted harness part', drifts, 1, []);

      expect(drifts.map(lineOf)).toEqual([]);
    } finally {
      await new Promise((done) => server.close(done));
    }
  }, 60_000);

  it('R2.2 every design part state and sketch variant state draws the same at ready and later (826)', async () => {
    if (!browser) throw new Error('no browser');

    const cwd = process.cwd();
    const config = readConfig(TARGET) ?? {};
    const server = await createDesignServer({ target: TARGET, config, listen: true, port: 0 });
    const system = createSystemModules({ target: TARGET, config });
    const drifts: Drift[] = [];
    const skipped: string[] = [];
    let shot = 0;

    try {
      await server.listen();

      const address = server.httpServer?.address();

      if (!address || typeof address === 'string') throw new Error('the design server has no address');

      const base = reachableBaseOf(address);
      const queue = system
        .products()
        .filter((product) => !PRODUCTS || PRODUCTS.includes(product))
        .flatMap((product) => framesOf(system, product))
        .filter((frame) => !PARTS || PARTS.includes(frame.part));
      const worker = async () => {
        const context = await (browser as Browser).newContext({ viewport: viewportOf(null) });
        const page = await context.newPage();

        try {
          for (let frame = queue.shift(); frame; frame = queue.shift()) {
            const where = `${frame.product} ${frame.part}${frame.sketch ? `@${frame.sketch.target}/${frame.sketch.variant}` : ''}`;
            const module = (await server
              .ssrLoadModule(productModuleIdOf({ file: frame.file, product: frame.product, sketch: frame.sketch }))
              .catch(() => null)) as { default?: { states?: Record<string, unknown> } } | null;
            const states = Object.keys(module?.default?.states ?? {});

            if (states.length === 0) skipped.push(`${where}: no states`);

            for (const [index, state] of states.entries()) {
              try {
                if (index === 0 || !(await switchFrame(page, state)))
                  await openFrame(
                    page,
                    `${base}/frame.html?${new URLSearchParams({
                      product: frame.product,
                      part: frame.part,
                      state,
                      fit: '',
                      ...(frame.sketch ? { sketch: frame.sketch.target, variant: frame.sketch.variant } : {}),
                    })}`,
                  );
                await settleFrames(page);

                const why = (await page.evaluate(undrawnOf)) as string | null;

                if (why !== null) {
                  skipped.push(`${where} "${state}": ${why.split('\n')[0]}`);
                  continue;
                }

                const ready = await rootShotOf(page);

                await page.waitForTimeout(LATE_MS);
                await settleFrames(page);
                shot++;
                keepDrift(drifts, { side: 'design', where, state }, ready, await rootShotOf(page).catch(() => null));
              } catch (error) {
                skipped.push(
                  `${where} "${state}": ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`,
                );
              }
            }
          }
        } finally {
          await context.close();
        }
      };

      await Promise.all(Array.from({ length: PAGES_AT_ONCE }, worker));
    } finally {
      await server.close();
      process.chdir(cwd);
    }

    expect(report('R2.2 design frames', drifts, shot, skipped)).toEqual([]);
  }, 1_800_000);

  it('R2.3 every app picture compare takes equals one taken later (543, 924)', async () => {
    const cwd = process.cwd();
    const config = readConfig(TARGET) ?? {};
    const system = createSystemModules({ target: TARGET, config });
    const product = system.productOf('studio');

    if (!product) throw new Error('no studio product');

    const server = await createDesignServer({ target: TARGET, config, listen: true, port: 0 });
    const pairs: Pair[] = [];
    const queue = createDrawQueue({ target: TARGET, chromiumOf: recordingChromiumOf(pairs) });
    const skipped: string[] = [];
    const parts: string[] = [];

    try {
      await server.listen();

      for (const part of product.parts) {
        const module = (await server
          .ssrLoadModule(productModuleIdOf({ file: part.file, product: product.name }))
          .catch(() => null)) as { default?: { implements?: unknown } } | null;

        if (module?.default?.implements) parts.push(partKeyOf(part));
      }

      const shoot = shootStatesWith({ server: async () => server, queue: () => queue });
      const outcome = await withHarnessUrl({
        target: TARGET,
        product,
        url: process.env['B498_HARNESS_URL'],
        run: async (url) => {
          for (const part of parts) {
            const result = await shoot({ target: TARGET, config, product, part, url, only: null, appRoot: null });

            if (typeof result === 'string') skipped.push(`${part}: ${result.split('\n')[0]}`);
          }
        },
      });

      if (typeof outcome === 'string') throw new Error(outcome);
    } finally {
      await queue.close();
      await server.close();
      process.chdir(cwd);
    }

    const drifts: Drift[] = [];

    for (const { url, ready, late } of pairs) {
      const params = new URL(url).searchParams;

      keepDrift(
        drifts,
        { side: 'app', where: `studio ${params.get('part')}`, state: params.get('state') ?? '' },
        ready,
        late,
      );
    }

    const lines = report('R2.3 app pictures', drifts, pairs.length, skipped);

    expect(pairs.length, `no app picture was shot over ${parts.length} parts: ${skipped.join('; ')}`).toBeGreaterThan(
      0,
    );
    expect(lines).toEqual([]);
  }, 1_800_000);
});
