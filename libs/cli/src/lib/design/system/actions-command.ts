import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig, DesignPreset } from '../paths';
import { createDesignServer } from '../serve';
import { checkerScriptOf, createPartShooter, Picture, pixelBoxOf, viewportOf } from '../shot';
import { Browser, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import {
  ACTION_INPUTS,
  ActionElement,
  actionFailureOf,
  ActionInput,
  ActionOutcome,
  actionScanScriptOf,
  componentSelectorOf,
  drawsStateAlreadyOf,
  elementNameOf,
  embeddedOwnersScriptOf,
  embeddersOf,
  listenEmbeddedScriptOf,
  pairElementsOf,
  openedFromOf,
  resolveActionOf,
  targetStateOf,
} from './actions';
import { EMIT_WAIT_MS, INIT_SCRIPT, OVERLAY_ROOTS, settle } from './action-press';
import { compareFrameOf } from './compare-command';
import { checkLiveActions, liveLineOf, liveStateCompareOf } from './live-actions';
import { pointerFocusVerdictOf, probePointerFocus } from './pointer-focus';
import { liveSpecOf } from './live-compare';
import { harnessStaleOf } from './harness-map';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import {
  compareLineOf,
  comparePngs,
  drawnSurfacesOf,
  forcedElementsOf,
  HARNESS_HOST_SELECTOR,
  harnessUrlOf,
  hostBoxScriptOf,
  OVERLAY_PANES,
  pointerOpensOf,
} from './part-compare';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { partLinkOf } from './sketch/part-definition';
import { parseTarget } from './sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system-modules';

export const ACTIONS_USAGE =
  'actions <layer>/<name> --product <name> [--url <app dev server url>] [--state <name>] | actions [<layer>/<name>] --product <name> --live [--url <app build url>]';

const ROOM_PX = 1024;

const ACTION_BATCH_STATES = 4;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

/** A state the check starts from: its harness props, and the trigger a click opens first when the state is an open surface. */
export type ActionStart = { state: string; props: unknown; opener: string | null };

type Line = {
  state: string;
  element: string;
  input: ActionInput | null;
  failure: string | null;
  warning?: string | null;
};

const scanOf = async (page: Page, roots: string[]) =>
  (await page.evaluate(actionScanScriptOf(roots))) as ActionElement[];

const probeOf = (probe: number) => `[data-et-action-probe="${probe}"]`;

/**
 * Waits until the harness host shows and holds the mounted part: a page-layout host fills the viewport before the
 * lazily loaded part renders into it.
 */
const harnessMountedOf = async (page: Page, timeout: number) => {
  await page.locator(HARNESS_HOST_SELECTOR).first().waitFor({ state: 'visible', timeout });
  await page.locator(`${HARNESS_HOST_SELECTOR} > *`).first().waitFor({ state: 'attached', timeout });
};

const expandedScanOf = async (page: Page, roots: string[]) =>
  (await page.evaluate(
    `${actionScanScriptOf(roots)}.map((found) => ({ key: found.key, expanded: document.querySelector('[data-et-action-probe="' + found.probe + '"]')?.getAttribute('aria-expanded') ?? null }))`,
  )) as { key: string; expanded: string | null }[];

const shotOf = async (options: { page: Page; size: DesignPreset | null; room: boolean; timeout: number }) => {
  const { page, size, room, timeout } = options;
  const host = page.locator(HARNESS_HOST_SELECTOR).first();

  if (size && (await page.locator(OVERLAY_PANES).count()) === 0) {
    const origin = await host.evaluate((element) => {
      const { x, y } = element.getBoundingClientRect();

      return { x: Math.round(x + scrollX), y: Math.round(y + scrollY) };
    });

    await page.evaluate(checkerScriptOf(origin));

    return await host.screenshot({ type: 'png', animations: 'disabled', timeout });
  }

  await host.scrollIntoViewIfNeeded({ timeout });

  const clip = pixelBoxOf(
    (await page.evaluate(hostBoxScriptOf({ up: room }))) as { x: number; y: number; width: number; height: number },
  );

  await page.evaluate(checkerScriptOf(clip));

  return await page.screenshot({ type: 'png', fullPage: true, animations: 'disabled', clip, timeout });
};

/**
 * Loads the harness page of `start`, clicks its opener, then presses `input` on the element `pick` names and returns
 * the outputs it fired, whether its keydown default was prevented, and the host shot when `shoot` asks for one. The
 * outputs include those of the components under the `listen` selectors; `expanded` adds each element's
 * `aria-expanded` after the press.
 */
export const runActionInput = async (options: {
  browser: Browser;
  url: string;
  start: ActionStart;
  pick: { key: string; occurrence: number };
  input: ActionInput;
  shoot: { size: DesignPreset | null; room: boolean } | null;
  timeout: number;
  listen?: string[];
  expanded?: boolean;
}) => {
  const { browser, url, start, pick, input, shoot, timeout, listen = [], expanded = false } = options;
  const room = !!shoot && !shoot.size && shoot.room;
  const viewport = viewportOf(shoot?.size ?? null);
  const context = await browser.newContext({
    viewport: room ? { width: viewport.width + ROOM_PX, height: viewport.height + ROOM_PX } : viewport,
    deviceScaleFactor: 1,
  });

  try {
    await context.addInitScript(INIT_SCRIPT);

    const page = await context.newPage();

    await page.goto(url, { timeout });
    await harnessMountedOf(page, timeout);
    await page.evaluate('document.fonts.ready');

    if (room) await page.evaluate(`document.documentElement.style.padding = '${ROOM_PX}px 0 0 ${ROOM_PX}px'`);

    await page.mouse.move(-1, -1);

    const roots = [HARNESS_HOST_SELECTOR, OVERLAY_ROOTS];

    if (start.opener !== null) {
      const opener = (await scanOf(page, [HARNESS_HOST_SELECTOR])).find((element) => element.key === start.opener);

      if (!opener) throw new Error(`the app has no ${start.opener} to open state ${start.state} with`);

      await page.locator(probeOf(opener.probe)).click({ timeout });
      await page.mouse.move(-1, -1);
      await settle(page, timeout);
    }

    const element = (await scanOf(page, roots)).find(
      (found) => found.key === pick.key && found.occurrence === pick.occurrence,
    );

    if (!element) throw new Error('the element is gone after a fresh load');

    await page.evaluate('window.__etPrevented = []; (window.__etDesignEmits ?? []).length = 0;');

    const listened = listen.length > 0 ? ((await page.evaluate(listenEmbeddedScriptOf(listen))) as number) : 0;

    const target = page.locator(probeOf(element.probe));

    if (input === 'click') {
      await target.click({ timeout });
      await page.mouse.move(-1, -1);
    } else {
      await page.keyboard.press('Shift');
      await target.focus({ timeout });
      await page.keyboard.press(input);
    }

    await page.waitForTimeout(EMIT_WAIT_MS);
    await settle(page, timeout);

    const emitted = (await page.evaluate('(window.__etDesignEmits ?? []).map((emit) => emit.output)')) as string[];
    const embedded = listened > 0 ? ((await page.evaluate('window.__etEmbeddedEmits')) as string[]) : [];
    const prevented = ((await page.evaluate('window.__etPrevented')) as string[]).length > 0;
    const after = expanded ? await expandedScanOf(page, roots) : null;
    const app = shoot ? await shotOf({ page, size: shoot.size, room, timeout }) : null;

    return { emitted: [...emitted, ...embedded], prevented, app, ...(after && { after }) };
  } finally {
    await context.close();
  }
};

/** Presses each interactive element of each start state of a part on the app's harness page and checks its declared action. */
export const checkActions = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url: string;
  only: string | null;
}): Promise<{ lines: Line[]; pictures: string | null; embedders?: string[] } | string> => {
  const { target, config, product, part, url, only } = options;
  const frame = compareFrameOf({ presets: product.presets, part, preset: null });

  if (typeof frame === 'string') return frame;
  if (!(await chromiumOf(target))) return 'actions needs playwright or playwright-core in the checkout';

  const server = await createDesignServer({ target, config, listen: true, port: 0 });
  let browser: { queue: ReturnType<typeof createDrawQueue>; shooter: ReturnType<typeof createPartShooter> } | undefined;
  const closeBrowser = async () => {
    const open = browser;

    browser = undefined;
    await open?.shooter.close();
    await open?.queue.close();
  };

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const system = createSystemModules({ target, config });
    const freshBrowser = async () => {
      await closeBrowser();

      const queue = createDrawQueue({ target });

      browser = { queue, shooter: createPartShooter({ target, base: `http://localhost:${port}`, system, queue }) };

      return browser;
    };

    const file = product.parts.find((candidate) => partKeyOf(candidate) === part)?.file ?? '';
    const module = (await server.ssrLoadModule(productModuleIdOf({ file, product: product.name }))) as {
      default?: { states?: unknown; controls?: unknown };
    };
    const loaded = module.default?.states;
    const states =
      loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? (loaded as Record<string, unknown>) : {};
    const names = Object.keys(states);

    if (only !== null && !(only in states)) return `${part} has no state "${only}" - its states: ${names.join(', ')}`;

    let embedders: Promise<string[]> | undefined;
    const embeddersOfPart = () =>
      (embedders ??= Promise.all(
        product.parts.map(async (candidate) => {
          const id = productModuleIdOf({ file: candidate.file, product: product.name });
          const controls = await server.ssrLoadModule(id).then(
            (loaded) => (loaded as { default?: { controls?: unknown } }).default?.controls,
            () => undefined,
          );

          return [partKeyOf(candidate), controls] as const;
        }),
      ).then((entries) => embeddersOf({ part, controls: Object.fromEntries(entries) })));

    let { queue, shooter } = await freshBrowser();
    const designs = new Map<string, Picture>();
    const draw = async (state: string, opened: Record<string, unknown> | null = null) => {
      const key = opened === null ? state : `${state}\n${JSON.stringify(opened)}`;
      const drawn =
        designs.get(key) ??
        (await shooter.pictureOf({
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
          ...(opened && { compose: { [part]: opened } }),
          params: new URLSearchParams(),
        }));

      designs.set(key, drawn);

      return drawn;
    };

    for (const state of names) await draw(state);

    const markups = new Map([...designs].map(([state, design]) => [state, design.markup ?? '']));
    const opens = pointerOpensOf({
      states,
      controls: module.default?.controls,
      drawn: Object.fromEntries([...markups].map(([state, markup]) => [state, drawnSurfacesOf(markup)])),
    });
    const designScan = async (state: string) =>
      queue.run(async (browser) => {
        const context = await browser.newContext({ viewport: viewportOf(frame.size) });

        try {
          const page = await context.newPage();

          await page.setContent(markups.get(state) ?? '');

          const found = await scanOf(page, ['body']);
          const owners = (await page.evaluate(embeddedOwnersScriptOf(part))) as Record<string, string[]>;

          return found.map((element) => ({ ...element, owners: owners[String(element.probe)] ?? [] }));
        } finally {
          await context.close();
        }
      });
    const embedded = new Map<string, Promise<{ part: string; states: string[]; selector: string | null }>>();
    const embeddedOf = (key: string) => {
      const cached =
        embedded.get(key) ??
        (async () => {
          const found = product.parts.find((candidate) => partKeyOf(candidate) === key);
          const loaded = found
            ? (
                (await server.ssrLoadModule(productModuleIdOf({ file: found.file, product: product.name }))) as {
                  default?: { states?: unknown };
                }
              ).default?.states
            : undefined;
          const link = found ? partLinkOf(found.source) : null;
          const component =
            link?.kind === 'component' ? link.path : link?.kind === 'route' ? (link.component ?? null) : null;
          const file = component === null ? null : resolve(target, component);

          return {
            part: key,
            states: loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? Object.keys(loaded) : [],
            selector: file && existsSync(file) ? componentSelectorOf(readFileSync(file, 'utf8')) : null,
          };
        })();

      embedded.set(key, cached);

      return cached;
    };
    const expectedCache = new Map<string, Promise<Record<string, string>>>();
    const expectedOf = (owner: string, state: string) => {
      const key = `${owner}\n${state}`;
      const cached =
        expectedCache.get(key) ??
        (async () => {
          const ownerFrame = compareFrameOf({ presets: product.presets, part: owner, preset: null });
          const size = typeof ownerFrame === 'string' ? null : ownerFrame.size;
          const picture = await shooter.pictureOf({
            product: product.name,
            part: owner,
            state,
            preset: typeof ownerFrame === 'string' ? null : ownerFrame.preset,
            width: null,
            sketch: null,
            interaction: null,
            bare: true,
            emptySlots: true,
            params: new URLSearchParams(),
          });

          return queue.run(async (browser) => {
            const context = await browser.newContext({ viewport: viewportOf(size) });

            try {
              const page = await context.newPage();

              await page.setContent(picture.markup ?? '');

              return Object.fromEntries(
                (await expandedScanOf(page, ['body'])).flatMap(({ key, expanded }) =>
                  expanded === null ? [] : [[key, expanded]],
                ),
              );
            } finally {
              await context.close();
            }
          });
        })();

      expectedCache.set(key, cached);

      return cached;
    };
    const lines: Line[] = [];
    let dir: string | null = null;

    const checked = only === null ? names : [only];

    for (const [index, state] of checked.entries()) {
      if (index % ACTION_BATCH_STATES === 0) {
        designs.clear();
        ({ queue, shooter } = await freshBrowser());
      }

      const markup = markups.get(state) ?? '';

      if (forcedElementsOf(markup).length > 0) continue;

      const open = opens[state];

      if (typeof open === 'string') {
        lines.push({ state, element: '-', input: null, failure: open });
        continue;
      }

      const design = await designScan(state);
      const opener = open ? (design.find((element) => element.control === open.control)?.key ?? null) : null;

      if (open && opener === null) {
        lines.push({ state, element: '-', input: null, failure: `no ${open.control} trigger to open it with` });
        continue;
      }

      const start: ActionStart = { state, props: open ? (open.props ?? states[open.from]) : states[state], opener };
      const startUrl = harnessUrlOf({ url, part, state, props: start.props, layout: frame.layout });
      const app = await queue.run(async (browser) => {
        const context = await browser.newContext({ viewport: viewportOf(frame.size) });

        try {
          const page = await context.newPage();

          await page.goto(startUrl, { timeout: DRAW_TIMEOUT_MS });
          await harnessMountedOf(page, DRAW_TIMEOUT_MS);

          if (opener !== null) {
            const trigger = (await scanOf(page, [HARNESS_HOST_SELECTOR])).find((element) => element.key === opener);

            if (trigger) await page.locator(probeOf(trigger.probe)).click();

            await settle(page, DRAW_TIMEOUT_MS);
          }

          return await scanOf(page, [HARNESS_HOST_SELECTOR, OVERLAY_ROOTS]);
        } finally {
          await context.close();
        }
      });
      const { paired, missing } = pairElementsOf({ design, app });

      for (const element of missing)
        lines.push({
          state,
          element: elementNameOf(element),
          input: null,
          failure: `the design declares ${element.action} but the app draws no such element`,
        });

      for (const { app: element, design: drawn } of paired) {
        const name = elementNameOf(element);

        try {
          const probes = await queue.run((browser) =>
            probePointerFocus({
              open: async () => {
                const context = await browser.newContext({ viewport: viewportOf(frame.size) });
                const page = await context.newPage();
                const close = () => context.close();

                try {
                  await page.goto(startUrl, { timeout: DRAW_TIMEOUT_MS });
                  await harnessMountedOf(page, DRAW_TIMEOUT_MS);
                  await page.mouse.move(-1, -1);

                  if (opener !== null) {
                    const trigger = (await scanOf(page, [HARNESS_HOST_SELECTOR])).find((found) => found.key === opener);

                    if (trigger) await page.locator(probeOf(trigger.probe)).click();

                    await settle(page, DRAW_TIMEOUT_MS);
                    await page.mouse.move(-1, -1);
                  }

                  const found = (await scanOf(page, [HARNESS_HOST_SELECTOR, OVERLAY_ROOTS])).find(
                    (candidate) => candidate.key === element.key && candidate.occurrence === element.occurrence,
                  );

                  if (!found) throw new Error('the element is gone after a fresh load');

                  return { page, locator: page.locator(probeOf(found.probe)), close };
                } catch (error) {
                  await close();
                  throw error;
                }
              },
              settle: (page) => settle(page, DRAW_TIMEOUT_MS),
            }),
          );

          if (probes) {
            const { failure, warning } = pointerFocusVerdictOf({ ...probes, activatable: !!drawn?.action });

            lines.push({ state, element: `${name} pointer focus`, input: null, failure, warning });
          }
        } catch (error) {
          lines.push({
            state,
            element: `${name} pointer focus`,
            input: null,
            failure: messageOf(error).split('\n')[0] ?? '',
          });
        }
        const owners = drawn ? await Promise.all(drawn.owners.map(embeddedOf)) : [];
        const value = drawn?.action?.trim() ?? '';
        const settled: string[] = [];

        for (const candidate of owners)
          if (
            candidate.states.includes(value) &&
            drawsStateAlreadyOf({
              expected: await expectedOf(candidate.part, value),
              current: await expectedOf(part, state),
            })
          )
            settled.push(candidate.part);

        const { action, owner } = drawn
          ? resolveActionOf({ value: drawn.action, owners, page: { part, states: names }, settled })
          : { action: null, owner: part };
        const embeddedState = owners.find((candidate) => candidate.part === owner);
        const listen = owners.flatMap((candidate) => (candidate.selector === null ? [] : [candidate.selector]));

        if (drawn === null || action === null || typeof action === 'string') {
          if (typeof action !== 'string' && (await embeddersOfPart()).length > 0) continue;

          lines.push({
            state,
            element: name,
            input: null,
            failure:
              typeof action === 'string'
                ? action
                : drawn === null
                  ? 'the design draws no such element, so it declares no action'
                  : 'the design declares no data-et-action',
          });
          continue;
        }

        for (const input of ACTION_INPUTS) {
          const goal =
            action.kind === 'state'
              ? targetStateOf({ state: action.state, input, states: embeddedState?.states ?? names })
              : '';
          const opened = goal === '' ? null : openedFromOf({ goal, start: state, states, open: opens[goal] });
          const goalPicture = goal === '' || embeddedState ? null : await draw(opened ? state : goal, opened);

          try {
            const run = await queue.run((browser) =>
              runActionInput({
                browser,
                url: startUrl,
                start,
                pick: element,
                input,
                shoot: goalPicture
                  ? {
                      size: frame.size,
                      room: (goalPicture.marks.find((mark) => mark.parts.includes(part))?.y ?? 0) > 0,
                    }
                  : null,
                timeout: DRAW_TIMEOUT_MS,
                listen: action.kind === 'emit' ? listen : [],
                expanded: !!embeddedState && action.kind === 'state',
              }),
            );
            const result = goalPicture && run.app ? comparePngs({ design: goalPicture.png, app: run.app }) : null;
            const outcome: ActionOutcome = {
              emitted: run.emitted,
              prevented: run.prevented,
              compare:
                embeddedState && action.kind === 'state'
                  ? liveStateCompareOf({
                      state: `${owner} ${goal}`,
                      expected: await expectedOf(owner, goal),
                      after: run.after ?? [],
                    })
                  : result
                    ? { ok: result.kind === 'ok', detail: compareLineOf(goal, result).slice(goal.length + 1) }
                    : null,
            };
            const failure = actionFailureOf({ action, target: goal, input, outcome });

            if (failure !== null && result && result.kind !== 'ok' && goalPicture && run.app) {
              dir ??= mkdtempSync(join(tmpdir(), 'et-design-actions-'));

              const stem = `${state}--${name}--${input}`.replace(/[^\w.-]/g, '-');

              writeFileSync(join(dir, `${stem}.design.png`), goalPicture.png);
              writeFileSync(join(dir, `${stem}.app.png`), run.app);
              writeFileSync(join(dir, `${stem}.diff.png`), result.diff);
            }

            lines.push({ state, element: name, input, failure });
          } catch (error) {
            lines.push({ state, element: name, input, failure: messageOf(error).split('\n')[0] ?? '' });
          }
        }
      }
    }

    return { lines, pictures: dir, embedders: embedders ? await embedders : [] };
  } catch (error) {
    return messageOf(error);
  } finally {
    await closeBrowser();
    await server.close();
  }
};

/** The line `design actions` prints for one checked element and input. */
export const actionLineOf = ({ state, element, input, failure, warning }: Line) =>
  `${state} ${element}${input === null ? '' : ` ${input}`} ${failure === null ? `ok${warning ? ` (warning: ${warning})` : ''}` : `FAILED ${failure}`}`;

/** The failed lines `design actions` prints for a part, or why the check could not run. */
export const partActionFailuresOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url?: string;
  start?: StartHarnessServer;
  check?: typeof checkActions;
  checkLive?: typeof checkLiveActions;
}): Promise<string[] | { unavailable: string }> => {
  const { target, config, product, part } = options;
  const stale = harnessStaleOf({ target, product });

  if (stale !== null) return { unavailable: stale };

  const checked = await withHarnessUrl({
    target,
    product,
    url: options.url,
    start: options.start,
    run: (url) => (options.check ?? checkActions)({ target, config, product, part, url, only: null }),
  });

  if (typeof checked === 'string') return { unavailable: checked };

  const failures = checked.lines.filter((line) => line.failure !== null).map(actionLineOf);

  if (!options.url || typeof liveSpecOf({ target, product }) === 'string') return failures;

  const live = await (options.checkLive ?? checkLiveActions)({ target, config, product, url: options.url, part });

  if (typeof live === 'string') return { unavailable: `the live action check: ${live}` };

  return [...failures, ...live.lines.filter((line) => line.failure !== null).map((line) => `live ${liveLineOf(line)}`)];
};

/** The note a ready refusal adds when the action check ran on the part harness only. */
export const PART_HARNESS_ONLY =
  'checked on the part harness only - pass --url <studio build> to check the live pages too';

/**
 * `et design actions <layer>/<name> …` clicks and presses Enter and Space on each interactive element of a part in the
 * app's harness page and fails unless each reaches the state or fires the output its design's `data-et-action` declares.
 */
export const designActions = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  check?: typeof checkActions;
  checkLive?: typeof checkLiveActions;
  start?: StartHarnessServer;
}) => {
  const { target, invocation } = options;
  const args = argsOf(options.argv, ['--product', '--url', '--state']);
  const live = typeof args !== 'string' && args.flags.has('--live');

  if (typeof args === 'string' || args.positional.length > 1 || (!live && args.positional.length !== 1)) {
    if (typeof args === 'string') console.error(args);

    console.error(`usage: ${invocation} ${ACTIONS_USAGE}`);

    return 2;
  }

  const config = configOf(target);

  if (live) return designLiveActions({ ...options, args, config });

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

  const part = partKeyOf(parsed);
  const refusal = product.parts.some((candidate) => partKeyOf(candidate) === part)
    ? harnessStaleOf({ target, product })
    : `${product.name} has no part ${part}`;

  if (refusal !== null) {
    console.error(refusal);

    return 1;
  }

  const checked = await withHarnessUrl({
    target,
    product,
    url: args.values['--url'],
    start: options.start,
    run: (url) =>
      (options.check ?? checkActions)({
        target,
        config,
        product,
        part: part,
        url,
        only: args.values['--state'] ?? null,
      }),
  });

  if (typeof checked === 'string') {
    console.error(checked);

    return 1;
  }

  for (const line of checked.lines) console.log(actionLineOf(line));

  if (checked.pictures !== null) console.log(`pictures: ${checked.pictures}`);

  const failed = checked.lines.filter((line) => line.failure !== null).length;

  if (checked.lines.length === 0) {
    console.log(
      checked.embedders?.length
        ? `${part}: exempt - ${checked.embedders.join(', ')} declare(s) the actions of its elements`
        : `${part} has no interactive element`,
    );

    return 0;
  }

  console.log(
    failed === 0
      ? `${part}: every declared action works`
      : `${part}: ${failed} of ${checked.lines.length} action check(s) failed`,
  );

  return failed === 0 ? 0 : 1;
};

const designLiveActions = async (options: {
  target: string;
  args: Exclude<ReturnType<typeof argsOf>, string>;
  config: ReturnType<typeof configOf>;
  start?: StartHarnessServer;
  checkLive?: typeof checkLiveActions;
}) => {
  const { target, args, config } = options;
  const parsed = args.positional[0] === undefined ? null : parseTarget(args.positional[0]);

  if (typeof config === 'string' || typeof parsed === 'string') {
    console.error(typeof config === 'string' ? config : parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const part = parsed === null ? null : partKeyOf(parsed);

  if (part !== null && !product.parts.some((candidate) => partKeyOf(candidate) === part)) {
    console.error(`${product.name} has no part ${part}`);

    return 1;
  }

  const checked = await withHarnessUrl({
    target,
    product,
    url: args.values['--url'],
    start: options.start,
    run: (url) => (options.checkLive ?? checkLiveActions)({ target, config, product, url, part }),
  });

  if (typeof checked === 'string') {
    console.error(checked);

    return 1;
  }

  for (const line of checked.lines) console.log(liveLineOf(line));

  const failed = checked.lines.filter((line) => line.failure !== null).length;
  const scope = part ?? 'the live pages';

  console.log(
    failed === 0
      ? `${scope}: every shell control reaches its declared action and behaves the same on every page`
      : `${scope}: ${failed} of ${checked.lines.length} live action check(s) failed`,
  );

  return failed === 0 ? 0 : 1;
};
