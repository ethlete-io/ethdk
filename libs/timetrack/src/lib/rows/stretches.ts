import { ActivityBlock } from '../model/block';
import { TimeWindow, mergeWindows } from '../model/time-window';

/**
 * The stretches a row's blocks held, for a screen to draw a band per stretch rather than one rectangle
 * from the row's first block to its last.
 *
 * Two runs join while the gap between them is no longer than the work already in the run, so every
 * stretch is at most twice the time behind it. A row whose gaps another context filled - a day spent
 * switching between four checkouts - would otherwise be drawn across the whole day.
 */
export const stretchesOf = (blocks: readonly ActivityBlock[]): TimeWindow[] => {
  const stretches: TimeWindow[] = [];
  let heldMs = 0;

  for (const window of mergeWindows(blocks)) {
    const last = stretches[stretches.length - 1];
    const windowMs = window.to.getTime() - window.from.getTime();

    if (last && window.from.getTime() - last.to.getTime() <= heldMs) {
      last.to = window.to;
      heldMs += windowMs;
      continue;
    }

    stretches.push(window);
    heldMs = windowMs;
  }

  return stretches;
};
