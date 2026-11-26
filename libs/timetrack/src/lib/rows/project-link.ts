import { ActivityBlock } from '../model/block';
import { foldByKey } from './fold-by-key';
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
}): PrivateTime[] =>
  foldByKey({
    entries: options.blocks,
    blockOf: (entry) => entry.block,
    keyOf: (entry) => entry.link.id,
    open: ({ entry, span }) => ({ link: entry.link, ...span }),
  });
