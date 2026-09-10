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
  /** Above this many rows, every row on one track collapses into one regardless of the gaps. */
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

/**
 * The last resort for a day that fragmented into more rows than anyone will review: every row on one
 * track becomes one, gaps and all. `observedMs` still counts only observed time, so this widens a
 * row's clock span without inventing any duration.
 */
const consolidateByTrack = (rows: WorkGroup[]) => {
  const indexByTrack = new Map<string, number>();
  const kept: WorkGroup[] = [];

  for (const row of rows) {
    const track = trackOf(row);
    const at = track === undefined ? undefined : indexByTrack.get(track);

    if (at === undefined) {
      if (track !== undefined) indexByTrack.set(track, kept.length);
      kept.push(row);
      continue;
    }

    const existing = kept[at];
    if (existing) kept[at] = join(existing, row);
  }

  return kept;
};

/**
 * Combines a track's blocks into reviewable rows - the same issue, or the same context while nothing
 * has named it. Two blocks of one track join while less than `maxMergeGapMs` separates them, whatever
 * held the machine in that gap: a day that moves between two checkouts every minute is two lines of
 * work and not four hundred, and each row still counts only the time its own blocks held.
 *
 * A real break is longer than the gap, so it still ends a row and the timeline still shows when the
 * work happened.
 */
export const mergeBlocks = (options: { blocks: AttributedBlock[]; options?: Partial<MergeOptions> }): WorkGroup[] => {
  const config = { ...DEFAULT_MERGE_OPTIONS, ...options.options };
  const ordered = options.blocks.slice().sort((a, b) => a.block.from.getTime() - b.block.from.getTime());
  const rows: WorkGroup[] = [];
  const lastOfTrack = new Map<string, number>();

  for (const attributed of ordered) {
    const group = groupFrom(attributed);
    const track = trackOf(group);
    const at = track === undefined ? undefined : lastOfTrack.get(track);
    const previous = at === undefined ? undefined : rows[at];

    if (at !== undefined && previous && group.from.getTime() - previous.to.getTime() <= config.maxMergeGapMs) {
      rows[at] = join(previous, group);
      continue;
    }

    if (track !== undefined) lastOfTrack.set(track, rows.length);
    rows.push(group);
  }

  return rows.length > config.maxRowsPerDay ? consolidateByTrack(rows) : rows;
};
