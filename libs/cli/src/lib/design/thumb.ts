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

/** Rejects a drawing that was still waiting when every ask that wanted it was aborted. */
export class DrawDroppedError extends Error {}

const frameWidthOf = (slug: string) => `(async (slug) => {
  const { calls } = await import('/@id/__x00__virtual:design-explore');
  if (!calls[slug]) return null;
  return (await calls[slug]()).default.frameWidth ?? null;
})(${JSON.stringify(slug)})`;

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

/**
 * Opens a frame and waits until it drew its content or its error, then for its embedded frames. A frame that
 * draws nothing after one reload throws a `ShotTimeoutError` naming the URL.
 */
export const openFrame = async (page: Page, url: string) => {
  const never = (what: string) =>
    new ShotTimeoutError(`design-explore: ${url} did not ${what} within ${DRAW_TIMEOUT_MS} ms`);
  const drawn = async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Headless Chromium's pointer starts at 0,0 on a new page and draws a real :hover on whatever fills the
    // frame's corner. A move before the first navigation does not stick.
    await page.mouse.move(-1, -1);
    return page
      .locator('#root > :not(style)')
      .first()
      .waitFor({ state: 'attached', timeout: DRAW_TIMEOUT_MS })
      .then(
        () => true,
        async () => (await page.locator('vite-error-overlay').count()) > 0,
      );
  };

  if (!(await drawn()) && !(await drawn())) throw never('draw its content');
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

/** Finishes the page's finite time-based animations; scroll-driven ones keep the progress their scroll position gives. */
export const finished = `document.getAnimations()
  .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
  .filter((animation) => typeof ScrollTimeline === 'undefined' || !(animation.timeline instanceof ScrollTimeline))
  .forEach((animation) => animation.finish())`;

export type DrawPriority = 'high' | 'low';

/**
 * What one ask wants of a drawing. `view` is a number the asker raises with each view change; the
 * highest one seen is the shown view. `rank` places the ask in that view. `onWithdraw` gets the callback
 * that withdraws the ask, to call once the asker no longer waits, or at once if it already stopped.
 */
export type DrawWant = {
  priority: DrawPriority;
  view?: number | null;
  rank?: 'active' | 'visible' | null;
  onWithdraw?: (withdraw: () => void) => void;
};

type WaitingDraw = { job: () => Promise<void>; wants: Set<DrawWant>; drop: () => void };

// Partial raster redraws only the invalidated part of a tile, so the anti-aliased edge of a rounded clip over an
// embedded frame depends on which frame painted first: two draws of the same page differed under load.
const DRAW_BROWSER_ARGS = ['--disable-partial-raster'];
export const DRAWS_AT_ONCE = 8;

/**
 * One shared headless Chromium, launched on the first ask, that runs up to `DRAWS_AT_ONCE` drawings at once.
 * A waiting `high` drawing runs first; of the `low` ones, those for the active frame of the shown view,
 * then its visible cells, then the rest, then those of views no longer shown, each lane in the order asked.
 * A drawing every ask withdrew before it started is dropped. A failed launch is not kept, so the next ask
 * tries again.
 */
export const createDrawQueue = (options: { target: string; chromiumOf?: typeof chromiumOf; ledger?: DrawLedger }) => {
  const { target, ledger } = options;
  const resolveChromium = options.chromiumOf ?? chromiumOf;
  let browser: Promise<Browser> | null = null;
  const waiting: WaitingDraw[] = [];
  const entries = new WeakMap<Promise<unknown>, WaitingDraw>();
  let drawing = 0;
  let shownView = 0;

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

  const laneOf = (want: DrawWant) => {
    if (want.priority === 'high') return 0;
    if (typeof want.view === 'number' && want.view < shownView) return 4;

    return want.rank === 'active' ? 1 : want.rank === 'visible' ? 2 : 3;
  };

  const entryLaneOf = (entry: WaitingDraw) => Math.min(...[...entry.wants].map(laneOf));

  const next = () => {
    while (drawing < DRAWS_AT_ONCE && waiting.length > 0) {
      const lanes = waiting.map(entryLaneOf);
      const at = lanes.indexOf(Math.min(...lanes));
      const [entry] = waiting.splice(at, 1);

      if (!entry) return;

      drawing++;
      void entry.job().finally(() => {
        drawing--;
        next();
      });
    }
  };

  const withdraw = (entry: WaitingDraw, want: DrawWant) => {
    entry.wants.delete(want);

    const at = waiting.indexOf(entry);

    if (at < 0 || entry.wants.size > 0) return;

    waiting.splice(at, 1);
    entry.drop();
  };

  const see = (want: DrawWant) => {
    if (typeof want.view === 'number' && want.view > shownView) shownView = want.view;
  };

  const add = (entry: WaitingDraw, want: DrawWant) => {
    see(want);

    if (!waiting.includes(entry)) return;

    entry.wants.add(want);

    want.onWithdraw?.(() => withdraw(entry, want));
  };

  const join = (drawn: Promise<unknown>, want: DrawWant) => {
    const entry = entries.get(drawn);

    if (entry) add(entry, want);
    else see(want);
  };

  return {
    run: <T>(draw: (browser: Browser) => Promise<T>, want: DrawPriority | DrawWant = 'high') => {
      const ticket = ledger?.ask();
      const entry: WaitingDraw = {
        job: () => Promise.resolve(),
        wants: new Set(),
        drop: () => undefined,
      };
      const drawn = new Promise<T>((resolve, reject) => {
        entry.job = () => {
          ticket?.start();

          return launch()
            .then(draw)
            .then(resolve, reject)
            .finally(() => ticket?.end());
        };
        entry.drop = () => {
          ticket?.end();
          reject(new DrawDroppedError('design-explore: every ask withdrew the drawing before it started'));
        };
      });

      entries.set(drawn, entry);
      waiting.push(entry);
      add(entry, typeof want === 'string' ? { priority: want } : want);
      next();

      return drawn;
    },
    /** Adds an ask to a drawing `run` returned, so it runs in the best lane any of its asks wants, unless it already started. */
    join,
    /** Moves a drawing `run` returned into the high lane, unless it already started. */
    hurry: (drawn: Promise<unknown>) => join(drawn, { priority: 'high' }),
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
  shot.catch((error: unknown) => !(error instanceof DrawDroppedError) && failed(failureOf(error)));

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
