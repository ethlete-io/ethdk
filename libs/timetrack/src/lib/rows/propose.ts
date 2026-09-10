import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { contextKey } from '../model/block';
import { WorklogProposal } from '../model/proposal';
import { DescribeOptions, describeWork } from './describe';
import { laneKeyOf } from './lane';
import { WorkGroup } from './merge';
import { RoundOptions, roundDurations } from './round';
import { stretchesOf } from './stretches';

/**
 * A band of work the day could not name. It is drawn, split and merged like any other row, and it
 * never reaches Tempo — naming it is what turns it into a proposal.
 */
export type UnnamedProposal = Omit<WorklogProposal, 'issueKey' | 'storyKey'>;

export type ProposeResult = {
  proposals: WorklogProposal[];
  /**
   * Groups no rule could attribute — the reasoning provider's input, and never synced. The same work
   * as `unnamed`, kept as groups because `unnamedContexts` folds them by the context behind them.
   */
  unattributed: WorkGroup[];
  /** The same work as rows, for the day screen to draw. */
  unnamed: UnnamedProposal[];
};

type AttributedGroup = WorkGroup & { issueKey: string };

const isAttributed = (group: WorkGroup): group is AttributedGroup => !!group.issueKey;

/** Stable across re-runs of a day, so an already-synced row is recognised rather than duplicated. */
const proposalId = (group: AttributedGroup) => `${group.issueKey}@${group.from.toISOString()}`;

/**
 * Stable the same way, by the context behind the band rather than by an issue. Two contexts can hold
 * the same minute, so the instant alone would give a concurrent day two rows with one id.
 */
const unnamedId = (group: WorkGroup) => {
  const context = group.blocks[0]?.context;

  return `unnamed:${context ? contextKey(context) : ''}@${group.from.toISOString()}`;
};

/**
 * Turns merged groups into reviewable rows: rounded as a day so the total survives, described from
 * their own evidence, and carrying that evidence and their confidence so a reviewer can see why each
 * row exists.
 *
 * A group with no issue becomes a row too, in `unnamed`, and carries its observed time. Rounding
 * spreads a day's increments over its rows, so rounding a band that is not a worklog yet is what
 * makes a band holding two hours read `15m`. `reviewDay` rounds it once naming it makes it a
 * proposal.
 */
export const propose = (options: {
  groups: WorkGroup[];
  config?: GitFlowConfig;
  round?: Partial<RoundOptions>;
  describe?: Partial<DescribeOptions>;
}): ProposeResult => {
  const attributed = options.groups.filter(isAttributed);
  const unattributed = options.groups.filter((group) => !isAttributed(group));
  const rounded = roundDurations({
    durationsMs: attributed.map((group) => group.observedMs),
    options: options.round,
  });
  return {
    proposals: attributed.map((group, index) => ({
      id: proposalId(group),
      issueKey: group.issueKey,
      storyKey: group.storyKey,
      from: group.from,
      to: group.to,
      durationMs: rounded[index] ?? group.observedMs,
      observedMs: group.observedMs,
      stretches: stretchesOf(group.blocks),
      laneKey: group.laneKey ?? laneKeyOf(group.blocks),
      description: describeWork({ group, config: options.config, options: options.describe }),
      confidence: group.confidence,
      evidence: group.evidence,
      state: 'suggested',
    })),
    unattributed,
    unnamed: unattributed.map((group) => ({
      id: unnamedId(group),
      from: group.from,
      to: group.to,
      durationMs: group.observedMs,
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
