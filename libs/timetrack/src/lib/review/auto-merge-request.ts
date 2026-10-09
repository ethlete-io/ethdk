import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { AUTO_MODE_CLIENT } from '../agent-api/action-classes';
import { AgentApproval } from '../agent-api/approval-queue';
import { UnnamedContext } from '../model/attribution';
import { CollectedEvent } from '../model/event';
import { CheckoutKeys } from '../model/peer-path';
import { StandIn } from '../model/stand-in';
import { TimeWindow } from '../model/time-window';
import { WorkFacts, contextWorkFacts, standInWorkFacts } from '../ticket/work-facts';
import { autoModeSubjectKey, autoModeTargetOf, leavesUnnamed } from './auto-mode';
import { AutoModeOutcome } from './model';

/**
 * What the day's events say about each subject auto mode may ask about, by `autoModeSubjectKey`: every
 * unnamed context, and every open stand-in over its bands of the day.
 */
export const autoModeWorkFacts = (options: {
  contexts: readonly UnnamedContext[];
  standIns: readonly (Pick<StandIn, 'id' | 'state'> & Partial<Pick<StandIn, 'openedFor'>>)[];
  bands: readonly ({ standInId?: string } & TimeWindow)[];
  events: readonly CollectedEvent[];
  config: GitFlowConfig;
  repoKeys?: CheckoutKeys;
}): ReadonlyMap<string, WorkFacts> => {
  const { events, config, repoKeys } = options;
  const facts = new Map<string, WorkFacts>();

  for (const context of options.contexts) {
    facts.set(
      autoModeSubjectKey({ kind: 'context', contextId: context.id }),
      contextWorkFacts({ context, events, config, repoKeys }),
    );
  }

  for (const standIn of options.standIns) {
    if (standIn.state !== 'open') continue;

    facts.set(
      autoModeSubjectKey({ kind: 'stand-in', standInId: standIn.id }),
      standInWorkFacts({ standIn, bands: options.bands, events, config, repoKeys }),
    );
  }

  return facts;
};

/**
 * The answer auto mode gives itself for a stretch that changed nothing beside a merge request that
 * names an issue: that issue, with no model asked and no ticket drafted. `null` for any other stretch.
 */
export const autoModeMergeRequestOutcome = (facts: WorkFacts | undefined): AutoModeOutcome | null => {
  const mergeRequest = facts?.mergeRequest;

  if (!mergeRequest?.issueKey) return null;

  const title = mergeRequest.title ? ` (${mergeRequest.title})` : '';

  return {
    kind: 'match',
    issueKey: mergeRequest.issueKey,
    reason: `You ${mergeRequest.action} ${mergeRequest.reference}${title} that day, and the agent sessions here wrote no file.`,
  };
};

/**
 * Expires each waiting auto mode create and apply of `day` whose subject auto mode now leaves unnamed:
 * a stretch that changed nothing beside a merge request that names no issue. See {@link leavesUnnamed}.
 */
export const withUnnamedSubjectItemsExpired = (
  queue: readonly AgentApproval[],
  options: { day: string; workFacts: ReadonlyMap<string, WorkFacts> },
): AgentApproval[] =>
  queue.map((item) => {
    if (item.state !== 'queued' || item.client !== AUTO_MODE_CLIENT || item.day !== options.day) return item;
    if (item.request.op !== 'jira.create' && item.request.op !== 'autoMode.apply') return item;

    const target = autoModeTargetOf(item.target);

    if (!target || target.day !== options.day) return item;

    return leavesUnnamed(options.workFacts.get(autoModeSubjectKey(target.subject)))
      ? { ...item, state: 'expired' }
      : item;
  });
