import { IncomingMessage, ServerResponse } from 'http';
import { chromiumOf } from './browser';
import { DrawnPart, PartsChange, redraws } from './changed-parts';
import { DesignPreset } from './paths';
import { SketchVariant, SystemModules } from './system/system-modules';
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

const isPositiveWhole = (pixels: number) => Number.isInteger(pixels) && pixels > 0;

const VIEWPORT_HEIGHT = 800;

const FIT_VIEWPORT_WIDTH = 1280;

type Drawn = { part: DrawnPart } | { slug: string };

type Size = Pick<DesignPreset, 'width' | 'height'>;

type Frame = { search: string; size: Size | null; clip: boolean };

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
 * Draws one state of a part at one preset, at one container width, or fitted to its content, or one
 * variant of a call at a given width, at full height, into a PNG. Each picture is kept per frame, size
 * and theme until a change redraws its part.
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
      viewport: { width: frame.size?.width ?? FIT_VIEWPORT_WIDTH, height: frame.size?.height ?? VIEWPORT_HEIGHT },
    });

    try {
      const page = await context.newPage();

      await openFrame(page, `${base}/frame.html?${frame.search}`);
      await page.evaluate(settled);

      if (frame.clip) return await page.locator('#root').screenshot({ type: 'png' });

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

  const partShotOf = (options: {
    product: string;
    part: string;
    state: string;
    preset: string | null;
    width: number | null;
    sketch: SketchVariant | null;
    interaction: string | null;
    params: URLSearchParams;
  }) => {
    const { product, part, state, preset, width, sketch, interaction, params } = options;
    const file = system.partOf({ product, part, sketch })?.file;
    const size = preset ? system.productOf(product)?.presets[preset] : width ? { width } : null;

    if (!file)
      return Promise.reject(
        new ThumbMissingError(
          sketch
            ? `design-explore: variant "${sketch.variant}" of the sketch on ${sketch.target} in product "${product}" has no part "${part}"`
            : `design-explore: product "${product}" has no part "${part}"`,
        ),
      );
    if (preset && !size)
      return Promise.reject(new ThumbMissingError(`design-explore: product "${product}" has no preset "${preset}"`));

    return cached({
      key: ['part', product, part, state, preset, width, sketch?.target, sketch?.variant, interaction],
      drawn: { part: { product, part, sketch } },
      search: new URLSearchParams({
        product,
        part,
        state,
        ...(size ? {} : { fit: '' }),
        ...(sketch ? { sketch: sketch.target, variant: sketch.variant } : {}),
        ...(interaction ? { interaction } : {}),
      }),
      params,
      size: size ?? null,
      clip: !preset,
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

        sendShot(response, callShotOf({ slug, variant, width: pixels, params }));

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
        }),
      );
    },
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
