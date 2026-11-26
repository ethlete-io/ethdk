import { streamKey } from '../model/block';
import { TimeWindow, mergeWindows, subtractWindows } from '../model/time-window';
import { AttributedBlock } from './attribute';
import { WorkGroup, joinUnattended, mergeBlocks } from './merge';
import { clipBlocks } from './overlap';

const ALL_TIME: TimeWindow = { from: new Date(-8.64e15), to: new Date(8.64e15) };

type DrawnRow = { laneKey?: string; from: Date; to: Date; unattended?: boolean };

const within = (entry: AttributedBlock, windows: readonly TimeWindow[]): AttributedBlock[] =>
  clipBlocks({ blocks: [entry.block], windows: subtractWindows({ windows: [ALL_TIME], without: windows }) }).map(
    (block) => ({
      ...entry,
      block: { ...block, evidence: block.evidence.filter((seen) => seen.at >= block.from && seen.at <= block.to) },
      evidence: entry.evidence.filter((seen) => seen.at >= block.from && seen.at <= block.to),
    }),
  );

/**
 * The minutes `cutBackground` handed to a foreground band that `markAttendance` found nobody attended,
 * as unattended bands of the background checkout that lost them.
 *
 * It runs after the day's rows are proposed and only adds bands beside them: a minute any attended row
 * holds, in any lane, or any row of the background checkout's own lane holds, is never given back. The
 * result is proposed on its own, so no row the day already holds can move.
 */
export const giveBackUnattended = (options: {
  groups: readonly WorkGroup[];
  lost: readonly AttributedBlock[];
  rows: readonly DrawnRow[];
  breaks?: readonly TimeWindow[];
  /** `markAttendance` over the given-back bands, with the inputs the day's own bands were marked with. */
  mark: (groups: readonly WorkGroup[]) => WorkGroup[];
  merge?: Parameters<typeof mergeBlocks>[0]['options'];
}): WorkGroup[] => {
  const nobody = subtractWindows({
    windows: mergeWindows(options.groups.filter((group) => group.attended === false && group.blocks.length)),
    without: [
      ...options.groups.filter((group) => group.attended !== false),
      ...options.rows.filter((row) => !row.unattended),
    ],
  });

  if (!nobody.length) return [];

  const takenIn = new Map<string, TimeWindow[]>();
  const blocks = [...options.lost]
    .sort((a, b) => a.block.from.getTime() - b.block.from.getTime())
    .flatMap((entry) => {
      const lane = streamKey(entry.block.context);
      const taken = takenIn.get(lane) ?? options.rows.filter((row) => row.laneKey === lane);
      const pieces = within(entry, subtractWindows({ windows: nobody, without: taken }));

      takenIn.set(lane, [...taken, ...pieces.map((piece) => piece.block)]);

      return pieces;
    });

  if (!blocks.length) return [];

  return joinUnattended({
    groups: options
      .mark(mergeBlocks({ blocks, barriers: options.breaks, options: options.merge }))
      .filter((group) => group.attended === false),
    gaps: [ALL_TIME],
    maxGapMs: 0,
  });
};
