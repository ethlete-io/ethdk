import { IncomingMessage, ServerResponse } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAWS_AT_ONCE, ShotTimeoutError, createDrawQueue, createThumbnailer, finished, openFrame } from './thumb';

const sent: Record<string, unknown>[] = [];
const goto = vi.fn<(url: string, options?: unknown) => Promise<void>>(async () => undefined);
const evaluate = vi.fn(async (script: string): Promise<unknown> => (script.includes('frameWidth') ? 1740 : true));
const send = vi.fn(async (method: string, params?: Record<string, unknown>) => {
  sent.push({ method, ...params });

  return method === 'Page.captureScreenshot' ? { data: Buffer.from('png').toString('base64') } : {};
});
const closeContext = vi.fn(async () => undefined);
const closeBrowser = vi.fn(async () => undefined);
const newContext = vi.fn(async () => ({
  newPage: async () => ({
    goto,
    mouse: { move: async () => undefined },
    evaluate,
    locator: () => ({ first: () => ({ waitFor: async () => undefined }) }),
  }),
  newCDPSession: async () => ({ send }),
  close: closeContext,
}));
const launch = vi.fn(async () => ({ newContext, close: closeBrowser }));
const chromium = { launch } as never;
const withBrowser = vi.fn(async () => ({ chromium, from: '/co/node_modules/playwright/index.js' }));

const ask = (middleware: (request: IncomingMessage, response: ServerResponse) => void, url: string) =>
  new Promise<{ status: number; type: string; body: unknown }>((done) => {
    const headers: Record<string, string> = {};
    const response = {
      statusCode: 200,
      setHeader: (name: string, value: string) => (headers[name] = value),
      end: (body: unknown) => done({ status: response.statusCode, type: headers['content-type'] ?? '', body }),
    };

    middleware({ url } as IncomingMessage, response as unknown as ServerResponse);
  });

const thumbnailer = (chromiumOf: Parameters<typeof createThumbnailer>[0]['chromiumOf'] = withBrowser) =>
  createThumbnailer({ target: '/co', base: 'http://localhost:4999', chromiumOf });

describe('createThumbnailer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sent.length = 0;
  });

  it('draws the variant at the call width into a PNG twice the tile wide', async () => {
    const { middleware } = thumbnailer();

    const answer = await ask(middleware, '/?call=app%2Fone&variant=a&surface=dark&epoch=2');

    expect(answer).toMatchObject({ status: 200, type: 'image/png' });
    expect(String(answer.body)).toBe('png');
    expect(goto).toHaveBeenCalledWith(
      'http://localhost:4999/frame.html?call=app%2Fone&variant=a&surface=dark&epoch=2',
      expect.anything(),
    );
    expect(sent[0]).toEqual({
      method: 'Emulation.setDeviceMetricsOverride',
      width: 1740,
      height: 979,
      deviceScaleFactor: 360 / 1740,
      mobile: false,
    });
    expect(closeContext).toHaveBeenCalledOnce();
  });

  it('keeps one picture per query, and draws again once the call changed', async () => {
    const { middleware, forget } = thumbnailer();

    await ask(middleware, '/?call=app/one&variant=a');
    await ask(middleware, '/?call=app/one&variant=a');
    expect(goto).toHaveBeenCalledOnce();

    await ask(middleware, '/?call=app/one&variant=a&color=brand');
    expect(goto).toHaveBeenCalledTimes(2);

    forget('app/two/call.ts');
    await ask(middleware, '/?call=app/one&variant=a');
    expect(goto).toHaveBeenCalledTimes(2);

    forget('app/one/variants/a.ts');
    await ask(middleware, '/?call=app/one&variant=a');
    await ask(middleware, '/?call=app/one&variant=a&color=brand');
    expect(goto).toHaveBeenCalledTimes(4);

    forget('app/providers.ts');
    await ask(middleware, '/?call=app/one&variant=a');
    expect(goto).toHaveBeenCalledTimes(5);
    expect(launch).toHaveBeenCalledOnce();
  });

  it('draws at most DRAWS_AT_ONCE variants at once', async () => {
    let drawing = 0;
    let most = 0;
    goto.mockImplementation(async () => {
      most = Math.max(most, ++drawing);
      await new Promise((done) => setTimeout(done, 5));
      drawing--;
    });
    const { middleware } = thumbnailer();

    await Promise.all(
      Array.from({ length: DRAWS_AT_ONCE + 2 }, (_, key) => ask(middleware, `/?call=app/one&variant=v${key}`)),
    );

    expect(most).toBe(DRAWS_AT_ONCE);
    goto.mockImplementation(async () => undefined);
  });

  it('answers 503 when no playwright resolves', async () => {
    const { middleware } = thumbnailer(vi.fn(async () => null));

    const answer = await ask(middleware, '/?call=app/one&variant=a');

    expect(answer.status).toBe(503);
    expect(String(answer.body)).toContain('no playwright');
  });

  it('answers 404 for a call the registry does not hold', async () => {
    evaluate.mockResolvedValueOnce(null);
    const { middleware } = thumbnailer();

    expect((await ask(middleware, '/?call=app/gone&variant=a')).status).toBe(404);
  });

  it('answers 400 without a call or a variant', async () => {
    const { middleware } = thumbnailer();

    expect((await ask(middleware, '/?call=app/one')).status).toBe(400);
    expect(withBrowser).not.toHaveBeenCalled();
  });

  it.each([
    ['its content never attaches', '#root > :not(style)'],
    ['an embedded frame never draws', 'iframe[data-et-embed]'],
  ])('answers 504 naming the frame when %s', async (_, never) => {
    newContext.mockImplementationOnce(
      async () =>
        ({
          newPage: async () => ({
            goto,
            mouse: { move: async () => undefined },
            evaluate,
            locator: (selector: string) => ({
              count: async () => 0,
              first: () => ({
                waitFor: async () => {
                  if (selector.startsWith(never)) throw new Error('Timeout');
                },
              }),
            }),
          }),
          newCDPSession: async () => ({ send }),
          close: closeContext,
        }) as never,
    );
    const { middleware } = thumbnailer();

    const answer = await ask(middleware, '/?call=app%2Fone&variant=a');

    expect(answer.status).toBe(504);
    expect(String(answer.body)).toContain('http://localhost:4999/frame.html?call=app%2Fone&variant=a');
  });

  it('does not keep a failed drawing', async () => {
    goto.mockRejectedValueOnce(new Error('net::ERR_CONNECTION_REFUSED'));
    const { middleware } = thumbnailer();

    expect((await ask(middleware, '/?call=app/one&variant=a')).status).toBe(500);
    expect((await ask(middleware, '/?call=app/one&variant=a')).status).toBe(200);
  });

  it('closes the browser it launched', async () => {
    const { middleware, close } = thumbnailer();

    await close();
    expect(closeBrowser).not.toHaveBeenCalled();

    await ask(middleware, '/?call=app/one&variant=a');
    await close();
    expect(closeBrowser).toHaveBeenCalledOnce();
  });
});

describe('createDrawQueue', () => {
  it('draws DRAWS_AT_ONCE jobs at once and holds the next until one of them ends', async () => {
    const queue = createDrawQueue({ target: '/co', chromiumOf: withBrowser });
    const started: number[] = [];
    const releases: (() => void)[] = [];
    const ats = Array.from({ length: DRAWS_AT_ONCE + 1 }, (_, at) => at);
    const drawn = ats.map((at) =>
      queue.run(async () => {
        started.push(at);
        await new Promise<void>((done) => releases.push(done));
      }),
    );

    await vi.waitFor(() => expect(started).toEqual(ats.slice(0, DRAWS_AT_ONCE)));
    await new Promise((done) => setTimeout(done, 5));
    expect(started).toEqual(ats.slice(0, DRAWS_AT_ONCE));

    releases[0]?.();
    await vi.waitFor(() => expect(started).toEqual(ats));
    releases.slice(1).forEach((release) => release());
    await Promise.all(drawn);
  });

  it('starts a waiting high job before the low jobs queued ahead of it, and each lane in order', async () => {
    const queue = createDrawQueue({ target: '/co', chromiumOf: withBrowser });
    const order: string[] = [];
    let release = () => undefined as void;
    const held = new Promise<void>((done) => (release = done));
    const job = (name: string) => async () => void order.push(name);
    const busy = (name: string) => async () => {
      order.push(name);
      await held;
    };

    const busyNames = Array.from({ length: DRAWS_AT_ONCE }, (_, at) => `busy ${at + 1}`);
    const drawn = [
      ...busyNames.map((name) => queue.run(busy(name), 'low')),
      ...['low 1', 'low 2', 'low 3'].map((name) => queue.run(job(name), 'low')),
      queue.run(job('high 1'), 'high'),
      queue.run(job('high 2')),
    ];

    await vi.waitFor(() => expect(order).toHaveLength(DRAWS_AT_ONCE));
    release();
    await Promise.all(drawn);

    expect(order).toEqual([...busyNames, 'high 1', 'high 2', 'low 1', 'low 2', 'low 3']);
  });

  it('launches Chromium without partial raster, so the same page draws the same pixels each time', async () => {
    const queue = createDrawQueue({ target: '/co', chromiumOf: withBrowser });

    await queue.run(async () => 'drawn');

    expect(launch).toHaveBeenCalledWith({ args: expect.arrayContaining(['--disable-partial-raster']) });
  });

  it('keeps drawing after a failed job', async () => {
    const queue = createDrawQueue({ target: '/co', chromiumOf: withBrowser });
    const failed = queue.run(async () => Promise.reject(new Error('broken')), 'low');
    const next = queue.run(async () => 'drawn', 'low');

    await expect(failed).rejects.toThrow('broken');
    await expect(next).resolves.toBe('drawn');
  });
});

describe('openFrame', () => {
  const pageOf = (draws: boolean[]) => {
    const visits: string[] = [];
    const page = {
      goto: async (url: string) => void visits.push(url),
      mouse: { move: async () => undefined },
      locator: (selector: string) => ({
        count: async () => 0,
        first: () => ({
          waitFor: async () => {
            if (selector.startsWith('#root') && !draws.shift()) throw new Error('timeout');
          },
        }),
      }),
    };

    return { page: page as unknown as Parameters<typeof openFrame>[0], visits };
  };

  it('reloads a frame once when it misses the first wait', async () => {
    const { page, visits } = pageOf([false, true]);

    await openFrame(page, '/frame.html?a');

    expect(visits).toEqual(['/frame.html?a', '/frame.html?a']);
  });

  it('fails a frame that draws nothing after the reload', async () => {
    const { page, visits } = pageOf([false, false]);

    await expect(openFrame(page, '/frame.html?b')).rejects.toBeInstanceOf(ShotTimeoutError);
    expect(visits).toHaveLength(2);
  });
});

describe('finished', () => {
  it('finishes finite time-based animations and leaves scroll-driven ones as the scroll position draws them', () => {
    class ScrollTimeline {}
    const animation = (endTime: number, timeline: unknown) => ({
      timeline,
      effect: { getComputedTiming: () => ({ endTime }) },
      finish: vi.fn(),
    });
    const fade = animation(300, {});
    const loop = animation(Infinity, {});
    const scrollFade = animation(100, new ScrollTimeline());
    const document = { getAnimations: () => [fade, loop, scrollFade] };

    new Function('document', 'ScrollTimeline', finished)(document, ScrollTimeline);

    expect(fade.finish).toHaveBeenCalled();
    expect(loop.finish).not.toHaveBeenCalled();
    expect(scrollFade.finish).not.toHaveBeenCalled();
  });
});
