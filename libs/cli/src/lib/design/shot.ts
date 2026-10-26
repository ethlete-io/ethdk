import { IncomingMessage, ServerResponse } from 'http';
import { chromiumOf } from './browser';
import { DesignPreset } from './paths';
import { fileOfModuleId, productOfModuleId, SystemModules } from './system/system-modules';
import { Browser, createDrawQueue, openFrame, send, sendShot, settled, ThumbMissingError } from './thumb';

export const SHOT_PATH = '/__design/shot';

const VIEWPORT_HEIGHT = 800;

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
 * Draws one state of a part at one preset width, at full height, into a PNG. Each picture is kept
 * per part, state, preset and theme until a module it was drawn from changes.
 */
export const createPartShooter = (options: {
  target: string;
  base: string;
  system: SystemModules;
  chromiumOf?: typeof chromiumOf;
}) => {
  const { base, system } = options;
  const drawQueue = createDrawQueue(options);
  const cache = new Map<string, { product: string; file: string; shot: Promise<Buffer> }>();

  const draw = async (browser: Browser, frame: { search: string; preset: DesignPreset }) => {
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

  const shotOf = (options: {
    product: string;
    part: string;
    state: string;
    preset: string;
    params: URLSearchParams;
  }) => {
    const { product, part, state, preset, params } = options;
    const file = system.partOf({ product, part })?.file;
    const size = system.productOf(product)?.presets[preset];

    if (!file)
      return Promise.reject(new ThumbMissingError(`design-explore: product "${product}" has no part "${part}"`));
    if (!size)
      return Promise.reject(new ThumbMissingError(`design-explore: product "${product}" has no preset "${preset}"`));

    const theme = { surface: params.get('surface') ?? '', color: params.get('color') ?? '' };
    const key = JSON.stringify([product, part, state, preset, theme.surface, theme.color]);
    const cached = cache.get(key);

    if (cached) return cached.shot;

    const search = new URLSearchParams({ product, part, state });

    if (theme.surface) search.set('surface', theme.surface);
    if (theme.color) search.set('color', theme.color);

    const shot = drawQueue.run((browser) => draw(browser, { search: search.toString(), preset: size }));

    cache.set(key, { product, file, shot });
    shot.catch(() => cache.get(key)?.shot === shot && cache.delete(key));

    return shot;
  };

  return {
    middleware: (request: IncomingMessage, response: ServerResponse) => {
      const params = new URL(request.url ?? '', 'http://localhost').searchParams;
      const [product, part, state, preset] = ['product', 'part', 'state', 'preset'].map((name) => params.get(name));

      if (!product || !part || !state || !preset) {
        send(response, {
          status: 400,
          type: 'text/plain; charset=utf-8',
          body: 'design-explore: pass product, part, state and preset',
        });

        return;
      }

      sendShot(response, shotOf({ product, part, state, preset, params }));
    },
    /** Drops the pictures drawn from one of the given module ids, each of which names its product. */
    forget: (ids: string[]) => {
      const drawn = new Set(
        ids.flatMap((id) => {
          const product = productOfModuleId(id);

          return product ? [JSON.stringify([product, fileOfModuleId(id)])] : [];
        }),
      );

      for (const [key, entry] of cache) {
        if (drawn.has(JSON.stringify([entry.product, entry.file]))) cache.delete(key);
      }
    },
    clear: () => cache.clear(),
    close: async () => {
      cache.clear();
      await drawQueue.close();
    },
  };
};
