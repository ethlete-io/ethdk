import { Browser } from '../thumb';
import { playwrightTimeoutOf } from '../wait';
import { UNSETTLED_ANIMATION } from './action-press';
import { OVERLAY_PANES } from './part-compare';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

const UNSETTLED_PANE = [
  ...['enter-from', 'enter-active', 'enter-to', 'leave-from', 'leave-active', 'leave-to'].map(
    (phase) => `.et-animation-${phase}`,
  ),
  '.et-force-invisible',
].join(', ');

const SETTLED_FRAMES = 3;

/** How long `settledPanesOf` waits for the overlay panes a design draws to open in the app. */
export const PANE_COUNT_TIMEOUT_MS = 1_000;

/**
 * A page script that counts the frames in a row in which every overlay pane has left its init, enter and leave
 * phases, no finite animation runs, and no box in a pane moved or resized; it returns whether that count reached
 * `SETTLED_FRAMES`. Run it once per frame.
 */
export const settledPanesScript = `(() => {
  const panes = [...document.querySelectorAll(${JSON.stringify(OVERLAY_PANES)})];
  const quiet =
    panes.every((pane) => !pane.matches(${JSON.stringify(UNSETTLED_PANE)}) && !pane.querySelector(${JSON.stringify(UNSETTLED_PANE)})) &&
    !document.getAnimations().some(${UNSETTLED_ANIMATION});
  const geometry = panes
    .map((pane) =>
      [pane, ...pane.querySelectorAll('*')]
        .map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();

          return x + ',' + y + ',' + width + ',' + height;
        })
        .join(' '),
    )
    .join('|');
  const still = quiet && geometry === window.__etPaneGeometry;

  window.__etPaneGeometry = geometry;
  window.__etSettledFrames = still ? (window.__etSettledFrames ?? 0) + 1 : 0;

  return window.__etSettledFrames >= ${SETTLED_FRAMES};
})()`;

const PANES_NOW = `document.querySelectorAll(${JSON.stringify(OVERLAY_PANES)}).length`;

/**
 * Waits up to `PANE_COUNT_TIMEOUT_MS` for at least `count` overlay panes, or until the open ones settle with no new one,
 * then until `settledPanesScript` holds within `timeout`. `opened` is the pane count when fewer than `count` opened.
 */
export const settledPanesOf = async (options: {
  page: Page;
  count: number;
  timeout: number;
}): Promise<{ settled: boolean; opened: number | null }> => {
  const { page, count } = options;
  const timeout = playwrightTimeoutOf(options.timeout);

  if (count > 0)
    await page
      .waitForFunction(
        `(() => { const settled = ${settledPanesScript}; return ${PANES_NOW} >= ${count} || settled; })()`,
        undefined,
        { timeout: Math.min(timeout, PANE_COUNT_TIMEOUT_MS), polling: 'raf' },
      )
      .catch(() => undefined);

  const settled = await page
    .waitForFunction(settledPanesScript, undefined, { timeout, polling: 'raf' })
    .then(() => true)
    .catch(() => false);
  const opened = count > 0 ? ((await page.evaluate(PANES_NOW)) as number) : 0;

  return { settled, opened: opened < count ? opened : null };
};
