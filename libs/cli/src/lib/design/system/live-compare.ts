import { existsSync, readFileSync } from 'fs';
import { AddressInfo } from 'net';
import { dirname, resolve } from 'path';
import { chromiumOf } from '../browser';
import { createDesignServer } from '../serve';
import { createPartShooter, Pan } from '../shot';
import { awaitFonts, Browser, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { ShootStates, StateShot } from './compare-command';
import { harnessOf } from './harness-map';
import { occludedFramesOf } from './occluded';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { watchSdkErrors } from './sdk-errors';
import { settledPanesOf } from './settled-panes';
import { overlaySketch } from './sketch/overlay';
import { findSketch, parseTarget } from './sketch/sketch';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system-modules';
import { Partless, partSelectorsOf, uncoveredLineOf, uncoveredRegionsOnPage } from './uncovered-regions';

type Storage = Record<string, unknown>;

/** The sample a page or one of its states changes: host command answers and design server answers over the spec's. */
type LiveSample = { invoke?: Record<string, unknown>; answers?: Record<string, string> };

/**
 * How the live compare reaches one state of a page: the design state it draws, and what the app needs to show it.
 * `occluded: true` allows a shell panel to cover a design frame in this state; otherwise compare fails it as OCCLUDED.
 */
export type LiveState = LiveSample & {
  design: string;
  storage?: Storage;
  click?: string[];
  pan?: Pan;
  compose?: Record<string, Storage>;
  occluded?: boolean;
};

export type LivePage = LiveSample & {
  host?: string;
  path?: string;
  storage?: Storage;
  click?: string[];
  states: Record<string, LiveState>;
};

/**
 * The fixed sample the app's real pages run on: `host` is the selector of the element the shot clips to, `invoke`
 * the answers of the desktop host commands (`$port` and `$checkout` stand for the design server port and the
 * checkout; an answer `{ "$messages": [...] }` sends those messages to each channel the command is passed), `storage` the localStorage entries, and `answers` the design server paths answered with a JSON file
 * (relative to the spec) instead of the live design system. `frame` is a PNG (relative to the spec) both sides draw as
 * frame content: the design in each slot the page draws itself, the app as every part shot and frame. `now` is the
 * ISO time the app's clock reads, in UTC, so relative times such as "vor 3 Min" draw the same on every run. `shell`
 * is the selector of the app component whose template, with the components it draws, holds the shell controls that
 * `design actions --live` presses on every page. `partless` lists the app regions, by selector and reason, that no part
 * is meant to cover; compare fails every other visible region outside the part components as UNCOVERED.
 */
export type LiveSpec = {
  host: string;
  shell?: string;
  frame?: string;
  now?: string;
  invoke?: Record<string, unknown>;
  storage?: Storage;
  answers?: Record<string, string>;
  partless?: Partless[];
  pages: Record<string, LivePage>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLabels = (value: unknown) =>
  value === undefined || (Array.isArray(value) && value.every((label) => typeof label === 'string'));

const isAnswers = (value: unknown) =>
  value === undefined || (isRecord(value) && Object.values(value).every((file) => typeof file === 'string'));

/** Why the invoke and answers of a spec, page or state are unusable, or `null`. */
const sampleProblemOf = (sample: Record<string, unknown>) =>
  sample['invoke'] !== undefined && !isRecord(sample['invoke'])
    ? 'invoke must be an object'
    : isAnswers(sample['answers'])
      ? null
      : 'answers must map design server paths to JSON files';

const isPan = (value: unknown) =>
  value === undefined ||
  (isRecord(value) &&
    typeof value['selector'] === 'string' &&
    typeof value['x'] === 'number' &&
    typeof value['y'] === 'number');

const isPartless = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry['selector'] === 'string' &&
      entry['selector'].trim() !== '' &&
      typeof entry['reason'] === 'string' &&
      entry['reason'].trim() !== '',
  );

/** Why a live spec is unusable, or `null`. */
export const liveSpecProblemOf = (spec: unknown): string | null => {
  if (!isRecord(spec) || typeof spec['host'] !== 'string' || !isRecord(spec['pages']))
    return 'a live spec must be { "host": "<selector>", "pages": { "pages/<name>": { "states": { … } } } }';

  if (spec['storage'] !== undefined && !isRecord(spec['storage'])) return 'storage must be an object';
  if (spec['frame'] !== undefined && typeof spec['frame'] !== 'string') return 'frame must name a PNG file';
  if (spec['shell'] !== undefined && typeof spec['shell'] !== 'string') return 'shell must be a selector';
  if (spec['now'] !== undefined && (typeof spec['now'] !== 'string' || Number.isNaN(Date.parse(spec['now']))))
    return 'now must be an ISO time';
  if (spec['partless'] !== undefined && !isPartless(spec['partless']))
    return 'partless must be a list of { "selector", "reason" }';

  const specProblem = sampleProblemOf(spec);

  if (specProblem !== null) return specProblem;

  for (const [part, page] of Object.entries(spec['pages'])) {
    if (!isRecord(page) || !isRecord(page['states'])) return `${part} must have states`;
    if (!isLabels(page['click'])) return `${part}: click must be a list of aria-labels`;
    if (page['host'] !== undefined && typeof page['host'] !== 'string') return `${part}: host must be a selector`;
    if (page['storage'] !== undefined && !isRecord(page['storage'])) return `${part}: storage must be an object`;

    const pageProblem = sampleProblemOf(page);

    if (pageProblem !== null) return `${part}: ${pageProblem}`;

    for (const [name, state] of Object.entries(page['states'])) {
      if (!isRecord(state) || typeof state['design'] !== 'string')
        return `${part} state ${name} must name its design state`;
      if (!isLabels(state['click'])) return `${part} state ${name}: click must be a list of aria-labels`;
      if (!isPan(state['pan'])) return `${part} state ${name}: pan must be { "selector", "x", "y" }`;
      if (state['occluded'] !== undefined && typeof state['occluded'] !== 'boolean')
        return `${part} state ${name}: occluded must be true or false`;

      const stateProblem = sampleProblemOf(state);

      if (stateProblem !== null) return `${part} state ${name}: ${stateProblem}`;
      if (state['storage'] !== undefined && !isRecord(state['storage']))
        return `${part} state ${name}: storage must be an object`;
      if (
        state['compose'] !== undefined &&
        (!isRecord(state['compose']) || !Object.values(state['compose']).every(isRecord))
      )
        return `${part} state ${name}: compose must map parts to props`;
    }
  }

  return null;
};

/** The product's live spec, with the folder its answer files are relative to, or why there is none. */
export const liveSpecOf = (options: { target: string; product: ResolvedProduct }) => {
  const harness = harnessOf(options.product);

  if (harness === null) return `product "${options.product.name}" has no harness in config.json`;
  if (typeof harness === 'string') return harness;
  if (!harness.live) return `product "${options.product.name}" has no harness.live spec in config.json`;

  const file = resolve(options.target, harness.live);

  if (!existsSync(file)) return `the live spec ${harness.live} does not exist`;

  let spec: unknown;

  try {
    spec = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return `the live spec ${harness.live} is no JSON: ${error instanceof Error ? error.message : String(error)}`;
  }

  const problem = liveSpecProblemOf(spec);

  return problem === null ? { spec: spec as LiveSpec, dir: dirname(file) } : `${harness.live}: ${problem}`;
};

/** Merges storage entries: an object value merges into the earlier one, anything else replaces it. */
export const mergedStorageOf = (...layers: (Storage | undefined)[]): Storage => {
  const merge = (into: unknown, value: unknown): unknown =>
    isRecord(into) && isRecord(value)
      ? Object.fromEntries(
          [...new Set([...Object.keys(into), ...Object.keys(value)])].map((key) => [
            key,
            key in value ? merge(into[key], value[key]) : into[key],
          ]),
        )
      : value;

  return layers.reduce<Storage>((merged, layer) => (layer ? (merge(merged, layer) as Storage) : merged), {});
};

/** A value with every `$port` and `$checkout` string replaced. */
export const substitutedOf = (value: unknown, values: { port: number; checkout: string }): unknown => {
  if (value === '$port') return values.port;
  if (value === '$checkout') return values.checkout;
  if (Array.isArray(value)) return value.map((item) => substitutedOf(item, values));
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitutedOf(item, values)]));

  return value;
};

/** The markup that shows the PNG `png` as frame content, at its own size. */
export const frameContentOf = (png: Buffer) =>
  `<img src="data:image/png;base64,${png.toString('base64')}" alt="" class="block">`;

/** A frame page that shows `content` and nothing else. */
const framePageOf = (content: string) =>
  `<!doctype html><html><head><style>html, body { margin: 0; } img { display: block; }</style></head><body>${content}</body></html>`;

/** The answer file of a design server request, by its path and query, else by its path alone. */
export const answerFileOf = (answers: Record<string, string>, url: URL) =>
  answers[`${url.pathname}${url.search}`] ?? answers[url.pathname] ?? null;

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

const STABLE_SHOTS = 3;

const STABLE_POLL_MS = 250;

const hostBoxOf = async (page: Page, { host, timeout = 0 }: { host: string; timeout?: number }) => {
  const deadline = Date.now() + timeout;

  for (;;) {
    const box = await page.locator(host).first().boundingBox();

    if ((box && box.width > 0 && box.height > 0) || Date.now() > deadline)
      return box ?? { x: 0, y: 0, width: 0, height: 0 };

    await page.waitForTimeout(STABLE_POLL_MS);
  }
};

/** A live page that could not be opened or shot, with the reason. */
export class LiveError extends Error {}

/**
 * Opens the app's real page `url` in `context`, sized so its `spec.host` element measures `size`, on the fixed sample of
 * `spec`: stubbed desktop host, seeded localStorage, canned design server answers, and the page's and state's clicks.
 */
export const openLivePage = async (options: {
  context: Awaited<ReturnType<Browser['newContext']>>;
  url: string;
  size: { width: number; height: number };
  spec: LiveSpec;
  dir: string;
  page: LivePage;
  state: LiveState;
  server: string;
  checkout: string;
  timeout: number;
}) => {
  const { context, spec, size, server, checkout, timeout } = options;
  const host = options.page.host ?? spec.host;
  const port = Number(new URL(server).port);
  const page = await context.newPage();
  const sdkErrors = watchSdkErrors(page);

  if (spec.now !== undefined) await page.clock.setFixedTime(spec.now);
  const answers = { ...spec.answers, ...options.page.answers, ...options.state.answers };
  const invoke = { ...spec.invoke, ...options.page.invoke, ...options.state.invoke };
  const frame = spec.frame ? readFileSync(resolve(options.dir, spec.frame)) : null;
  const frameAnswers: Record<string, { contentType: string; body: Buffer | string }> = frame
    ? {
        '/__design/shot': { contentType: 'image/png', body: frame },
        '/frame.html': { contentType: 'text/html', body: framePageOf(frameContentOf(frame)) },
      }
    : {};
  const storage = mergedStorageOf(spec.storage, options.page.storage, options.state.storage);

  await page.addInitScript(
    (data: { invoke: Record<string, unknown>; storage: Record<string, string> }) => {
      let callbacks = 0;
      const registered = new Map<number, (message: unknown) => void>();
      const target = globalThis as unknown as Record<string, unknown>;
      const send = (args: unknown, messages: unknown[]) =>
        Object.values(typeof args === 'object' && args !== null ? args : {}).forEach((value: { id?: unknown }) => {
          const channel = typeof value?.id === 'number' ? registered.get(value.id) : undefined;

          messages.forEach((message, index) => channel?.({ index, message }));
        });

      target['__TAURI_INTERNALS__'] = {
        invoke: (command: string, args: unknown) => {
          if (!(command in data.invoke)) return new Promise(() => undefined);

          const answer = data.invoke[command] as { $messages?: unknown };

          if (!Array.isArray(answer?.$messages)) return Promise.resolve(answer);

          send(args, answer.$messages);

          return Promise.resolve(null);
        },
        transformCallback: (callback: (message: unknown) => void) => {
          registered.set(++callbacks, callback);

          return callbacks;
        },
        unregisterCallback: (id: number) => registered.delete(id),
        convertFileSrc: (path: string) => path,
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      };
      Object.entries(data.storage).forEach(([key, value]) => localStorage.setItem(key, value));
    },
    {
      invoke: substitutedOf(invoke, { port, checkout }) as Record<string, unknown>,
      storage: Object.fromEntries(
        Object.entries(storage).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]),
      ),
    },
  );

  const answer = async (route: Parameters<Parameters<typeof page.route>[1]>[0]) => {
    const url = new URL(route.request().url());
    const file = answerFileOf(answers, url);

    const fixed = frameAnswers[url.pathname];

    if (file === null && fixed)
      return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, ...fixed });
    if (file !== null)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: readFileSync(resolve(options.dir, file)),
      });
    if (url.pathname.endsWith('-events') || route.request().method() !== 'GET') return route.abort();

    const response = await route.fetch({ url: `${server}${url.pathname}${url.search}` }).catch(() => null);

    return response
      ? route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } })
      : route.abort();
  };

  await page.route(`http://localhost:${port}/**`, (route) => answer(route).catch(() => undefined));

  const address = `${options.url.replace(/\/+$/, '')}${options.page.path ?? '/'}`;

  await page.goto(address, { timeout }).catch((error: unknown) => {
    throw new LiveError(`the app page ${address} did not load: ${String(error).split('\n')[0] ?? ''}`);
  });
  await page
    .locator(host)
    .first()
    .waitFor({ state: 'visible', timeout })
    .catch(() => {
      throw new LiveError(`the app page ${address} showed no ${host} within ${timeout} ms`);
    });

  const box = await hostBoxOf(page, { host, timeout });

  await page.setViewportSize({
    width: size.width + Math.round(size.width - box.width),
    height: size.height + Math.round(size.height - box.height),
  });

  for (const label of [...(options.page.click ?? []), ...(options.state.click ?? [])]) {
    const control = page
      .locator(`[aria-label=${JSON.stringify(label)}]`)
      .filter({ visible: true })
      .first();

    await control.click({ timeout }).catch(() => {
      throw new LiveError(`the app page ${address} has no visible control "${label}" to click`);
    });
  }

  return { page, host, address, sdkErrors };
};

/**
 * A PNG of the app's `spec.host` element on the real page `url`, sized to `size`, opened as `openLivePage` does and
 * taken once the picture stops changing. `parts` are the selectors of the part components, which together with the
 * spec's `partless` selectors must cover every visible region of the page.
 */
export const liveShotOf = async (options: {
  browser: Browser;
  parts: string[];
  url: string;
  size: { width: number; height: number };
  spec: LiveSpec;
  dir: string;
  page: LivePage;
  state: LiveState;
  server: string;
  checkout: string;
  timeout?: number;
}) => {
  const { browser, spec, size } = options;
  const timeout = options.timeout ?? DRAW_TIMEOUT_MS;
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    ...(spec.now !== undefined && { timezoneId: 'UTC' }),
  });

  try {
    const { page, host, address, sdkErrors } = await openLivePage({ ...options, context, timeout });

    await page.mouse.move(-1, -1);
    await awaitFonts(page);
    await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);

    const deadline = Date.now() + timeout;
    let last: Buffer | null = null;
    let same = 0;

    for (;;) {
      const clip = await hostBoxOf(page, { host });

      if (Math.round(clip.width) !== size.width || Math.round(clip.height) !== size.height)
        throw new LiveError(
          `${host} measures ${Math.round(clip.width)}x${Math.round(clip.height)} on ${address}, not the ${size.width}x${size.height} of the design`,
        );

      if (!(await settledPanesOf({ page, count: 0, timeout: Math.max(deadline - Date.now(), 0) })))
        throw new LiveError(`the app page ${address} did not settle its overlay panes within ${timeout} ms`);

      const shot = await page.screenshot({ type: 'png', animations: 'disabled', clip, timeout });

      same = last !== null && shot.equals(last) ? same + 1 : 0;
      last = shot;

      if (same >= STABLE_SHOTS - 1) {
        const sdkProblem = sdkErrors(`the app page ${address}`);

        if (sdkProblem) throw new LiveError(sdkProblem);

        const occluded = options.state.occluded
          ? []
          : await occludedFramesOf({ page, host, port: Number(new URL(options.server).port) });
        const uncovered = await uncoveredRegionsOnPage({ page, parts: options.parts, partless: spec.partless ?? [] });
        const findings = [
          ...occluded.map(
            (line) =>
              `OCCLUDED: ${line} on ${address} - the user cannot see what compare checks there; set "occluded": true on the live state if the cover is intended`,
          ),
          ...uncovered.map((region) => uncoveredLineOf(region, address)),
        ];

        if (findings.length > 0) throw new LiveError(findings.join('\n'));

        return shot;
      }
      if (Date.now() > deadline)
        throw new LiveError(`the app page ${address} did not stop changing within ${timeout} ms`);

      await page.waitForTimeout(STABLE_POLL_MS);
    }
  } finally {
    await context.close();
  }
};

/** The file and variant id of `part` as sketch variant `variant` draws it, or why no such sketch variant part exists. */
export const liveSketchOf = (options: {
  product: ResolvedProduct;
  part: string;
  variant: string;
}): { file: string; drawn: SketchVariant } | string => {
  const { product, part, variant } = options;
  const target = parseTarget(part);

  if (typeof target === 'string') return target;

  const sketch = findSketch({ productDir: product.dir, product: product.name, sketch: target });

  if (typeof sketch === 'string') return sketch;
  if (!sketch) return `no open sketch targets ${part}`;
  if (!sketch.variants.includes(variant))
    return `sketch ${sketch.target} has no variant "${variant}" - its variants: ${sketch.variants.join(', ')}`;

  const file = overlaySketch({ product, sketch, variant }).parts.find((entry) => partKeyOf(entry) === part)?.file;

  return file ? { file, drawn: { target: sketch.target, variant } } : `variant "${variant}" holds no part ${part}`;
};

/** Draws each live state of a page part, or the `only` one: its design state, and the app's real page on the sample. */
export const shootLiveStates: ShootStates = async ({ target, config, product, part, url, only, preset, sketch }) => {
  if (!part.startsWith('pages/')) return `--live compares a pages part only, not ${part}`;

  const live = liveSpecOf({ target, product });

  if (typeof live === 'string') return live;

  const page = live.spec.pages[part];

  if (!page) return `${part} has no live states in the live spec`;
  if (only !== null && !(only in page.states))
    return `${part} has no live state "${only}" - its live states: ${Object.keys(page.states).join(', ')}`;

  const sketched = sketch ? liveSketchOf({ product, part, variant: sketch }) : null;

  if (typeof sketched === 'string') return sketched;

  const presetName = preset ?? Object.keys(product.presets)[0] ?? '';
  const presetSize = product.presets[presetName];

  if (presetSize?.height === undefined) return `the product has no preset "${presetName}" with a height`;

  const size = { width: presetSize.width, height: presetSize.height };
  if (!(await chromiumOf(target))) return 'compare needs playwright or playwright-core in the checkout';

  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });
  let shooter: ReturnType<typeof createPartShooter> | undefined;

  try {
    await server.listen();

    const base = `http://localhost:${(server.httpServer?.address() as AddressInfo).port}`;
    const system = createSystemModules({ target, config });

    shooter = createPartShooter({ target, base, system, queue });

    const file = sketched?.file ?? product.parts.find((candidate) => partKeyOf(candidate) === part)?.file ?? '';
    const module = (await server.ssrLoadModule(
      productModuleIdOf({ file, product: product.name, sketch: sketched?.drawn }),
    )) as {
      default?: { states?: unknown };
    };
    const loaded = module.default?.states;
    const states = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded : {};
    const parts = partSelectorsOf({ target, product });
    const slotFill = live.spec.frame ? frameContentOf(readFileSync(resolve(live.dir, live.spec.frame))) : null;
    const shots: StateShot[] = [];

    for (const [name, state] of Object.entries(page.states)) {
      if (only !== null && name !== only) continue;

      if (!(state.design in states)) {
        shots.push({
          state: name,
          problem: `${part} has no design state "${state.design}" - its states: ${Object.keys(states).join(', ')}`,
        });
        continue;
      }

      const design = await shooter.pictureOf({
        product: product.name,
        part,
        state: state.design,
        preset: presetName,
        width: null,
        sketch: sketched?.drawn ?? null,
        interaction: null,
        pan: state.pan ?? null,
        emptySlots: slotFill !== null,
        slotFill,
        compose: state.compose ?? null,
        params: new URLSearchParams(),
      });
      const app = await queue
        .run((browser) =>
          liveShotOf({
            browser,
            parts,
            url,
            size,
            spec: live.spec,
            dir: live.dir,
            page,
            state,
            server: base,
            checkout: target,
          }),
        )
        .catch((error: unknown) => (error instanceof LiveError ? error.message : Promise.reject(error)));

      shots.push(typeof app === 'string' ? { state: name, problem: app } : { state: name, design: design.png, app });
    }

    return { states: page.states, shots };
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await shooter?.close();
    await queue.close();
    await server.close();
  }
};
