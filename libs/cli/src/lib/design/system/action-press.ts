import { Browser } from '../thumb';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

export const OVERLAY_ROOTS = '.et-overlay-runtime-root, .cdk-overlay-container';

export const EMIT_WAIT_MS = 400;

const SETTLED_FRAMES = 2;

/** An init script that records each key whose keydown default the page prevented in `window.__etPrevented`. */
export const INIT_SCRIPT = `window.__etPrevented = [];
window.addEventListener('keydown', (event) => { if (event.defaultPrevented) window.__etPrevented.push(event.key); });`;

/** Waits until no finite animation runs for a few frames, or `timeout` passes. */
export const settle = async (page: Page, timeout: number) => {
  await page
    .waitForFunction(
      `(() => {
        const settled = document.getAnimations().every((animation) => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity);
        window.__etActionFrames = settled ? (window.__etActionFrames ?? 0) + 1 : 0;
        return window.__etActionFrames >= ${SETTLED_FRAMES};
      })()`,
      undefined,
      { timeout, polling: 'raf' },
    )
    .catch(() => undefined);
};
