import { IncomingMessage, ServerResponse } from 'http';
import { chromiumOf } from './browser';
import { DrawnPart, PartsChange, redraws } from './changed-parts';
import { DesignPreset } from './paths';
import { SketchVariant, SystemModules } from './system/system-modules';
import {
  Browser,
  callDrawsFrom,
  createDrawQueue,
  DRAW_TIMEOUT_MS,
  openFrame,
  send,
  sendShot,
  settled,
  ShotTimeoutError,
  ShotUnprocessableError,
  ThumbMissingError,
} from './thumb';

export const SHOT_PATH = '/__design/shot';

const isPositiveWhole = (pixels: number) => Number.isInteger(pixels) && pixels > 0;

const VIEWPORT_HEIGHT = 800;

const FIT_VIEWPORT_WIDTH = 1280;

/** The viewport a frame of this size is drawn in. */
export const viewportOf = (size: Size | null) => ({
  width: size?.width ?? FIT_VIEWPORT_WIDTH,
  height: size?.height ?? VIEWPORT_HEIGHT,
});

type Drawn = { part: DrawnPart } | { slug: string };

type Size = Pick<DesignPreset, 'width' | 'height'>;

type Frame = { search: string; size: Size | null; clip: boolean };

type GraphModule = { id: string | null; importers: Set<GraphModule> };

/** An element a part render marked as its root, in CSS pixels from the top left of the picture. */
export type PartMark = { parts: string[]; x: number; y: number; width: number; height: number };

/** One drawn PNG and the part roots in it. */
export type Picture = { png: Buffer; marks: PartMark[] };

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

/** The ids of the given modules and of every module that imports one of them, directly or not. */
export const dependentIdsOf = (modules: Iterable<GraphModule>) => {
  const seen = new Set<GraphModule>();
  const open = [...modules];

  for (let next = open.pop(); next; next = open.pop()) {
    if (seen.has(next)) continue;

    seen.add(next);
    open.push(...next.importers);
  }

  return [...seen].flatMap((module) => (module.id ? [module.id] : []));
};

/** One state of a part as a frame draws it: at a product preset, at a container width, or fitted to its content. */
export type PartAddress = {
  product: string;
  part: string;
  state: string;
  preset: string | null;
  width: number | null;
  sketch: SketchVariant | null;
  interaction: string | null;
};

/** The frame query, viewport and cache key that draw one state of a part, or why the part cannot be drawn. */
export const partFrameOf = (options: PartAddress & { system: SystemModules }) => {
  const { system, product, part, state, preset, width, sketch, interaction } = options;
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
    key: ['part', product, part, state, preset, width, sketch?.target, sketch?.variant, interaction] as unknown[],
    drawn: { part: { product, part, sketch } } as Drawn,
    search: new URLSearchParams({
      product,
      part,
      state,
      ...(size ? {} : { fit: '' }),
      ...(sketch ? { sketch: sketch.target, variant: sketch.variant } : {}),
      ...(interaction ? { interaction } : {}),
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
}) => {
  const { system } = options;
  const baseOf = () => (typeof options.base === 'function' ? options.base() : options.base);
  const drawQueue = createDrawQueue(options);
  const cache = new Map<string, { drawn: Drawn; shot: Promise<Picture> }>();

  const draw = async (browser: Browser, frame: Frame): Promise<Picture> => {
    const context = await browser.newContext({ viewport: viewportOf(frame.size) });

    try {
      const page = await context.newPage();

      await openFrame(page, `${baseOf()}/frame.html?${frame.search}`);
      await page.evaluate(settled);

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

      if (frame.clip) {
        const box = await root.boundingBox();

        if (!box || box.width === 0 || box.height === 0)
          throw new ShotUnprocessableError(
            'design-explore: part root has zero size - give an element that fills its container a min-height',
          );
      }

      const png = await (
        frame.clip
          ? root.screenshot({ type: 'png', timeout: DRAW_TIMEOUT_MS })
          : page.screenshot({ fullPage: true, type: 'png', timeout: DRAW_TIMEOUT_MS })
      ).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);

        if (error instanceof Error && error.name === 'TimeoutError')
          throw new ShotTimeoutError(
            `design-explore: the screenshot timed out after ${DRAW_TIMEOUT_MS} ms: ${message}`,
          );

        throw new ShotUnprocessableError(`design-explore: the screenshot failed: ${message}`);
      });

      return { png, marks: Array.isArray(marks) ? (marks as PartMark[]) : [] };
    } finally {
      await context.close();
    }
  };

  const themeOf = (params: URLSearchParams) => ({
    surface: params.get('surface') ?? '',
    color: params.get('color') ?? '',
  });

  const cached = (options: {
    key: unknown[];
    drawn: Drawn;
    search: URLSearchParams;
    params: URLSearchParams;
    size: Size | null;
    clip?: boolean;
  }) => {
    const theme = themeOf(options.params);
    const key = JSON.stringify([...options.key, theme.surface, theme.color]);
    const kept = cache.get(key);

    if (kept) return kept.shot;
    if (theme.surface) options.search.set('surface', theme.surface);
    if (theme.color) options.search.set('color', theme.color);

    const search = options.search.toString();
    const shot = drawQueue.run((browser) => draw(browser, { search, size: options.size, clip: options.clip ?? false }));

    cache.set(key, { drawn: options.drawn, shot });
    shot.catch(() => cache.get(key)?.shot === shot && cache.delete(key));

    return shot;
  };

  const partShotOf = (options: PartAddress & { params: URLSearchParams }) => {
    const frame = partFrameOf({ system, ...options });

    if (frame instanceof ThumbMissingError) return Promise.reject(frame);

    return cached({ ...frame, params: options.params });
  };

  const callShotOf = (options: { slug: string; variant: string; width: number; params: URLSearchParams }) => {
    const { slug, variant, width, params } = options;

    return cached({
      key: ['call', slug, variant, width],
      drawn: { slug },
      search: new URLSearchParams({ call: slug, variant }),
      params,
      size: { width },
    });
  };

  return {
    middleware: (request: IncomingMessage, response: ServerResponse) => {
      const params = new URL(request.url ?? '', 'http://localhost').searchParams;
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
          callShotOf({ slug, variant, width: pixels, params }).then((picture) => picture.png),
        );

        return;
      }

      const [part, state, preset] = ['part', 'state', 'preset'].map((name) => params.get(name));
      const pixels = width === null ? null : Number(width);

      if (!product || !part || !state || (preset && width) || (pixels !== null && !isPositiveWhole(pixels))) {
        send(response, {
          status: 400,
          type: 'text/plain; charset=utf-8',
          body: 'design-explore: pass product, part, state and at most one of preset and a width in pixels, or call, variant and width',
        });

        return;
      }

      sendShot(
        response,
        partShotOf({
          product,
          part,
          state,
          preset: preset ?? null,
          width: pixels,
          sketch: sketch && variant ? { target: sketch, variant } : null,
          interaction: params.get('interaction'),
          params,
        }).then((picture) => picture.png),
      );
    },
    /** Draws one state of a part as `partShotOf` does for the middleware, with the part roots it holds. */
    pictureOf: partShotOf,
    /** Drops the pictures of the parts `change` redraws. */
    forget: (change: PartsChange) => {
      for (const [key, { drawn }] of cache) {
        if ('part' in drawn && redraws(change, drawn.part)) cache.delete(key);
      }
    },
    /** Drops the call pictures a changed file under the calls root may draw into. */
    forgetCalls: (file: string) => {
      for (const [key, { drawn }] of cache) {
        if ('slug' in drawn && callDrawsFrom({ slug: drawn.slug, file })) cache.delete(key);
      }
    },
    clear: () => cache.clear(),
    close: async () => {
      cache.clear();
      await drawQueue.close();
    },
  };
};
