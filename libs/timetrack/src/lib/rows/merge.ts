import { ActivityBlock, blockDurationMs, contextKey, dominantContext, streamKey } from '../model/block';
import { formatDurationMs } from '../model/duration';
import { CollectedEvent } from '../model/event';
import { Confidence, Evidence, compareConfidence } from '../model/evidence';
import { StandIn, findStandIn } from '../model/stand-in';
import { TimeWindow } from '../model/time-window';
import { AttributedBlock } from './attribute';
import { AttributionRule, AttributionScope, matchAttributionRule } from '../model/attribution';
import { laneKeyOf } from './lane';

/** One or more attributed blocks that will become a single reviewable row. */
export type WorkGroup = {
  issueKey?: string;
  /** The stand-in naming the band while Jira holds no issue for it. Never set beside an `issueKey`. */
  standInId?: string;
  storyKey?: string;
  taskKey?: string;
  /**
   * The other work a second rung named for this band, when two rungs named different work. The band
   * still books `issueKey` — the ranking in ADR 0012 decides that — and this is what lets the band show
   * both and offer the loser in one press, so the higher rung is never picked silently.
   */
  disputedIssueKey?: string;
  /** The same, for a rung that named a stand-in rather than an issue. */
  disputedStandInId?: string;
  from: Date;
  to: Date;
  /**
   * The time behind the row, which is less than `to - from` once a merge spans a gap between blocks.
   * An idle gap `fillGaps` joined to the work counts here too, and says so in the evidence chain.
   */
  observedMs: number;
  confidence: Confidence;
  /** The observed time behind each confidence tier across every join. `confidence` is ranked from it. */
  observedByConfidence?: Partial<Record<Confidence, number>>;
  /** The scope of the rule that named the row, when a rule did. See `AttributedBlock.ruleScope`. */
  ruleScope?: AttributionScope;
  evidence: Evidence[];
  blocks: ActivityBlock[];
  /**
   * The lane the row is drawn in when the row is not a checkout's work. A call and a meeting carry no
   * blocks, so nothing else can say where they belong.
   */
  laneKey?: string;
  /**
   * Whether anybody was at the machine for this band, from `markAttendance`. `false` is a band the
   * machine worked alone, and `propose` refuses to make a Tempo row of one. Absent means the question
   * was not asked, which every caller that builds a group by hand is.
   */
  attended?: boolean;
  /**
   * Whether a worklog could hold this band. `false` is a band the day draws and never asks about — a
   * call a rule excluded from work. Absent leaves the answer to the lane, in `isBookable`.
   */
  bookable?: boolean;
  /** The id `propose` gave the row of an unnamed band. Read it through `unnamedRowId`. */
  rowId?: string;
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
   * own lane, and dropped when that lane holds no band close enough to take it: a row books at least
   * one whole increment, so a few seconds of work would claim fifteen minutes.
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

const tiersOf = (group: WorkGroup) => group.observedByConfidence ?? { [group.confidence]: group.observedMs };

const joinTiers = (left: WorkGroup, right: WorkGroup) => {
  const tiers: Partial<Record<Confidence, number>> = { ...tiersOf(left) };

  for (const [tier, ms] of Object.entries(tiersOf(right)) as [Confidence, number][]) {
    tiers[tier] = (tiers[tier] ?? 0) + ms;
  }

  return tiers;
};

const groupFrom = (attributed: AttributedBlock): WorkGroup => ({
  issueKey: attributed.issueKey,
  standInId: attributed.standInId,
  storyKey: attributed.storyKey,
  taskKey: attributed.taskKey,
  from: attributed.block.from,
  to: attributed.block.to,
  observedMs: blockDurationMs(attributed.block),
  confidence: attributed.confidence,
  ruleScope: attributed.ruleScope,
  evidence: [...attributed.evidence],
  blocks: [attributed.block],
});

const branchOf = (group: WorkGroup) => dominantContext(group.blocks)?.branch;

/**
 * What a row says when it takes the stretch its own checkout worked before anything could name it.
 * The band books time nothing named on its own, so the chain carries how much it was and where it
 * came from, and the day screen draws a mark at `at`.
 */
const swapEvidence = (unnamed: WorkGroup, named: WorkGroup): Evidence => {
  const left = branchOf(unnamed);
  const entered = branchOf(named);

  return {
    kind: 'branch-swap',
    at: named.from,
    detail: `${formatDurationMs(unnamed.observedMs)} ${left ? `on \`${left}\`` : 'in this checkout'} before it swapped to ${entered ? `\`${entered}\`` : (named.issueKey ?? named.standInId)}`,
  };
};

export const joinGroups = (into: WorkGroup, next: WorkGroup): WorkGroup => {
  const swapped = !nameOf(into) && !!nameOf(next);
  const tiers = joinTiers(into, next);

  return {
    ...into,
    issueKey: into.issueKey ?? next.issueKey,
    standInId: into.standInId ?? next.standInId,
    storyKey: into.storyKey ?? next.storyKey,
    taskKey: into.taskKey ?? next.taskKey,
    ruleScope: into.ruleScope ?? next.ruleScope,
    from: into.from <= next.from ? into.from : next.from,
    to: into.to >= next.to ? into.to : next.to,
    observedMs: into.observedMs + next.observedMs,
    confidence: dominantConfidence(
      (Object.entries(tiers) as [Confidence, number][]).map(([confidence, observedMs]) => ({ confidence, observedMs })),
    ),
    observedByConfidence: tiers,
    evidence: mergeEvidence([into.evidence, next.evidence, swapped ? [swapEvidence(into, next)] : []]),
    blocks: [...into.blocks, ...next.blocks],
  };
};

/** The issue or stand-in naming a band, which is its track whatever checkout or branch it is on. */
const nameOf = (group: WorkGroup) => {
  if (group.issueKey) return `issue:${group.issueKey}`;

  return group.standInId ? `stand-in:${group.standInId}` : undefined;
};

/**
 * Which row a block continues: the issue or stand-in a rule named, or the context behind a block nothing could
 * name. A group with neither - a meeting, a timer run - continues nothing and stays its own row.
 *
 * A named band of an agent session's piece is its name within that piece, so two pieces of one checkout on
 * one issue are two rows. A named band with no piece is its name alone, and continues any row of it.
 *
 * A context is the right identity for an unnamed band, because the reasoning provider is asked per
 * context as well: `unnamedContexts` folds the day's unattributed groups by this same key. One band
 * per context and stretch therefore asks exactly what hundreds of one-block bands asked.
 */
const trackOf = (group: WorkGroup) => {
  const name = nameOf(group);

  if (name) return namedTrackOf(name, group.blocks[0]);

  const context = group.blocks[0]?.context;

  return context ? `context:${contextKey(context)}` : undefined;
};

const namedTrackOf = (name: string, block: ActivityBlock | undefined) => {
  const piece = block ? pieceOfBlock(block) : undefined;

  return piece ? `${name}~${piece.checkout}~${piece.piece}` : name;
};

const pieceOfBlock = (block: ActivityBlock) => {
  const { context } = block;

  return context.repoPath && context.piece ? { checkout: streamKey(context), piece: context.piece } : undefined;
};

/**
 * Whether two bands hold different pieces of one checkout. Pieces of two checkouts never conflict: the same
 * issue in two repositories is one row, as it was before sessions had pieces.
 */
const holdsOtherPiece = (left: WorkGroup, right: WorkGroup) => {
  const piecesOf = (group: WorkGroup) => group.blocks.flatMap((block) => pieceOfBlock(block) ?? []);
  const held = piecesOf(left);

  return piecesOf(right).some((own) =>
    held.some((other) => other.checkout === own.checkout && other.piece !== own.piece),
  );
};

/**
 * The piece of a checkout an unnamed band belongs to. A named band has none: its issue or stand-in, within
 * its piece, is its track, and reaching across a checkout would join two lanes into one row.
 */
const streamOf = (group: WorkGroup) => (nameOf(group) ? undefined : pieceOf(group));

/**
 * Whether a sliver may fold into a band: its own issue or stand-in in its own piece once one names it, its
 * piece otherwise.
 */
const foldsInto = (sliver: WorkGroup, host: WorkGroup) => {
  const name = nameOf(sliver);

  if (name) return nameOf(host) === name && !holdsOtherPiece(host, sliver);

  const stream = streamOf(sliver);

  return stream !== undefined && !nameOf(host) && streamOf(host) === stream;
};

/** The checkout behind a band, whether or not anything has named the band's work. */
const checkoutOf = (group: WorkGroup) => {
  const context = group.blocks[0]?.context;

  return context?.repoPath ? streamKey(context) : undefined;
};

/**
 * The checkout behind a band, narrowed to the piece of work its agent session belongs to. Two pieces of
 * one checkout are two efforts, so an unnamed band of one never continues the other's.
 */
const pieceOf = (group: WorkGroup) => {
  const checkout = checkoutOf(group);
  const piece = group.blocks[0]?.context.piece;

  return checkout && piece ? `${checkout}~${piece}` : checkout;
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

type PassOptions = {
  maxGapMs: number;
  maxSpanRatio: number;
  maxLaneSpanRatio: number;
  barriers: readonly TimeWindow[];
  laneBarriers: Readonly<Record<string, readonly TimeWindow[]>>;
  /** The part of a window another piece of the band's checkout worked on the band's own ticket. */
  siblingMs?: (group: WorkGroup, window: TimeWindow) => number;
};

/**
 * The time each window of a named band another piece of its checkout spent on the same ticket. Parallel
 * sessions split their shared minutes between them, so each session's band is full of the other's
 * stretches; a band that books its own observed minutes must not be cut at every switch for them.
 */
const siblingTime = (ordered: readonly AttributedBlock[]) => {
  const held = new Map<string, { piece: string; from: number; to: number }[]>();
  const keyOf = (name: string, checkout: string) => `${name}\n${checkout}`;

  for (const entry of ordered) {
    const name = nameOf(groupFrom(entry));
    const piece = pieceOfBlock(entry.block);

    if (!name || !piece) continue;

    const key = keyOf(name, piece.checkout);
    const list = held.get(key) ?? [];

    list.push({ piece: piece.piece, from: entry.block.from.getTime(), to: entry.block.to.getTime() });
    held.set(key, list);
  }

  return (group: WorkGroup, window: TimeWindow) => {
    const name = nameOf(group);
    const pieces = new Map(group.blocks.flatMap((block) => pieceOfBlock(block) ?? []).map((own) => [own.piece, own]));
    const [own, ...more] = [...pieces.values()];

    if (!name || !own || more.length) return 0;

    const from = window.from.getTime();
    const to = window.to.getTime();
    const clipped = (held.get(keyOf(name, own.checkout)) ?? [])
      .filter((other) => other.piece !== own.piece && other.from < to && other.to > from)
      .map((other) => ({ from: Math.max(from, other.from), to: Math.min(to, other.to) }))
      .sort((left, right) => left.from - right.from);

    let at = from;
    let totalMs = 0;

    for (const part of clipped) {
      const start = Math.max(at, part.from);

      if (part.to > start) totalMs += part.to - start;

      at = Math.max(at, part.to);
    }

    return totalMs;
  };
};

/**
 * Whether a band may take another: the gap is no wider than `maxGapMs`, no barrier falls in it, no
 * block of another checkout falls in a barrier of the band's own lane, and the joined band still spans
 * no more than its own span ratio times the time it observed - `maxLaneSpanRatio` while every block is
 * one checkout, `maxSpanRatio` otherwise.
 *
 * The span test is what keeps the picture honest. Without it a band whose gaps another checkout filled
 * is drawn as a rectangle across the whole day while its label says fifteen minutes.
 */
const joinable = (options: {
  into: WorkGroup;
  added: WorkGroup;
  joined: WorkGroup;
  gap: TimeWindow;
  pass: PassOptions;
}) => {
  const { into, added, joined, gap, pass } = options;
  const siblingMs = (window: TimeWindow) => pass.siblingMs?.(joined, window) ?? 0;
  const span = joined.to.getTime() - joined.from.getTime() - siblingMs(joined);
  const ratio = oneLane(joined) ? pass.maxLaneSpanRatio : pass.maxSpanRatio;
  const lane = laneKeyOf(into.blocks);

  return (
    gap.to.getTime() - gap.from.getTime() - siblingMs(gap) <= pass.maxGapMs &&
    span <= joined.observedMs * ratio &&
    !barred({ from: gap.from, to: gap.to, barriers: pass.barriers }) &&
    !joined.blocks.some((block) =>
      barred({ from: gap.from, to: gap.to, barriers: pass.laneBarriers[streamKey(block.context)] ?? [] }),
    ) &&
    !added.blocks.some(
      (block) =>
        !!lane &&
        streamKey(block.context) !== lane &&
        barred({ from: block.from, to: block.to, barriers: pass.laneBarriers[lane] ?? [] }),
    )
  );
};

/**
 * One merge over the day's blocks, each joining the band its own track left open.
 *
 * Every unnamed band of one checkout is one band, whatever branch each was on. A checkout holds one
 * branch at a time, so a second branch there is a swap rather than a second effort, and nothing has
 * yet said the two deserve tickets of their own. Splitting such a row back apart is one press.
 *
 * A stand-in is a name like an issue key: a branch-scoped rule gives each branch its own, so a switch
 * to another branch of the checkout cuts the band there.
 *
 * An issue or stand-in the day can name also continues the unnamed band of its own checkout, which is
 * the branch somebody worked on before they created the one that names the work. Only in that
 * direction: a named band is continued by its own name alone, so no key or stand-in ever takes the
 * minutes of another.
 *
 * Two pieces of one checkout on one name are two bands, one per agent session's piece, and neither is cut
 * for the stretches the other took from it - see `siblingTime`. A band with no piece, or one in another
 * checkout, continues the latest band of its name as long as that band holds no other piece of its checkout.
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

    const name = nameOf(group);
    const named = name === undefined ? undefined : lastOfTrack.get(name);
    const namedRow = named === undefined ? undefined : rows[named];

    if (namedRow && !holdsOtherPiece(namedRow, group)) return named;

    const stream = pieceOf(group);
    const streamAt = stream === undefined ? undefined : lastOfStream.get(stream);
    const candidate = streamAt === undefined ? undefined : rows[streamAt];

    if (!candidate || nameOf(candidate)) return undefined;

    return streamAt;
  };

  const open = (options: { row: WorkGroup; added: WorkGroup; at: number }) => {
    const { row, added, at } = options;
    const name = nameOf(row);
    const stream = name ? undefined : pieceOf(row);

    if (name) {
      for (const [key, index] of lastOfTrack) {
        if (index === at && key.startsWith('context:')) lastOfTrack.delete(key);
      }

      lastOfTrack.set(name, at);
      lastOfTrack.set(namedTrackOf(name, added.blocks[0]), at);
    } else {
      const track = trackOf(row);

      if (track !== undefined) lastOfTrack.set(track, at);
    }

    if (stream !== undefined) lastOfStream.set(stream, at);
  };

  for (const attributed of ordered) {
    const group = groupFrom(attributed);
    const at = openFor(group);
    const previous = at === undefined ? undefined : rows[at];

    if (at !== undefined && previous) {
      const joined = joinGroups(previous, group);

      if (joinable({ into: previous, added: group, joined, gap: { from: previous.to, to: group.from }, pass })) {
        rows[at] = joined;
        open({ row: joined, added: group, at });
        continue;
      }
    }

    open({ row: group, added: group, at: rows.length });
    rows.push(group);
  }

  return rows;
};

/** Whether the band is one the day would draw as a sliver rather than as a row a reader can press. */
const isSliver = (group: WorkGroup, minBandMs: number) => group.observedMs < minBandMs;

/**
 * Folds every sliver into the band of its own lane it sits closest to, once the day's bands are cut,
 * and drops the ones no band takes.
 *
 * A sliver is a band the merge left behind because the span rule refused it: the flash is minutes away
 * from the work it belongs to and holds seconds of its own, so the pair would be drawn as a rectangle
 * far longer than the time behind it. That test is right about the pair and wrong about the day - the
 * band the flash belongs to holds the hour that makes the same rectangle honest, and it is only
 * reachable once that band exists.
 *
 * The join is tested by the same rules. A sliver no band can take is not a row of its own: a row books
 * at least one whole increment, so ten seconds of a checkout during a call would book fifteen minutes.
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

    const hosts = rows
      .map((row, at) => ({ row, at }))
      .filter((entry) => entry.at !== index && !taken.has(entry.at) && foldsInto(sliver, entry.row))
      .filter((entry) => !isSliver(entry.row, minBandMs))
      .sort((left, right) => distance(sliver, left.row) - distance(sliver, right.row));

    for (const host of hosts) {
      const joined = joinGroups(host.row, sliver);

      if (!joinable({ into: host.row, added: sliver, joined, gap: gapBetween(host.row, sliver), pass })) continue;

      rows[host.at] = joined;
      taken.add(index);
      break;
    }
  });

  return rows.filter((row, index) => !taken.has(index) && !isSliver(row, minBandMs));
};

/**
 * Re-reads a row once it is assembled. A repository rule names no branch, so a row holding two of them
 * was named before the swap that says the work changed. The key stays as a proposal and stops syncing
 * on its own — see `syncsWithoutReview`. A branch rule is left alone: it named a branch the row holds,
 * and the stretch before the swap into it is the start of that very work.
 */
const reconsider = (row: WorkGroup): WorkGroup => {
  if (!row.issueKey || row.confidence === 'weak' || row.ruleScope !== 'repo') return row;

  const branches = new Set(
    row.blocks.map((block) => block.context.branch).filter((branch): branch is string => !!branch),
  );

  return branches.size > 1 ? { ...row, confidence: 'weak' } : row;
};

/**
 * Combines a track's blocks into reviewable rows - the same issue within one piece of a checkout, or the
 * same context while nothing has named it. Two blocks of one track join while less than `maxMergeGapMs` separates them, whatever
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
 * A band left under `minBandMs` is then folded into the nearest band of its own lane, or dropped when
 * none can take it - see `absorbSlivers`, which keeps a call's worth of focus flashes out of the day.
 */
export const mergeBlocks = (options: {
  blocks: AttributedBlock[];
  /** Instants no band may be drawn across, whatever the gap rule allows — the day's breaks. */
  barriers?: readonly TimeWindow[];
  /** The same, per `streamKey`, for a band of that checkout alone — see `cutSessionAcrossCheckouts`. */
  laneBarriers?: Readonly<Record<string, readonly TimeWindow[]>>;
  options?: Partial<MergeOptions>;
}): WorkGroup[] => {
  const config = { ...DEFAULT_MERGE_OPTIONS, ...options.options };
  const ordered = options.blocks.slice().sort((a, b) => a.block.from.getTime() - b.block.from.getTime());
  const pass = {
    maxSpanRatio: config.maxSpanRatio,
    maxLaneSpanRatio: config.maxLaneSpanRatio,
    barriers: options.barriers ?? [],
    laneBarriers: options.laneBarriers ?? {},
    siblingMs: siblingTime(ordered),
  };
  const cut = mergePass({ ...pass, ordered, maxGapMs: config.maxMergeGapMs });
  const rows = cut.length > config.maxRowsPerDay ? mergePass({ ...pass, ordered, maxGapMs: Infinity }) : cut;

  return absorbSlivers({
    rows,
    minBandMs: config.minBandMs,
    pass: { ...pass, maxGapMs: config.maxMergeGapMs },
  }).map(reconsider);
};

/**
 * Joins the bands of work nobody attended that start inside one of `gaps`, one per lane and name,
 * while no more than `maxGapMs` separates two of them. A call carries no blocks and is left alone.
 *
 * `mergeBlocks` keeps each agent session's piece its own band, which is right for work somebody
 * steered. Nobody told the sessions of an unattended break apart, so one row per piece would put a row
 * every few minutes into a break and ask the reviewer the same question for each.
 */
export const joinUnattended = (options: {
  groups: readonly WorkGroup[];
  /** The whole absences of the day, from `breakGaps`. */
  gaps: readonly TimeWindow[];
  maxGapMs: number;
}): WorkGroup[] => {
  const rows: WorkGroup[] = [];
  const openAt = new Map<string, number>();
  const gapOf = (group: WorkGroup) => options.gaps.findIndex((gap) => gap.from <= group.from && group.from < gap.to);

  for (const group of [...options.groups].sort((a, b) => a.from.getTime() - b.from.getTime())) {
    const gap = group.attended === false && group.blocks.length ? gapOf(group) : -1;

    if (gap < 0) {
      rows.push(group);
      continue;
    }

    const key = `${gap}\n${group.laneKey ?? laneKeyOf(group.blocks) ?? ''}\n${nameOf(group) ?? ''}`;
    const at = openAt.get(key);
    const previous = at === undefined ? undefined : rows[at];

    if (at !== undefined && previous && group.from.getTime() - previous.to.getTime() <= options.maxGapMs) {
      rows[at] = joinGroups(previous, group);
      continue;
    }

    openAt.set(key, rows.length);
    rows.push(group);
  }

  return rows;
};

type BranchActivity = { at: Date; branch: string; repoPath?: string; detail: string; written: boolean };

const branchActivityOf = (event: CollectedEvent): BranchActivity | [] => {
  if (event.kind === 'git-commit') {
    return {
      at: event.at,
      branch: event.branch,
      repoPath: event.repoPath,
      detail: `a commit on \`${event.branch}\``,
      written: true,
    };
  }

  if (event.kind === 'git-branch-update') {
    const verb = event.action.split(':')[0] || 'an update';

    return {
      at: event.at,
      branch: event.branch,
      repoPath: event.repoPath,
      detail: `${verb} on \`${event.branch}\``,
      written: true,
    };
  }

  if (event.kind !== 'merge-request-activity' || !event.branch) return [];

  const mergeRequest = event.mergeRequestIid ? `!${event.mergeRequestIid}` : 'a merge request';

  return {
    at: event.at,
    branch: event.branch,
    detail: `you ${event.action} ${mergeRequest} on \`${event.branch}\``,
    written: false,
  };
};

type Rival = { disputedIssueKey: string } | { disputedStandInId: string };

const rivalKey = (rival: Rival) =>
  'disputedIssueKey' in rival ? `issue:${rival.disputedIssueKey}` : `stand-in:${rival.disputedStandInId}`;

const swapTo = (group: WorkGroup, won: string): WorkGroup => {
  const { issueKey, standInId, storyKey: _storyKey, taskKey: _taskKey, ...rest } = group;
  const lost = issueKey ? { disputedIssueKey: issueKey } : standInId ? { disputedStandInId: standInId } : {};

  return { ...rest, issueKey: won, ...lost };
};

/**
 * Marks a band a rule named as disputed when its stretch holds activity on another branch of its
 * checkout, or of a worktree of it, that a branch rule names as other work: a merge request, a
 * commit, or a rebase or merge made without a checkout. The band still books what its rule named;
 * the review sees both.
 *
 * An agent session's band is the exception. A session reports the branch its checkout had checked out,
 * yet it can commit or merge on another one through a worktree it removes again. When every write to
 * this checkout inside the session's own stretches names one other issue, and nothing wrote to the
 * band's branch, the band books that issue and the rule's answer becomes the dispute. A branch that
 * names only a stand-in never takes a band from an issue: it stays the dispute. A write a linked
 * worktree owns is that worktree's session's, never this one's.
 */
export const disputeOtherBranches = (options: {
  groups: readonly WorkGroup[];
  events: readonly CollectedEvent[];
  rules?: readonly AttributionRule[];
  standIns?: readonly StandIn[];
  /** Each linked worktree's path, mapped to its main checkout. */
  worktrees?: Readonly<Record<string, string>>;
}): WorkGroup[] => {
  const rules = options.rules ?? [];
  const worktrees = options.worktrees ?? {};
  const mainOf = (path: string) => worktrees[path] ?? path;
  const ruled = [...new Set(rules.flatMap((rule) => rule.repoPath ?? []))];
  const standIns = options.standIns ?? [];
  const activities = options.events.flatMap(branchActivityOf);

  const rivalOf = (activity: { group: WorkGroup; branch: string; repoPaths: readonly string[] }): Rival | undefined => {
    for (const repoPath of activity.repoPaths) {
      const match = matchAttributionRule({ context: { repoPath, branch: activity.branch }, rules });
      const target = match?.scope === 'branch' ? match.rule.target : undefined;

      if (target?.kind === 'issue' && target.issueKey !== activity.group.issueKey) {
        return { disputedIssueKey: target.issueKey };
      }

      const standIn = target?.kind === 'stand-in' ? findStandIn({ id: target.standInId, standIns }) : undefined;

      if (standIn?.state === 'open' && standIn.id !== activity.group.standInId)
        return { disputedStandInId: standIn.id };
    }

    return undefined;
  };

  return options.groups.map((group) => {
    const context = dominantContext(group.blocks);
    const repoPath = context?.repoPath;

    if (!group.ruleScope || !repoPath || group.disputedIssueKey || group.disputedStandInId) return group;

    const main = mainOf(repoPath);
    const checkouts = ruled.filter((path) => mainOf(path) === main);
    const bySession = (at: Date) =>
      group.blocks.some((block) => !!block.context.session && block.from <= at && at <= block.to);
    const found: { activity: BranchActivity; rival?: Rival; repoPaths: readonly string[] }[] = [];

    for (const activity of activities) {
      if (activity.at < group.from || activity.at > group.to) continue;

      const repoPaths = activity.repoPath ? [activity.repoPath].filter((path) => mainOf(path) === main) : checkouts;

      found.push({ activity, repoPaths, rival: rivalOf({ group, branch: activity.branch, repoPaths }) });
    }

    const ownWrite = found.some(
      (entry) => entry.activity.written && entry.repoPaths.length && entry.activity.branch === context.branch,
    );
    const sessionWrites = found.filter(
      (entry) => entry.activity.written && entry.activity.repoPath === repoPath && bySession(entry.activity.at),
    );
    const named = new Set(sessionWrites.flatMap((entry) => (entry.rival ? rivalKey(entry.rival) : [])));
    const onlyRival = !ownWrite && named.size === 1 ? sessionWrites.find((entry) => entry.rival) : undefined;
    const won =
      onlyRival?.rival && 'disputedIssueKey' in onlyRival.rival ? onlyRival.rival.disputedIssueKey : undefined;
    const written = won ? onlyRival : undefined;
    const disputed = written ?? found.find((entry) => entry.rival);

    if (!disputed?.rival) return group;

    const evidence = mergeEvidence([
      group.evidence,
      [{ kind: 'branch', at: disputed.activity.at, detail: disputed.activity.detail }],
    ]);

    if (won) return { ...swapTo(group, won), evidence };

    return { ...group, ...disputed.rival, evidence };
  });
};
