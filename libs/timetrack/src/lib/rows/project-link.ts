import { ActivityBlock, blockDurationMs } from '../model/block';
import { TimetrackProjectLink } from '../model/project-link';

/** One private path, with how much of the day it covered. What the day view labels rather than bills. */
export type PrivateTime = {
  link: TimetrackProjectLink;
  observedMs: number;
  from: Date;
  to: Date;
};

/**
 * Folds private blocks into the links that made them private, largest first. The day still reports
 * them: a user who cannot see that the app watched has no way to tell a working link from a broken
 * one, which is the same promise the pause button makes.
 */
export const privateTime = (options: {
  blocks: readonly { block: ActivityBlock; link: TimetrackProjectLink }[];
}): PrivateTime[] => {
  const found = new Map<string, PrivateTime>();

  for (const { block, link } of options.blocks) {
    const existing = found.get(link.id);
    const observedMs = blockDurationMs(block);

    if (!existing) {
      found.set(link.id, { link, observedMs, from: block.from, to: block.to });
      continue;
    }

    existing.observedMs += observedMs;
    if (block.from < existing.from) existing.from = block.from;
    if (block.to > existing.to) existing.to = block.to;
  }

  return [...found.values()].sort((a, b) => b.observedMs - a.observedMs);
};
