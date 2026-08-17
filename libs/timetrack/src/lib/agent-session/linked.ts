import { TimetrackProjectLink, matchProjectLink } from '../correlate/project-link';
import { AgentSessionEvent } from '../model/event';

/** One checkout whose sessions were dropped, so a repository nobody linked stays visible. */
export type UnlinkedAgentSessions = {
  cwd: string;
  events: number;
  lastAt: Date;
};

export type LinkedAgentSessions = {
  kept: AgentSessionEvent[];
  /** Dropped for want of a link, by checkout, most samples first. A private link is not reported here. */
  unlinked: UnlinkedAgentSessions[];
};

/**
 * Keeps only the sessions run inside a checkout a link files into a Jira project.
 *
 * Tempo takes a worklog against an issue, so a session in a checkout no project covers is time nothing
 * can bill — and a developer's machine holds far more of those than it holds client repositories. A
 * private link drops too: private time is not billable either, and the day still reports the stretch
 * from the window focus covering it.
 *
 * What is dropped is reported by checkout rather than swallowed. A repository the user has not linked
 * yet looks exactly like one they never will, and only they can tell the two apart.
 */
export const keepLinkedAgentSessions = (options: {
  events: readonly AgentSessionEvent[];
  links: readonly TimetrackProjectLink[];
}): LinkedAgentSessions => {
  const kept: AgentSessionEvent[] = [];
  const unlinked = new Map<string, UnlinkedAgentSessions>();

  for (const event of options.events) {
    const target = matchProjectLink({ context: { repoPath: event.cwd }, links: options.links })?.target;

    if (target?.kind === 'project') {
      kept.push(event);
      continue;
    }

    if (target) continue;

    const seen = unlinked.get(event.cwd);

    if (!seen) {
      unlinked.set(event.cwd, { cwd: event.cwd, events: 1, lastAt: event.at });
      continue;
    }

    seen.events += 1;
    if (event.at > seen.lastAt) seen.lastAt = event.at;
  }

  return {
    kept,
    unlinked: [...unlinked.values()].sort((a, b) => b.events - a.events || a.cwd.localeCompare(b.cwd)),
  };
};
