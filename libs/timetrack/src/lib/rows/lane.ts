import { ActivityBlock, blockDurationMs, streamKey } from '../model/block';

/**
 * Which checkout a row belongs to, so the day screen can give each checkout its own lane.
 *
 * A merge can join blocks from more than one context, and a row is drawn in one lane, so the lane is
 * the stream that holds most of the row's time rather than the one its first block happened to be in.
 * Blocks with no context at all produce no lane.
 */
export const laneKeyOf = (blocks: readonly ActivityBlock[]) => {
  const held = new Map<string, number>();

  for (const block of blocks) {
    const key = streamKey(block.context);

    if (key === 'app:') continue;

    held.set(key, (held.get(key) ?? 0) + blockDurationMs(block));
  }

  const ranked = [...held].sort(([a, aMs], [b, bMs]) => bMs - aMs || a.localeCompare(b));

  return ranked[0]?.[0];
};

/**
 * The lane every call row is drawn in, whatever application held the call.
 *
 * A call carries no blocks, so `laneKeyOf` can read no checkout out of it, and a row with no lane
 * falls into the day screen's `lane:none` beside the work nothing could place.
 */
export const CALL_LANE_KEY = 'lane:call';

/** The lane every meeting row is drawn in, for the same reason a call has one. */
export const MEETING_LANE_KEY = 'lane:meeting';
