import { AddressInfo } from 'net';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { createPartShooter, viewportOf } from '../shot';
import { createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { compareFrameOf } from './compare-command';
import { harnessStaleOf } from './harness-map';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import { goPartOf } from './part-go';
import {
  drawnSurfacesOf,
  forcedElementsOf,
  HARNESS_HOST_SELECTOR,
  harnessUrlOf,
  PointerOpen,
  pointerOpensOf,
} from './part-compare';
import { formattedTextOf } from './prettier';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system-modules';

export const DOM_USAGE = 'dom <layer>/<name> --product <name> [--state <name>] [--app] [--url <app dev server url>]';

export type ReadDom = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  state: string | null;
  app: boolean;
  url: string;
}) => Promise<{ state: string; html: string } | string>;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const refusedOf = ({ part, what, detail = '' }: { part: string; what: string; detail?: string }) =>
  `design dom --app cannot render ${what} of ${part}${detail} yet; run it without --app for the design markup`;

/** The reason `--app` cannot print a state: compare forces its hover, active or focus, or clicks a trigger to open it. */
export const appRefusalOf = (options: {
  part: string;
  state: string;
  markup: string;
  open: PointerOpen | string | undefined;
}) => {
  const { part, state, markup, open } = options;

  if (forcedElementsOf(markup).length > 0) return refusedOf({ part, what: `the forced state ${state}` });

  if (open === undefined) return null;

  return refusedOf({
    part,
    what: `the click-opened state ${state}`,
    detail: ` (${typeof open === 'string' ? open : `a click on ${open.control}`})`,
  });
};

export const readDom: ReadDom = async ({ target, config, product, part, state: asked, app, url }) => {
  const frame = compareFrameOf({ presets: product.presets, part, preset: null });

  if (typeof frame === 'string') return frame;
  if (!(await chromiumOf(target))) return 'dom needs playwright or playwright-core in the checkout';

  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });
  let shooter: ReturnType<typeof createPartShooter> | undefined;

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;

    const partShooter = (shooter = createPartShooter({
      target,
      base: `http://localhost:${port}`,
      system: createSystemModules({ target, config }),
      queue,
    }));

    const file = product.parts.find((candidate) => partKeyOf(candidate) === part)?.file ?? '';
    const module = (await server.ssrLoadModule(productModuleIdOf({ file, product: product.name }))) as {
      default?: { states?: unknown; controls?: unknown };
    };
    const loaded = module.default?.states;
    const states =
      loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? (loaded as Record<string, unknown>) : {};
    const state = asked ?? Object.keys(states)[0];

    if (state === undefined || !(state in states))
      return `${part} has no state "${asked ?? ''}" - its states: ${Object.keys(states).join(', ')}`;

    const designOf = (name: string) =>
      partShooter.pictureOf({
        product: product.name,
        part,
        state: name,
        preset: frame.preset,
        width: null,
        sketch: null,
        interaction: null,
        bare: true,
        emptySlots: true,
        checker: false,
        params: new URLSearchParams(),
      });

    if (!app) {
      const design = await designOf(state);

      return design.markup === undefined
        ? `the design of ${part} state ${state} drew no markup`
        : { state, html: design.markup };
    }

    const markups = Object.fromEntries(
      await Promise.all(Object.keys(states).map(async (name) => [name, (await designOf(name)).markup ?? ''] as const)),
    );
    const opens = pointerOpensOf({
      states,
      controls: module.default?.controls,
      drawn: Object.fromEntries(Object.entries(markups).map(([name, markup]) => [name, drawnSurfacesOf(markup)])),
    });
    const refusal = appRefusalOf({ part, state, markup: markups[state] ?? '', open: opens[state] });

    if (refusal !== null) return refusal;

    const pageUrl = harnessUrlOf({ url, part, state, props: states[state], layout: frame.layout });
    const html = await queue.run(async (browser) => {
      const context = await browser.newContext({ viewport: viewportOf(frame.size), deviceScaleFactor: 1 });

      try {
        const page = await context.newPage();

        await page.goto(pageUrl, { timeout: DRAW_TIMEOUT_MS });
        await page.locator(HARNESS_HOST_SELECTOR).first().waitFor({ state: 'visible', timeout: DRAW_TIMEOUT_MS });
        await page.evaluate('document.fonts.ready');

        return (await page.evaluate(
          `document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)})?.outerHTML ?? null`,
        )) as string | null;
      } finally {
        await context.close();
      }
    });

    return html === null ? `the harness page ${pageUrl} showed no ${HARNESS_HOST_SELECTOR} element` : { state, html };
  } catch (error) {
    return messageOf(error);
  } finally {
    await shooter?.close();
    await queue.close();
    await server.close();
  }
};

/**
 * `et design dom <layer>/<name> …` prints the pretty-printed HTML of one state of a part: its rendered design, or
 * with `--app` the harness host element of the app that compare shoots.
 */
export const designDom = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  read?: ReadDom;
  start?: StartHarnessServer;
}) => {
  const { target, invocation } = options;
  const args = argsOf(options.argv, ['--product', '--state', '--url']);

  if (typeof args === 'string' || args.positional.length !== 1) {
    if (typeof args === 'string') console.error(args);

    console.error(`usage: ${invocation} ${DOM_USAGE}`);

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

  const app = args.flags.has('--app');
  const part = partKeyOf(parsed);
  const found = goPartOf({ product, part });
  const refusal = typeof found === 'string' ? found : app ? harnessStaleOf({ target, product }) : null;

  if (refusal !== null) {
    console.error(refusal);

    return 1;
  }

  const read = options.read ?? readDom;
  const run = (url: string) => read({ target, config, product, part, state: args.values['--state'] ?? null, app, url });
  const result = app
    ? await withHarnessUrl({ target, product, url: args.values['--url'], start: options.start, run })
    : await run('');

  if (typeof result === 'string') {
    console.error(result);

    return 1;
  }

  const formatted = formattedTextOf({ target, file: 'dom.html', text: result.html });

  if (typeof formatted !== 'string') {
    console.error(formatted.error);

    return 1;
  }

  console.log(formatted.trimEnd());

  return 0;
};
