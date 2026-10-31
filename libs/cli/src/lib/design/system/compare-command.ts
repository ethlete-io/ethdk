import { mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { createPartShooter, viewportOf } from '../shot';
import { Browser, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { harnessStaleOf } from './harness-map';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import { compareLineOf, comparePngs, HARNESS_HOST_SELECTOR, harnessUrlOf } from './part-compare';
import { taskPartOf } from './part-task';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system-modules';

export const COMPARE_USAGE = 'compare <layer>/<name> --product <name> [--url <app dev server url>] [--state <name>]';

export type StateShot = { state: string; design: Buffer; app: Buffer };

export type ShootStates = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url: string;
  only: string | null;
}) => Promise<{ states: Record<string, unknown>; shots: StateShot[] } | string>;

export type ComparePart = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url: string;
  only: string | null;
  shoot?: ShootStates;
}) => Promise<{ green: boolean; states: Record<string, unknown> } | string>;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

class HarnessError extends Error {}

/** A PNG of the harness host element at `url`, in the viewport and device scale the design frame of a fitted part uses. */
export const harnessShotOf = async (options: { browser: Browser; url: string; timeout?: number }) => {
  const { browser, url } = options;
  const timeout = options.timeout ?? DRAW_TIMEOUT_MS;
  const context = await browser.newContext({ viewport: viewportOf(null), deviceScaleFactor: 1 });

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

    return await host.screenshot({ type: 'png', omitBackground: true, animations: 'disabled', timeout });
  } finally {
    await context.close();
  }
};

/** Draws each state of a part, or the `only` one, as its design frame and as the app's harness page, in one Chromium. */
export const shootStates: ShootStates = async ({ target, config, product, part, url, only }) => {
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
      default?: { states?: unknown };
    };
    const loaded = module.default?.states;
    const states =
      loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? (loaded as Record<string, unknown>) : {};

    if (only !== null && !(only in states))
      return `${part} has no state "${only}" - its states: ${Object.keys(states).join(', ')}`;

    const shots: StateShot[] = [];

    for (const state of only === null ? Object.keys(states) : [only]) {
      const design = await shooter.pictureOf({
        product: product.name,
        part,
        state,
        preset: null,
        width: null,
        sketch: null,
        interaction: null,
        params: new URLSearchParams(),
      });
      const app = await queue.run((browser) =>
        harnessShotOf({ browser, url: harnessUrlOf({ url, part, state, props: states[state] }) }),
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
  const args = argsOf(options.argv, ['--product', '--url', '--state']);

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
        shoot: options.shoot,
      }),
  });

  if (typeof compared === 'string') {
    console.error(compared);

    return 1;
  }

  return compared.green ? 0 : 1;
};
