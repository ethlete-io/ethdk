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
  /**
   * The shortest band the day draws on its own. A shorter one is folded into the nearest band of its
   * own lane, and it is left alone only when that lane holds no band close enough to take it.
   *
   * The day screen draws an hour as 8rem, so a band of one minute is a sliver a reader can neither
   * read nor press. They arrive in runs: a focus flash into the editor during a call names the
   * checkout for six seconds, and the span rule then keeps the flash out of the band it belongs to.
   */
  minBandMs: number;
};

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  maxMergeGapMs: 15 * 60_000,
  maxSpanRatio: 2,
  maxLaneSpanRatio: 4,
  maxRowsPerDay: 12,
  minBandMs: 2 * 60_000,
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
 * The checkout an unnamed band belongs to, which is the lane it is drawn in. A named band has none:
 * its issue is its track, and reaching across a checkout would join two lanes into one row.
 */
const streamOf = (group: WorkGroup) => {
  const context = group.blocks[0]?.context;

  if (group.issueKey || !context?.repoPath) return undefined;

  return streamKey(context);
};

/** Whether no block behind a band names a branch, which is what lets another branch continue it. */
const branchless = (group: WorkGroup) => group.blocks.every((block) => !block.context.branch);

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

type PassOptions = {
  maxGapMs: number;
  maxSpanRatio: number;
  maxLaneSpanRatio: number;
  barriers: readonly TimeWindow[];
};

/**
 * Whether a band may take another: the gap is no wider than `maxGapMs`, no barrier falls in it, and
 * the joined band still spans no more than its own span ratio times the time it observed -
 * `maxLaneSpanRatio` while every block is one checkout, `maxSpanRatio` otherwise.
 *
 * The span test is what keeps the picture honest. Without it a band whose gaps another checkout filled
 * is drawn as a rectangle across the whole day while its label says fifteen minutes.
 */
const joinable = (options: { joined: WorkGroup; gap: TimeWindow; pass: PassOptions }) => {
  const { joined, gap, pass } = options;
  const span = joined.to.getTime() - joined.from.getTime();
  const ratio = oneLane(joined) ? pass.maxLaneSpanRatio : pass.maxSpanRatio;

  return (
    gap.to.getTime() - gap.from.getTime() <= pass.maxGapMs &&
    span <= joined.observedMs * ratio &&
    !barred({ from: gap.from, to: gap.to, barriers: pass.barriers })
  );
};

/**
 * One merge over the day's blocks, each joining the band its own track left open.
 *
 * A checkout whose branch nothing observed continues that checkout's band whatever branch it was on,
 * and a named branch continues a band of the same checkout that named none: an unknown branch is not
 * another branch. A focus flash into the editor reports no branch at all, so without this the same
 * checkout's own work is two tracks and the flash can never rejoin it.
 */
const mergePass = (options: { ordered: readonly AttributedBlock[] } & PassOptions) => {
  const { ordered, ...pass } = options;
  const rows: WorkGroup[] = [];
  const lastOfTrack = new Map<string, number>();
  const lastOfStream = new Map<string, number>();

  const openFor = (group: WorkGroup) => {
    const track = trackOf(group);
    const at = track === undefined ? undefined : lastOfTrack.get(track);

    if (at !== undefined) return at;

    const stream = streamOf(group);
    const streamAt = stream === undefined ? undefined : lastOfStream.get(stream);
    const candidate = streamAt === undefined ? undefined : rows[streamAt];

    if (!candidate) return undefined;

    return branchless(group) || branchless(candidate) ? streamAt : undefined;
  };

  const open = (group: WorkGroup, at: number) => {
    const track = trackOf(group);
    const stream = streamOf(group);

    if (track !== undefined) lastOfTrack.set(track, at);
    if (stream !== undefined) lastOfStream.set(stream, at);
  };

  for (const attributed of ordered) {
    const group = groupFrom(attributed);
    const at = openFor(group);
    const previous = at === undefined ? undefined : rows[at];

    if (at !== undefined && previous) {
      const joined = join(previous, group);

      if (joinable({ joined, gap: { from: previous.to, to: group.from }, pass })) {
        rows[at] = joined;
        open(joined, at);
        continue;
      }
    }

    open(group, rows.length);
    rows.push(group);
  }

  return rows;
};

/** Whether the band is one the day would draw as a sliver rather than as a row a reader can press. */
const isSliver = (group: WorkGroup, minBandMs: number) => group.observedMs < minBandMs;

/**
 * Folds every sliver into the band of its own lane it sits closest to, once the day's bands are cut.
 *
 * A sliver is a band the merge left behind because the span rule refused it: the flash is minutes away
 * from the work it belongs to and holds seconds of its own, so the pair would be drawn as a rectangle
 * far longer than the time behind it. That test is right about the pair and wrong about the day - the
 * band the flash belongs to holds the hour that makes the same rectangle honest, and it is only
 * reachable once that band exists.
 *
 * The join is tested by the same rules, so a sliver no band can take is left where it is. It is the one
 * touch of a checkout that a day really did hold for ten seconds, and dropping it would take a lane off
 * the day screen.
 */
const absorbSlivers = (options: { rows: readonly WorkGroup[]; minBandMs: number; pass: PassOptions }) => {
  const { minBandMs, pass } = options;
  const rows = [...options.rows];
  const taken = new Set<number>();

  const gapBetween = (left: WorkGroup, right: WorkGroup): TimeWindow =>
    left.to <= right.from ? { from: left.to, to: right.from } : { from: right.to, to: left.from };

  const distance = (left: WorkGroup, right: WorkGroup) => {
    const gap = gapBetween(left, right);

    return Math.max(0, gap.to.getTime() - gap.from.getTime());
  };

  rows.forEach((sliver, index) => {
    if (!isSliver(sliver, minBandMs) || taken.has(index)) return;

    const lane = streamOf(sliver);

    if (lane === undefined) return;

    const hosts = rows
      .map((row, at) => ({ row, at }))
      .filter((entry) => entry.at !== index && !taken.has(entry.at) && streamOf(entry.row) === lane)
      .filter((entry) => !isSliver(entry.row, minBandMs))
      .sort((left, right) => distance(sliver, left.row) - distance(sliver, right.row));

    for (const host of hosts) {
      const joined = join(host.row, sliver);

      if (!joinable({ joined, gap: gapBetween(host.row, sliver), pass })) continue;

      rows[host.at] = joined;
      taken.add(index);
      break;
    }
  });

  return rows.filter((_, index) => !taken.has(index));
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
 *
 * A band left under `minBandMs` is then folded into the nearest band of its own lane - see
 * `absorbSlivers`, which is what keeps a call's worth of focus flashes out of the timeline.
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
    maxSpanRatio: config.maxSpanRatio,
    maxLaneSpanRatio: config.maxLaneSpanRatio,
    barriers: options.barriers ?? [],
  };
  const cut = mergePass({ ...pass, ordered, maxGapMs: config.maxMergeGapMs });
  const rows = cut.length > config.maxRowsPerDay ? mergePass({ ...pass, ordered, maxGapMs: Infinity }) : cut;

  return absorbSlivers({
    rows,
    minBandMs: config.minBandMs,
    pass: { ...pass, maxGapMs: config.maxMergeGapMs },
  });
};
