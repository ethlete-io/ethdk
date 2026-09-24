import { AgentPromptEvent, AgentSessionEvent, AgentUsageEvent, CollectedEvent } from '../model/event';
import { repoRootOf } from '../model/context';

const isAgentRecord = (event: CollectedEvent): event is AgentSessionEvent | AgentUsageEvent | AgentPromptEvent =>
  event.kind === 'agent-session' || event.kind === 'agent-usage' || event.kind === 'agent-prompt';

/**
 * The instant each session was first sampled by a parser that reads where the work happened.
 *
 * A log read again from the top stores its samples beside the ones an older read stored, and the two
 * reads thinned the log at different instants. From this instant on the session's older samples are
 * that older read, still naming only the directory the session started in.
 */
const placedFrom = (events: readonly CollectedEvent[]) => {
  const found = new Map<string, number>();

  for (const event of events) {
    if (event.kind !== 'agent-session' || !event.workedIn) continue;

    const seen = found.get(event.sessionId);

    if (seen === undefined || event.at.getTime() < seen) found.set(event.sessionId, event.at.getTime());
  }

  return found;
};

/**
 * Every agent event filed under the checkout its work touched, where that is another known checkout
 * than the one it was started in.
 *
 * A re-filed event drops the branch the agent reported: that is the branch of the directory it was
 * started in, so the day reads the other checkout's branch from that checkout's own evidence instead.
 */
export const fileAgentEventsByWork = (options: {
  events: readonly CollectedEvent[];
  roots: readonly string[];
}): CollectedEvent[] => {
  const known = new Set(options.roots);

  for (const event of options.events) {
    if (event.kind === 'git-commit' || event.kind === 'git-checkout') known.add(event.repoPath);
    if (event.kind === 'editor-heartbeat' && event.repoPath) known.add(event.repoPath);
  }

  const checkouts = [...known];
  const placed = placedFrom(options.events);

  return options.events.flatMap((event): CollectedEvent[] => {
    if (!isAgentRecord(event)) return [event];

    const workedIn = event.workedIn;

    if (!workedIn) {
      const from = event.kind === 'agent-session' ? placed.get(event.sessionId) : undefined;

      return from !== undefined && event.at.getTime() >= from ? [] : [event];
    }

    const touched = repoRootOf({ path: workedIn, roots: checkouts });

    if (!known.has(touched) || touched === repoRootOf({ path: event.cwd, roots: checkouts })) return [event];

    return [{ ...event, cwd: touched, gitBranch: undefined }];
  });
};
