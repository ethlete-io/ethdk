import { IncomingMessage, ServerResponse } from 'http';
import { chromiumOf } from './browser';
import { DesignPreset } from './paths';
import { fileOfModuleId, productOfModuleId, SketchVariant, SystemModules } from './system/system-modules';
import {
  Browser,
  callDrawsFrom,
  createDrawQueue,
  openFrame,
  send,
  sendShot,
  settled,
  ThumbMissingError,
} from './thumb';

export const SHOT_PATH = '/__design/shot';

const VIEWPORT_HEIGHT = 800;

type Drawn = { product: string; file: string } | { slug: string };

type Frame = { search: string; preset: Pick<DesignPreset, 'width' | 'height'> };

type GraphModule = { id: string | null; importers: Set<GraphModule> };

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

/**
 * Draws one state of a part at one preset width, or one variant of a call at a given width, at full
 * height, into a PNG. Each picture is kept per frame, size and theme until a file it was drawn from
 * changes.
 */
export const createPartShooter = (options: {
  target: string;
  base: string;
  system: SystemModules;
  chromiumOf?: typeof chromiumOf;
}) => {
  const { base, system } = options;
  const drawQueue = createDrawQueue(options);
  const cache = new Map<string, { drawn: Drawn; shot: Promise<Buffer> }>();

  const draw = async (browser: Browser, frame: Frame) => {
    const context = await browser.newContext({
      viewport: { width: frame.preset.width, height: frame.preset.height ?? VIEWPORT_HEIGHT },
    });

    try {
      const page = await context.newPage();

      await openFrame(page, `${base}/frame.html?${frame.search}`);
      await page.evaluate(settled);

      return await page.screenshot({ fullPage: true, type: 'png' });
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
    size: Pick<DesignPreset, 'width' | 'height'>;
  }) => {
    const theme = themeOf(options.params);
    const key = JSON.stringify([...options.key, theme.surface, theme.color]);
    const kept = cache.get(key);

    if (kept) return kept.shot;
    if (theme.surface) options.search.set('surface', theme.surface);
    if (theme.color) options.search.set('color', theme.color);

    const search = options.search.toString();
    const shot = drawQueue.run((browser) => draw(browser, { search, preset: options.size }));

    cache.set(key, { drawn: options.drawn, shot });
    shot.catch(() => cache.get(key)?.shot === shot && cache.delete(key));

    return shot;
  };

  const partShotOf = (options: {
    product: string;
    part: string;
    state: string;
    preset: string;
    sketch: SketchVariant | null;
    params: URLSearchParams;
  }) => {
    const { product, part, state, preset, sketch, params } = options;
    const file = system.partOf({ product, part, sketch })?.file;
    const size = system.productOf(product)?.presets[preset];

    if (!file)
      return Promise.reject(
        new ThumbMissingError(
          sketch
            ? `design-explore: variant "${sketch.variant}" of the sketch on ${sketch.target} in product "${product}" has no part "${part}"`
            : `design-explore: product "${product}" has no part "${part}"`,
        ),
      );
    if (!size)
      return Promise.reject(new ThumbMissingError(`design-explore: product "${product}" has no preset "${preset}"`));

    return cached({
      key: ['part', product, part, state, preset, sketch?.target, sketch?.variant],
      drawn: { product, file },
      search: new URLSearchParams({
        product,
        part,
        state,
        ...(sketch ? { sketch: sketch.target, variant: sketch.variant } : {}),
      }),
      params,
      size,
    });
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
      const [slug, variant, width, sketch] = ['call', 'variant', 'width', 'sketch'].map((name) => params.get(name));

      if (slug || width || (variant && !sketch)) {
        const pixels = Number(width);

        if (!slug || !variant || !Number.isInteger(pixels) || pixels <= 0) {
          send(response, {
            status: 400,
            type: 'text/plain; charset=utf-8',
            body: 'design-explore: pass call, variant and a width in pixels',
          });

          return;
        }

        sendShot(response, callShotOf({ slug, variant, width: pixels, params }));

        return;
      }

      const [product, part, state, preset] = ['product', 'part', 'state', 'preset'].map((name) => params.get(name));

      if (!product || !part || !state || !preset) {
        send(response, {
          status: 400,
          type: 'text/plain; charset=utf-8',
          body: 'design-explore: pass product, part, state and preset, or call, variant and width',
        });

        return;
      }

      sendShot(
        response,
        partShotOf({
          product,
          part,
          state,
          preset,
          sketch: sketch && variant ? { target: sketch, variant } : null,
          params,
        }),
      );
    },
    /** Drops the pictures drawn from one of the given module ids, each of which names its product. */
    forget: (ids: string[]) => {
      const drawn = new Set(
        ids.flatMap((id) => {
          const product = productOfModuleId(id);

          return product ? [JSON.stringify([product, fileOfModuleId(id)])] : [];
        }),
      );

      for (const [key, { drawn: from }] of cache) {
        if ('file' in from && drawn.has(JSON.stringify([from.product, from.file]))) cache.delete(key);
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
