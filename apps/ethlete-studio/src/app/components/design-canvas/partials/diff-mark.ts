import { StateDiff } from '../../../../host/design';

export type DiffMark = { left: string; top: string; right: string; bottom: string };

const percentOf = (part: number, whole: number) => `${(part / Math.max(whole, 1)) * 100}%`;

/**
 * The region `diff` found, as insets from the cell edges, for the cell to leave undimmed; `null` without a region.
 */
export const diffMarkOf = (diff: StateDiff | null): DiffMark | null => {
  if (!diff?.box) return null;

  const { box, frame } = diff;

  return {
    left: percentOf(box.x, frame.width),
    top: percentOf(box.y, frame.height),
    right: percentOf(frame.width - box.x - box.width, frame.width),
    bottom: percentOf(frame.height - box.y - box.height, frame.height),
  };
};
