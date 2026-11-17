import { StateDiff } from '../../../../host/design';

export type DiffMark = { left: string; top: string; width: string; height: string };

const percentOf = (part: number, whole: number) => `${(part / Math.max(whole, 1)) * 100}%`;

/** Where a cell draws the outline around the region `diff` found, in shares of the cell; `null` without a region. */
export const diffMarkOf = (diff: StateDiff | null): DiffMark | null => {
  if (!diff?.box) return null;

  const { box, frame } = diff;

  return {
    left: percentOf(box.x, frame.width),
    top: percentOf(box.y, frame.height),
    width: percentOf(box.width, frame.width),
    height: percentOf(box.height, frame.height),
  };
};
