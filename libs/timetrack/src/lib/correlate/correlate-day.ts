import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { AttributeOptions, attribute } from './attribute';
import { DescribeOptions } from './describe';
import { DEFAULT_MERGE_OPTIONS, MergeOptions, WorkGroup, mergeBlocks } from './merge';
import { CheckDayOptions, DayCheck, RoundOptions, checkDay } from './round';
import { propose } from './propose';
import { SessionizeOptions, sessionize } from './sessionize';

export type CorrelateDayOptions = {
  config?: GitFlowConfig;
  resolveBase?: AttributeOptions['resolveBase'];
  activity?: AttributeOptions['activity'];
  patterns?: AttributeOptions['patterns'];
  sessionize?: Partial<SessionizeOptions>;
  merge?: Partial<MergeOptions>;
  round?: Partial<RoundOptions>;
  describe?: Partial<DescribeOptions>;
  check?: CheckDayOptions;
};

export type DayCorrelation = {
  /** The sessionized day, kept for the timeline half of the review UI. */
  blocks: ActivityBlock[];
  proposals: WorklogProposal[];
  unattributed: WorkGroup[];
  check: DayCheck;
};

/**
 * Runs a window of collected events through the whole deterministic pipeline — sessionize, attribute,
 * merge, round, describe, explain — and returns what a day review needs. Pure: no network, no clock,
 * no filesystem, so the same events always produce the same day.
 */
export const correlateDay = (options: { events: CollectedEvent[] } & CorrelateDayOptions): DayCorrelation => {
  const blocks = sessionize({ events: options.events, options: options.sessionize });
  const attributed = blocks.map((block) =>
    attribute({
      block,
      config: options.config,
      resolveBase: options.resolveBase,
      activity: options.activity,
      patterns: options.patterns,
    }),
  );
  const groups = mergeBlocks({ blocks: attributed, options: options.merge });
  const { proposals, unattributed } = propose({
    groups,
    config: options.config,
    round: options.round,
    describe: options.describe,
  });

  return {
    blocks,
    proposals,
    unattributed,
    check: checkDay({
      proposals,
      unattributed,
      options: {
        maxRowsPerDay: options.merge?.maxRowsPerDay ?? DEFAULT_MERGE_OPTIONS.maxRowsPerDay,
        ...options.check,
      },
    }),
  };
};
