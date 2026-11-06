import { createHash } from 'crypto';
import { mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig, DesignPreset, viteCacheOf } from '../paths';
import { createDesignServer } from '../serve';
import { timedPhase } from '../phase-timing';
import { buildStampOf } from '../stamp';
import { recordCache } from '../timings';
import { WarmDraw } from '../warm-draw';
import { checkerScriptOf, createPartShooter, pixelBoxOf, TextAmbient, viewportOf } from '../shot';
import { awaitFonts, Browser, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { partActionFailuresOf } from './actions-command';
import {
  AppShotCache,
  browserVersionOf,
  builtAppHashOf,
  cacheKeyOf,
  COMPARE_APP_SHOTS,
  COMPARE_DESIGN_SHOTS,
  createAppShotCache,
} from './compare-cache';
import { harnessStaleOf } from './harness-map';
import { productSampledPropsOf } from './harness-samples';
import { shootLiveStates } from './live-compare';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import {
  compareLineOf,
  comparePngs,
  ForcedElement,
  designOnlyPropsOf,
  drawsSelectedOf,
  drawnSurfacesOf,
  droppedPropsOf,
  forcedElementsOf,
  HARNESS_HOST_SELECTOR,
  harnessUrlOf,
  hostBoxScriptOf,
  OVERLAY_PANES,
  pointerOpensOf,
  slotOnlyStatesOf,
} from './part-compare';
import { doneParts, linkedTaskPartOf } from './part-task';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { watchSdkErrors } from './sdk-errors';
import { PANE_COUNT_TIMEOUT_MS, settledPanesOf } from './settled-panes';
import { inOrderAtOnce } from './in-order-at-once';
import { FrozenAnimation, freezeAnimationsScriptOf, frozenAnimationsOf } from './frozen-animations';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget, SketchTarget } from './sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system-modules';
import { drawnStateNamesOf } from './unchanged-rows';

export const COMPARE_USAGE =
  'compare <layer>/<name> | --all --product <name> [--url <app dev server url>] [--state <name>] [--preset <name>] [--live [--sketch <variant>]]';

/** A state compare could not draw; `undrivable` when the app has no element to force the design's interaction on. */
export type StateShot =
  { state: string; design: Buffer; app: Buffer } | { state: string; problem: string; undrivable?: true };

export type ShootStates = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url: string;
  only: string | null;
  preset?: string | null;
  sketch?: string | null;
  /** Draws the app even for a state compare cannot check against its design: one that differs only inside slots, or sends props the app has no input for. */
  appOnly?: boolean;
  /** The folder of the built harness app `url` serves; without it no app picture is cached. */
  appRoot?: string | null;
}) => Promise<{ states: Record<string, unknown>; shots: StateShot[] } | string>;

export type ComparePart = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url: string;
  only: string | null;
  preset?: string | null;
  sketch?: string | null;
  appRoot?: string | null;
  shoot?: ShootStates;
}) => Promise<{ green: boolean; states: Record<string, unknown> } | string>;

const ROOM_PX = 1024;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

class HarnessError extends Error {}

class UndrivableError extends HarnessError {}

class DroppedPropsError extends Error {}

class MissingPanesError extends Error {}

/** @internal How many states compare shoots at once, design and app pictures alike. */
export const COMPARE_SHOTS_AT_ONCE = 8;

/** @internal The problem of a state whose app opened fewer overlay panes than its design draws. */
export const missingPanesProblemOf = (count: { drawn: number; opened: number }) =>
  `the design draws ${count.drawn} overlay pane${count.drawn === 1 ? '' : 's'}, the app opened ${count.opened} before its panes settled or ${PANE_COUNT_TIMEOUT_MS} ms passed`;

type AppShot = { app: Buffer } | { problem: string; undrivable?: true };

/** @internal The failed state a harness shot's error stands for; rethrows any error that fails the whole compare. */
export const appShotProblemOf = (error: unknown): AppShot => {
  if (error instanceof DroppedPropsError || error instanceof MissingPanesError) return { problem: error.message };
  if (error instanceof UndrivableError) return { problem: error.message, undrivable: true };

  throw error;
};

/**
 * @internal Shoots the app picture of each state that has a design, at most `COMPARE_SHOTS_AT_ONCE` at once, and returns
 * the shots in state order; a state whose pointer open is a string aborts with it before any shot.
 */
export const appShotsOf = async <TDesign extends { png: Buffer }, TOpen>(options: {
  states: string[];
  designs: ReadonlyMap<string, TDesign | undefined>;
  opens: Readonly<Record<string, TOpen | string | undefined>>;
  slotOnly: ReadonlyMap<string, string>;
  shoot: (shot: { state: string; design: TDesign; open: TOpen | undefined }) => Promise<AppShot>;
}): Promise<StateShot[] | string> => {
  const { designs, opens, slotOnly } = options;
  const states = options.states.filter((state) => designs.get(state));
  const aborting = states.map((state) => opens[state]).find((open) => typeof open === 'string');

  if (typeof aborting === 'string') return aborting;

  return inOrderAtOnce({
    items: states,
    limit: COMPARE_SHOTS_AT_ONCE,
    run: async (state): Promise<StateShot> => {
      const design = designs.get(state) as TDesign;
      const base = slotOnly.get(state);

      if (base !== undefined)
        return {
          state,
          problem: `draws like ${base} once compare empties its slots - it differs from ${base} only inside slot() regions, so compare cannot check it`,
        };

      const app = await options.shoot({ state, design, open: opens[state] as TOpen | undefined });

      return 'app' in app ? { state, design: design.png, ...app } : { state, ...app };
    },
  });
};

const MOUNTED_INPUTS_SCRIPT = `(() => {
  const mounted = document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)})?.firstElementChild;
  const ng = window.ng;

  if (!mounted || !ng?.getComponent || !ng.getDirectiveMetadata) return null;

  const component = ng.getComponent(mounted);
  const inputs = component ? ng.getDirectiveMetadata(component)?.inputs : null;

  return inputs ? Object.keys(inputs) : null;
})()`;

/**
 * How compare draws a part: a page at a product preset, the asked one or the first, with the harness host filling
 * its viewport; any other part fitted to its content.
 */
export const compareFrameOf = (options: {
  presets: Record<string, DesignPreset>;
  part: string;
  preset: string | null;
}): { preset: string | null; size: DesignPreset | null; layout: 'page' | null } | string => {
  const { presets, part } = options;

  if (!part.startsWith('pages/'))
    return options.preset === null
      ? { preset: null, size: null, layout: null }
      : `--preset applies to a pages part only, ${part} is fitted to its content`;

  const preset = options.preset ?? Object.keys(presets)[0] ?? '';
  const size = Object.keys(presets).includes(preset) ? presets[preset] : undefined;

  return size
    ? { preset, size, layout: 'page' }
    : `the product has no preset "${preset}" - its presets: ${Object.keys(presets).join(', ')}`;
};

/** The width a non-page part is compared at: the first of the `widths` its design declares, `null` to fit its content. */
export const compareWidthOf = (options: { part: string; widths: unknown }): number | null => {
  const first: unknown = Array.isArray(options.widths) ? options.widths[0] : undefined;

  return !options.part.startsWith('pages/') && typeof first === 'number' && Number.isInteger(first) && first > 0
    ? first
    : null;
};

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

const clickOpen = async (options: {
  page: Page;
  host: ReturnType<Page['locator']>;
  url: string;
  control: string;
  markup: string;
  timeout: number;
}) => {
  const { page, host, url, control, timeout } = options;
  const scratch = await page.context().newPage();
  let name: { label: string | null; text: string } | null;

  try {
    await scratch.setContent(options.markup);
    const trigger = scratch.locator(`[data-et-control=${JSON.stringify(control)}]`).first();

    name =
      (await trigger.count()) === 0
        ? null
        : {
            label: await trigger.getAttribute('aria-label'),
            text: ((await trigger.textContent()) ?? '').replace(/\s+/g, ' ').trim(),
          };
  } finally {
    await scratch.close();
  }

  if (name === null)
    throw new HarnessError(`the design picture has no [data-et-control="${control}"] trigger to click open`);

  const triggerIn = (scope: ReturnType<Page['locator']>) => {
    const triggers = scope.locator('[aria-expanded]');

    return name.label === null
      ? triggers.filter({ hasText: name.text })
      : triggers.and(scope.locator(`[aria-label=${JSON.stringify(name.label)}]`));
  };
  const trigger = triggerIn(host)
    .or(triggerIn(page.locator(OVERLAY_ROOTS)))
    .first();
  const named = name.label ?? name.text;

  await trigger.waitFor({ state: 'visible', timeout }).catch(() => {
    throw new HarnessError(
      `the harness page ${url} has no [aria-expanded] trigger named "${named}" to click control ${control} open`,
    );
  });
  await trigger.click({ timeout });
  await page.mouse.move(-1, -1);
  await trigger
    .and(page.locator('[aria-expanded="true"]'))
    .waitFor({ timeout })
    .catch(() => {
      throw new HarnessError(`a click on "${named}" in ${url} did not open control ${control}`);
    });
};

const OVERLAY_ROOTS = '.et-overlay-runtime-root, .cdk-overlay-container';

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/**
 * The number of overlay panes a design picture draws: each `<et-overlay-container>`, `.et-overlay-runtime-pane`,
 * `<et-menu>` and `<et-select-panel>` mock, as the app renders each of them in a pane of its own. A mock inside a
 * `hidden` element draws none.
 */
export const drawnPaneCountOf = (markup: string) => {
  const open: { tag: string; hidden: boolean }[] = [];
  let count = 0;

  for (const [whole, closing, tag = '', attributes = ''] of markup.matchAll(/<(\/?)([a-zA-Z][\w-]*)(\s[^>]*)?>/g)) {
    if (closing) {
      const at = open.map((element) => element.tag).lastIndexOf(tag);

      if (at >= 0) open.length = at;

      continue;
    }

    const hidden =
      !!open[open.length - 1]?.hidden || /\shidden(?=[\s=/>]|$)/.test(attributes.replace(/"[^"]*"/g, '""'));

    if (
      !hidden &&
      (['et-overlay-container', 'et-menu', 'et-select-panel'].includes(tag) ||
        /\sclass="(?:[^"]*\s)?et-overlay-runtime-pane[\s"]/.test(attributes))
    )
      count++;

    if (!VOID_TAGS.has(tag.toLowerCase()) && !whole.endsWith('/>')) open.push({ tag, hidden });
  }

  return count;
};

const FORCED_POLL_MS = 50;

const escapedForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The one visible app element named as the design's `forced` element: by `aria-label`, else by role or tag and whole
 * text. It looks in the harness host first and in the overlay roots only when the host has none.
 */
const forcedTargetOf = async (options: {
  page: Page;
  host: ReturnType<Page['locator']>;
  forced: ForcedElement;
  url: string;
  timeout: number;
}) => {
  const { page, host, forced, url, timeout } = options;
  const { interaction, label, role, text } = forced;

  if (label === null && text === '')
    throw new UndrivableError(
      `the design forces ${interaction} on a <${role}> without an aria-label or text - compare cannot find it in the app`,
    );

  const named = label === null ? `the ${role} "${text}"` : `the aria-label "${label}"`;
  const matchesIn = (scope: ReturnType<Page['locator']>) =>
    (label === null
      ? scope
          .locator(`[role=${JSON.stringify(role)}]${/^[a-z][\w-]*$/i.test(role) ? `, ${role}:not([role])` : ''}`)
          .filter({
            hasText: new RegExp(`^\\s*${[...text.replace(/\s+/g, '')].map(escapedForRegExp).join('\\s*')}\\s*$`),
          })
      : scope.locator(`[aria-label=${JSON.stringify(label)}]`)
    ).filter({ visible: true });
  const deadline = Date.now() + timeout;

  for (;;) {
    for (const scope of [host, page.locator(OVERLAY_ROOTS)]) {
      const matches = matchesIn(scope);
      const count = await matches.count();

      if (count === 1) return matches;
      if (count > 1)
        throw new UndrivableError(
          `the harness page ${url} has ${count} elements with ${named} to force ${interaction} on`,
        );
    }

    if (Date.now() > deadline)
      throw new UndrivableError(`the harness page ${url} has no element with ${named} to force ${interaction} on`);

    await page.waitForTimeout(FORCED_POLL_MS);
  }
};

/**
 * A PNG of the harness host element at `url`, in the viewport of `size` at device scale 1, or without `size` fitted
 * as a design frame fits its root, with its overflowing positioned descendants and rounded to whole pixels, with the
 * pointer off the page, after a pointer click on the app trigger of the design `markup`'s `[data-et-control]` named
 * `opened`, and with each `forced` element hovered, pressed or keyboard-focused as the design picture forces it.
 * With `roomAbove`, for a design picture drawn above its part root, the fitted host gets room above and before it, so
 * an overlay that opens above neither flips below nor shifts off the viewport edge, and the shot grows up as well.
 * Without `size`, a `width` sets the viewport and the host to that width, as a design frame draws a part with `widths`.
 */
export const harnessShotOf = async (options: {
  browser: Browser;
  url: string;
  size?: DesignPreset | null;
  width?: number | null;
  forced?: ForcedElement[];
  opened?: { control: string; markup: string };
  roomAbove?: boolean;
  panes?: number;
  frozen?: FrozenAnimation[];
  timeout?: number;
  /** The design frame root's text style, set on the host so a part that inherits its type draws in the design's, not the app body's. */
  ambient?: TextAmbient;
  /** Fails with the props the mounted component has no input for, but `designOnly`; skipped in a production build. */
  props?: { sent: unknown; designOnly: ReadonlySet<string> };
  /** Records the steps of the shot as `<phase> load|prepare|drive|settle|screenshot` timing phases. */
  phase?: string;
}) => {
  const { browser, url } = options;
  const step = <T>(name: string, run: () => Promise<T>) =>
    options.phase ? timedPhase(`${options.phase} ${name}`, run) : run();
  const timeout = options.timeout ?? DRAW_TIMEOUT_MS;
  const room = !options.size && !!options.roomAbove;
  const width = options.size ? null : (options.width ?? null);
  const viewport = { ...viewportOf(options.size ?? null), ...(width ? { width } : {}) };
  const context = await step('context', () =>
    browser.newContext({
      viewport: room ? { width: viewport.width + ROOM_PX, height: viewport.height + ROOM_PX } : viewport,
      deviceScaleFactor: 1,
    }),
  );

  try {
    const page = await context.newPage();
    const sdkErrors = watchSdkErrors(page);
    const host = page.locator(HARNESS_HOST_SELECTOR).first();

    await step('load', async () => {
      await page.goto(url, { timeout }).catch((error: unknown) => {
        throw new HarnessError(`the harness page ${url} did not load: ${messageOf(error).split('\n')[0] ?? ''}`);
      });

      await host.waitFor({ state: 'visible', timeout }).catch(() => {
        throw new HarnessError(
          `the harness page ${url} showed no ${HARNESS_HOST_SELECTOR} element within ${timeout} ms - does the app serve the design harness route?`,
        );
      });
    });

    if (width)
      await page.evaluate(
        `document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)}).style.width = '${width}px'`,
      );

    if (options.ambient)
      await page.evaluate(
        `Object.assign(document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)}).style, ${JSON.stringify(options.ambient)})`,
      );

    await step('fonts', () => awaitFonts(page));

    if (options.props) {
      const inputs = (await page.evaluate(MOUNTED_INPUTS_SCRIPT)) as string[] | null;
      const dropped = inputs ? droppedPropsOf({ props: options.props.sent, inputs, ...options.props }) : [];

      if (dropped.length > 0)
        throw new DroppedPropsError(
          `the design prop${dropped.length > 1 ? 's' : ''} ${dropped.join(', ')} ${dropped.length > 1 ? 'have' : 'has'} no input on the app component - the harness drops ${dropped.length > 1 ? 'them' : 'it'}, so compare cannot check this state`,
        );
    }

    if (room) await page.evaluate(`document.documentElement.style.padding = '${ROOM_PX}px 0 0 ${ROOM_PX}px'`);

    await page.mouse.move(-1, -1);

    const { opened } = options;

    if (opened) await step('open', () => clickOpen({ page, host, url, timeout, ...opened }));

    for (const forced of options.forced ?? []) {
      const { interaction } = forced;
      const element = await forcedTargetOf({ page, host, forced, url, timeout });

      if (interaction === 'hover') await element.hover({ timeout });
      else if (interaction === 'active') {
        await element.hover({ timeout });
        await page.mouse.down();
      } else if (interaction === 'focus-visible') {
        await page.keyboard.press('Shift');
        await element.focus({ timeout });
      } else
        throw new UndrivableError(`compare cannot force ${interaction} on "${forced.label ?? forced.text}" in the app`);
    }

    const panes = options.panes ?? 0;
    const { settled, opened: openedPanes } = await step('settle', () =>
      settledPanesOf({ page, count: panes, timeout }),
    );

    if (!settled)
      throw new HarnessError(`the harness page ${url} did not settle its overlay panes within ${timeout} ms`);

    if (openedPanes !== null) throw new MissingPanesError(missingPanesProblemOf({ drawn: panes, opened: openedPanes }));

    if (options.frozen?.length) await page.evaluate(freezeAnimationsScriptOf(options.frozen));

    if (options.size && (await page.locator(OVERLAY_PANES).count()) === 0) {
      const hostBox = await host.evaluate((element) => {
        const { x, y } = element.getBoundingClientRect();

        return { x: Math.round(x + scrollX), y: Math.round(y + scrollY) };
      });

      await page.evaluate(checkerScriptOf(hostBox));

      const png = await step('screenshot', () => host.screenshot({ type: 'png', animations: 'disabled', timeout }));

      const sdkProblem = sdkErrors(`the harness page ${url}`);

      if (sdkProblem) throw new HarnessError(sdkProblem);

      return png;
    }

    // Waits for a stable host as an element screenshot does; without it an overlay a click opened is not drawn yet.
    await step('stable', () => host.scrollIntoViewIfNeeded({ timeout }));

    const box = (await page.evaluate(hostBoxScriptOf({ up: room }))) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    const clip = pixelBoxOf(box);

    await page.evaluate(checkerScriptOf(clip));

    const png = await step('screenshot', () =>
      page.screenshot({
        type: 'png',
        fullPage: true,
        animations: 'disabled',
        clip,
        timeout,
      }),
    );

    const sdkProblem = sdkErrors(`the harness page ${url}`);

    if (sdkProblem) throw new HarnessError(sdkProblem);

    return png;
  } finally {
    await context.close();
  }
};

type DesignServer = Awaited<ReturnType<typeof createDesignServer>>;

type HarnessShot = Omit<Parameters<typeof harnessShotOf>[0], 'browser' | 'phase' | 'timeout'>;

const sha256Of = (text: string) => createHash('sha256').update(text).digest('hex');

/**
 * @internal The disk cache key of an app picture: `salt` (the cli and browser versions), the hash of the built app,
 * and every option the shot is drawn with but the harness origin, whose port changes from run to run.
 */
export const appShotKeyOf = (options: { salt: string; app: string; shot: HarnessShot }) => {
  const { url, opened, props, ...rest } = options.shot;
  const { pathname, search } = new URL(url);

  return cacheKeyOf([
    options.salt,
    options.app,
    `${pathname}${search}`,
    opened ? { control: opened.control, markup: sha256Of(opened.markup) } : null,
    props ? { sent: props.sent ?? null, designOnly: [...props.designOnly].sort() } : null,
    rest,
  ]);
};

/** @internal The disk caches of one compare: design pictures by the files they are drawn from, app pictures by `appShotKeyOf`. */
export const compareCachesOf = (options: {
  target: string;
  server: DesignServer;
  browser: string;
  appRoot: string | null;
}) => {
  const { target, server, appRoot } = options;
  const stamp = buildStampOf();
  const salt = `${stamp.version} ${stamp.build} ${options.browser}`;

  return {
    design: server.shotStore(viteCacheOf(target, COMPARE_DESIGN_SHOTS), options.browser),
    app: appRoot
      ? {
          salt,
          built: timedPhase('compare-app-hash', () => builtAppHashOf(appRoot)),
          cache: createAppShotCache(viteCacheOf(target, COMPARE_APP_SHOTS)),
        }
      : null,
  };
};

/** @internal The app picture of `shot` from `cache`, or drawn by `draw` and kept there; without a cache always drawn. */
export const cachedAppShotOf = async (options: {
  cache: { salt: string; built: string; cache: AppShotCache } | null;
  shot: HarnessShot;
  draw: () => Promise<{ app: Buffer }>;
}) => {
  const { cache } = options;
  const key = cache ? appShotKeyOf({ salt: cache.salt, app: cache.built, shot: options.shot }) : null;
  const kept = key && cache ? cache.cache.read(key) : null;

  recordCache(!!kept);

  if (kept) return kept;

  const drawn = await options.draw();

  if (key) cache?.cache.write(key, drawn);

  return drawn;
};

/** A listening design server and a draw queue that outlive one compare; the owner closes them. */

const ownDraw = async (target: string, config: DesignConfig) => {
  const server = await createDesignServer({ target, config, listen: true, port: 0 });

  try {
    await timedPhase('compare-design-server', () => server.listen());
  } catch (error) {
    await server.close();

    throw error;
  }

  return server;
};

/** `shootStates` drawing on `warm`, or on a design server and Chromium of its own when there is none. */
export const shootStatesWith =
  (warm?: WarmDraw): ShootStates =>
  async ({ target, config, product, part, url, only, preset, appOnly, appRoot }) => {
    const frame = compareFrameOf({ presets: product.presets, part, preset: preset ?? null });

    if (typeof frame === 'string') return frame;

    const browser = await chromiumOf(target);

    if (!browser) return 'compare needs playwright or playwright-core in the checkout';

    const queue = warm ? warm.queue() : createDrawQueue({ target });
    let server: DesignServer | undefined;
    let shooter: ReturnType<typeof createPartShooter> | undefined;

    try {
      server = warm
        ? await timedPhase('compare-design-server', () => warm.server(config))
        : await ownDraw(target, config);

      const { port } = server.httpServer?.address() as AddressInfo;
      const system = createSystemModules({ target, config });
      const caches = compareCachesOf({
        target,
        server,
        browser: browserVersionOf(browser.from),
        appRoot: appRoot ?? null,
      });

      shooter = createPartShooter({ target, base: `http://localhost:${port}`, system, queue, store: caches.design });

      const file = product.parts.find((candidate) => partKeyOf(candidate) === part)?.file ?? '';
      const module = (await server.ssrLoadModule(productModuleIdOf({ file, product: product.name }))) as {
        default?: { states?: unknown; controls?: unknown; widths?: unknown };
      };
      const width = compareWidthOf({ part, widths: module.default?.widths });
      const loaded = module.default?.states;
      const drawn = new Set(await drawnStateNamesOf(module.default));
      const states =
        loaded && typeof loaded === 'object' && !Array.isArray(loaded)
          ? Object.fromEntries(Object.entries(loaded).filter(([state]) => drawn.has(state)))
          : {};

      if (only !== null && !(only in states))
        return `${part} has no state "${only}" - its states: ${Object.keys(states).join(', ')}`;

      const controls = module.default?.controls;
      const pictures = shooter;
      const designs = new Map<string, Awaited<ReturnType<typeof pictures.pictureOf>>>();
      const pictureOf = (state: string, emptySlots: boolean) =>
        pictures.pictureOf({
          product: product.name,
          part,
          state,
          preset: frame.preset,
          width,
          sketch: null,
          interaction: null,
          bare: true,
          emptySlots,
          checker: true,
          params: new URLSearchParams(),
        });

      const slotOnly = await timedPhase('compare-design-shots', async () => {
        const drawn = await inOrderAtOnce({
          items: Object.keys(states),
          limit: COMPARE_SHOTS_AT_ONCE,
          run: (state) => pictureOf(state, true),
        });

        drawn.forEach((design, at) => designs.set(Object.keys(states)[at] ?? '', design));

        const slotted = [...designs.values()].some((design) => design?.markup?.includes('data-et-projected'));

        return slotted
          ? await slotOnlyStatesOf({
              states: Object.keys(states),
              emptied: new Map([...designs].flatMap(([state, design]) => (design ? [[state, design.png]] : []))),
              full: async (state) => (await pictureOf(state, false))?.png ?? null,
            })
          : new Map<string, string>();
      });

      const opens = pointerOpensOf({
        states,
        controls,
        drawn: Object.fromEntries([...designs].map(([state, design]) => [state, drawnSurfacesOf(design.markup ?? '')])),
      });
      const sampled = productSampledPropsOf({ target, product, part });
      const forcing = new Set(
        [...designs].flatMap(([state, design]) => (forcedElementsOf(design?.markup ?? '').length > 0 ? [state] : [])),
      );

      const unshot = await timedPhase('compare-app-shots', () =>
        appShotsOf({
          states: only === null ? Object.keys(states) : [only],
          designs,
          opens,
          slotOnly: appOnly ? new Map() : slotOnly,
          shoot: ({ state, design, open }) => {
            const sent = open?.props ?? states[open?.from ?? state];
            const forced = forcedElementsOf(design.markup ?? '');
            const shot: HarnessShot = {
              url: harnessUrlOf({
                url,
                part,
                state,
                props: sent,
                layout: frame.layout,
              }),
              size: frame.size,
              width,
              forced,
              ...(appOnly
                ? {}
                : {
                    props: {
                      sent,
                      designOnly: new Set([
                        ...designOnlyPropsOf({
                          states,
                          opens,
                          state,
                          forced: forced.map(({ interaction }) => interaction),
                          forcing,
                          selected: drawsSelectedOf(design.markup ?? ''),
                        }),
                        ...sampled,
                      ]),
                    },
                  }),
              roomAbove: (design.marks.find((mark) => mark.parts.includes(part))?.y ?? 0) > 0,
              panes: drawnPaneCountOf(design.markup ?? ''),
              frozen: frozenAnimationsOf(design.markup ?? ''),
              ...(design.ambient ? { ambient: design.ambient } : {}),
              ...(open ? { opened: { control: open.control, markup: design.markup ?? '' } } : {}),
            };

            return cachedAppShotOf({
              cache: caches.app,
              shot,
              draw: () =>
                timedPhase(`compare-app-shot ${state}`, () =>
                  queue.run((browser) =>
                    harnessShotOf({ ...shot, browser, phase: `compare-app-shot ${state}` }).then((app) => ({ app })),
                  ),
                ),
            }).catch(appShotProblemOf);
          },
        }),
      );

      if (typeof unshot === 'string') return unshot;

      return { states, shots: unshot };
    } catch (error) {
      return messageOf(error);
    } finally {
      if (!warm)
        await timedPhase('compare-close', async () => {
          await shooter?.close();
          await queue.close();
          await server?.close();
        });
    }
  };

/** Draws each state of a part, or the `only` one, as its design frame and as the app's harness page, in one Chromium. */
export const shootStates: ShootStates = shootStatesWith();

const fileNameOf = (state: string) => state.replace(/[^\w.-]/g, '-');

/** Compares the design and app pictures of each state at 0 px, prints a line per state, and keeps the pictures of each failing one in a temp folder. */
export const comparePart: ComparePart = async (options) => {
  const shot = await timedPhase('compare-states', () => (options.shoot ?? shootStates)(options));

  if (typeof shot === 'string') return shot;
  if (shot.shots.length === 0) return `${options.part} has no states to compare`;

  const { states, shots } = shot;

  return timedPhase('compare-pixels', () => {
    let dir: string | null = null;

    let failed = false;

    for (const stateShot of shots) {
      const { state } = stateShot;

      if ('problem' in stateShot) {
        console.log(`${state} FAILED ${stateShot.problem}`);
        failed = true;
        continue;
      }

      const { design, app } = stateShot;
      let result: ReturnType<typeof comparePngs>;

      try {
        result = comparePngs({ design, app });
      } catch (error) {
        return `the pictures of ${state} cannot be compared: ${messageOf(error)}`;
      }

      console.log(compareLineOf(state, result));

      if (result.kind === 'ok') continue;

      dir ??= mkdtempSync(join(tmpdir(), 'et-design-compare-'));
      writeFileSync(join(dir, `${fileNameOf(state)}.design.png`), design);
      writeFileSync(join(dir, `${fileNameOf(state)}.app.png`), app);
      writeFileSync(join(dir, `${fileNameOf(state)}.diff.png`), result.diff);
    }

    if (dir !== null) console.log(`pictures: ${dir}`);

    return { green: dir === null && !failed, states };
  });
};

/**
 * `et design compare --all` compares every done part and fails on any deviation or part it cannot compare; a foundation has nothing to compare.
 * `et design compare <layer>/<name> …` compares each state of a part with the app's harness page of its component;
 * with `--live` each live state of a page with the app's real page on the fixed sample of `harness.live`.
 */
export const designCompare = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  shoot?: ShootStates;
  start?: StartHarnessServer;
  actions?: typeof partActionFailuresOf;
}) => {
  const { target, invocation } = options;
  const args = argsOf(options.argv, {
    values: ['--product', '--url', '--state', '--preset', '--sketch'],
    switches: ['--all', '--live'],
  });

  if (typeof args === 'string' || args.positional.length !== (args.flags.has('--all') ? 0 : 1)) {
    if (typeof args === 'string') console.error(args);

    console.error(`usage: ${invocation} ${COMPARE_USAGE}`);

    return 2;
  }

  const config = configOf(target);
  const all = args.flags.has('--all');
  const parsed = all ? null : parseTarget(args.positional[0]);

  if (typeof config === 'string' || typeof parsed === 'string') {
    console.error(typeof config === 'string' ? config : parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const live = args.flags.has('--live');

  if (args.values['--sketch'] !== undefined && !live) {
    console.error('--sketch compares live states only: pass --live');

    return 2;
  }

  if (all && (live || args.values['--state'] !== undefined || args.values['--preset'] !== undefined)) {
    console.error('--all compares every state of every done part: pass no part, --state, --preset or --live');

    return 2;
  }

  const keys = all
    ? doneParts({
        product,
        parts: product.parts.filter((part) => part.layer !== 'foundations').map(partKeyOf),
      })
    : [partKeyOf(parsed as SketchTarget)];

  if (!all && parsed?.layer === 'foundations' && product.parts.some((part) => partKeyOf(part) === keys[0])) {
    console.log(`${keys[0]}: foundation, nothing to compare`);

    return 0;
  }

  if (all && keys.length === 0) {
    console.log(`${product.name}: no done parts to compare`);

    return 0;
  }

  const tasks = keys.map((key) => linkedTaskPartOf({ product, part: key }));
  const refusal = tasks.every((task) => typeof task !== 'string') && !live ? harnessStaleOf({ target, product }) : null;

  if (refusal !== null) {
    console.error(refusal);

    return 1;
  }

  let failed = 0;
  const pending = tasks.flatMap((task) => (typeof task === 'string' ? [] : [task]));

  for (const task of tasks) {
    if (typeof task !== 'string') continue;

    console.error(all ? `${task} - cannot be compared` : task);
    failed++;
  }

  if (pending.length === 0) return 1;

  const compared = await withHarnessUrl({
    target,
    product,
    url: args.values['--url'],
    start: options.start,
    run: async (url, root) => {
      for (const task of pending) {
        if (all) console.log(`== ${task.part}`);

        const result = await comparePart({
          target,
          config,
          product,
          part: task.part,
          url,
          only: args.values['--state'] ?? null,
          preset: args.values['--preset'] ?? null,
          sketch: args.values['--sketch'] ?? null,
          appRoot: root,
          shoot: options.shoot ?? (live ? shootLiveStates : undefined),
        });

        if (typeof result === 'string') {
          console.error(result);
          failed++;
        } else if (!result.green) failed++;
      }

      if (all || live) return { failed, missed: null };

      const missed = await timedPhase('compare-actions', () =>
        (options.actions ?? partActionFailuresOf)({
          target,
          config,
          product,
          part: keys[0] ?? '',
          url: args.values['--url'],
          harness: url,
          appRoot: root,
          onNote: (line) => console.log(line),
        }),
      );

      return { failed, missed };
    },
  });

  if (typeof compared === 'string') {
    console.error(compared);

    return 1;
  }

  const { missed } = compared;

  if (missed === null) return compared.failed === 0 ? 0 : 1;

  if (!Array.isArray(missed)) {
    console.error(`actions not checked: ${missed.unavailable}`);

    return 1;
  }

  missed.forEach((line) => console.error(line));
  console.log(
    missed.length === 0
      ? 'every declared action works'
      : `${missed.length} action${missed.length === 1 ? '' : 's'} missed`,
  );

  return compared.failed === 0 && missed.length === 0 ? 0 : 1;
};
