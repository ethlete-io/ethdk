import { ActivityBlock, blockDurationMs } from '../model/block';
import { Confidence, Evidence, compareConfidence } from '../model/evidence';
import { AttributedBlock } from './attribute';

/** One or more attributed blocks that will become a single reviewable row. */
export type WorkGroup = {
  issueKey?: string;
  storyKey?: string;
  taskKey?: string;
  from: Date;
  to: Date;
  /** Time actually observed, which is less than `to - from` once a merge spans a gap between blocks. */
  observedMs: number;
  confidence: Confidence;
  evidence: Evidence[];
  blocks: ActivityBlock[];
};

export type MergeOptions = {
  /** Two same-issue rows this close become one; a longer gap stays two rows, so lunch stays visible. */
  maxMergeGapMs: number;
  /** Above this many rows, every row on one issue collapses into one regardless of the gaps. */
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
 * The last resort for a day that fragmented into more rows than anyone will review: every row on one
 * issue becomes one, gaps and all. `observedMs` still counts only observed time, so this widens a
 * row's clock span without inventing any duration.
 */
const consolidateByIssue = (rows: WorkGroup[]) => {
  const indexByIssue = new Map<string, number>();
  const kept: WorkGroup[] = [];

  for (const row of rows) {
    const at = row.issueKey === undefined ? undefined : indexByIssue.get(row.issueKey);

    if (at === undefined) {
      if (row.issueKey) indexByIssue.set(row.issueKey, kept.length);
      kept.push(row);
      continue;
    }

    const existing = kept[at];
    if (existing) kept[at] = join(existing, row);
  }

  return kept;
};

/**
 * Combines consecutive blocks that carry the same issue key into one reviewable row, and leaves a
 * genuine context switch alone however short it was. Blocks nothing could attribute never merge with
 * anything: each one is a separate question for the reasoning provider, and merging them would
 * destroy the evidence that distinguishes them.
 */
export const mergeBlocks = (options: { blocks: AttributedBlock[]; options?: Partial<MergeOptions> }): WorkGroup[] => {
  const config = { ...DEFAULT_MERGE_OPTIONS, ...options.options };
  const ordered = options.blocks.slice().sort((a, b) => a.block.from.getTime() - b.block.from.getTime());
  const rows: WorkGroup[] = [];

  for (const attributed of ordered) {
    const group = groupFrom(attributed);
    const previous = rows[rows.length - 1];
    const mergeable =
      !!previous &&
      !!group.issueKey &&
      previous.issueKey === group.issueKey &&
      group.from.getTime() - previous.to.getTime() <= config.maxMergeGapMs;

    if (previous && mergeable) rows[rows.length - 1] = join(previous, group);
    else rows.push(group);
  }

  return rows.length > config.maxRowsPerDay ? consolidateByIssue(rows) : rows;
};
