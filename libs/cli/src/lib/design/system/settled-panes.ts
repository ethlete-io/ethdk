import { Browser } from '../thumb';
import { playwrightTimeoutOf } from '../wait';
import { UNSETTLED_ANIMATION } from './action-press';
import { OVERLAY_PANES } from './part-compare';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

const PANE_TRANSITIONS = ['enter-from', 'enter-active', 'enter-to', 'leave-from', 'leave-active', 'leave-to']
  .map((phase) => `.et-animation-${phase}`)
  .join(', ');

const SETTLED_FRAMES = 2;

const PANE_COUNT_TIMEOUT_MS = 3000;

/**
 * Waits for at least `count` overlay panes, then until no pane is in an enter or leave phase and no finite animation
 * runs for a few frames. Resolves `false` when that does not happen within `timeout`.
 */
export const settledPanesOf = async (options: { page: Page; count: number; timeout: number }) => {
  const { page, count } = options;
  const timeout = playwrightTimeoutOf(options.timeout);

  if (count > 0)
    await page
      .waitForFunction(`document.querySelectorAll(${JSON.stringify(OVERLAY_PANES)}).length >= ${count}`, undefined, {
        timeout: Math.min(timeout, PANE_COUNT_TIMEOUT_MS),
        polling: 'raf',
      })
      .catch(() => undefined);

  return page
    .waitForFunction(
      `(() => {
        const panes = [...document.querySelectorAll(${JSON.stringify(OVERLAY_PANES)})];
        const settled =
          panes.every((pane) => !pane.matches(${JSON.stringify(PANE_TRANSITIONS)}) && !pane.querySelector(${JSON.stringify(PANE_TRANSITIONS)})) &&
          !document.getAnimations().some(${UNSETTLED_ANIMATION});

        window.__etSettledFrames = settled ? (window.__etSettledFrames ?? 0) + 1 : 0;

        return window.__etSettledFrames >= ${SETTLED_FRAMES};
      })()`,
      undefined,
      { timeout, polling: 'raf' },
    )
    .then(() => true)
    .catch(() => false);
};
