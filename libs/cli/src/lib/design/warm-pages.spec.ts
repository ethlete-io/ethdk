import { describe, expect, it, vi } from 'vitest';
import type { Browser } from './thumb';
import { createWarmPages } from './warm-pages';

const fakeBrowser = () => {
  const contexts: { options: unknown; close: ReturnType<typeof vi.fn>; pages: { goto: ReturnType<typeof vi.fn> }[] }[] =
    [];
  const evaluate = vi.fn(async () => undefined);
  const clearCookies = vi.fn(async () => undefined);
  const newContext = vi.fn(async (options: unknown) => {
    const context = {
      options,
      pages: [] as { goto: ReturnType<typeof vi.fn> }[],
      close: vi.fn(async () => undefined),
      clearCookies,
      newPage: async () => {
        const page = { goto: vi.fn(async () => undefined), evaluate };

        context.pages.push(page);

        return page;
      },
    };

    contexts.push(context);

    return context;
  });

  return { browser: { newContext } as unknown as Browser, contexts, evaluate, clearCookies };
};

const parked = (page: { goto: ReturnType<typeof vi.fn> } | undefined, times = 1) =>
  vi.waitFor(() => expect(page?.goto.mock.calls.filter(([url]) => url === 'about:blank')).toHaveLength(times));

const phone = { viewport: { width: 390, height: 844 } };

describe('createWarmPages', () => {
  it('draws twice on one page, parked on a blank page with its storage and cookies cleared in between', async () => {
    const { browser, contexts, evaluate, clearCookies } = fakeBrowser();
    const warm = createWarmPages();
    const pages: unknown[] = [];

    await warm.run({ browser, context: phone }, async (page) => pages.push(page));
    await warm.run({ browser, context: phone }, async (page) => pages.push(page));

    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.options).toEqual(phone);
    expect(pages[0]).toBe(pages[1]);
    expect(evaluate).toHaveBeenCalledWith('localStorage.clear(); sessionStorage.clear()');
    expect(clearCookies).toHaveBeenCalledTimes(1);
    await parked(contexts[0]?.pages[0], 2);
  });

  it('closes the page of a failed draw and draws the next one on a new page', async () => {
    const { browser, contexts } = fakeBrowser();
    const warm = createWarmPages();

    await expect(
      warm.run({ browser, context: phone }, async () => {
        throw new Error('timed out');
      }),
    ).rejects.toThrow('timed out');
    await warm.run({ browser, context: phone }, async () => undefined);

    expect(contexts).toHaveLength(2);
    expect(contexts[0]?.close).toHaveBeenCalled();
    expect(contexts[0]?.pages[0]?.goto).not.toHaveBeenCalled();
  });

  it('opens a page of its own per viewport and scale', async () => {
    const { browser, contexts } = fakeBrowser();
    const warm = createWarmPages();

    await warm.run({ browser, context: phone }, async () => undefined);
    await parked(contexts[0]?.pages[0]);
    await warm.run({ browser, context: { ...phone, deviceScaleFactor: 2 } }, async () => undefined);
    await warm.run({ browser, context: { viewport: { width: 1440, height: 900 } } }, async () => undefined);

    expect(contexts.map(({ options }) => options)).toEqual([
      phone,
      { ...phone, deviceScaleFactor: 2 },
      { viewport: { width: 1440, height: 900 } },
    ]);
  });

  it('closes the oldest idle page past the idle limit, and keeps no page of another browser', async () => {
    const first = fakeBrowser();
    const second = fakeBrowser();
    const warm = createWarmPages({ idleLimit: 1 });

    await warm.run({ browser: first.browser, context: phone }, async () => undefined);
    await parked(first.contexts[0]?.pages[0]);
    await warm.run(
      { browser: first.browser, context: { viewport: { width: 480, height: 800 } } },
      async () => undefined,
    );
    await parked(first.contexts[1]?.pages[0]);
    await warm.run(
      { browser: second.browser, context: { viewport: { width: 480, height: 800 } } },
      async () => undefined,
    );

    expect(first.contexts[0]?.close).toHaveBeenCalled();
    expect(first.contexts[1]?.close).not.toHaveBeenCalled();
    expect(second.contexts).toHaveLength(1);
  });
});
