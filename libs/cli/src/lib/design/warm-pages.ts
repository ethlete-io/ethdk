import { Browser } from './thumb';

type ContextOptions = NonNullable<Parameters<Browser['newContext']>[0]>;
type Context = Awaited<ReturnType<Browser['newContext']>>;
type Page = Awaited<ReturnType<Context['newPage']>>;
type Warm = { key: string; context: Context; page: Page };
type Idle = { warm: Warm; parked: Promise<boolean> };
type Lent = { browser: Browser; context: ContextOptions };

const IDLE_LIMIT = 8;

const BLANK = 'about:blank';

/**
 * Lends a page of its own browser context per set of context options and keeps it open between draws, parked on a
 * blank page with its storage and cookies cleared. A page whose draw throws is closed, never lent again. The pages
 * close with their browser.
 */
export const createWarmPages = (options: { idleLimit?: number } = {}) => {
  const idleLimit = options.idleLimit ?? IDLE_LIMIT;
  const idleByBrowser = new WeakMap<Browser, Idle[]>();

  const idleOf = (browser: Browser) => {
    const kept = idleByBrowser.get(browser) ?? [];

    idleByBrowser.set(browser, kept);

    return kept;
  };

  const drop = (warm: Warm) => void warm.context.close().catch(() => undefined);

  const open = async ({ browser, context: contextOptions }: Lent, key: string): Promise<Warm> => {
    const context = await browser.newContext(contextOptions);

    try {
      return { key, context, page: await context.newPage() };
    } catch (error) {
      await context.close().catch(() => undefined);
      throw error;
    }
  };

  const park = (warm: Warm) =>
    warm.page
      .evaluate('localStorage.clear(); sessionStorage.clear()')
      .catch(() => undefined)
      .then(() => warm.context.clearCookies())
      .then(() => warm.page.goto(BLANK))
      .then(
        () => true,
        () => {
          drop(warm);

          return false;
        },
      );

  const borrow = async (lent: Lent, key: string): Promise<Warm> => {
    const kept = idleOf(lent.browser);
    const at = kept.findIndex((idle) => idle.warm.key === key);
    const [idle] = at >= 0 ? kept.splice(at, 1) : [];

    if (!idle) return open(lent, key);

    return (await idle.parked) ? idle.warm : borrow(lent, key);
  };

  return {
    /** Runs `draw` on an idle page of `browser` opened with the same `context` options, or on a new one. */
    run: async <T>(lent: Lent, draw: (page: Page) => Promise<T>) => {
      const key = JSON.stringify(lent.context);
      const warm = await borrow(lent, key);

      try {
        const drawn = await draw(warm.page);
        const kept = idleOf(lent.browser);

        kept.push({ warm, parked: park(warm) });
        kept.splice(0, Math.max(0, kept.length - idleLimit)).forEach((idle) => drop(idle.warm));

        return drawn;
      } catch (error) {
        drop(warm);
        throw error;
      }
    },
  };
};
