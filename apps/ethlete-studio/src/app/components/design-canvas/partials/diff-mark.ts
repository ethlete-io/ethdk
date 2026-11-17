import { StateDiff } from '../../../../host/design';

export type DiffMark = { left: string; top: string; right: string; bottom: string };

const DIFF_STROKE = '--et-diff-mark-stroke';

const percentOf = (part: number, whole: number) => `${(part / Math.max(whole, 1)) * 100}%`;

const outsetOf = (edge: number, whole: number) =>
  `max(var(${DIFF_STROKE}), calc(${percentOf(edge, whole)} - var(${DIFF_STROKE})))`;

/**
 * Where a cell draws the outline around the region `diff` found, as insets from the cell edges: one stroke outside the
 * box so the outline never covers its pixels, and at least one stroke inside the cell so it is never clipped; `null`
 * without a region.
 */
export const diffMarkOf = (diff: StateDiff | null): DiffMark | null => {
  if (!diff?.box) return null;

  const { box, frame } = diff;

  return {
    left: outsetOf(box.x, frame.width),
    top: outsetOf(box.y, frame.height),
    right: outsetOf(frame.width - box.x - box.width, frame.width),
    bottom: outsetOf(frame.height - box.y - box.height, frame.height),
  };
};
