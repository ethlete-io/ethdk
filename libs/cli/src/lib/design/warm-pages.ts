import { Browser } from './thumb';
import { withinLimit } from './wait';

type ContextOptions = NonNullable<Parameters<Browser['newContext']>[0]>;
type Context = Awaited<ReturnType<Browser['newContext']>>;
type Page = Awaited<ReturnType<Context['newPage']>>;
type Warm = { key: string; context: Context; page: Page; booted: string | null };
type Idle = { warm: Warm; parked: Promise<boolean> };
type Lent = { browser: Browser; context: ContextOptions };

const IDLE_LIMIT = 8;

const BLANK = 'about:blank';

/**
 * Lends a page of its own browser context per set of context options and keeps it open between draws, with its storage
 * and cookies cleared, parked on a blank page or, after a draw with a `boot`, left on that drawing. A page whose draw
 * throws is closed, never lent again. The pages close with their browser.
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
      return { key, context, page: await context.newPage(), booted: null };
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
      .then(() => (warm.booted === null ? warm.page.goto(BLANK) : undefined))
      .then(
        () => true,
        () => {
          drop(warm);

          return false;
        },
      );

  const borrow = async (lent: Lent, { key, boot }: { key: string; boot: string | null }): Promise<Warm> => {
    const kept = idleOf(lent.browser);
    const booted = boot === null ? -1 : kept.findIndex((idle) => idle.warm.key === key && idle.warm.booted === boot);
    const at = booted >= 0 ? booted : kept.findIndex((idle) => idle.warm.key === key);
    const [idle] = at >= 0 ? kept.splice(at, 1) : [];

    if (!idle) return open(lent, key);

    return (await idle.parked) ? idle.warm : borrow(lent, { key, boot });
  };

  return {
    /**
     * Runs `draw` on an idle page of `browser` opened with the same `context` options, or on a new one. With `limit`,
     * a draw still running after `limit.ms` rejects with a `WaitTimeoutError` and its page closes. With `boot`, an idle
     * page left on a drawing with the same `boot` goes first, and `draw` gets `booted: true` for it.
     */
    run: async <T>(
      lent: Lent & { limit?: { ms: number; what: string }; boot?: string },
      draw: (page: Page, booted: boolean) => Promise<T>,
    ) => {
      const key = JSON.stringify(lent.context);
      const boot = lent.boot ?? null;
      const warm = await borrow(lent, { key, boot });
      const booted = boot !== null && warm.booted === boot;

      warm.booted = null;

      try {
        const drawing = draw(warm.page, booted);
        const drawn = await (lent.limit ? withinLimit(drawing, lent.limit) : drawing);
        const kept = idleOf(lent.browser);

        warm.booted = boot;

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
