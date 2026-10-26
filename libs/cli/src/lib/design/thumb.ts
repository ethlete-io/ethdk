import { IncomingMessage, ServerResponse } from 'http';
import { posix } from 'path';
import { Chromium, chromiumOf } from './browser';

export const THUMB_PATH = '/__design/thumb';

/** The pixel width a thumbnail comes out at: twice the 180px tile Studio shows it in. */
export const THUMB_PIXEL_WIDTH = 360;

const THUMB_ASPECT = 9 / 16;

const DRAW_TIMEOUT_MS = 15000;

type Browser = Awaited<ReturnType<Chromium['launch']>>;

type Shot = { status: number; type: string; body: Buffer | string };

export class ThumbUnavailableError extends Error {}

export class ThumbMissingError extends Error {}

const frameWidthOf = (slug: string) => `(async (slug) => {
  const { calls } = await import('/@id/__x00__virtual:design-explore');
  if (!calls[slug]) return null;
  return (await calls[slug]()).default.frameWidth ?? null;
})(${JSON.stringify(slug)})`;

const settled = `new Promise((done) => document.fonts.ready.then(() =>
  requestAnimationFrame(() => requestAnimationFrame(() => done(true)))))`;

/**
 * Draws variants into PNGs in one shared headless Chromium, launched on the first ask. Renders run
 * one at a time, and each finished picture is kept per query until its call is drawn again.
 */
export const createThumbnailer = (options: { target: string; base: string; chromiumOf?: typeof chromiumOf }) => {
  const { target, base } = options;
  const resolveChromium = options.chromiumOf ?? chromiumOf;
  const cache = new Map<string, { slug: string; shot: Promise<Buffer> }>();
  let browser: Promise<Browser> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const launch = () => {
    browser ??= resolveChromium(target).then((resolved) => {
      if (!resolved) {
        throw new ThumbUnavailableError(
          'design-explore: no playwright or playwright-core resolves, so the server can not draw thumbnails',
        );
      }

      return resolved.chromium.launch().catch((error: unknown) => {
        throw new ThumbUnavailableError(
          `design-explore: the Chromium of ${resolved.from} did not start\n${error instanceof Error ? error.message : String(error)}`,
        );
      });
    });

    browser.catch(() => (browser = null));

    return browser;
  };

  const draw = async (slug: string, search: string) => {
    const context = await (await launch()).newContext({ viewport: { width: 1600, height: 900 } });

    try {
      const page = await context.newPage();

      await page.goto(`${base}/frame.html${search}`, { waitUntil: 'domcontentloaded' });
      await page
        .locator('#root > :not(style)')
        .first()
        .waitFor({ timeout: DRAW_TIMEOUT_MS })
        .catch(() => undefined);

      const width = (await page.evaluate(frameWidthOf(slug))) as number | null;

      if (!width) throw new ThumbMissingError(`design-explore: no call "${slug}" with a frameWidth`);

      const cdp = await context.newCDPSession(page);

      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: Math.round(width * THUMB_ASPECT),
        deviceScaleFactor: THUMB_PIXEL_WIDTH / width,
        mobile: false,
      });
      await page.evaluate(settled);

      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });

      return Buffer.from(data, 'base64');
    } finally {
      await context.close();
    }
  };

  const shotOf = (slug: string, search: string) => {
    const cached = cache.get(search);

    if (cached) return cached.shot;

    const shot = queue.then(() => draw(slug, search));

    queue = shot.catch(() => undefined);
    cache.set(search, { slug, shot });
    shot.catch(() => cache.get(search)?.shot === shot && cache.delete(search));

    return shot;
  };

  return {
    middleware: (request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? '', 'http://localhost');
      const slug = url.searchParams.get('call') ?? '';
      const send = ({ status, type, body }: Shot) => {
        response.statusCode = status;
        response.setHeader('content-type', type);
        response.end(body);
      };

      if (!slug || !url.searchParams.get('variant')) {
        send({ status: 400, type: 'text/plain; charset=utf-8', body: 'design-explore: pass call and variant' });

        return;
      }

      void shotOf(slug, url.search).then(
        (body) => send({ status: 200, type: 'image/png', body }),
        (error: unknown) =>
          send({
            status: error instanceof ThumbUnavailableError ? 503 : error instanceof ThumbMissingError ? 404 : 500,
            type: 'text/plain; charset=utf-8',
            body: error instanceof Error ? error.message : String(error),
          }),
      );
    },
    /** Drops the pictures a changed file may draw into: its own call's, or every call below its folder. */
    forget: (file: string) => {
      const folder = posix.dirname(file.replace(/\\/g, '/'));

      for (const [key, entry] of cache) {
        const shared = folder === '.' || entry.slug.startsWith(`${folder}/`);

        if (shared || folder === entry.slug || folder.startsWith(`${entry.slug}/`)) cache.delete(key);
      }
    },
    close: async () => {
      const running = browser;

      browser = null;
      cache.clear();
      await running?.then((open) => open.close()).catch(() => undefined);
    },
  };
};
