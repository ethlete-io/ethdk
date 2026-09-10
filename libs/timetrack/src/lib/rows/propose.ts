import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { WorklogProposal } from '../model/proposal';
import { DescribeOptions, describeWork } from './describe';
import { WorkGroup } from './merge';
import { RoundOptions, roundDurations } from './round';

export type ProposeResult = {
  proposals: WorklogProposal[];
  /** Groups no rule could attribute — the reasoning provider's input, and never synced. */
  unattributed: WorkGroup[];
};

type AttributedGroup = WorkGroup & { issueKey: string };

const isAttributed = (group: WorkGroup): group is AttributedGroup => !!group.issueKey;

/** Stable across re-runs of a day, so an already-synced row is recognised rather than duplicated. */
const proposalId = (group: AttributedGroup) => `${group.issueKey}@${group.from.toISOString()}`;

/**
 * Turns merged groups into reviewable worklogs: rounded as a day so the total survives, described
 * from their own evidence, and carrying that evidence and their confidence so a reviewer can see why
 * each row exists. Groups without an issue come back untouched rather than being forced into a row.
 */
export const propose = (options: {
  groups: WorkGroup[];
  config?: GitFlowConfig;
  round?: Partial<RoundOptions>;
  describe?: Partial<DescribeOptions>;
}): ProposeResult => {
  const attributed = options.groups.filter(isAttributed);
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
      description: describeWork({ group, config: options.config, options: options.describe }),
      confidence: group.confidence,
      evidence: group.evidence,
      state: 'suggested',
    })),
    unattributed: options.groups.filter((group) => !isAttributed(group)),
  };
};
