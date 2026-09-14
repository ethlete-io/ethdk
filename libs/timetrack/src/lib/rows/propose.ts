import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { contextKey } from '../model/block';
import { WorklogProposal } from '../model/proposal';
import { DescribeOptions, describeWork } from './describe';
import { laneKeyOf } from './lane';
import { WorkGroup } from './merge';
import { RoundOptions, roundDurationUp } from './round';
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
 */
const isAttributed = (group: WorkGroup): group is AttributedGroup => !!group.issueKey && group.attended !== false;

/** A group with the bounds and the booked time its row will carry. */
type BoundGroup = { group: WorkGroup; from: Date; to: Date; durationMs: number };

const isAttributedRow = (row: BoundGroup): row is BoundGroup & { group: AttributedGroup } => isAttributed(row.group);

/** Stable across re-runs of a day, so an already-synced row is recognised rather than duplicated. */
const proposalId = (group: AttributedGroup) => `${group.issueKey}@${group.from.toISOString()}`;

/**
 * The id the row of an unnamed band carries. Stable the same way {@link proposalId} is, by the context
 * behind the band rather than by an issue: two contexts can hold the same minute, so the instant alone
 * would give a concurrent day two rows with one id.
 *
 * Exported because a review answers a band through its row, and `reviewDay` needs the group that row
 * came from to stop counting it as time nothing named.
 */
export const unnamedRowId = (group: WorkGroup) => {
  const context = group.blocks[0]?.context;

  return `unnamed:${context ? contextKey(context) : ''}@${group.from.toISOString()}`;
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
}): ProposeResult => {
  const rows = snapRowBounds({
    rows: options.groups.map((group) => ({
      group,
      from: group.from,
      to: group.to,
      durationMs: roundDurationUp(group.observedMs, options.round),
    })),
    options: options.round,
  }).map((row) => ({ ...row, durationMs: row.to.getTime() - row.from.getTime() }));
  const attributed = rows.filter(isAttributedRow);
  const unnamed = rows.filter((row) => !isAttributedRow(row));
  const unattributed = unnamed.filter((row) => !row.group.standInId);

  return {
    proposals: attributed.map(({ group, from, to, durationMs }) => ({
      id: proposalId(group),
      issueKey: group.issueKey,
      storyKey: group.storyKey,
      from,
      to,
      durationMs,
      observedMs: group.observedMs,
      stretches: stretchesOf(group.blocks),
      laneKey: group.laneKey ?? laneKeyOf(group.blocks),
      description: describeWork({ group, config: options.config, options: options.describe }),
      confidence: group.confidence,
      evidence: group.evidence,
      state: 'suggested',
    })),
    unattributed: unattributed.map((row) => row.group),
    unnamed: unnamed.map(({ group, from, to, durationMs }) => ({
      id: unnamedRowId(group),
      ...(group.standInId ? { standInId: group.standInId } : {}),
      ...(group.attended === false ? { unattended: true } : {}),
      ...(group.bookable === false ? { excluded: true } : {}),
      from,
      to,
      durationMs,
      observedMs: group.observedMs,
      stretches: stretchesOf(group.blocks),
      laneKey: group.laneKey ?? laneKeyOf(group.blocks),
      description: describeWork({ group, config: options.config, options: options.describe }),
      confidence: group.confidence,
      evidence: group.evidence,
      state: 'suggested',
    })),
  };
};
