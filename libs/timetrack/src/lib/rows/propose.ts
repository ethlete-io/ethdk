import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock, blockDurationMs, dominantContext, streamKey } from '../model/block';
import { WorklogProposal } from '../model/proposal';
import {
  TimeWindow,
  clipWindows,
  mergeWindows,
  subtractWindows,
  windowsMs,
  windowsOverlap,
} from '../model/time-window';
import { breaksBetweenRows, drawnBreak } from '../stream/breaks';
import { DescribeOptions, describeWork } from './describe';
import { CALL_LANE_KEY, laneKeyOf } from './lane';
import { WorkGroup, joinGroups } from './merge';
import { clipBlocks } from './overlap';
import { DEFAULT_ROUND_OPTIONS, RoundOptions, roundDurationUp, siblingBookingsOf } from './round';
import { floorToGrid, nearestOnGrid } from './grid';
import { snapRowBounds } from './snap';
import { stretchesOf } from './stretches';

/**
 * A band of work the day will not book. It is drawn, split and merged like any other row, and it
 * never reaches Tempo — naming it is what turns it into a proposal.
 */
export type UnnamedProposal = Omit<WorklogProposal, 'issueKey' | 'storyKey'> & {
  /** The stand-in naming the band. The row is still drawn, counted and never written. */
  standInId?: string;
};

export type ProposeResult = {
  proposals: WorklogProposal[];
  /**
   * Groups no rule could attribute — the reasoning provider's input, and never synced. Kept as groups
   * because `unnamedContexts` folds them by the context behind them.
   *
   * A band a stand-in names is not among them, though it is drawn in `unnamed`: unattributed means the
   * user still owes the app an answer, and on a stand-in band the app owes them a ticket instead.
   */
  unattributed: WorkGroup[];
  /** The same work as rows, for the day screen to draw. */
  unnamed: UnnamedProposal[];
};

type AttributedGroup = WorkGroup & { issueKey: string };

/**
 * Whether the group becomes a Tempo row.
 *
 * An issue is not enough. A band the machine worked alone is refused here rather than at sync time,
 * because a proposal is the thing a reviewer accepts, and nothing the user has to notice may be the
 * only guard against booking an hour nobody was there for. Such a band is still drawn, in `unnamed`,
 * and the user can still name it by hand — which is a deliberate act rather than an oversight.
 *
 * What it keeps is the key the ladder found, on `withheldIssueKey`. Refusing to book the band and
 * forgetting what it was are two decisions, and only the first one is this guard's.
 */
const isAttributed = (group: WorkGroup): group is AttributedGroup => !!group.issueKey && group.attended !== false;

/** A group with the bounds and the booked time its row will carry. */
type BoundGroup = { group: WorkGroup; from: Date; to: Date; durationMs: number };

const isAttributedRow = <T extends BoundGroup>(row: T): row is T & { group: AttributedGroup } =>
  isAttributed(row.group);

const ALL_TIME = { from: new Date(-8.64e15), to: new Date(8.64e15) };

const blocksMs = (blocks: readonly ActivityBlock[]) => blocks.reduce((sum, block) => sum + blockDurationMs(block), 0);

/** `idFrom` is the start a part's id is built from, where it differs from the part's own start. */
type BreakPiece = { group: WorkGroup; afterBreak?: true; inBreak?: true; idFrom?: Date };

/**
 * The boundary below the first block after the measured break, which is where a part after a break
 * started while the cut ran on the measured break. Its id, and the user's edits on it, hang there.
 */
const measuredStartOf = (options: {
  blocks: readonly ActivityBlock[];
  away: readonly TimeWindow[];
  part: TimeWindow;
  incrementMs: number;
}) => {
  const { part } = options;
  const back = Math.max(
    -Infinity,
    ...options.away.filter((window) => window.from < part.from).map((window) => window.to.getTime()),
  );
  const starts = Number.isFinite(back)
    ? options.blocks
        .filter((block) => block.to.getTime() > back && block.from < part.to)
        .map((block) => Math.max(block.from.getTime(), back))
    : [];

  return new Date(floorToGrid(starts.length ? Math.min(...starts) : part.from.getTime(), options.incrementMs));
};

/**
 * Cuts an attended group at the breaks the Break lane draws over the rows, `drawn`, so no booked part
 * reaches into one. Only a break a group runs through is drawn there; the lane draws any other break as
 * the gap the rows leave. A part after a break keeps the id it had when the cut ran on the measured
 * break, `away`.
 *
 * A part no block reaches is dropped, so a group with no blocks of its own, like a timer run's, is never cut.
 */
const cutOutBreaks = (options: {
  group: WorkGroup;
  away: readonly TimeWindow[];
  drawn: readonly TimeWindow[];
  incrementMs: number;
}): BreakPiece[] => {
  const { group } = options;
  const over = options.drawn.filter((window) => windowsOverlap(window, group));

  if (group.attended === false || !over.length) return [{ group }];

  const blocks = clipBlocks({ blocks: group.blocks, windows: over });
  const attended = subtractWindows({ windows: [group], without: over }).flatMap((window) => {
    const inside = blocks.filter((block) => block.from >= window.from && block.to <= window.to);
    const extent = mergeWindows(inside);
    const first = extent[0];
    const last = extent[extent.length - 1];

    if (!first || !last) return [];

    return [
      {
        from: window.from.getTime() === group.from.getTime() ? group.from : first.from,
        to: window.to.getTime() === group.to.getTime() ? group.to : last.to,
        blocks: inside,
      },
    ];
  });

  if (!attended.length) return [{ group }];

  const evidenceOf = (index: number) => {
    const from = (index && attended[index]?.from.getTime()) || -Infinity;
    const to = attended[index + 1]?.from.getTime() ?? Infinity;

    return group.evidence.filter((entry) => entry.at.getTime() >= from && entry.at.getTime() < to);
  };
  const parts = attended.map((piece, index) => ({
    group: {
      ...group,
      from: piece.from,
      to: piece.to,
      blocks: piece.blocks,
      evidence: evidenceOf(index),
      observedMs: Math.min(group.observedMs, blocksMs(piece.blocks)),
    },
    ...(piece.from > group.from
      ? {
          afterBreak: true as const,
          idFrom: measuredStartOf({
            blocks: group.blocks,
            away: options.away,
            part: piece,
            incrementMs: options.incrementMs,
          }),
        }
      : {}),
  }));
  const inBreaks = clipWindows({ windows: over, within: [group] }).flatMap((window) => {
    const inside = clipBlocks({
      blocks: group.blocks,
      windows: subtractWindows({ windows: [ALL_TIME], without: [window] }),
    });

    if (!inside.length) return [];

    return [
      {
        group: {
          ...group,
          attended: false,
          from: window.from,
          to: window.to,
          blocks: inside,
          evidence: group.evidence.filter((entry) => entry.at >= window.from && entry.at < window.to),
          observedMs: Math.min(group.observedMs, blocksMs(inside)),
        },
        inBreak: true as const,
      },
    ];
  });

  return [...parts, ...inBreaks].sort((a, b) => a.group.from.getTime() - b.group.from.getTime());
};

const laneOf = (row: { group: WorkGroup }) => row.group.laneKey ?? laneKeyOf(row.group.blocks);

const sharesUnattendedRow = (row: BoundGroup, piece: BoundGroup) =>
  row.group.attended === false &&
  row.group.issueKey === piece.group.issueKey &&
  row.group.standInId === piece.group.standInId &&
  laneOf(row) === laneOf(piece) &&
  windowsOverlap(row, piece);

/** The work inside a break must stay off every attended row of its lane, or the review folds and trims it into a booking. */
const placeInBreaks = (options: {
  rows: readonly (BoundGroup & { afterBreak?: true; idFrom?: Date })[];
  cut: readonly (readonly BreakPiece[])[];
  placed: ReadonlyMap<BreakPiece, BoundGroup>;
  round?: Partial<RoundOptions>;
}): (BoundGroup & { afterBreak?: true; idFrom?: Date })[] => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const rows = [...options.rows];

  for (const pieces of options.cut) {
    pieces.forEach((piece, index) => {
      if (!piece.inBreak) return;

      const placedAt = (at: number) => {
        const neighbour = pieces[at];

        return neighbour && options.placed.get(neighbour);
      };
      const from = placedAt(index - 1)?.to.getTime() ?? floorToGrid(piece.group.from.getTime(), incrementMs);
      const to =
        placedAt(index + 1)?.from.getTime() ??
        Math.max(nearestOnGrid(piece.group.to.getTime(), incrementMs), from + incrementMs);
      const lane = laneOf(piece);
      const free = subtractWindows({
        windows: to > from ? [{ from: new Date(from), to: new Date(to) }] : [],
        without: rows.filter((row) => row.group.attended !== false && laneOf(row) === lane),
      });

      for (const window of free) {
        const blocks = clipBlocks({
          blocks: piece.group.blocks,
          windows: subtractWindows({ windows: [ALL_TIME], without: [window] }),
        });

        if (!blocks.length) continue;

        const row = {
          group: { ...piece.group, ...window, blocks, observedMs: Math.min(piece.group.observedMs, blocksMs(blocks)) },
          ...window,
          durationMs: windowsMs([window]),
        };
        const at = rows.findIndex((other) => sharesUnattendedRow(other, row));
        const host = rows[at];

        if (!host) {
          rows.push(row);
          continue;
        }

        const joined = joinGroups(host.group, row.group);

        rows[at] = { ...host, group: joined, from: joined.from, to: joined.to, durationMs: windowsMs([joined]) };
      }
    });
  }

  return rows;
};

/** The unattended part must keep the row's start: its id, and the user's edits on it, hang on that start. */
const cutAtBreakEnd = <T extends BoundGroup>(options: {
  rows: readonly T[];
  breaks: readonly TimeWindow[];
  presence: readonly TimeWindow[];
  round?: Partial<RoundOptions>;
}): (T & { afterBreak?: true })[] => {
  if (!options.breaks.length || !options.rows.some((row) => row.group.attended === false)) return [...options.rows];

  const drawn = breaksBetweenRows({
    breaks: options.breaks.map((window) => ({ from: window.from, to: window.to, locked: false })),
    rows: options.rows,
    round: options.round,
    presence: options.presence,
  });

  return options.rows.flatMap((row) => {
    if (row.group.attended !== false) return [row];

    const from = row.from.getTime();
    const sitsIn = drawn.find((window) => window.from.getTime() <= from && from < window.to.getTime());

    if (!sitsIn || sitsIn.to.getTime() >= row.to.getTime()) return [row];

    const cut = sitsIn.to;
    const inside = clipBlocks({ blocks: row.group.blocks, windows: [{ from: cut, to: ALL_TIME.to }] });
    const after = clipBlocks({ blocks: row.group.blocks, windows: [{ from: ALL_TIME.from, to: cut }] });

    if (!inside.length || !after.length) return [row];

    const afterMs = Math.min(row.group.observedMs, windowsMs(mergeWindows(after)));

    return [
      {
        ...row,
        to: cut,
        durationMs: cut.getTime() - from,
        group: { ...row.group, to: cut, blocks: inside, observedMs: row.group.observedMs - afterMs },
      },
      {
        ...row,
        afterBreak: true as const,
        from: cut,
        durationMs: row.to.getTime() - cut.getTime(),
        group: { ...row.group, from: cut, blocks: after, observedMs: afterMs, attended: true },
      },
    ];
  });
};

/**
 * Stable across re-runs of a day, so an already-synced row is recognised rather than duplicated.
 *
 * The group it reads has already been snapped, and it has to stay that way: a raw start moves with
 * every neighbour that grows, so on a live day the id would change on every rebuild and the screen
 * would destroy and redraw a band that never moved.
 */
const proposalId = (group: AttributedGroup) => `${group.issueKey}@${group.from.toISOString()}`;

/**
 * Hands out the ids `baseOf` builds, and gives a second row with the same id the piece of its agent session
 * as a suffix: two parallel sessions of one checkout can snap to one start.
 */
const rowIds = <T extends WorkGroup>(baseOf: (group: T) => string) => {
  const used = new Set<string>();

  return {
    next: (group: T) => {
      const base = baseOf(group);
      let id = used.has(base) ? `${base}+${dominantContext(group.blocks)?.piece ?? 'row'}` : base;

      for (let n = 2; used.has(id); n++) id = `${base}+${n}`;

      used.add(id);

      return id;
    },
  };
};

/**
 * The id the row of an unnamed band carries. Stable the same way {@link proposalId} is, by the stream
 * behind the band rather than by an issue: two streams can hold the same minute, so the instant alone
 * would give a concurrent day two rows with one id.
 *
 * The branch is deliberately left out, although a block carries one. Every unnamed band of a checkout
 * is one band whatever branch each block was on, so a branch here names whichever one the band happens
 * to hold the most of - and it moves to another while the day is still running. The user's own edits
 * hang on this id, so an id that moves loses them.
 *
 * Exported because a review answers a band through its row, and `reviewDay` needs the group that row
 * came from to stop counting it as time nothing named.
 */
export const unnamedRowId = (group: WorkGroup) => group.rowId ?? unnamedBaseId(group);

const unnamedBaseId = (group: WorkGroup) => {
  const context = dominantContext(group.blocks);

  return `unnamed:${context ? streamKey(context) : ''}@${group.from.toISOString()}`;
};

const activeUntilOf = (options: { group: WorkGroup; blocks: readonly ActivityBlock[] }) => {
  const own = dominantContext(options.group.blocks);

  if (!own?.piece) return {};

  const from = options.group.from.getTime();
  const to = options.group.to.getTime();
  let last = 0;

  for (const block of options.blocks) {
    const { context } = block;

    if (context.piece !== own.piece || context.repoPath !== own.repoPath) continue;
    if (block.from.getTime() > to || block.to.getTime() < from) continue;

    last = Math.max(last, block.to.getTime());
  }

  return last ? { activeUntil: new Date(last) } : {};
};

/**
 * Turns merged groups into reviewable rows: booked in whole increments, described from their own
 * evidence, and carrying that evidence and their confidence so a reviewer can see why each row
 * exists.
 *
 * A group with no issue becomes a row too, in `unnamed`, and books the same way. A band reads the
 * length it would be written for from the moment it is drawn, so naming it never changes its size.
 * The raw time each row observed stays on `observedMs`, and the raw clock times it ran on are gone
 * once `snapRowBounds` has put them on an increment boundary.
 */
export const propose = (options: {
  groups: WorkGroup[];
  config?: GitFlowConfig;
  round?: Partial<RoundOptions>;
  describe?: Partial<DescribeOptions>;
  /**
   * Every block of the day before the sessions sharing an instant were cut apart. A row with a piece
   * reads from it how long its own session went on, which the cut rows no longer say.
   */
  sessionBlocks?: readonly ActivityBlock[];
  /**
   * The breaks the day held, from `breakWindows`. A row nobody attended ends with the break it starts in,
   * and an attended row is cut where one is drawn over it.
   */
  breaks?: readonly TimeWindow[];
  /** The stretches no break may cover: a call the user attended and a run they timed — see ADR 0030. */
  presence?: readonly TimeWindow[];
}): ProposeResult => {
  const sessionBlocks = options.sessionBlocks ?? [];
  const presence = options.presence ?? [];
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const away = subtractWindows({ windows: options.breaks ?? [], without: presence });
  const drawn = (options.breaks ?? [])
    .filter((window) =>
      subtractWindows({ windows: [window], without: presence }).some((part) =>
        options.groups.some((group) => windowsOverlap(part, group)),
      ),
    )
    .flatMap((window) => drawnBreak({ window, presence, round: options.round }));
  const cut = options.groups.map((group) => cutOutBreaks({ group, away, drawn, incrementMs }));
  const parts = cut.flat().filter((piece) => !piece.inBreak);
  const snapped = snapRowBounds({
    rows: parts.map(({ group, afterBreak, idFrom }) => ({
      group,
      ...(afterBreak ? { afterBreak } : {}),
      ...(idFrom ? { idFrom } : {}),
      from: group.from,
      to: group.to,
      durationMs: roundDurationUp(group.observedMs, options.round),
    })),
    options: options.round,
    observedMsOf: (row) => (row.group.laneKey === CALL_LANE_KEY ? row.group.observedMs : undefined),
  }).map((row) => ({
    ...row,
    group: { ...row.group, from: row.from, to: row.to },
    durationMs: row.to.getTime() - row.from.getTime(),
  }));
  const rows = placeInBreaks({
    rows: cutAtBreakEnd({
      rows: snapped,
      breaks: options.breaks ?? [],
      presence: options.presence ?? [],
      round: options.round,
    }),
    cut,
    placed: new Map(parts.flatMap((piece, index) => (snapped[index] ? [[piece, snapped[index]] as const] : []))),
    round: options.round,
  });
  const siblings = siblingBookingsOf(
    rows.map((row) => ({
      row,
      from: row.from,
      to: row.to,
      observedMs: row.group.observedMs,
      laneKey: row.group.laneKey ?? laneKeyOf(row.group.blocks),
      issueKey: isAttributedRow(row) ? row.group.issueKey : undefined,
      standInId: row.group.standInId,
    })),
    { round: options.round },
  );
  const bookedByRow = new Map([...siblings].map(([sibling, bookedMs]) => [sibling.row, bookedMs]));
  const booked = rows.map((row) => {
    const bookedMs = bookedByRow.get(row);
    const shared = bookedMs !== undefined;

    return {
      ...row,
      durationMs: bookedMs ?? row.durationMs,
      stretches: shared ? mergeWindows(row.group.blocks) : stretchesOf(row.group.blocks),
    };
  });
  const attributed = booked.filter(isAttributedRow);
  const unnamedIds = rowIds(unnamedBaseId);
  const idGroupOf = <T extends WorkGroup>(row: { group: T; idFrom?: Date }): T =>
    row.idFrom ? { ...row.group, from: row.idFrom } : row.group;
  const unnamed = booked
    .filter((row) => !isAttributedRow(row))
    .map((row) => ({ ...row, group: { ...row.group, rowId: unnamedIds.next(idGroupOf(row)) } }));
  const unattributed = unnamed.filter((row) => !row.group.standInId);
  const ids = rowIds(proposalId);

  return {
    proposals: attributed.map(({ group, from, to, durationMs, stretches, afterBreak, idFrom }) => ({
      id: ids.next(idGroupOf({ group, idFrom })),
      unnamedId: unnamedBaseId(idGroupOf({ group, idFrom })),
      issueKey: group.issueKey,
      storyKey: group.storyKey,
      ...(group.disputedIssueKey ? { disputedIssueKey: group.disputedIssueKey } : {}),
      ...(group.disputedStandInId ? { disputedStandInId: group.disputedStandInId } : {}),
      ...(afterBreak ? { afterBreak } : {}),
      from,
      to,
      durationMs,
      observedMs: group.observedMs,
      stretches,
      ...activeUntilOf({ group, blocks: sessionBlocks }),
      laneKey: group.laneKey ?? laneKeyOf(group.blocks),
      description: describeWork({ group, config: options.config, options: options.describe }),
      confidence: group.confidence,
      evidence: group.evidence,
      state: 'suggested',
    })),
    unattributed: unattributed.map((row) => row.group),
    unnamed: unnamed.map(({ group, from, to, durationMs, stretches, afterBreak }) => ({
      id: unnamedRowId(group),
      ...(group.standInId ? { standInId: group.standInId } : {}),
      ...(group.attended === false ? { unattended: true } : {}),
      ...(group.attended === false && group.issueKey ? { withheldIssueKey: group.issueKey } : {}),
      ...(group.bookable === false ? { excluded: true } : {}),
      ...(afterBreak ? { afterBreak } : {}),
      ...(group.disputedIssueKey ? { disputedIssueKey: group.disputedIssueKey } : {}),
      ...(group.disputedStandInId ? { disputedStandInId: group.disputedStandInId } : {}),
      from,
      to,
      durationMs,
      observedMs: group.observedMs,
      stretches,
      ...activeUntilOf({ group, blocks: sessionBlocks }),
      laneKey: group.laneKey ?? laneKeyOf(group.blocks),
      description: describeWork({ group, config: options.config, options: options.describe }),
      confidence: group.confidence,
      evidence: group.evidence,
      state: 'suggested',
    })),
  };
};
