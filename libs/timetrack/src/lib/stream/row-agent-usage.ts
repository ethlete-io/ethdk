import { repoRootOf } from '../model/context';
import { streamKeyRepoPath } from '../model/block';
import { AgentUsageEvent, CollectedEvent, TIMETRACK_PROVIDER, TokenUsage } from '../model/event';
import { fileAgentEventsByWork } from './worked-in';

/** The turns of the user's coding agents, each filed under the checkout its work touched. */
export const agentTurnsOf = (options: {
  events: readonly CollectedEvent[];
  roots: readonly string[];
}): AgentUsageEvent[] =>
  fileAgentEventsByWork(options).filter(
    (event): event is AgentUsageEvent => event.kind === 'agent-usage' && event.provider !== TIMETRACK_PROVIDER,
  );

/**
 * The tokens the agents spent in one checkout between `from` (included) and `to` (excluded), or nothing
 * when the lane is no checkout or no turn falls in the range. Pass the turns from {@link agentTurnsOf}.
 */
export const agentUsageWithin = (options: {
  turns: readonly AgentUsageEvent[];
  roots: readonly string[];
  laneKey: string | undefined;
  from: Date;
  to: Date;
}): (TokenUsage & { turns: number }) | undefined => {
  const lanePath = options.laneKey ? streamKeyRepoPath(options.laneKey) : undefined;

  if (!lanePath) return undefined;

  const total = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0, turns: 0 };

  for (const turn of options.turns) {
    const at = turn.at.getTime();

    if (at < options.from.getTime() || at >= options.to.getTime()) continue;
    if (!turn.cwd || repoRootOf({ path: turn.cwd, roots: options.roots }) !== lanePath) continue;

    total.input += turn.usage.input;
    total.output += turn.usage.output;
    total.cacheWrite += turn.usage.cacheWrite;
    total.cacheRead += turn.usage.cacheRead;
    total.thinking += turn.usage.thinking;
    total.turns++;
  }

  return total.turns ? total : undefined;
};
