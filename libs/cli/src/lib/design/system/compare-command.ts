import { mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig, DesignPreset } from '../paths';
import { createDesignServer } from '../serve';
import { checkerScriptOf, createPartShooter, pixelBoxOf, viewportOf } from '../shot';
import { Browser, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { harnessStaleOf } from './harness-map';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import {
  compareLineOf,
  comparePngs,
  ForcedElement,
  drawnSurfacesOf,
  forcedElementsOf,
  HARNESS_HOST_SELECTOR,
  harnessUrlOf,
  hostBoxScriptOf,
  OVERLAY_PANES,
  pointerOpensOf,
} from './part-compare';
import { taskPartOf } from './part-task';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system-modules';

export const COMPARE_USAGE =
  'compare <layer>/<name> --product <name> [--url <app dev server url>] [--state <name>] [--preset <name>]';

export type StateShot = { state: string; design: Buffer; app: Buffer };

export type ShootStates = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url: string;
  only: string | null;
  preset?: string | null;
}) => Promise<{ states: Record<string, unknown>; shots: StateShot[] } | string>;

export type ComparePart = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url: string;
  only: string | null;
  preset?: string | null;
  shoot?: ShootStates;
}) => Promise<{ green: boolean; states: Record<string, unknown> } | string>;

const ROOM_PX = 1024;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

class HarnessError extends Error {}

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

  const triggers = host.locator('[aria-expanded]');
  const trigger = (
    name.label === null
      ? triggers.filter({ hasText: name.text })
      : triggers.and(host.locator(`[aria-label=${JSON.stringify(name.label)}]`))
  ).first();
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

/** The number of overlay panes a design picture draws, as `<et-overlay-container>` mocks. */
const drawnPaneCountOf = (markup: string) => markup.match(/<et-overlay-container[\s>]/g)?.length ?? 0;

const PANE_TRANSITIONS = ['enter-from', 'enter-active', 'enter-to', 'leave-from', 'leave-active', 'leave-to']
  .map((phase) => `.et-animation-${phase}`)
  .join(', ');

const SETTLED_FRAMES = 2;

const PANE_COUNT_TIMEOUT_MS = 3000;

const settledPanesOf = async (options: { page: Page; url: string; count: number; timeout: number }) => {
  const { page, url, count, timeout } = options;

  await page
    .waitForFunction(`document.querySelectorAll(${JSON.stringify(OVERLAY_PANES)}).length >= ${count}`, undefined, {
      timeout: Math.min(timeout, PANE_COUNT_TIMEOUT_MS),
      polling: 'raf',
    })
    .catch(() => undefined);

  await page
    .waitForFunction(
      `(() => {
        const panes = [...document.querySelectorAll(${JSON.stringify(OVERLAY_PANES)})];
        const settled =
          panes.every((pane) => !pane.matches(${JSON.stringify(PANE_TRANSITIONS)}) && !pane.querySelector(${JSON.stringify(PANE_TRANSITIONS)})) &&
          document.getAnimations().every((animation) => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity);

        window.__etSettledFrames = settled ? (window.__etSettledFrames ?? 0) + 1 : 0;

        return window.__etSettledFrames >= ${SETTLED_FRAMES};
      })()`,
      undefined,
      { timeout, polling: 'raf' },
    )
    .catch(() => {
      throw new HarnessError(`the harness page ${url} did not settle its overlay panes within ${timeout} ms`);
    });
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
    throw new HarnessError(
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
        throw new HarnessError(
          `the harness page ${url} has ${count} elements with ${named} to force ${interaction} on`,
        );
    }

    if (Date.now() > deadline)
      throw new HarnessError(`the harness page ${url} has no element with ${named} to force ${interaction} on`);

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
 */
export const harnessShotOf = async (options: {
  browser: Browser;
  url: string;
  size?: DesignPreset | null;
  forced?: ForcedElement[];
  opened?: { control: string; markup: string };
  roomAbove?: boolean;
  panes?: number;
  timeout?: number;
}) => {
  const { browser, url } = options;
  const timeout = options.timeout ?? DRAW_TIMEOUT_MS;
  const room = !options.size && !!options.roomAbove;
  const viewport = viewportOf(options.size ?? null);
  const context = await browser.newContext({
    viewport: room ? { width: viewport.width + ROOM_PX, height: viewport.height + ROOM_PX } : viewport,
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();

    await page.goto(url, { timeout }).catch((error: unknown) => {
      throw new HarnessError(`the harness page ${url} did not load: ${messageOf(error).split('\n')[0] ?? ''}`);
    });

    const host = page.locator(HARNESS_HOST_SELECTOR).first();

    await host.waitFor({ state: 'visible', timeout }).catch(() => {
      throw new HarnessError(
        `the harness page ${url} showed no ${HARNESS_HOST_SELECTOR} element within ${timeout} ms - does the app serve the design harness route?`,
      );
    });
    await page.evaluate('document.fonts.ready');

    if (room) await page.evaluate(`document.documentElement.style.padding = '${ROOM_PX}px 0 0 ${ROOM_PX}px'`);

    await page.mouse.move(-1, -1);

    if (options.opened) await clickOpen({ page, host, url, timeout, ...options.opened });

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
        throw new HarnessError(`compare cannot force ${interaction} on "${forced.label ?? forced.text}" in the app`);
    }

    if (options.panes) await settledPanesOf({ page, url, count: options.panes, timeout });

    if (options.size && (await page.locator(OVERLAY_PANES).count()) === 0) {
      const hostBox = await host.evaluate((element) => {
        const { x, y } = element.getBoundingClientRect();

        return { x: Math.round(x + scrollX), y: Math.round(y + scrollY) };
      });

      await page.evaluate(checkerScriptOf(hostBox));

      return await host.screenshot({ type: 'png', animations: 'disabled', timeout });
    }

    // Waits for a stable host as an element screenshot does; without it an overlay a click opened is not drawn yet.
    await host.scrollIntoViewIfNeeded({ timeout });

    const box = (await page.evaluate(hostBoxScriptOf({ up: room }))) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    const clip = pixelBoxOf(box);

    await page.evaluate(checkerScriptOf(clip));

    return await page.screenshot({
      type: 'png',
      fullPage: true,
      animations: 'disabled',
      clip,
      timeout,
    });
  } finally {
    await context.close();
  }
};

/** Draws each state of a part, or the `only` one, as its design frame and as the app's harness page, in one Chromium. */
export const shootStates: ShootStates = async ({ target, config, product, part, url, only, preset }) => {
  const frame = compareFrameOf({ presets: product.presets, part, preset: preset ?? null });

  if (typeof frame === 'string') return frame;
  if (!(await chromiumOf(target))) return 'compare needs playwright or playwright-core in the checkout';

  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });
  let shooter: ReturnType<typeof createPartShooter> | undefined;

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const system = createSystemModules({ target, config });

    shooter = createPartShooter({ target, base: `http://localhost:${port}`, system, queue });

    const file = product.parts.find((candidate) => partKeyOf(candidate) === part)?.file ?? '';
    const module = (await server.ssrLoadModule(productModuleIdOf({ file, product: product.name }))) as {
      default?: { states?: unknown; controls?: unknown };
    };
    const loaded = module.default?.states;
    const states =
      loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? (loaded as Record<string, unknown>) : {};

    if (only !== null && !(only in states))
      return `${part} has no state "${only}" - its states: ${Object.keys(states).join(', ')}`;

    const controls = module.default?.controls;
    const pictures = shooter;
    const designs = new Map<string, Awaited<ReturnType<typeof pictures.pictureOf>>>();
    const draw = async (state: string) =>
      designs.get(state) ??
      designs
        .set(
          state,
          await pictures.pictureOf({
            product: product.name,
            part,
            state,
            preset: frame.preset,
            width: null,
            sketch: null,
            interaction: null,
            bare: true,
            emptySlots: true,
            checker: true,
            params: new URLSearchParams(),
          }),
        )
        .get(state);
    const opened =
      only !== null &&
      (only in pointerOpensOf({ states, controls }) || drawnSurfacesOf((await draw(only))?.markup ?? '').length > 0);

    for (const state of only === null || opened ? Object.keys(states) : [only]) await draw(state);

    const opens = pointerOpensOf({
      states,
      controls,
      drawn: Object.fromEntries([...designs].map(([state, design]) => [state, drawnSurfacesOf(design.markup ?? '')])),
    });
    const shots: StateShot[] = [];

    for (const state of only === null ? Object.keys(states) : [only]) {
      const design = designs.get(state);
      const open = opens[state];

      if (!design) continue;

      if (typeof open === 'string') return open;

      const app = await queue.run((browser) =>
        harnessShotOf({
          browser,
          url: harnessUrlOf({
            url,
            part,
            state,
            props: open?.props ?? states[open?.from ?? state],
            layout: frame.layout,
          }),
          size: frame.size,
          forced: forcedElementsOf(design.markup ?? ''),
          roomAbove: (design.marks.find((mark) => mark.parts.includes(part))?.y ?? 0) > 0,
          panes: drawnPaneCountOf(design.markup ?? ''),
          ...(open ? { opened: { control: open.control, markup: design.markup ?? '' } } : {}),
        }),
      );

      shots.push({ state, design: design.png, app });
    }

    return { states, shots };
  } catch (error) {
    return messageOf(error);
  } finally {
    await shooter?.close();
    await queue.close();
    await server.close();
  }
};

const fileNameOf = (state: string) => state.replace(/[^\w.-]/g, '-');

/** Compares the design and app pictures of each state at 0 px, prints a line per state, and keeps the pictures of each failing one in a temp folder. */
export const comparePart: ComparePart = async (options) => {
  const shot = await (options.shoot ?? shootStates)(options);

  if (typeof shot === 'string') return shot;
  if (shot.shots.length === 0) return `${options.part} has no states to compare`;

  let dir: string | null = null;

  for (const { state, design, app } of shot.shots) {
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

  return { green: dir === null, states: shot.states };
};

/** `et design compare <layer>/<name> …` compares each state of a part with the app's harness page of its component. */
export const designCompare = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  shoot?: ShootStates;
  start?: StartHarnessServer;
}) => {
  const { target, invocation } = options;
  const args = argsOf(options.argv, ['--product', '--url', '--state', '--preset']);

  if (typeof args === 'string' || args.positional.length !== 1) {
    if (typeof args === 'string') console.error(args);

    console.error(`usage: ${invocation} ${COMPARE_USAGE}`);

    return 2;
  }

  const config = configOf(target);
  const parsed = parseTarget(args.positional[0]);

  if (typeof config === 'string' || typeof parsed === 'string') {
    console.error(typeof config === 'string' ? config : parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const task = taskPartOf({ product, part: partKeyOf(parsed) });
  const refusal = typeof task === 'string' ? task : harnessStaleOf({ target, product });

  if (typeof task === 'string' || refusal !== null) {
    console.error(refusal);

    return 1;
  }

  const compared = await withHarnessUrl({
    target,
    product,
    url: args.values['--url'],
    start: options.start,
    run: (url) =>
      comparePart({
        target,
        config,
        product,
        part: task.part,
        url,
        only: args.values['--state'] ?? null,
        preset: args.values['--preset'] ?? null,
        shoot: options.shoot,
      }),
  });

  if (typeof compared === 'string') {
    console.error(compared);

    return 1;
  }

  return compared.green ? 0 : 1;
};
