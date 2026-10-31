import { createHash } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { isAbsolute } from 'path';
import { Plugin } from 'postcss';
import { chromiumOf } from './browser';
import { ChangedBox, changedBoxesOf } from './contact-sheet';
import { DrawnPart, PartsChange, redraws } from './changed-parts';
import { DesignPreset } from './paths';
import { DrawLedger } from './draw-ledger';
import { fileOfModuleId, SketchVariant, SystemModules } from './system/system-modules';
import {
  Browser,
  callDrawsFrom,
  createDrawQueue,
  DRAW_TIMEOUT_MS,
  DrawWant,
  openFrame,
  send,
  noteFailure,
  sendShot,
  finished,
  settled,
  ShotFailedError,
  ShotTimeoutError,
  ShotUnprocessableError,
  ThumbMissingError,
} from './thumb';
import { MotionMode, MotionPictures, motionPicturesOf } from './motion-shot';
import { createWarmPages } from './warm-pages';
import { ShotStore, StoredAddress } from './shot-store';

export const SHOT_PATH = '/__design/shot';

const BOX_CACHE_LIMIT = 500;

const isPositiveWhole = (pixels: number) => Number.isInteger(pixels) && pixels > 0;

const VIEWPORT_HEIGHT = 800;

const MAX_SCALE = 4;

const scaleOf = (params: URLSearchParams) => Number(params.get('scale') ?? 1);

const viewOf = (raw: string | null) => (raw !== null && isPositiveWhole(Number(raw)) ? Number(raw) : null);

const wantOf = (params: URLSearchParams, response: ServerResponse): DrawWant => {
  const withdraws = new Set<() => void>();
  const rank = params.get('rank');
  let hungUp = false;

  response.once('close', () => {
    hungUp = !response.writableFinished;

    if (hungUp) withdraws.forEach((withdraw) => withdraw());
  });

  return {
    priority: params.get('priority') === 'low' ? 'low' : 'high',
    view: viewOf(params.get('view')),
    rank: rank === 'active' || rank === 'visible' ? rank : null,
    onWithdraw: (withdraw) => (hungUp ? withdraw() : withdraws.add(withdraw)),
  };
};

const schemeOf = (params: URLSearchParams) => {
  const scheme = params.get('scheme');

  return scheme === 'dark' || scheme === 'light' ? scheme : null;
};

/** Whether a `--scheme` value is absent or one the frame pins. */
export const isSchemeFlag = (value: string | undefined) => value === undefined || value === 'light' || value === 'dark';

/** The frame params of the `--surface`, `--color`, `--scheme` and `--scale` flags of a shot command. */
export const drawParamsOf = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams();

  for (const name of ['surface', 'color', 'scheme', 'scale']) {
    const value = values[`--${name}`];

    if (value) params.set(name, value);
  }

  return params;
};

const isScale = (scale: number) => Number.isInteger(scale) && scale >= 1 && scale <= MAX_SCALE;

/** The `x,y,width,height` crop of a picture in CSS pixels, `null` without one, `undefined` for a malformed one. */
export const cropOf = (raw: string | null | undefined) => {
  if (raw === null || raw === undefined) return null;

  const [x, y, width, height, ...rest] = raw.split(',').map((part) => (part.trim() === '' ? NaN : Number(part)));

  if (rest.length > 0 || x === undefined || y === undefined || width === undefined || height === undefined)
    return undefined;
  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1) return undefined;

  return { x, y, width, height };
};

type Crop = NonNullable<ReturnType<typeof cropOf>>;

const FIT_VIEWPORT_WIDTH = 1280;

/** The viewport a frame of this size is drawn in. */
export const viewportOf = (size: Size | null) => ({
  width: size?.width ?? FIT_VIEWPORT_WIDTH,
  height: size?.height ?? VIEWPORT_HEIGHT,
});

type Drawn = { part: DrawnPart } | { slug: string };

type Size = Pick<DesignPreset, 'width' | 'height'>;

type Frame = {
  search: string;
  size: Size | null;
  clip: boolean;
  scale: number;
  crop: Crop | null;
  scheme: 'dark' | 'light' | null;
};

type GraphModule = { id: string | null; file?: string | null; importers: Set<GraphModule> };

export type ImportingModule = { file?: string | null; importedModules: Set<ImportingModule> };

/** An element a part render marked as its root, in CSS pixels from the top left of the picture. */
export type PartMark = { parts: string[]; x: number; y: number; width: number; height: number };

/** One drawn PNG, the part roots in it, and the markup of the frame root. */
/** Where a shot response's picture came from: the disk store, the in-memory cache or a fresh draw. */
export type ShotSource = 'disk' | 'memory' | 'drawn';

export type Picture = { png: Buffer; marks: PartMark[]; markup?: string };

const marksIn = (clip: boolean) => `(() => {
  const origin = ${clip} ? document.getElementById('root').getBoundingClientRect() : { left: -scrollX, top: -scrollY };

  return [...document.querySelectorAll('[data-et-part]')]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0)
    .map(({ element, rect }) => ({
      parts: element.getAttribute('data-et-part').split(' ').filter(Boolean),
      x: Math.round(rect.left - origin.left),
      y: Math.round(rect.top - origin.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }));
})()`;

/** The files each stylesheet inlines through an `@import`, keyed by the stylesheet's file. */
export type StylesheetImports = Map<string, Set<string>>;

/** A PostCSS plugin that records into `imports` the files each stylesheet inlines, apart from the Tailwind sources it scans. */
export const stylesheetImportsPlugin = (imports: StylesheetImports): Plugin => ({
  postcssPlugin: 'ethlete-stylesheet-imports',
  OnceExit: (_root, { result }) => {
    if (!result.opts.from) return;

    imports.set(
      fileOfModuleId(result.opts.from),
      new Set(
        result.messages.flatMap((message) =>
          message.type === 'dependency' &&
          message.plugin !== '@tailwindcss/postcss' &&
          typeof message['file'] === 'string'
            ? [message['file']]
            : [],
        ),
      ),
    );
  },
});

const isTailwindSourceOf = (options: {
  imports: StylesheetImports;
  module: { file?: string | null };
  importer: { file?: string | null };
}) => {
  const inlined = options.importer.file ? options.imports.get(options.importer.file) : undefined;

  return !!inlined && !!options.module.file && !inlined.has(options.module.file);
};

/**
 * The ids of the given modules and of every module that imports one of them, directly or not. A
 * stylesheet does not count as importing a file it only scans as a Tailwind source.
 */
export const dependentIdsOf = (modules: Iterable<GraphModule>, imports: StylesheetImports = new Map()) => {
  const seen = new Set<GraphModule>();
  const open = [...modules];

  for (let next = open.pop(); next; next = open.pop()) {
    if (seen.has(next)) continue;

    seen.add(next);
    open.push(...[...next.importers].filter((importer) => !isTailwindSourceOf({ imports, module: next, importer })));
  }

  return [...seen].flatMap((module) => (module.id ? [module.id] : []));
};

/**
 * The files of the given modules and of every module they import, directly or not: the reverse of
 * `dependentIdsOf`, so a Tailwind source a stylesheet only scans is not among them.
 */
export const dependencyFilesOf = (modules: Iterable<ImportingModule>, imports: StylesheetImports = new Map()) => {
  const seen = new Set<ImportingModule>();
  const open = [...modules];

  for (let next = open.pop(); next; next = open.pop()) {
    if (seen.has(next)) continue;

    seen.add(next);

    const importer = next;

    open.push(...[...next.importedModules].filter((module) => !isTailwindSourceOf({ imports, module, importer })));
  }

  return [...seen].flatMap((module) => (module.file && isAbsolute(module.file) ? [module.file] : []));
};

const SHOT_OPTIONS = { type: 'png', fullPage: true, omitBackground: true, timeout: DRAW_TIMEOUT_MS } as const;

/** One state of a part as a frame draws it: at a product preset, at a container width, or fitted to its content. */
export type PartAddress = {
  product: string;
  part: string;
  state: string;
  preset: string | null;
  width: number | null;
  sketch: SketchVariant | null;
  interaction: string | null;
  props?: SketchVariant | null;
};

/** The frame query, viewport and cache key that draw one state of a part, or why the part cannot be drawn. */
export const partFrameOf = (options: PartAddress & { system: SystemModules }) => {
  const { system, product, part, state, preset, width, sketch, interaction, props } = options;
  const file = system.partOf({ product, part, sketch })?.file;
  const size = preset ? system.productOf(product)?.presets[preset] : width ? { width } : null;

  if (!file)
    return new ThumbMissingError(
      sketch
        ? `design-explore: variant "${sketch.variant}" of the sketch on ${sketch.target} in product "${product}" has no part "${part}"`
        : `design-explore: product "${product}" has no part "${part}"`,
    );
  if (preset && !size) return new ThumbMissingError(`design-explore: product "${product}" has no preset "${preset}"`);

  return {
    key: [
      'part',
      product,
      part,
      state,
      preset,
      width,
      sketch?.target,
      sketch?.variant,
      interaction,
      props?.target,
      props?.variant,
    ] as unknown[],
    drawn: { part: { product, part, sketch } } as Drawn,
    search: new URLSearchParams({
      product,
      part,
      state,
      ...(size ? {} : { fit: '' }),
      ...(sketch ? { sketch: sketch.target, variant: sketch.variant } : {}),
      ...(interaction ? { interaction } : {}),
      ...(props ? { props: props.target, 'props-variant': props.variant } : {}),
    }),
    size: size ?? null,
    clip: !preset,
  };
};

/**
 * Draws one state of a part at one preset, at one container width, or fitted to its content, or one
 * variant of a call at a given width, at full height, into a PNG. Each picture is kept per frame, size
 * and theme until a change redraws its part.
 */
export const createPartShooter = (options: {
  target: string;
  base: string | (() => string);
  system: SystemModules;
  chromiumOf?: typeof chromiumOf;
  ledger?: DrawLedger;
  statesOf?: (address: Pick<PartAddress, 'product' | 'part' | 'sketch'>) => Promise<string[] | null>;
  store?: ShotStore;
  queue?: ReturnType<typeof createDrawQueue>;
}) => {
  const { system, statesOf, store } = options;
  const baseOf = () => (typeof options.base === 'function' ? options.base() : options.base);
  const drawQueue = options.queue ?? createDrawQueue(options);
  const warmPages = createWarmPages();
  const cache = new Map<string, { drawn: Drawn; shot: Promise<Picture> }>();
  const motions = new Map<string, { drawn: Drawn; pictures: Promise<MotionPictures> }>();
  const boxes = new Map<string, Promise<ChangedBox[]>>();

  const draw = (browser: Browser, frame: Frame): Promise<Picture> =>
    warmPages.run(
      {
        browser,
        context: {
          viewport: viewportOf(frame.size),
          ...(frame.scale > 1 ? { deviceScaleFactor: frame.scale } : {}),
          ...(frame.scheme ? { colorScheme: frame.scheme } : {}),
        },
      },
      async (page) => {
        await openFrame(page, `${baseOf()}/frame.html?${frame.search}`);
        await page.evaluate(settled);
        await page.evaluate(finished);

        const overlay = page.locator('vite-error-overlay');

        if ((await overlay.count()) > 0) {
          const message = await overlay
            .locator('.message-body')
            .innerText()
            .catch(() => 'the overlay text is unreadable');

          throw new ShotUnprocessableError(`design-explore: the frame has a build error\n${message.trim()}`);
        }

        const marks: unknown = await page.evaluate(marksIn(frame.clip));
        const root = page.locator('#root');

        const rootBox = frame.clip ? await root.boundingBox() : null;

        if (frame.clip) {
          const box = rootBox;

          if (!box || box.width === 0 || box.height === 0)
            throw new ShotUnprocessableError(
              'design-explore: part root has zero size - give an element that fills its container a min-height',
            );
        }

        const origin = frame.crop && frame.clip ? rootBox : null;
        const crop = frame.crop && {
          ...frame.crop,
          x: frame.crop.x + (origin?.x ?? 0),
          y: frame.crop.y + (origin?.y ?? 0),
        };
        const png = await (
          crop
            ? page.screenshot({ ...SHOT_OPTIONS, clip: crop })
            : rootBox
              ? page.screenshot({ ...SHOT_OPTIONS, clip: rootBox })
              : page.screenshot(SHOT_OPTIONS)
        ).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);

          if (error instanceof Error && error.name === 'TimeoutError')
            throw new ShotTimeoutError(
              `design-explore: the screenshot timed out after ${DRAW_TIMEOUT_MS} ms: ${message}`,
            );

          throw new ShotUnprocessableError(`design-explore: the screenshot failed: ${message}`);
        });

        const failure: unknown = await page.evaluate("document.documentElement.getAttribute('data-et-error')");

        if (typeof failure === 'string') {
          const missing: unknown = await page.evaluate("document.documentElement.getAttribute('data-et-missing')");

          throw typeof missing === 'string' ? new ThumbMissingError(failure) : new ShotFailedError(failure, png);
        }

        const markup: unknown = await page.evaluate("document.getElementById('root')?.innerHTML ?? null");

        return {
          png,
          marks: Array.isArray(marks) ? (marks as PartMark[]) : [],
          ...(typeof markup === 'string' ? { markup } : {}),
        };
      },
    );

  const themeOf = (params: URLSearchParams) => ({
    surface: params.get('surface') ?? '',
    color: params.get('color') ?? '',
    fill: params.get('fill') ?? '',
  });

  const cached = (options: {
    key: unknown[];
    drawn: Drawn;
    search: URLSearchParams;
    params: URLSearchParams;
    size: Size | null;
    clip?: boolean;
    want: DrawWant;
    fresh?: boolean;
    gone?: () => ThumbMissingError | null;
    address?: StoredAddress;
    onSource?: (source: ShotSource) => void;
  }) => {
    const theme = themeOf(options.params);
    const scale = scaleOf(options.params);
    const crop = cropOf(options.params.get('clip')) ?? null;
    const scheme = schemeOf(options.params);
    const key = JSON.stringify([...options.key, theme.surface, theme.color, theme.fill, scale, crop, scheme]);
    const kept = options.fresh ? undefined : cache.get(key);

    if (kept) {
      options.onSource?.('memory');

      drawQueue.join(kept.shot, options.want);

      return kept.shot;
    }

    const stored = !options.fresh && options.address ? store?.read(key, options.address) : null;

    if (stored) {
      options.onSource?.('disk');

      const shot = Promise.resolve(stored);

      cache.set(key, { drawn: options.drawn, shot });

      return shot;
    }

    options.onSource?.('drawn');

    if (theme.surface) options.search.set('surface', theme.surface);
    if (theme.color) options.search.set('color', theme.color);
    if (theme.fill) options.search.set('fill', theme.fill);

    const search = options.search.toString();
    const shot = drawQueue.run((browser) => {
      const gone = options.gone?.();

      return gone
        ? Promise.reject(gone)
        : draw(browser, { search, size: options.size, clip: options.clip ?? false, scale, crop, scheme });
    }, options.want);

    const { address } = options;

    cache.set(key, { drawn: options.drawn, shot });
    shot.then(
      (picture) => address && cache.get(key)?.shot === shot && store?.write(key, { address, picture }),
      () => cache.get(key)?.shot === shot && cache.delete(key),
    );

    return shot;
  };

  const partShotOf = (
    options: PartAddress & {
      params: URLSearchParams;
      want: DrawWant;
      fresh?: boolean;
      onSource?: (source: ShotSource) => void;
    },
  ) => {
    const frame = partFrameOf({ system, ...options });

    if (frame instanceof ThumbMissingError) return Promise.reject(frame);

    const gone = () => {
      const now = partFrameOf({ system, ...options });

      return now instanceof ThumbMissingError ? now : null;
    };
    const { product, part, sketch, props } = options;
    const address = { product, part, sketch, props: props ?? null };
    const draw = () =>
      cached({
        ...frame,
        params: options.params,
        want: options.want,
        fresh: options.fresh,
        gone,
        address,
        onSource: options.onSource,
      });

    if (!statesOf) return draw();

    const { state } = options;
    const statesFrom = props ?? sketch;

    return statesOf({ product, part, sketch: statesFrom }).then((names) => {
      if (!names || names.includes(state)) return draw();

      const holder = statesFrom ? `variant "${statesFrom.variant}" of ${statesFrom.target}` : `the merged part ${part}`;

      throw new ThumbMissingError(
        `design-explore: state "${state}" is not in ${holder} - it has: ${names.join(', ') || 'no states'}`,
      );
    });
  };

  const callShotOf = (options: {
    slug: string;
    variant: string;
    width: number;
    params: URLSearchParams;
    want: DrawWant;
    onSource?: (source: ShotSource) => void;
  }) => {
    const { slug, variant, width, params, want, onSource } = options;

    return cached({
      key: ['call', slug, variant, width],
      drawn: { slug },
      search: new URLSearchParams({ call: slug, variant }),
      params,
      size: { width },
      want,
      onSource,
    });
  };

  return {
    middleware: (request: IncomingMessage, response: ServerResponse) => {
      const params = new URL(request.url ?? '', 'http://localhost').searchParams;
      const want = wantOf(params, response);
      const onSource = (source: ShotSource) => response.setHeader('x-design-shot', source);

      if (!isScale(scaleOf(params))) {
        send(response, {
          status: 400,
          type: 'text/plain; charset=utf-8',
          body: `design-explore: scale is a whole number from 1 to ${MAX_SCALE}`,
        });

        return;
      }

      if (cropOf(params.get('clip')) === undefined) {
        send(response, {
          status: 400,
          type: 'text/plain; charset=utf-8',
          body: 'design-explore: clip is x,y,width,height in whole CSS pixels, width and height above 0',
        });

        return;
      }

      const [slug, variant, width, sketch, product] = ['call', 'variant', 'width', 'sketch', 'product'].map((name) =>
        params.get(name),
      );

      if (slug || (!product && (width || variant))) {
        const pixels = Number(width);

        if (!slug || !variant || !isPositiveWhole(pixels)) {
          send(response, {
            status: 400,
            type: 'text/plain; charset=utf-8',
            body: 'design-explore: pass call, variant and a width in pixels',
          });

          return;
        }

        sendShot(
          response,
          noteFailure(
            callShotOf({ slug, variant, width: pixels, params, want, onSource }).then((picture) => picture.png),
            (failure) => options.ledger?.fail({ part: slug, state: variant, ...failure }),
          ),
        );

        return;
      }

      const [part, state, preset] = ['part', 'state', 'preset'].map((name) => params.get(name));
      const pixels = width === null ? null : Number(width);
      const presetWidth = preset && product ? system.productOf(product)?.presets[preset]?.width : undefined;

      const sketchVariant = sketch && variant ? { target: sketch, variant } : null;

      if (product && part && !state && statesOf) {
        void statesOf({ product, part, sketch: sketchVariant }).then(
          (names) =>
            send(response, {
              status: 400,
              type: 'text/plain; charset=utf-8',
              body: names
                ? `design-explore: pass state=<one of: ${names.join(', ')}>`
                : `design-explore: product "${product}" has no part "${part}"`,
            }),
          (error: unknown) =>
            send(response, {
              status: 500,
              type: 'text/plain; charset=utf-8',
              body: error instanceof Error ? error.message : String(error),
            }),
        );

        return;
      }

      if (!product || !part || !state || (pixels !== null && !isPositiveWhole(pixels))) {
        send(response, {
          status: 400,
          type: 'text/plain; charset=utf-8',
          body: 'design-explore: pass product, part, state and at most one of preset and a width in pixels, or call, variant and width',
        });

        return;
      }

      if (preset && pixels !== null && presetWidth !== pixels) {
        send(response, {
          status: 400,
          type: 'text/plain; charset=utf-8',
          body: `design-explore: preset "${preset}" is ${presetWidth ?? 'unknown'} px wide, so width ${pixels} does not match - pass one of them, or the width the preset has`,
        });

        return;
      }

      sendShot(
        response,
        noteFailure(
          partShotOf({
            product,
            part,
            state,
            preset: preset ?? null,
            width: preset ? null : pixels,
            sketch: sketchVariant,
            interaction: params.get('interaction'),
            params,
            want,
            onSource,
          }).then((picture) => picture.png),
          (failure) =>
            options.ledger?.fail({
              part: `${product}/${part}`,
              state,
              ...failure,
              sketch: sketchVariant && { product, ...sketchVariant },
            }),
        ),
      );
    },
    /**
     * Draws one state of a part as `partShotOf` does for the middleware, with the part roots it holds,
     * ahead of every shot asked with `priority=low`.
     */
    pictureOf: (options: PartAddress & { params: URLSearchParams; fresh?: boolean }) =>
      partShotOf({ ...options, want: { priority: 'high' } }),
    /**
     * Draws `motion` of a part from its `from` state, `address.state`, at each keyframe time, with the motion's tracks;
     * `mode` picks `prefers-reduced-motion`. Kept until a change redraws the part. With `flowTo`, `motion` names a flow
     * line instead: the part morphs to that page state in a View Transition, drawn in the whole viewport.
     */
    motionOf: (
      options: PartAddress & {
        motion: string;
        flowTo?: { part: string; state: string };
        at?: readonly number[];
        mode: MotionMode;
        params: URLSearchParams;
      },
    ) => {
      const frame = partFrameOf({ system, ...options });

      if (frame instanceof ThumbMissingError) return Promise.reject(frame);

      const theme = themeOf(options.params);
      const scale = scaleOf(options.params);
      const scheme = schemeOf(options.params);
      const key = JSON.stringify([
        ...frame.key,
        options.motion,
        options.flowTo ?? null,
        options.at ?? [],
        options.mode,
        theme.surface,
        theme.color,
        theme.fill,
        scale,
        scheme,
      ]);
      const kept = motions.get(key);

      if (kept) return kept.pictures;

      for (const [name, value] of Object.entries(theme)) if (value) frame.search.set(name, value);
      if (options.flowTo) frame.search.set('flow-to', `${options.flowTo.part}#${options.flowTo.state}`);
      else frame.search.set('motion', options.motion);

      const pictures = drawQueue.run(
        (browser) =>
          warmPages.run(
            {
              browser,
              context: {
                viewport: viewportOf(frame.size),
                reducedMotion: options.mode === 'reduced' ? 'reduce' : 'no-preference',
                ...(scale > 1 ? { deviceScaleFactor: scale } : {}),
                ...(scheme ? { colorScheme: scheme } : {}),
              },
            },
            (page) =>
              motionPicturesOf({
                page,
                url: `${baseOf()}/frame.html?${frame.search}`,
                clip: frame.clip && !options.flowTo,
                viewport: !!options.flowTo,
                at: options.at,
              }),
          ),
        'high',
      );

      motions.set(key, { drawn: frame.drawn, pictures });
      pictures.catch(() => motions.get(key)?.pictures === pictures && motions.delete(key));

      return pictures;
    },
    /** One box per cluster of the pixels `after` changes from `before`, kept per pair of pictures; drawn after every waiting shot. */
    changedBoxesOf: (before: Buffer, after: Buffer) => {
      const key = [before, after].map((png) => createHash('sha256').update(png).digest('hex')).join(' ');
      const kept = boxes.get(key);

      if (kept) return kept;
      if (boxes.size >= BOX_CACHE_LIMIT) boxes.delete(boxes.keys().next().value ?? '');

      const box = drawQueue.run((browser) => changedBoxesOf({ browser, before, after }), 'low');

      boxes.set(key, box);
      box.catch(() => boxes.get(key) === box && boxes.delete(key));

      return box;
    },
    /** Drops the pictures of the parts `change` redraws. */
    forget: (change: PartsChange) => {
      for (const [key, { drawn }] of cache) {
        if ('part' in drawn && redraws(change, drawn.part)) {
          cache.delete(key);
          store?.drop(key);
        }
      }
      for (const [key, { drawn }] of motions) {
        if ('part' in drawn && redraws(change, drawn.part)) motions.delete(key);
      }
    },
    /** Drops the call pictures a changed file under the calls root may draw into. */
    forgetCalls: (file: string) => {
      for (const [key, { drawn }] of cache) {
        if ('slug' in drawn && callDrawsFrom({ slug: drawn.slug, file })) cache.delete(key);
      }
    },
    clear: () => {
      for (const [key, { drawn }] of cache) {
        if ('part' in drawn) store?.drop(key);
      }
      cache.clear();
      motions.clear();
    },
    close: async () => {
      cache.clear();
      motions.clear();
      boxes.clear();
      await drawQueue.close();
    },
  };
};
