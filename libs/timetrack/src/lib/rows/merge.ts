import { ActivityBlock, blockDurationMs, contextKey } from '../model/block';
import { Confidence, Evidence, compareConfidence } from '../model/evidence';
import { AttributedBlock } from './attribute';

/** One or more attributed blocks that will become a single reviewable row. */
export type WorkGroup = {
  issueKey?: string;
  storyKey?: string;
  taskKey?: string;
  from: Date;
  to: Date;
  /**
   * The time behind the row, which is less than `to - from` once a merge spans a gap between blocks.
   * An idle gap `fillGaps` joined to the work counts here too, and says so in the evidence chain.
   */
  observedMs: number;
  confidence: Confidence;
  evidence: Evidence[];
  blocks: ActivityBlock[];
};

export type MergeOptions = {
  /** Two rows of one track this close become one; a longer gap stays two rows, so lunch stays visible. */
  maxMergeGapMs: number;
  /** Above this many rows, the day is merged again with no gap limit, so one track is fewer rows. */
  maxRowsPerDay: number;
};

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  maxMergeGapMs: 15 * 60_000,
  maxRowsPerDay: 12,
};

/**
 * The tier holding most of the merged time. Both directions matter: a long weakly-evidenced stretch
 * must not inherit `certain` from a short one, and a short weak scrap must not drag a well-evidenced
 * row into manual review. Ties go to the weaker tier.
 */
export const dominantConfidence = (groups: readonly { confidence: Confidence; observedMs: number }[]): Confidence => {
  const totals = new Map<Confidence, number>();

  for (const group of groups) totals.set(group.confidence, (totals.get(group.confidence) ?? 0) + group.observedMs);

  const ranked = [...totals].sort(([aTier, aMs], [bTier, bMs]) => bMs - aMs || compareConfidence(aTier, bTier));

  return ranked[0]?.[0] ?? 'weak';
};

/** One evidence chain out of several: de-duplicated on kind and detail, oldest observation first. */
export const mergeEvidence = (chains: readonly Evidence[][]): Evidence[] => {
  const merged: Evidence[] = [];
  const seen = new Set<string>();

  for (const entry of chains.flat()) {
    const id = `${entry.kind}|${entry.detail}`;
    if (seen.has(id)) continue;

    seen.add(id);
    merged.push(entry);
  }

  return merged.sort((a, b) => a.at.getTime() - b.at.getTime());
};

const groupFrom = (attributed: AttributedBlock): WorkGroup => ({
  issueKey: attributed.issueKey,
  storyKey: attributed.storyKey,
  taskKey: attributed.taskKey,
  from: attributed.block.from,
  to: attributed.block.to,
  observedMs: blockDurationMs(attributed.block),
  confidence: attributed.confidence,
  evidence: [...attributed.evidence],
  blocks: [attributed.block],
});

const join = (into: WorkGroup, next: WorkGroup): WorkGroup => ({
  ...into,
  storyKey: into.storyKey ?? next.storyKey,
  taskKey: into.taskKey ?? next.taskKey,
  from: into.from <= next.from ? into.from : next.from,
  to: into.to >= next.to ? into.to : next.to,
  observedMs: into.observedMs + next.observedMs,
  confidence: dominantConfidence([into, next]),
  evidence: mergeEvidence([into.evidence, next.evidence]),
  blocks: [...into.blocks, ...next.blocks],
});

/**
 * Which row a block continues: the issue a rule named, or the context behind a block nothing could
 * name. A group with neither - a meeting, a timer run - continues nothing and stays its own row.
 *
 * A context is the right identity for an unnamed band, because the reasoning provider is asked per
 * context as well: `unnamedContexts` folds the day's unattributed groups by this same key. One band
 * per context and stretch therefore asks exactly what hundreds of one-block bands asked.
 */
const trackOf = (group: WorkGroup) => {
  if (group.issueKey) return `issue:${group.issueKey}`;

  const context = group.blocks[0]?.context;

  return context ? `context:${contextKey(context)}` : undefined;
};

/** The day's blocks as one ordered set of busy stretches, so a gap can be asked what filled it. */
const busyStretchesOf = (ordered: readonly AttributedBlock[]) => {
  const stretches: { from: number; to: number }[] = [];

  for (const { block } of ordered) {
    const from = block.from.getTime();
    const to = block.to.getTime();
    const last = stretches[stretches.length - 1];

    if (last && from <= last.to) {
      if (to > last.to) last.to = to;
      continue;
    }

    stretches.push({ from, to });
  }

  return stretches;
};

/** How much of a gap nothing at all covered: the time the machine stood idle. */
const idleMsIn = (options: { stretches: readonly { from: number; to: number }[]; from: number; to: number }) => {
  const { stretches, from, to } = options;

  if (to <= from) return 0;

  let busy = 0;

  for (const stretch of stretches) {
    if (stretch.to <= from) continue;
    if (stretch.from >= to) break;

    busy += Math.min(stretch.to, to) - Math.max(stretch.from, from);
  }

  return to - from - busy;
};

/**
 * One merge over the day's blocks. A band joins the block after it while two things hold: the gap is
 * no wider than `maxGapMs`, and the idle the band would then have absorbed is no longer than the time
 * it observed.
 *
 * The idle test is what keeps the picture honest, and the coverage test is what keeps it from
 * fragmenting: a gap the machine spent in another context is a switch and costs nothing, while a gap
 * it spent doing nothing is a break. Without it a band of one-minute samples ten minutes apart is
 * drawn as one rectangle across the whole day.
 */
const mergePass = (options: {
  ordered: readonly AttributedBlock[];
  stretches: readonly { from: number; to: number }[];
  maxGapMs: number;
}) => {
  const { ordered, stretches, maxGapMs } = options;
  const rows: WorkGroup[] = [];
  const idleOfRow: number[] = [];
  const lastOfTrack = new Map<string, number>();

  for (const attributed of ordered) {
    const group = groupFrom(attributed);
    const track = trackOf(group);
    const at = track === undefined ? undefined : lastOfTrack.get(track);
    const previous = at === undefined ? undefined : rows[at];

    if (at !== undefined && previous) {
      const gap = group.from.getTime() - previous.to.getTime();
      const idle =
        (idleOfRow[at] ?? 0) + idleMsIn({ stretches, from: previous.to.getTime(), to: group.from.getTime() });

      if (gap <= maxGapMs && idle <= previous.observedMs) {
        rows[at] = join(previous, group);
        idleOfRow[at] = idle;
        continue;
      }
    }

    if (track !== undefined) lastOfTrack.set(track, rows.length);
    idleOfRow.push(0);
    rows.push(group);
  }

  return rows;
};

/**
 * Combines a track's blocks into reviewable rows - the same issue, or the same context while nothing
 * has named it. Two blocks of one track join while less than `maxMergeGapMs` separates them, whatever
 * held the machine in that gap: a day that moves between two checkouts every minute is two lines of
 * work and not four hundred, and each row still counts only the time its own blocks held.
 *
 * A real break is longer than the gap, so it still ends a row and the timeline still shows when the
 * work happened. A row absorbs no more idle than the time it observed either, so the rectangle a
 * screen draws for it is never more than twice the work behind it.
 *
 * Above `maxRowsPerDay` the day is merged again with no gap limit at all, which is the last resort
 * for a day nobody would review row by row. The idle rule holds in that pass too, so a day of short
 * touches far apart stays many rows and warns rather than lie in one band.
 */
export const mergeBlocks = (options: { blocks: AttributedBlock[]; options?: Partial<MergeOptions> }): WorkGroup[] => {
  const config = { ...DEFAULT_MERGE_OPTIONS, ...options.options };
  const ordered = options.blocks.slice().sort((a, b) => a.block.from.getTime() - b.block.from.getTime());
  const stretches = busyStretchesOf(ordered);
  const rows = mergePass({ ordered, stretches, maxGapMs: config.maxMergeGapMs });

  return rows.length > config.maxRowsPerDay ? mergePass({ ordered, stretches, maxGapMs: Infinity }) : rows;
};
