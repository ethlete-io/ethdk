import { Browser } from '../thumb';
import { playwrightTimeoutOf } from '../wait';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

export const OVERLAY_ROOTS = '.et-overlay-runtime-root, .cdk-overlay-container';

export const EMIT_WAIT_MS = 400;

const SETTLED_FRAMES = 2;

const QUIET_FRAMES = 2;

/** An init script that records each key whose keydown default the page prevented in `window.__etPrevented`. */
export const INIT_SCRIPT = `window.__etPrevented = [];
window.addEventListener('keydown', (event) => { if (event.defaultPrevented) window.__etPrevented.push(event.key); });`;

/** A page-side predicate: a finite, time-based animation that is still running. A scroll-driven one never ends. */
export const UNSETTLED_ANIMATION = `((animation) => animation.playState === 'running' &&
  animation.effect?.getTiming().iterations !== Infinity &&
  !(typeof ScrollTimeline !== 'undefined' && animation.timeline instanceof ScrollTimeline))`;

export const SETTLE_TIMEOUT_MS = 3_000;

export class SettleTimeoutError extends Error {}

/**
 * Waits until no finite, time-based animation runs for a few frames. Throws a `SettleTimeoutError` when they still run
 * after `timeout`, capped at `SETTLE_TIMEOUT_MS`.
 */
export const settle = async (page: Page, timeout: number) => {
  const cap = Math.min(timeout, SETTLE_TIMEOUT_MS);

  await page
    .waitForFunction(
      `(() => {
        const settled = !document.getAnimations().some(${UNSETTLED_ANIMATION});
        window.__etActionFrames = settled ? (window.__etActionFrames ?? 0) + 1 : 0;
        return window.__etActionFrames >= ${SETTLED_FRAMES};
      })()`,
      undefined,
      { timeout: playwrightTimeoutOf(cap), polling: 'raf' },
    )
    .catch((error: unknown) => {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new SettleTimeoutError(`the page did not settle its animations within ${cap} ms`);
      }
    });
};

/** Starts recording DOM changes on the page, for `awaitOutput`. Call it right before the press. */
export const watchMutations = (page: Page) =>
  page.evaluate(`(() => {
    window.__etMutated = true;
    window.__etQuietFrames = 0;
    window.__etMutations?.disconnect();
    window.__etMutations = new MutationObserver(() => (window.__etMutated = true));
    window.__etMutations.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  })()`);

/**
 * Waits until `output` fired, or the DOM did not change for a few frames since `watchMutations`, or `EMIT_WAIT_MS`
 * passes.
 */
export const awaitOutput = async (page: Page, output: string | null) => {
  const expected = JSON.stringify(output);

  await page
    .waitForFunction(
      `(() => {
        const fired = [...(window.__etDesignEmits ?? []).map((emit) => emit.output), ...(window.__etEmbeddedEmits ?? [])];

        if (${expected} !== null && fired.includes(${expected})) return true;

        window.__etQuietFrames = window.__etMutated ? 0 : (window.__etQuietFrames ?? 0) + 1;
        window.__etMutated = false;

        return window.__etQuietFrames >= ${QUIET_FRAMES};
      })()`,
      undefined,
      { timeout: EMIT_WAIT_MS, polling: 'raf' },
    )
    .catch(() => undefined);
  await page.evaluate('window.__etMutations?.disconnect()');
};

/**
 * Blurs the element that shows a keyboard focus ring, so a picture after a key press compares against a goal state
 * the design draws unfocused.
 */
export const dropKeyboardFocus = (page: Page) =>
  page.evaluate(`(() => {
    const focused = document.activeElement;

    if (focused instanceof HTMLElement && focused.matches(':focus-visible')) focused.blur();
  })()`);
