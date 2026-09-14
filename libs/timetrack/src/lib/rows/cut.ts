import { TimeWindow } from '../model/time-window';
import { ActivityBlock, streamKey } from '../model/block';
import { projectKeyOf } from '../ticket/project';
import { AttributedBlock } from './attribute';
import { clipBlocks } from './overlap';
import { DEFAULT_ROUND_OPTIONS, RoundOptions } from './round';

export type CutOptions = {
  /**
   * The Jira projects whose work runs behind the day rather than being it — the checkout a person is
   * in all day while the work they are booking happens elsewhere. Keys, as `favoriteProjects` holds
   * them.
   */
  backgroundProjects?: readonly string[];
  /**
   * Focused milliseconds per `streamKey`, from the day's own focus spans. It ranks two background
   * bands against each other, and nothing else reads it.
   */
  focusMsByStream?: Readonly<Record<string, number>>;
  /**
   * Windows the day already holds as work outside its blocks — the calls a rule counts as work. A
   * meeting is the foreground of the minutes it runs in, and it carries no block for the cut to read
   * it off, so it has to be handed in.
   */
  claimed?: readonly TimeWindow[];
  /** The increment the day's clock times sit on, which a reported stretch is snapped to. */
  round?: Partial<RoundOptions>;
};

const windowOf = (entry: AttributedBlock): TimeWindow => ({ from: entry.block.from, to: entry.block.to });

/**
 * A stretch a background band lost to a foreground band.
 *
 * The minutes are real work and another band already claims them, so they are neither booked nor
 * waiting to be named. They are reported rather than dropped because the day screen draws one lane per
 * checkout: without them the lane holds a hole nothing on the screen explains.
 *
 * `issueKey` is the key the band would have booked, and it sits here rather than on a row because a
 * row's `issueKey` is what writes time to Tempo.
 */
export type BehindStretch = {
  from: Date;
  to: Date;
  issueKey: string;
  /** The checkout the band ran in, which is the lane it is drawn in. */
  laneKey: string;
};

export type CutResult = {
  blocks: AttributedBlock[];
  behind: BehindStretch[];
};

/** The stretches of a block that the pieces kept from it no longer cover, in order. */
const holesOf = (options: { block: ActivityBlock; kept: readonly ActivityBlock[] }): TimeWindow[] => {
  const end = options.block.to.getTime();
  const ordered = [...options.kept].sort((a, b) => a.from.getTime() - b.from.getTime());
  const holes: TimeWindow[] = [];

  let at = options.block.from.getTime();

  for (const piece of ordered) {
    if (piece.from.getTime() > at) holes.push({ from: new Date(at), to: piece.from });

    at = Math.max(at, piece.to.getTime());
  }

  if (at < end) holes.push({ from: new Date(at), to: new Date(end) });

  return holes;
};

/**
 * Puts both ends of a reported stretch on the nearest increment boundary, and drops what is then left
 * with no time in it.
 *
 * Both ends round to the nearest, where a row's start floors and its end never falls short of the time
 * it books. A row books time and must never be drawn narrower than its own worklog; a stretch books
 * nothing, so the boundary nearest each raw end is the honest answer. The two rules can land up to an
 * increment apart, which is what {@link meetLaneRows} closes afterwards.
 */
const snapStretches = (stretches: readonly BehindStretch[], options?: Partial<RoundOptions>): BehindStretch[] => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options };
  const nearest = (at: Date) => Math.round(at.getTime() / incrementMs) * incrementMs;

  return stretches
    .map((stretch) => ({ ...stretch, from: new Date(nearest(stretch.from)), to: new Date(nearest(stretch.to)) }))
    .filter((stretch) => stretch.to.getTime() > stretch.from.getTime());
};

/** A drawn row, as the lane it sits in and the bounds it was snapped to. A row with no lane is in none. */
export type LaneRow = { laneKey?: string; from: Date; to: Date };

/**
 * Puts each end of a reported stretch on the row beside it in its own lane, where the two are within
 * an increment of each other.
 *
 * A stretch and a row are drawn on one grid, and each reaches it by its own rule: the stretch by the
 * boundary nearest its raw end, a row by the whole increments it books. Where the two disagree the
 * lane holds a quarter-hour nothing on the screen accounts for, and on a running day that hole opens
 * and closes as the row beside it grows.
 *
 * The reach is one increment because that is the size of the disagreement. A wider gap is time the
 * lane really held nothing, and a band drawn across it would claim presence there was none of.
 */
export const meetLaneRows = (options: {
  behind: readonly BehindStretch[];
  rows: readonly LaneRow[];
  round?: Partial<RoundOptions>;
}): BehindStretch[] => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const nearestTo = (at: Date, edges: readonly number[]) =>
    edges
      .filter((edge) => Math.abs(edge - at.getTime()) <= incrementMs)
      .sort((a, b) => Math.abs(a - at.getTime()) - Math.abs(b - at.getTime()))[0] ?? at.getTime();

  return options.behind.map((stretch) => {
    const lane = options.rows.filter((row) => row.laneKey === stretch.laneKey);
    const from = nearestTo(
      stretch.from,
      lane.map((row) => row.to.getTime()),
    );
    const to = nearestTo(
      stretch.to,
      lane.map((row) => row.from.getTime()),
    );

    if (to <= from) return stretch;

    return { ...stretch, from: new Date(from), to: new Date(to) };
  });
};

/**
 * Consecutive stretches of one lane and one key as one, so an afternoon behind another checkout is one
 * band rather than one per block the builder happened to cut the presence into.
 */
export const joinTouching = (stretches: readonly BehindStretch[]): BehindStretch[] => {
  const ordered = [...stretches].sort(
    (a, b) =>
      a.laneKey.localeCompare(b.laneKey) || a.issueKey.localeCompare(b.issueKey) || a.from.getTime() - b.from.getTime(),
  );
  const joined: BehindStretch[] = [];

  for (const stretch of ordered) {
    const last = joined[joined.length - 1];
    const continues =
      last &&
      last.laneKey === stretch.laneKey &&
      last.issueKey === stretch.issueKey &&
      last.to.getTime() >= stretch.from.getTime();

    if (!continues || !last) {
      joined.push(stretch);
      continue;
    }

    if (stretch.to > last.to) joined[joined.length - 1] = { ...last, to: stretch.to };
  }

  return joined.sort((a, b) => a.from.getTime() - b.from.getTime());
};

/**
 * Takes the stretches a foreground band covers away from a background band.
 *
 * A person can be in one checkout all day while the work they are booking happens in another, and a
 * band that claims every minute of that presence overlaps every other band on the day. The user says
 * which projects those are; no rule can read it off a day, because the same repository is background
 * on one day and the whole of the work on the next.
 *
 * Only a background band ever loses time. Two foreground bands that overlap are a day that ran two
 * things at once, which is what `concurrency` is for and not a defect to resolve. Two background bands
 * are ranked against each other by the focus their streams held, then by which started first, so the
 * cut always resolves and never asks the reviewer to.
 *
 * What it loses is reported as `behind` rather than thrown away. The cut is silent otherwise: the lane
 * holds an hour of presence, no row covers it, and nothing on the day says which band took it.
 */
export const cutBackground = (options: { blocks: readonly AttributedBlock[] } & CutOptions): CutResult => {
  const background = new Set((options.backgroundProjects ?? []).map((key) => key.trim().toUpperCase()).filter(Boolean));

  if (!background.size) return { blocks: [...options.blocks], behind: [] };

  const focusMs = options.focusMsByStream ?? {};
  const isBackground = (entry: AttributedBlock) => {
    const project = entry.issueKey ? projectKeyOf(entry.issueKey) : undefined;

    return !!project && background.has(project);
  };

  const foreground = options.blocks.filter((entry) => !isBackground(entry));
  const ranked = options.blocks
    .filter(isBackground)
    .map((entry) => ({ entry, focus: focusMs[streamKey(entry.block.context)] ?? 0 }))
    .sort((a, b) => b.focus - a.focus || a.entry.block.from.getTime() - b.entry.block.from.getTime());

  const covered = [...foreground.map(windowOf), ...(options.claimed ?? [])];
  const kept: AttributedBlock[] = [];
  const behind: BehindStretch[] = [];

  for (const { entry } of ranked) {
    const issueKey = entry.issueKey;
    const pieces = clipBlocks({ blocks: [entry.block], windows: covered }).map((block) => ({
      ...entry,
      block,
      evidence: entry.evidence.filter(
        (observed) => observed.at.getTime() >= block.from.getTime() && observed.at.getTime() <= block.to.getTime(),
      ),
    }));

    if (issueKey) {
      behind.push(
        ...holesOf({ block: entry.block, kept: pieces.map((piece) => piece.block) }).map((hole) => ({
          ...hole,
          issueKey,
          laneKey: streamKey(entry.block.context),
        })),
      );
    }

    kept.push(...pieces);
    covered.push(...pieces.map(windowOf));
  }

  return {
    blocks: [...foreground, ...kept].sort((a, b) => a.block.from.getTime() - b.block.from.getTime()),
    behind: snapStretches(joinTouching(behind), options.round),
  };
};
