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
 * The lane every call row is drawn in, whatever application held the call and whether the calendar
 * named it a meeting or not.
 *
 * A call carries no blocks, so `laneKeyOf` can read no checkout out of it, and a row with no lane
 * falls into the day screen's `lane:none` beside the work nothing could place.
 */
export const CALL_LANE_KEY = 'lane:call';

/**
 * The lane key of a row read back out of the store, with the lane calls and meetings used to be split
 * into folded into {@link CALL_LANE_KEY}. A row pinned before that still names the old lane, and
 * without this it draws a lane of its own on the day screen.
 */
export const storedLaneKey = (laneKey: string | undefined) => (laneKey === 'lane:meeting' ? CALL_LANE_KEY : laneKey);
