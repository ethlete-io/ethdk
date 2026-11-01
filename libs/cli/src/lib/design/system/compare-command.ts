import { mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig, DesignPreset } from '../paths';
import { createDesignServer } from '../serve';
import { createPartShooter, pixelBoxOf, viewportOf } from '../shot';
import { Browser, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { harnessStaleOf } from './harness-map';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import {
  compareLineOf,
  comparePngs,
  ForcedElement,
  forcedElementsOf,
  HARNESS_HOST_SELECTOR,
  harnessUrlOf,
  HOST_BOX_SCRIPT,
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

/**
 * A PNG of the harness host element at `url`, in the viewport of `size` at device scale 1, or without `size` fitted
 * as a design frame fits its root, with its overflowing positioned descendants and rounded to whole pixels,
 * after a pointer click on the app trigger of the design `markup`'s `[data-et-control]` named `opened`, and with each
 * `forced` element hovered, pressed or keyboard-focused as the design picture forces it.
 */
export const harnessShotOf = async (options: {
  browser: Browser;
  url: string;
  size?: DesignPreset | null;
  forced?: ForcedElement[];
  opened?: { control: string; markup: string };
  timeout?: number;
}) => {
  const { browser, url } = options;
  const timeout = options.timeout ?? DRAW_TIMEOUT_MS;
  const context = await browser.newContext({ viewport: viewportOf(options.size ?? null), deviceScaleFactor: 1 });

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

    if (options.opened) await clickOpen({ page, host, url, timeout, ...options.opened });

    for (const { interaction, label } of options.forced ?? []) {
      if (label === null)
        throw new HarnessError(
          `the design forces ${interaction} on an element without an aria-label - compare cannot find it in the app`,
        );

      const element = host.locator(`[aria-label=${JSON.stringify(label)}]`).first();

      await element.waitFor({ state: 'visible', timeout }).catch(() => {
        throw new HarnessError(
          `the harness page ${url} has no element with the aria-label "${label}" to force ${interaction} on`,
        );
      });

      if (interaction === 'hover') await element.hover({ timeout });
      else if (interaction === 'active') {
        await element.hover({ timeout });
        await page.mouse.down();
      } else if (interaction === 'focus-visible') {
        await page.keyboard.press('Shift');
        await element.focus({ timeout });
      } else throw new HarnessError(`compare cannot force ${interaction} on "${label}" in the app`);
    }

    if (options.size)
      return await host.screenshot({ type: 'png', omitBackground: true, animations: 'disabled', timeout });

    // Waits for a stable host as an element screenshot does; without it an overlay a click opened is not drawn yet.
    await host.scrollIntoViewIfNeeded({ timeout });

    const box = (await page.evaluate(HOST_BOX_SCRIPT)) as { x: number; y: number; width: number; height: number };

    return await page.screenshot({
      type: 'png',
      fullPage: true,
      omitBackground: true,
      animations: 'disabled',
      clip: pixelBoxOf(box),
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

    const opens = pointerOpensOf({ states, controls: module.default?.controls });
    const shots: StateShot[] = [];

    for (const state of only === null ? Object.keys(states) : [only]) {
      const design = await shooter.pictureOf({
        product: product.name,
        part,
        state,
        preset: frame.preset,
        width: null,
        sketch: null,
        interaction: null,
        bare: true,
        emptySlots: true,
        params: new URLSearchParams(),
      });
      const open = opens[state];

      if (typeof open === 'string') return open;

      const app = await queue.run((browser) =>
        harnessShotOf({
          browser,
          url: harnessUrlOf({ url, part, state, props: states[open?.from ?? state], layout: frame.layout }),
          size: frame.size,
          forced: forcedElementsOf(design.markup ?? ''),
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
