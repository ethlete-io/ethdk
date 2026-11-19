import { repoRootOf } from '../model/context';
import { streamKeyRepoPath } from '../model/block';
import { AgentSessionEvent, CollectedEvent } from '../model/event';
import { fileAgentEventsByWork } from './worked-in';

/** One subagent's run inside a row: its first and its last sample there. It books nothing of its own. */
export type RowSubagent = { agentId: string; task: string | undefined; from: Date; to: Date };

/** The run time from which a subagent is drawn as its own stripe rather than as a tick on its session. */
export const SUBAGENT_STRIPE_MIN_MS = 15 * 60_000;

/** Whether a subagent is drawn as its own stripe beside its session. See ADR 0052. */
export const isSubagentStripe = (subagent: Pick<RowSubagent, 'from' | 'to'>) =>
  subagent.to.getTime() - subagent.from.getTime() >= SUBAGENT_STRIPE_MIN_MS;

/** The agent session samples of the day, each filed under the checkout its work touched. */
export const agentSamplesOf = (options: {
  events: readonly CollectedEvent[];
  roots: readonly string[];
}): AgentSessionEvent[] =>
  fileAgentEventsByWork(options).filter((event): event is AgentSessionEvent => event.kind === 'agent-session');

/**
 * The subagents of the sessions a row's checkout ran between `from` (included) and `to` (excluded),
 * oldest first. A session counts when one of its own samples falls in the row; `sessions` narrows that
 * to the sessions of the piece a row of parallel siblings is drawn for. Pass the samples from {@link agentSamplesOf}.
 */
export const subagentsWithin = (options: {
  samples: readonly AgentSessionEvent[];
  roots: readonly string[];
  laneKey: string | undefined;
  from: Date;
  to: Date;
  sessions?: readonly string[];
}): RowSubagent[] => {
  const lanePath = options.laneKey ? streamKeyRepoPath(options.laneKey) : undefined;

  if (!lanePath) return [];

  const from = options.from.getTime();
  const to = options.to.getTime();
  const within = options.samples.filter((sample) => sample.at.getTime() >= from && sample.at.getTime() < to);
  const sessions = new Set(
    within
      .filter(
        (sample) =>
          !sample.agentId &&
          (!options.sessions || options.sessions.includes(sample.sessionId)) &&
          repoRootOf({ path: sample.cwd, roots: options.roots }) === lanePath,
      )
      .map((sample) => sample.sessionId),
  );
  const found = new Map<string, RowSubagent>();

  for (const sample of within) {
    if (!sample.agentId || !sessions.has(sample.sessionId)) continue;

    const held = found.get(sample.agentId);

    if (!held) {
      found.set(sample.agentId, { agentId: sample.agentId, task: sample.agentTask, from: sample.at, to: sample.at });
      continue;
    }

    if (sample.at < held.from) held.from = sample.at;
    if (sample.at > held.to) held.to = sample.at;
    held.task ??= sample.agentTask;
  }

  return [...found.values()].sort((a, b) => a.from.getTime() - b.from.getTime());
};
