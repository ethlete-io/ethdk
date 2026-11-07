import { createHash } from 'crypto';
import { noVerdictLineOf } from './no-verdict';
import { mkdtempSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig, viteCacheOf } from '../paths';
import { createDesignServer } from '../serve';
import { timedPhase } from '../phase-timing';
import { appPictureCodeOf, pixelCompareCodeOf } from '../code-hash';
import { recordCache } from '../timings';
import { WarmDraw } from '../warm-draw';
import { createPartShooter } from '../shot';
import { createDrawQueue } from '../thumb';
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
  compareFrameOf,
  DroppedPropsError,
  drawnPaneCountOf,
  harnessShotOf,
  LookMissError,
  MissingPanesError,
  UndrivableError,
} from './harness-shot';
import {
  compareLineOf,
  PixelCompare,
  designOnlyPropsOf,
  drawsSelectedOf,
  drawnSurfacesOf,
  forcedElementsOf,
  forcesInFramesOf,
  frameLooksOf,
  harnessUrlOf,
  pointerOpensOf,
  slotOnlyStatesOf,
} from './part-compare';
import { doneParts, linkedTaskPartOf } from './part-task';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { inOrderAtOnce } from './in-order-at-once';
import { frozenAnimationsOf } from './frozen-animations';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { coveredLineOf, coveringSketchOf } from './sketch/covered-diffs';
import { listSketches, parseTarget, Sketch, SketchTarget } from './sketch/sketch';
import { cachedComparePngs, COMPARE_PIXELS } from './pixel-cache';
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
  /** Called once the design pictures are drawn and kept, before the app pictures. */
  onDesignShots?: () => void;
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
  onDesignShots?: () => void;
  sketches?: readonly Sketch[];
}) => Promise<{ green: boolean; states: Record<string, unknown> } | string>;

/** @internal How many states compare shoots at once, design and app pictures alike. */
export const COMPARE_SHOTS_AT_ONCE = 8;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

type AppShot = { app: Buffer } | { problem: string; undrivable?: true };

/** @internal The failed state a harness shot's error stands for; rethrows any error that fails the whole compare. */
export const appShotProblemOf = (error: unknown): AppShot => {
  if (error instanceof DroppedPropsError || error instanceof MissingPanesError || error instanceof LookMissError)
    return { problem: error.message };
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

/** The width a non-page part is compared at: the first of the `widths` its design declares, `null` to fit its content. */
export const compareWidthOf = (options: { part: string; widths: unknown }): number | null => {
  const first: unknown = Array.isArray(options.widths) ? options.widths[0] : undefined;

  return !options.part.startsWith('pages/') && typeof first === 'number' && Number.isInteger(first) && first > 0
    ? first
    : null;
};

type DesignServer = Awaited<ReturnType<typeof createDesignServer>>;

type HarnessShot = Omit<Parameters<typeof harnessShotOf>[0], 'browser' | 'phase' | 'timeout'>;

const sha256Of = (text: string) => createHash('sha256').update(text).digest('hex');

/**
 * @internal The disk cache key of an app picture: `salt` (the app picture code and the browser version), the hash of the built app,
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
  const salt = `${appPictureCodeOf()} ${options.browser}`;

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
  async ({ target, config, product, part, url, only, preset, appOnly, appRoot, onDesignShots }) => {
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

      onDesignShots?.();

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
            const looks = frameLooksOf(design.markup ?? '');
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
              ...(forcesInFramesOf(design.markup ?? '') ? { forcesInFrames: true } : {}),
              ...(looks.length > 0 ? { looks } : {}),
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
  const sketches =
    options.sketches ??
    listSketches({ productDir: options.product.dir, product: options.product.name }).filter(
      (sketch): sketch is Sketch => typeof sketch !== 'string',
    );

  return timedPhase('compare-pixels', () => {
    let dir: string | null = null;
    const cache = { dir: viteCacheOf(options.target, COMPARE_PIXELS), salt: pixelCompareCodeOf() };

    let failed = false;

    for (const stateShot of shots) {
      const { state } = stateShot;

      if ('problem' in stateShot) {
        console.log(`${state} FAILED ${stateShot.problem}`);
        failed = true;
        continue;
      }

      const { design, app } = stateShot;
      let result: PixelCompare;

      try {
        const compared = cachedComparePngs({ ...cache, design, app });

        recordCache(compared.hit);
        result = compared.result;
      } catch (error) {
        return `the pictures of ${state} cannot be compared: ${messageOf(error)}`;
      }

      const line = compareLineOf(state, result);

      if (result.kind === 'ok') {
        console.log(line);
        continue;
      }

      const covering = coveringSketchOf({ sketches, part: options.part, state });

      if (covering !== null) {
        console.log(coveredLineOf(line, covering));
        continue;
      }

      console.log(line);

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
      const notes: string[] = [];
      let designsShot = (): void => undefined;
      const designsDrawn = new Promise<void>((resolve) => (designsShot = resolve));
      const actions =
        all || live
          ? null
          : timedPhase('compare-actions', () =>
              (options.actions ?? partActionFailuresOf)({
                target,
                config,
                product,
                part: keys[0] ?? '',
                url: args.values['--url'],
                harness: url,
                appRoot: root,
                designsDrawn,
                onNote: (line) => notes.push(line),
              }),
            ).then(
              (missed) => ({ missed }),
              (error: unknown) => ({ error }),
            );

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
          onDesignShots: designsShot,
        });

        designsShot();

        if (typeof result === 'string') {
          console.error(result);
          failed++;
        } else if (!result.green) failed++;
      }

      if (actions === null) return { failed, missed: null };

      const settled = await actions;

      notes.forEach((line) => console.log(line));

      if ('error' in settled) throw settled.error;

      return { failed, missed: settled.missed };
    },
  });

  if (typeof compared === 'string') {
    console.error(compared);

    return 1;
  }

  const { missed } = compared;

  if (missed === null) return compared.failed === 0 ? 0 : 1;

  if (!Array.isArray(missed)) {
    console.error(noVerdictLineOf('actions', missed));

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
