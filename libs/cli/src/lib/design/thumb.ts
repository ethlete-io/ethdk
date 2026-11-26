import { fromEvent, take, tap } from 'rxjs';
import { createHash } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { posix } from 'path';
import { Chromium, chromiumOf } from './browser';
import { DrawLedger } from './draw-ledger';
import { performance } from 'perf_hooks';
import { timedPhase } from './phase-timing';
import { RunAbortedError, runSignal } from './run-abort';
import { ShotBoard } from './shot-board';
import { recordCache, recordDrawWait } from './timings';
import { withinLimit } from './wait';
import { loadScaledMs } from './system/no-verdict';
import { pendingRequestsLineOf, trackPendingRequests } from './pending-requests';
import { reportEmbedStall } from './embed-stall';

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

/** A design-server URL that answered an error status, such as the 403 Vite sends for a file outside `server.fs.allow`. */
export class FrameUnservedError extends Error {}

/** Throws a `FrameUnservedError` naming the URL and status when the navigation to a design-server page answered 400 or above. */
export const assertServed = (response: { status(): number } | null, url: string) => {
  const status = response?.status() ?? 0;

  if (status >= 400) {
    throw new FrameUnservedError(
      `design-explore: ${url} was not served (HTTP ${status}) - the design server refused or failed the page, so nothing on it can be measured`,
    );
  }
};

/** Rejects a drawing that was still waiting when every ask that wanted it was aborted. */
export class DrawDroppedError extends Error {}

const frameWidthOf = (slug: string) => `(async (slug) => {
  const { calls } = await import('/@id/__x00__virtual:design-explore');
  if (!calls[slug]) return null;
  return (await calls[slug]()).default.frameWidth ?? null;
})(${JSON.stringify(slug)})`;

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

// A part that measures its layout as it mounts measures the fallback font while a web font still loads, so a fresh
// load drew other pixels than a switch into the same state. A draw during which a face loaded runs again: one still
// loading after it, or one not loaded before it. A face the draw removed does not count.
const drawnOnLoadedFontsOf = (options: { state: string; switching: boolean }) => `(async ({ state, switching }) => {
  const drawn = () => document.querySelector('#root > :not(style)') !== null;
  const loaded = () => new Set([...document.fonts]
    .filter((face) => face.status === 'loaded')
    .map((face) => [face.family, face.weight, face.style, face.stretch, face.unicodeRange].join('|')));
  if (typeof window.etSwitchState !== 'function') return !switching && drawn();
  let before = switching ? loaded() : new Set();
  if (switching) await window.etSwitchState(state);
  for (let pass = 0; pass < 3 && drawn(); pass++) {
    document.documentElement.getBoundingClientRect();
    const loading = [...document.fonts].some((face) => face.status === 'loading');
    await document.fonts.ready;
    const after = loaded();
    if (!loading && [...after].every((face) => before.has(face))) break;
    before = after;
    await window.etSwitchState(state);
  }
  return drawn();
})(${JSON.stringify(options)})`;

const stalled = (error: ShotTimeoutError) => {
  reportEmbedStall(error.message);

  return error;
};

/**
 * Opens a frame and waits until it drew its content or its error, then for its embedded frames. Each wait is
 * `DRAW_TIMEOUT_MS` stretched by the machine load. A frame that draws nothing after one reload throws a
 * `ShotTimeoutError` naming the URL.
 */
export const openFrame = async (page: Page, url: string) => {
  const timeout = loadScaledMs(DRAW_TIMEOUT_MS);
  const never = (what: string, open = '') =>
    new ShotTimeoutError(`design-explore: ${url} did not ${what} within ${timeout} ms${open}`);

  await trackPendingRequests(page);

  const drawn = async () => {
    assertServed(await page.goto(url, { waitUntil: 'domcontentloaded' }), url);
    // Headless Chromium's pointer starts at 0,0 on a new page and draws a real :hover on whatever fills the
    // frame's corner. A move before the first navigation does not stick.
    await page.mouse.move(-1, -1);
    return page
      .locator('#root > :not(style)')
      .first()
      .waitFor({ state: 'attached', timeout })
      .then(
        () => true,
        async () => (await page.locator('vite-error-overlay').count()) > 0,
      );
  };

  if (!(await drawn()) && !(await drawn())) throw never('draw its content');
  const state = new URL(url, 'http://frame').searchParams.get('state');

  if (state !== null) await page.evaluate(drawnOnLoadedFontsOf({ state, switching: false }));
  await embedsDrawnOnLoadedFonts(page, timeout).catch(async () => {
    throw stalled(never('draw its embedded frames', await pendingRequestsLineOf(page)));
  });
};

type PageFrame = ReturnType<Page['mainFrame']>;

const embedsDrawnIn = (frame: Pick<PageFrame, 'locator'>, timeout: number) =>
  frame.locator('iframe[data-et-embed]:not([data-et-embed-drawn])').first().waitFor({ state: 'detached', timeout });

const embedsRedrawnOnLoadedFonts = async (frames: PageFrame[], timeout: number): Promise<void> => {
  for (const frame of frames) {
    const state = new URL(frame.url()).searchParams.get('state');

    if (state !== null) await frame.evaluate(drawnOnLoadedFontsOf({ state, switching: false }));
    await embedsDrawnIn(frame, timeout);
    await embedsRedrawnOnLoadedFonts(frame.childFrames(), timeout);
  }
};

const embedsDrawnOnLoadedFonts = async (page: Page, timeout: number) => {
  await embedsDrawnIn(page, timeout);
  await embedsRedrawnOnLoadedFonts(page.mainFrame().childFrames(), timeout);
};

/** What a part frame loads apart from its `state`: two frames with the same boot key can switch into each other. */
export const bootKeyOf = (search: string) => {
  const params = new URLSearchParams(search);

  params.delete('state');

  return params.toString();
};

/**
 * Draws `state` in place on a part frame that `openFrame` opened, as a fresh load with that state would, and waits for
 * its embedded frames. Resolves `false` when the frame cannot switch or drew nothing; open it with `openFrame` then.
 */
export const switchFrame = async (page: Page, state: string) => {
  const switched = await page.evaluate(drawnOnLoadedFontsOf({ state, switching: true }));

  if (switched !== true) return false;

  const timeout = loadScaledMs(DRAW_TIMEOUT_MS);

  await embedsDrawnOnLoadedFonts(page, timeout).catch(async () => {
    throw stalled(
      new ShotTimeoutError(
        `design-explore: ${page.url()} did not draw its embedded frames within ${timeout} ms${await pendingRequestsLineOf(page)}`,
      ),
    );
  });

  return true;
};

/**
 * Evaluates in a page to the font faces its text can draw with: each face that covers every character, and each
 * unicode-range face whose range holds a character of the page's markup or of a field's value.
 */
export const facesInUse = `(() => {
  const text = [document.documentElement.outerHTML, ...[...document.querySelectorAll('input, textarea')].map((field) => field.value)].join('');
  return [...document.fonts].filter((face) => {
    if (face.unicodeRange.toUpperCase() === 'U+0-10FFFF') return true;
    const spans = face.unicodeRange.split(',').map((span) => {
      const [from, to = from] = span.trim().slice(2).split('-');
      return '\\\\u{' + from.replaceAll('?', '0') + '}-\\\\u{' + to.replaceAll('?', 'F') + '}';
    });
    return new RegExp('[' + spans.join('') + ']', 'u').test(text);
  });
})()`;

const loadedFonts = `Promise.all(${facesInUse}.map((face) => face.load().catch(() => undefined)))
  .then(() => document.fonts.ready)`;

export const settled = `new Promise((done) => ${loadedFonts}.then(() =>
  requestAnimationFrame(() => requestAnimationFrame(() => done(true)))))`;

/**
 * Waits for `settled` on `page`, after evaluating the expression `before` in the same call, and resolves to the
 * expression `after` evaluated once settled; throws a `WaitTimeoutError` naming the page after `DRAW_TIMEOUT_MS`.
 */
export const awaitSettled = (
  page: Pick<Page, 'evaluate' | 'url'>,
  { before, after }: { before?: string; after?: string } = {},
) =>
  withinLimit(page.evaluate(`(${before ?? 'undefined'}, ${settled})${after ? `.then(() => ${after})` : ''}`), {
    ms: DRAW_TIMEOUT_MS,
    what: `the fonts and the first frames of ${page.url()}`,
  });

/** Loads every font face `page` declares and waits for its fonts, and throws a `WaitTimeoutError` naming the page after `DRAW_TIMEOUT_MS`. */
export const awaitFonts = (page: Pick<Page, 'evaluate' | 'url'>) =>
  withinLimit(page.evaluate(`${loadedFonts}.then(() => true)`), {
    ms: DRAW_TIMEOUT_MS,
    what: `the fonts of ${page.url()}`,
  });

/** Finishes the page's finite time-based animations; scroll-driven ones keep the progress their scroll position gives. */
export const finished = `document.getAnimations()
  .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
  .filter((animation) => typeof ScrollTimeline === 'undefined' || !(animation.timeline instanceof ScrollTimeline))
  .forEach((animation) => animation.finish())`;

/**
 * Cancels each running infinite animation, as a screenshot with disabled animations does in the app picture, so both
 * pictures show its start frame; a paused one or one with a playback rate of 0 keeps its held frame.
 */
export const heldAnimations = `document.getAnimations()
  .filter((animation) => animation.effect?.getComputedTiming().endTime === Infinity)
  .filter((animation) => animation.playState === 'running' && animation.playbackRate !== 0)
  .filter((animation) => typeof ScrollTimeline === 'undefined' || !(animation.timeline instanceof ScrollTimeline))
  .forEach((animation) => animation.cancel())`;

export type DrawPriority = 'high' | 'low' | 'idle';

/**
 * What one ask wants of a drawing. `view` is a number the asker raises with each view change; the
 * highest one seen is the shown view. `rank` places the ask in that view. `board` places it by the queue's shot
 * board instead, where the board names its shot. `onWithdraw` gets the callback
 * that withdraws the ask, to call once the asker no longer waits, or at once if it already stopped.
 */
export type DrawWant = {
  priority: DrawPriority;
  view?: number | null;
  rank?: 'active' | 'visible' | null;
  board?: { key: string; boardView: number };
  onWithdraw?: (withdraw: () => void) => void;
  onStart?: (start: { lane: number; waitedMs: number; busyLanes: number[] }) => void;
};

type WaitingDraw = {
  job: (stop: AbortSignal | null) => Promise<void>;
  wants: Set<DrawWant>;
  drop: () => void;
  asked: number;
};

// Partial raster redraws only the invalidated part of a tile, so the anti-aliased edge of a rounded clip over an
// embedded frame depends on which frame painted first: two draws of the same page differed under load.
export const DRAW_BROWSER_ARGS = ['--disable-partial-raster'];
// Headless Chromium paces requestAnimationFrame at 60 Hz, so each settle of an inspected frame waited for frames
// while the renderer idled. The flag breaks a view-transition screenshot, so only the inspect browser takes it.
export const INSPECT_BROWSER_ARGS = [...DRAW_BROWSER_ARGS, '--disable-frame-rate-limit'];
export const DRAWS_AT_ONCE = 8;
export const IDLE_DRAWS_AT_ONCE = DRAWS_AT_ONCE / 4;
const IDLE_LANE = 5;

/**
 * One shared headless Chromium, launched on the first ask, that runs up to `DRAWS_AT_ONCE` drawings at once.
 * A waiting `high` drawing runs first; of the `low` ones, those for the active frame of the shown view,
 * then its visible cells, then the rest, then those of views no longer shown, then the `idle` ones, each lane in the
 * order asked. `idle` drawings take at most `IDLE_DRAWS_AT_ONCE` places and none start while a shown shot draws, so a
 * shot the viewer waits for starts at once and shares the CPU with few of them. A shown shot that starts stops the
 * running `idle` drawings; each waits in its lane again and draws anew.
 * A drawing every ask withdrew before it started is dropped. A failed launch is not kept, so the next ask
 * tries again.
 */
const CLOSING_ON_ABORT = Symbol('closingOnAbort');

/** The browser and the abort signal behind a `closingOnAbort` browser; a plain browser has no signal. */
export const abortingOf = (browser: Browser): { browser: Browser; signal: AbortSignal | null } =>
  (Reflect.get(browser, CLOSING_ON_ABORT) as { browser: Browser; signal: AbortSignal } | undefined) ?? {
    browser,
    signal: null,
  };

/** `browser` with every context it opens closed when `signal` aborts, so a draw of an aborted run fails at once. */
export const closingOnAbort = (browser: Browser, signal: AbortSignal): Browser =>
  new Proxy(browser, {
    get: (target, key) => {
      if (key === CLOSING_ON_ABORT) return { browser: target, signal };

      const value = Reflect.get(target, key, target) as unknown;

      if (key !== 'newContext' || typeof value !== 'function') {
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return async (...args: Parameters<Browser['newContext']>) => {
        if (signal.aborted) throw new RunAbortedError();

        const context = await target.newContext(...args);
        const close = () => void context.close().catch(() => undefined);

        if (signal.aborted) close();
        else {
          const aborting = fromEvent(signal, 'abort').pipe(take(1), tap(close)).subscribe();

          context.once('close', () => aborting.unsubscribe());
        }

        return context;
      };
    },
  });

export const createDrawQueue = (options: {
  target: string;
  chromiumOf?: typeof chromiumOf;
  ledger?: DrawLedger;
  board?: Pick<ShotBoard, 'laneOf'>;
  args?: string[];
}) => {
  const { target, ledger, args = DRAW_BROWSER_ARGS } = options;
  const resolveChromium = options.chromiumOf ?? chromiumOf;
  let browser: Promise<Browser> | null = null;
  let closed = false;
  const waiting: WaitingDraw[] = [];
  const entries = new WeakMap<Promise<unknown>, WaitingDraw>();
  const drawingLanes: number[] = [];
  const runningIdle = new Set<AbortController>();
  let shownView = 0;

  const launch = () => {
    if (closed) return Promise.reject(new ThumbUnavailableError('design-explore: the draw queue closed'));

    browser ??= resolveChromium(target).then((resolved) => {
      if (!resolved) {
        throw new ThumbUnavailableError(
          'design-explore: no playwright or playwright-core resolves, so the server can not draw thumbnails',
        );
      }

      return timedPhase('browser-start', () => resolved.chromium.launch({ args })).catch((error: unknown) => {
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

    const shown = want.board && options.board?.laneOf(want.board);

    if (shown) return shown;
    if (typeof want.view === 'number' && want.view < shownView) return 4;
    if (want.priority === 'idle') return IDLE_LANE;

    return want.rank === 'active' ? 1 : want.rank === 'visible' ? 2 : 3;
  };

  const entryLaneOf = (entry: WaitingDraw) => Math.min(...[...entry.wants].map(laneOf));

  const next = () => {
    while (drawingLanes.length < DRAWS_AT_ONCE && waiting.length > 0) {
      const idleFull =
        drawingLanes.some((lane) => lane <= 2) ||
        drawingLanes.filter((lane) => lane === IDLE_LANE).length >= IDLE_DRAWS_AT_ONCE;
      const lanes = waiting.map(entryLaneOf).map((lane) => (idleFull && lane === IDLE_LANE ? Infinity : lane));
      const lane = Math.min(...lanes);

      if (lane === Infinity) return;

      const at = lanes.indexOf(lane);
      const [entry] = waiting.splice(at, 1);

      if (!entry) return;

      const start = { lane, waitedMs: performance.now() - entry.asked, busyLanes: [...drawingLanes] };

      const stop = lane === IDLE_LANE ? new AbortController() : null;

      if (lane <= 2) runningIdle.forEach((running) => running.abort());
      if (stop) runningIdle.add(stop);

      drawingLanes.push(lane);
      entry.wants.forEach((want) => want.onStart?.(start));
      void entry.job(stop?.signal ?? null).finally(() => {
        if (stop) runningIdle.delete(stop);
        drawingLanes.splice(drawingLanes.indexOf(lane), 1);
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
    run: <T>(draw: (browser: Browser) => Promise<T>, want: DrawPriority | DrawWant | DrawWant[] = 'high') => {
      const ticket = ledger?.ask();
      const asked = performance.now();
      const signal = runSignal();
      const entry: WaitingDraw = {
        job: async () => undefined,
        wants: new Set(),
        drop: () => undefined,
        asked,
      };
      const drawn = new Promise<T>((resolve, reject) => {
        let started = false;

        entry.job = (stop) => {
          if (!started) {
            ticket?.start();
            recordDrawWait(performance.now() - asked);
          }
          started = true;

          if (signal?.aborted) {
            ticket?.end();
            reject(new RunAbortedError());

            return Promise.resolve();
          }

          const aborts = [signal, stop].filter((each): each is AbortSignal => each !== null);
          const drawSignal = aborts.length > 1 ? AbortSignal.any(aborts) : aborts[0];

          return launch()
            .then((open) => draw(drawSignal ? closingOnAbort(open, drawSignal) : open))
            .then(resolve, (error: unknown) => {
              if (stop?.aborted && !signal?.aborted && !closed && entry.wants.size > 0) {
                waiting.unshift(entry);

                return;
              }

              reject(error);
            })
            .then(() => {
              if (!waiting.includes(entry)) ticket?.end();
            });
        };
        entry.drop = () => {
          ticket?.end();
          reject(new DrawDroppedError('design-explore: every ask withdrew the drawing before it started'));
        };
      });

      drawn.catch(() => undefined);
      entries.set(drawn, entry);
      waiting.push(entry);

      const wants = typeof want === 'string' ? [{ priority: want }] : Array.isArray(want) ? want : [want];

      // Every want joins before any withdraws, so one already withdrawn does not drop the drawing the others wait for.
      for (const each of wants) {
        see(each);
        entry.wants.add(each);
      }
      for (const each of wants) each.onWithdraw?.(() => withdraw(entry, each));
      next();

      return drawn;
    },
    /** Adds an ask to a drawing `run` returned, so it runs in the best lane any of its asks wants, unless it already started. */
    join,
    /** Moves a drawing `run` returned into the high lane, unless it already started. */
    hurry: (drawn: Promise<unknown>) => join(drawn, { priority: 'high' }),
    close: async () => {
      const running = browser;

      closed = true;
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

export const SHOT_MAX_AGE_S = 3600;

/**
 * Answers with the PNG `shot` resolves to, tagged with its content hash and its note in `x-et-note`; an ask whose
 * `if-none-match` names that tag gets a 304. The asker keys the URL on the content it shows (Studio: session, epoch
 * and revision), so the browser may keep a picture for `SHOT_MAX_AGE_S` and paint it again without asking.
 */
export const sendShot = (response: ServerResponse, shot: Promise<Buffer | { png: Buffer; note?: string }>) =>
  void shot.then(
    (answer) => {
      const body = Buffer.isBuffer(answer) ? answer : answer.png;
      const note = Buffer.isBuffer(answer) ? undefined : answer.note;

      if (note) response.setHeader('x-et-note', note);

      const tag = `"${createHash('sha1').update(body).digest('base64url')}"`;

      response.setHeader('etag', tag);
      response.setHeader('cache-control', `private, max-age=${SHOT_MAX_AGE_S}`);

      if (response.req?.headers['if-none-match'] === tag) {
        response.statusCode = 304;
        response.end();
      } else send(response, { status: 200, type: 'image/png', body });
    },
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
      await awaitSettled(page);

      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });

      return Buffer.from(data, 'base64');
    } finally {
      await context.close();
    }
  };

  const shotOf = (slug: string, search: string) => {
    const cached = cache.get(search);

    recordCache(cached !== undefined);

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
