import { IncomingMessage, ServerResponse } from 'http';
import { posix } from 'path';
import { Chromium, chromiumOf } from './browser';
import { DrawLedger } from './draw-ledger';

export const THUMB_PATH = '/__design/thumb';

/** The pixel width a thumbnail comes out at: twice the 180px tile Studio shows it in. */
export const THUMB_PIXEL_WIDTH = 360;

const THUMB_ASPECT = 9 / 16;

export const DRAW_TIMEOUT_MS = 15000;

export type Browser = Awaited<ReturnType<Chromium['launch']>>;

type Shot = { status: number; type: string; body: Buffer | string };

export class ThumbUnavailableError extends Error {}

export class ThumbMissingError extends Error {}

export class ShotUnprocessableError extends Error {}

/** A frame that drew its own error text: the shot is that picture, answered with a failing status. */
export class ShotFailedError extends Error {
  constructor(
    message: string,
    readonly png: Buffer,
  ) {
    super(message);
  }
}

export class ShotTimeoutError extends Error {}

const frameWidthOf = (slug: string) => `(async (slug) => {
  const { calls } = await import('/@id/__x00__virtual:design-explore');
  if (!calls[slug]) return null;
  return (await calls[slug]()).default.frameWidth ?? null;
})(${JSON.stringify(slug)})`;

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

/**
 * Opens a frame and waits until it drew its content or its error, then for its embedded frames. A frame that
 * never draws throws a `ShotTimeoutError` naming the URL.
 */
export const openFrame = async (page: Page, url: string) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Headless Chromium's pointer starts at 0,0 on a new page and draws a real :hover on whatever fills the
  // frame's corner. A move before the first navigation does not stick.
  await page.mouse.move(-1, -1);
  const never = (what: string) =>
    new ShotTimeoutError(`design-explore: ${url} did not ${what} within ${DRAW_TIMEOUT_MS} ms`);

  await page
    .locator('#root > :not(style)')
    .first()
    .waitFor({ state: 'attached', timeout: DRAW_TIMEOUT_MS })
    .catch(async () => {
      if ((await page.locator('vite-error-overlay').count()) === 0) throw never('draw its content');
    });
  await page
    .locator('iframe[data-et-embed]:not([data-et-embed-drawn])')
    .first()
    .waitFor({ state: 'detached', timeout: DRAW_TIMEOUT_MS })
    .catch(() => {
      throw never('draw its embedded frames');
    });
};

export const settled = `new Promise((done) => document.fonts.ready.then(() =>
  requestAnimationFrame(() => requestAnimationFrame(() => done(true)))))`;

export const finished = `document.getAnimations()
  .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
  .forEach((animation) => animation.finish())`;

export type DrawPriority = 'high' | 'low';

// Partial raster redraws only the invalidated part of a tile, so the anti-aliased edge of a rounded clip over an
// embedded frame depends on which frame painted first: two draws of the same page differed under load.
const DRAW_BROWSER_ARGS = ['--disable-partial-raster'];
const DRAWS_AT_ONCE = 4;

/**
 * One shared headless Chromium, launched on the first ask, that runs up to four drawings at once. A waiting
 * `high` drawing runs before every waiting `low` one, each lane in the order asked. A failed launch is
 * not kept, so the next ask tries again.
 */
export const createDrawQueue = (options: { target: string; chromiumOf?: typeof chromiumOf; ledger?: DrawLedger }) => {
  const { target, ledger } = options;
  const resolveChromium = options.chromiumOf ?? chromiumOf;
  let browser: Promise<Browser> | null = null;
  const waiting: Record<DrawPriority, (() => Promise<void>)[]> = { high: [], low: [] };
  const jobs = new WeakMap<Promise<unknown>, () => Promise<void>>();
  let drawing = 0;

  const launch = () => {
    browser ??= resolveChromium(target).then((resolved) => {
      if (!resolved) {
        throw new ThumbUnavailableError(
          'design-explore: no playwright or playwright-core resolves, so the server can not draw thumbnails',
        );
      }

      return resolved.chromium.launch({ args: DRAW_BROWSER_ARGS }).catch((error: unknown) => {
        throw new ThumbUnavailableError(
          `design-explore: the Chromium of ${resolved.from} did not start\n${error instanceof Error ? error.message : String(error)}`,
        );
      });
    });

    browser.catch(() => (browser = null));

    return browser;
  };

  const next = () => {
    while (drawing < DRAWS_AT_ONCE) {
      const job = waiting.high.shift() ?? waiting.low.shift();

      if (!job) return;

      drawing++;
      void job().finally(() => {
        drawing--;
        next();
      });
    }
  };

  return {
    run: <T>(draw: (browser: Browser) => Promise<T>, priority: DrawPriority = 'high') => {
      const ticket = ledger?.ask();
      let job = () => Promise.resolve();
      const drawn = new Promise<T>((resolve, reject) => {
        job = () => {
          ticket?.start();

          return launch()
            .then(draw)
            .then(resolve, reject)
            .finally(() => ticket?.end());
        };
      });

      jobs.set(drawn, job);
      waiting[priority].push(job);
      next();

      return drawn;
    },
    /** Moves a drawing `run` returned into the high lane, unless it already started. */
    hurry: (drawn: Promise<unknown>) => {
      const job = jobs.get(drawn);
      const at = job ? waiting.low.indexOf(job) : -1;

      if (job && at >= 0) waiting.high.push(...waiting.low.splice(at, 1));
    },
    close: async () => {
      const running = browser;

      browser = null;
      await running?.then((open) => open.close()).catch(() => undefined);
    },
  };
};

const failureOf = (error: unknown) => ({
  status:
    error instanceof ThumbUnavailableError
      ? 503
      : error instanceof ThumbMissingError
        ? 404
        : error instanceof ShotUnprocessableError
          ? 422
          : error instanceof ShotTimeoutError
            ? 504
            : 500,
  message: error instanceof Error ? error.message : String(error),
});

/** Calls `failed` with the status and message a shot answers when it fails, and returns the shot. */
export const noteFailure = <T>(shot: Promise<T>, failed: (failure: { status: number; message: string }) => void) => {
  shot.catch((error: unknown) => failed(failureOf(error)));

  return shot;
};

export const sendShot = (response: ServerResponse, shot: Promise<Buffer>) =>
  void shot.then(
    (body) => send(response, { status: 200, type: 'image/png', body }),
    (error: unknown) => {
      const failure = failureOf(error);

      send(
        response,
        error instanceof ShotFailedError
          ? { status: 500, type: 'image/png', body: error.png }
          : { status: failure.status, type: 'text/plain; charset=utf-8', body: failure.message },
      );
    },
  );

export const send = (response: ServerResponse, { status, type, body }: Shot) => {
  response.statusCode = status;
  response.setHeader('content-type', type);
  response.end(body);
};

/** Whether a call may draw from a file under the calls root: its own, or one in a folder above it. */
export const callDrawsFrom = ({ slug, file }: { slug: string; file: string }) => {
  const folder = posix.dirname(file.replace(/\\/g, '/'));

  return folder === '.' || slug.startsWith(`${folder}/`) || folder === slug || folder.startsWith(`${slug}/`);
};

/**
 * Draws variants into PNGs in the shared Chromium of a draw queue. Each finished picture is kept per
 * query until its call is drawn again.
 */
export const createThumbnailer = (options: {
  target: string;
  base: string | (() => string);
  chromiumOf?: typeof chromiumOf;
  ledger?: DrawLedger;
}) => {
  const baseOf = () => (typeof options.base === 'function' ? options.base() : options.base);
  const drawQueue = createDrawQueue(options);
  const cache = new Map<string, { slug: string; shot: Promise<Buffer> }>();

  const draw = async (browser: Browser, { slug, search }: { slug: string; search: string }) => {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });

    try {
      const page = await context.newPage();

      await openFrame(page, `${baseOf()}/frame.html${search}`);

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

    const shot = drawQueue.run((browser) => draw(browser, { slug, search }));

    cache.set(search, { slug, shot });
    shot.catch(() => cache.get(search)?.shot === shot && cache.delete(search));

    return shot;
  };

  return {
    middleware: (request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? '', 'http://localhost');
      const slug = url.searchParams.get('call') ?? '';

      if (!slug || !url.searchParams.get('variant')) {
        send(response, {
          status: 400,
          type: 'text/plain; charset=utf-8',
          body: 'design-explore: pass call and variant',
        });

        return;
      }

      sendShot(
        response,
        noteFailure(shotOf(slug, url.search), (failure) =>
          options.ledger?.fail({ part: slug, state: url.searchParams.get('variant') ?? '', ...failure }),
        ),
      );
    },
    /** Drops the pictures a changed file may draw into: its own call's, or every call below its folder. */
    forget: (file: string) => {
      for (const [key, entry] of cache) {
        if (callDrawsFrom({ slug: entry.slug, file })) cache.delete(key);
      }
    },
    clear: () => cache.clear(),
    close: async () => {
      cache.clear();
      await drawQueue.close();
    },
  };
};
