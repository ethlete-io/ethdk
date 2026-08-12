import { ActivityBlock } from '../model/block';

/** A half-open span of wall-clock time. */
export type TimeWindow = { from: Date; to: Date };

/** How much of a block falls inside a window — time two rows would each claim in full. */
export const overlapMs = (options: { block: ActivityBlock; window: TimeWindow }) => {
  const start = Math.max(options.block.from.getTime(), options.window.from.getTime());
  const end = Math.min(options.block.to.getTime(), options.window.to.getTime());

  return Math.max(0, end - start);
};

const evidenceWithin = (block: ActivityBlock, within: { from: number; to: number }) =>
  block.evidence.filter((entry) => entry.at.getTime() >= within.from && entry.at.getTime() <= within.to);

const clipOne = (block: ActivityBlock, windows: readonly TimeWindow[]): ActivityBlock[] => {
  let pieces: ActivityBlock[] = [block];

  for (const window of windows) {
    const from = window.from.getTime();
    const to = window.to.getTime();

    pieces = pieces.flatMap((piece) => {
      const pieceFrom = piece.from.getTime();
      const pieceTo = piece.to.getTime();

      if (to <= pieceFrom || from >= pieceTo) return [piece];

      return [
        ...(pieceFrom < from
          ? [{ ...piece, to: window.from, evidence: evidenceWithin(piece, { from: pieceFrom, to: from }) }]
          : []),
        ...(pieceTo > to
          ? [{ ...piece, from: window.to, evidence: evidenceWithin(piece, { from: to, to: pieceTo }) }]
          : []),
      ];
    });
  }

  return pieces;
};

/**
 * Cuts the given windows out of the blocks, splitting a block that a window falls inside of.
 *
 * This is how an explicit assertion displaces a reconstruction: whatever the collectors saw while a
 * timer ran describes the same work the timer already claims, and leaving both in would propose the
 * hour twice. Evidence follows the piece it was observed in, so a commit made before a timer started
 * still labels the block it happened in.
 */
export const clipBlocks = (options: {
  blocks: readonly ActivityBlock[];
  windows: readonly TimeWindow[];
}): ActivityBlock[] => {
  if (!options.windows.length) return [...options.blocks];

  return options.blocks.flatMap((block) => clipOne(block, options.windows)).filter((piece) => piece.to > piece.from);
};
