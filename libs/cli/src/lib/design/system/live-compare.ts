import { existsSync, readFileSync } from 'fs';
import { AddressInfo } from 'net';
import { dirname, resolve } from 'path';
import { chromiumOf } from '../browser';
import { createDesignServer } from '../serve';
import { createPartShooter, Pan } from '../shot';
import { Browser, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { ShootStates, StateShot } from './compare-command';
import { harnessOf } from './harness-map';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { createSystemModules, productModuleIdOf } from './system-modules';

type Storage = Record<string, unknown>;

/** The sample a page or one of its states changes: host command answers and design server answers over the spec's. */
type LiveSample = { invoke?: Record<string, unknown>; answers?: Record<string, string> };

/** How the live compare reaches one state of a page: the design state it draws, and what the app needs to show it. */
export type LiveState = LiveSample & {
  design: string;
  storage?: Storage;
  click?: string[];
  pan?: Pan;
  compose?: Record<string, Storage>;
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
 * checkout), `storage` the localStorage entries, and `answers` the design server paths answered with a JSON file
 * (relative to the spec) instead of the live design system. `frame` is a PNG (relative to the spec) both sides draw as
 * frame content: the design in each slot the page draws itself, the app as every part shot and frame.
 */
export type LiveSpec = {
  host: string;
  frame?: string;
  invoke?: Record<string, unknown>;
  storage?: Storage;
  answers?: Record<string, string>;
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

/** Why a live spec is unusable, or `null`. */
export const liveSpecProblemOf = (spec: unknown): string | null => {
  if (!isRecord(spec) || typeof spec['host'] !== 'string' || !isRecord(spec['pages']))
    return 'a live spec must be { "host": "<selector>", "pages": { "pages/<name>": { "states": { … } } } }';

  if (spec['storage'] !== undefined && !isRecord(spec['storage'])) return 'storage must be an object';
  if (spec['frame'] !== undefined && typeof spec['frame'] !== 'string') return 'frame must name a PNG file';

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

const hostBoxOf = async (page: Page, host: string) =>
  (await page.locator(host).first().boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

class LiveError extends Error {}

/**
 * A PNG of the app's `spec.host` element on the real page `url`, sized to `size`, running on the fixed sample of
 * `spec`: stubbed desktop host, seeded localStorage, canned design server answers, the given clicks, and taken once
 * the picture stops changing.
 */
export const liveShotOf = async (options: {
  browser: Browser;
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
  const { browser, spec, size, server, checkout } = options;
  const host = options.page.host ?? spec.host;
  const timeout = options.timeout ?? DRAW_TIMEOUT_MS;
  const port = Number(new URL(server).port);
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();
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
        const target = globalThis as unknown as Record<string, unknown>;

        target['__TAURI_INTERNALS__'] = {
          invoke: (command: string) =>
            command in data.invoke ? Promise.resolve(data.invoke[command]) : new Promise(() => undefined),
          transformCallback: () => ++callbacks,
          unregisterCallback: () => undefined,
          convertFileSrc: (path: string) => path,
          metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        };
        Object.entries(data.storage).forEach(([key, value]) => localStorage.setItem(key, value));
      },
      {
        invoke: substitutedOf(invoke, { port, checkout }) as Record<string, unknown>,
        storage: Object.fromEntries(
          Object.entries(storage).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value),
          ]),
        ),
      },
    );

    await page.route(`http://localhost:${port}/**`, async (route) => {
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
    });

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

    const box = await hostBoxOf(page, host);

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

    await page.mouse.move(-1, -1);
    await page.evaluate('document.fonts.ready');
    await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);

    const deadline = Date.now() + timeout;
    let last: Buffer | null = null;
    let same = 0;

    for (;;) {
      const clip = await hostBoxOf(page, host);

      if (Math.round(clip.width) !== size.width || Math.round(clip.height) !== size.height)
        throw new LiveError(
          `${host} measures ${Math.round(clip.width)}x${Math.round(clip.height)} on ${address}, not the ${size.width}x${size.height} of the design`,
        );

      const shot = await page.screenshot({ type: 'png', animations: 'disabled', clip, timeout });

      same = last !== null && shot.equals(last) ? same + 1 : 0;
      last = shot;

      if (same >= STABLE_SHOTS - 1) return shot;
      if (Date.now() > deadline)
        throw new LiveError(`the app page ${address} did not stop changing within ${timeout} ms`);

      await page.waitForTimeout(STABLE_POLL_MS);
    }
  } finally {
    await context.close();
  }
};

/** Draws each live state of a page part, or the `only` one: its design state, and the app's real page on the sample. */
export const shootLiveStates: ShootStates = async ({ target, config, product, part, url, only, preset }) => {
  if (!part.startsWith('pages/')) return `--live compares a pages part only, not ${part}`;

  const live = liveSpecOf({ target, product });

  if (typeof live === 'string') return live;

  const page = live.spec.pages[part];

  if (!page) return `${part} has no live states in the live spec`;
  if (only !== null && !(only in page.states))
    return `${part} has no live state "${only}" - its live states: ${Object.keys(page.states).join(', ')}`;

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

    const file = product.parts.find((candidate) => partKeyOf(candidate) === part)?.file ?? '';
    const module = (await server.ssrLoadModule(productModuleIdOf({ file, product: product.name }))) as {
      default?: { states?: unknown };
    };
    const loaded = module.default?.states;
    const states = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded : {};
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
        sketch: null,
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
