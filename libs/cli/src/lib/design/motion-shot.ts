import { Browser, DRAW_TIMEOUT_MS, finished, openFrame, settled, ShotUnprocessableError } from './thumb';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

export type MotionMode = 'full' | 'reduced';

type MotionBox = { left: number; top: number; right: number; bottom: number };

export const MOTION_MODES: readonly MotionMode[] = ['full', 'reduced'];

/** How far a motion runs to find its end: a step or animation that starts later is not drawn. */
export const MOTION_LIMIT_MS = 30000;

const SHARES = [0, 0.25, 0.5, 0.75, 1];

/** The keyframe times of a motion that ends at `end`: 0, 25, 50, 75 and 100 %, plus its `at` times, in ms. */
export const keyframeTimesOf = (end: number, at: readonly number[] = []) =>
  [
    ...new Set([
      ...SHARES.map((share) => Math.round(end * share)),
      ...at.filter((ms) => Number.isFinite(ms) && ms >= 0 && ms <= MOTION_LIMIT_MS),
    ]),
  ].sort((a, b) => a - b);

/** The tracks are the `MotionTrack`s of `design/motion-runtime.ts`, as the frame sends them. */
/** The smallest box around all of `boxes`, cut at the page origin, which a screenshot cannot reach past. */
export const unionOfBoxes = (boxes: readonly MotionBox[]) => {
  const left = Math.max(0, Math.min(...boxes.map((box) => box.left)));
  const top = Math.max(0, Math.min(...boxes.map((box) => box.top)));

  return {
    x: left,
    y: top,
    width: Math.max(...boxes.map((box) => box.right)) - left,
    height: Math.max(...boxes.map((box) => box.bottom)) - top,
  };
};

export type MotionPictures = { end: number; tracks: unknown[]; keyframes: { ms: number; png: Buffer }[] };

const failureOf = async (page: Page) => {
  const failure: unknown = await page.evaluate("document.documentElement.getAttribute('data-et-error')");

  if (typeof failure === 'string') throw new ShotUnprocessableError(failure);
};

/**
 * Draws a motion in a frame opened with `motion=<name>` at its `from` state: one run to its end finds the end and the
 * tracks, a second run is drawn at each keyframe time.
 */
export const motionPicturesOf = async (options: {
  page: Page;
  url: string;
  clip: boolean;
  at?: readonly number[];
}): Promise<MotionPictures> => {
  const { page, url, clip, at } = options;

  const start = async () => {
    await openFrame(page, url);
    await page.evaluate(settled);
    await page.evaluate(finished);
    await failureOf(page);
    await page.evaluate('window.etMotion.start()');
  };

  await start();

  const timeline = (await page.evaluate(
    `(() => { window.etMotion.seek(${MOTION_LIMIT_MS}); return window.etMotion.timeline(); })()`,
  )) as { end: number; tracks: unknown[] };

  const times = keyframeTimesOf(timeline.end, at);
  let region: ReturnType<typeof unionOfBoxes> | null = null;

  if (clip) {
    await start();

    const boxes: MotionBox[] = [];

    for (const ms of times) {
      await page.evaluate(`window.etMotion.seek(${ms})`);
      boxes.push((await page.evaluate('window.etMotion.bounds()')) as MotionBox);
    }

    region = unionOfBoxes(boxes);
  }

  await start();

  const keyframes: MotionPictures['keyframes'] = [];

  for (const ms of times) {
    await page.evaluate(`window.etMotion.seek(${ms})`);

    const png = await (region
      ? page.screenshot({ type: 'png', fullPage: true, clip: region, timeout: DRAW_TIMEOUT_MS })
      : page.screenshot({ type: 'png', fullPage: true, timeout: DRAW_TIMEOUT_MS }));

    keyframes.push({ ms, png });
  }

  await failureOf(page);

  return { ...timeline, keyframes };
};
