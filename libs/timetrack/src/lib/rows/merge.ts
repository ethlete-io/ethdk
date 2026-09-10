import { ActivityBlock, blockDurationMs, contextKey, streamKey } from '../model/block';
import { Confidence, Evidence, compareConfidence } from '../model/evidence';
import { TimeWindow } from '../model/time-window';
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
  /**
   * The lane the row is drawn in when the row is not a checkout's work. A call and a meeting carry no
   * blocks, so nothing else can say where they belong.
   */
  laneKey?: string;
};

export type MergeOptions = {
  /** Two rows of one track this close become one; a longer gap stays two rows, so lunch stays visible. */
  maxMergeGapMs: number;
  /**
   * How far a row may be drawn past the work behind it. At 2 a band is at most twice its own time,
   * whatever filled the gaps it absorbed, so the rectangle a screen draws is never a lie about when
   * the work happened.
   */
  maxSpanRatio: number;
  /**
   * The same limit for a band whose blocks are all one checkout. It is looser than `maxSpanRatio`
   * because the day screen draws each checkout its own lane: no other checkout is drawn behind such a
   * band, so the gap it spans is that lane's own idle rather than time it took from another lane.
   *
   * It is still a limit, not `Infinity`. A band is at most four times its own work either way, so a
   * lane touched twenty times across a whole day is still several bands and not one that claims the
   * day.
   */
  maxLaneSpanRatio: number;
  /** Above this many rows, the day is merged again with no gap limit, so one track is fewer rows. */
  maxRowsPerDay: number;
};

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  maxMergeGapMs: 15 * 60_000,
  maxSpanRatio: 2,
  maxLaneSpanRatio: 4,
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
 * Whether every block behind a band is one checkout, which is one lane on the day screen. A block with
 * no context at all is in no lane, so a band holding one is not.
 */
const oneLane = (group: WorkGroup) => {
  const keys = new Set(group.blocks.map((block) => streamKey(block.context)));

  return keys.size === 1 && !keys.has('app:');
};

/** Whether one of the barriers falls in the gap a join would swallow. */
const barred = (options: { from: Date; to: Date; barriers: readonly TimeWindow[] }) =>
  options.barriers.some(
    (barrier) => barrier.from.getTime() < options.to.getTime() && barrier.to.getTime() > options.from.getTime(),
  );

/**
 * One merge over the day's blocks. A band joins the block after it while three things hold: the gap is
 * no wider than `maxGapMs`, no barrier falls in that gap, and the band would still span no more than
 * its own span ratio times the time it observed - `maxLaneSpanRatio` while every block is one
 * checkout, `maxSpanRatio` otherwise.
 *
 * The span test is what keeps the picture honest. Without it a band whose gaps another checkout filled
 * is drawn as a rectangle across the whole day while its label says fifteen minutes.
 */
const mergePass = (options: {
  ordered: readonly AttributedBlock[];
  maxGapMs: number;
  maxSpanRatio: number;
  maxLaneSpanRatio: number;
  barriers: readonly TimeWindow[];
}) => {
  const { ordered, maxGapMs, maxSpanRatio, maxLaneSpanRatio, barriers } = options;
  const rows: WorkGroup[] = [];
  const lastOfTrack = new Map<string, number>();

  for (const attributed of ordered) {
    const group = groupFrom(attributed);
    const track = trackOf(group);
    const at = track === undefined ? undefined : lastOfTrack.get(track);
    const previous = at === undefined ? undefined : rows[at];

    if (at !== undefined && previous) {
      const joined = join(previous, group);
      const gap = group.from.getTime() - previous.to.getTime();
      const span = joined.to.getTime() - joined.from.getTime();
      const ratio = oneLane(joined) ? maxLaneSpanRatio : maxSpanRatio;

      if (
        gap <= maxGapMs &&
        span <= joined.observedMs * ratio &&
        !barred({ from: previous.to, to: group.from, barriers })
      ) {
        rows[at] = joined;
        continue;
      }
    }

    if (track !== undefined) lastOfTrack.set(track, rows.length);
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
 * work happened. A row is never drawn more than `maxSpanRatio` times the work behind it either, so a
 * band whose gaps another checkout filled is split rather than stretched across the day. A band of
 * one checkout is held to `maxLaneSpanRatio` instead, which is looser: it has its own lane on the day
 * screen, so twenty short touches of a browser read as a few bands rather than twenty bars.
 *
 * A `barriers` window ends a band whatever the gap and the ratio allow. A break is one: the user left
 * the desk, so the work before it and the work after it are two stretches and a band drawn across it
 * claims an hour nobody was there for.
 *
 * Above `maxRowsPerDay` the day is merged again with no gap limit at all, which is the last resort
 * for a day nobody would review row by row. The span rule and the barriers hold in that pass too, so
 * a day of short touches far apart stays many rows and warns rather than lie in one band.
 */
export const mergeBlocks = (options: {
  blocks: AttributedBlock[];
  /** Instants no band may be drawn across, whatever the gap rule allows — the day's breaks. */
  barriers?: readonly TimeWindow[];
  options?: Partial<MergeOptions>;
}): WorkGroup[] => {
  const config = { ...DEFAULT_MERGE_OPTIONS, ...options.options };
  const ordered = options.blocks.slice().sort((a, b) => a.block.from.getTime() - b.block.from.getTime());
  const pass = {
    ordered,
    maxSpanRatio: config.maxSpanRatio,
    maxLaneSpanRatio: config.maxLaneSpanRatio,
    barriers: options.barriers ?? [],
  };
  const rows = mergePass({ ...pass, maxGapMs: config.maxMergeGapMs });

  return rows.length > config.maxRowsPerDay ? mergePass({ ...pass, maxGapMs: Infinity }) : rows;
};
